# #160 — osservabilità: l'allarme esterno sul job e gli errori in produzione

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Da dove arriva (2026-11-23)

Aperta il 2026-11-07 dal report sullo stato del progetto. Due silenzi:

- **il job notturno fermo si vede solo aprendo `/impostazioni`** (#47): se
  nessuno le apre, il guasto resta invisibile. È già successo, cinque
  settimane fra luglio e agosto 2026;
- **`genericError()` scrive nei log di Vercel** (105 fra `console.error` e
  `console.warn` in `app/`, `components/`, `lib/`), che nessuno legge finché un
  utente non si lamenta, e che il piano gratuito tiene poche ore.

Divisa in due PR, una per silenzio: prima l'allarme sul job (il guasto che è
già successo davvero), poi la raccolta degli errori.

### Le decisioni (con Jomar, 2026-11-23)

- **Il job lo sorveglia un servizio esterno a «uomo morto»** (healthchecks.io,
  in UE), non un'email spedita da noi. Un Vercel Cron alle 06:00 UTC chiama
  `/api/cron/salute-job`, che manda `ok` o `fail`; il servizio scrive a Jomar
  quando riceve `fail` **e quando non riceve niente** entro l'orario atteso.
  Perché:
  - la #47 aveva fissato che chi sorveglia non deve guastarsi insieme al job:
    un secondo pg_cron no, perché se pg_cron si ferma si ferma anche lui. Il
    cron di Vercel sta fuori da Supabase;
  - ma anche il cron di Vercel può smettere di partire, perdere una variabile,
    rompersi in un deploy. Con un ping a «uomo morto» il silenzio stesso è
    l'allarme: anche chi sorveglia è sorvegliato;
  - Seichi non ha ancora un SMTP (#40): l'email la spedisce il servizio.
- **Il cron legge come `anon`**, con la chiave pubblicabile, e la migration
  `20261124` gli concede la sola `daily_job_health()`. È il primo e unico
  privilegio di `anon` in `public` dalla #154. Scartata la chiave segreta di
  Supabase nell'ambiente di Vercel, dove oggi non c'è: scavalca la RLS su
  tutto, per leggere cinque fatti globali che non contengono dati di nessuno.
  Scartato anche il database che spinge da sé il ping con `pg_net` a fine
  `run_daily_jobs()`: un'estensione nuova, e un verdetto diverso da quello
  dell'app.
- **Lo stesso verdetto dell'app.** `judgeDailyJob()` (`lib/job-health.ts`,
  funzione pura) è ciò che `/impostazioni` e la route pronunciano: se l'app
  dicesse «tutto bene» e l'email «fermo», una delle due sarebbe falsa. Ne
  segue anche la soglia di 36 ore: un giro mancato alle 03:00 non basta, e il
  controllo delle 06:00 lo segnala il giorno dopo. Lo stesso margine che
  l'app si dà per «un singolo ritardo non è un guasto».
- **Errori: Sentry in UE, senza SDK**, con il contenuto scelto per elenco
  (seconda PR).
- **Fuori**: Speed Insights (una dipendenza in più, e con un utente le misure
  dicono poco). L'informativa (#135) non esiste ancora: i due nuovi
  destinatari dei dati vanno nel suo inventario, con un commento sulla #135.

### La PR 1 — l'allarme sul job

- `lib/job-health.ts`: `judgeDailyJob()` (spostata da `lib/jobs.ts`, identica,
  ora con `overdue` e `watchingSince` esposti) e `pingFor()`, la frase per
  l'email.
- ⚠️ **Tre frasi per tre cause** (lezione 8): «passi falliti» manda a
  `job_runs.details`; «nessun giro riuscito da N ore» manda a `cron.job` e
  `cron.job_run_details`; «stato non leggibile» dice che è chi sorveglia a non
  vedere, non che il job sia fermo.
- `lib/jobs.ts`: `readDailyJobHealth(client)` riceve il client, perché le due
  voci non hanno la stessa identità: le pagine leggono come l'utente, il cron
  come `anon`. Una lettura fallita è `{ reason }`, mai un verdetto.
- `app/api/cron/salute-job/route.ts`:
  - ⚠️ **senza `CRON_SECRET` rifiuta tutto**: il confronto ingenuo con
    `` `Bearer ${process.env.CRON_SECRET}` `` accetterebbe la stringa
    letterale «Bearer undefined». Il confronto è a tempo costante, sugli hash;
  - un guasto della route stessa (variabile mancante, ping che non parte)
    risponde con un errore e **senza ping**: il servizio, non sentendo
    niente, avvisa da sé;
  - un client Supabase senza sessione e con un timeout di 10 secondi.
- `proxy.ts`: `api/cron` esce dal matcher, ancorato come gli altri. ⚠️ Senza,
  il cron riceveva un 307 verso /welcome, che per lui è un «riuscito» senza
  aver controllato niente.
- `vercel.json`: `crons`, `0 6 * * *`. Sul piano Hobby un cron gira una volta
  al giorno, entro l'ora indicata (06:00-06:59): il periodo e la tolleranza
  del servizio sono tarati su questo.

- **Una regola saltata non manda l'email.** Il giro scrive `partial`, che dalla
  #47 non è un allarme: è un guasto dei dati di un utente, e lo avvisa una
  notifica (#173). Lo stesso verdetto dell'app vale anche qui; se un giorno
  servisse saperlo da amministratore, la sede è un'informazione nel ping `ok`,
  non un `fail`.

### Il collaudo

- **Vitest** (`lib/job-health.test.ts`, 11 casi): la soglia esclusiva, l'errore
  che conta senza invecchiare, il seme che fa partire il cronometro, «nessuna
  traccia» come caso peggiore, l'ambito, e le tre frasi. Controprova:
  `pingFor()` che risponde sempre `ok` fa cadere i due casi di `fail`.
- **pgTAP** (`anon.test.sql`): c2 esclude la funzione per nome, c10 prova che
  `anon` la esegue e riceve una riga ma non legge `job_runs`. ⚠️ Il primo
  rosso era della prova: c10 girava dopo c9, che **inietta** proprio un grant
  di `job_runs` ad `anon` per vedere se c1 se ne accorge. Ora c10 sta prima.
  Controprova: revocato il grant nel database locale, cadono le due prove di
  esecuzione di c10 e nessun'altra.
- **Playwright** (`salute-job.spec.ts`): un server HTTP locale fa la parte del
  servizio. Senza segreto → 401 e nessun ping; un giro riuscito → `ok`; un
  passo fallito → `/fail` con il nome del passo e senza `details`.
  Controprove, ciascuna con la sua build: tolto `api/cron` dal matcher, «senza
  segreto» riceve 307; `authorized()` che accetta tutto, riceve 200.
- **L'avviso nelle pagine, dopo lo spostamento** del verdetto: uno scenario
  temporaneo (non committato, perché tiene `job_runs` in errore per secondi
  mentre girano gli altri) ha visto «Automazioni ferme» in `/impostazioni` e il
  titolo in `/impostazioni/ricorrenti` con un passo `recurring` fallito, e
  nessun avviso con un giro sano.
- ⚠️ **La prima review era incompleta**: `git diff` non mostra i file non
  tracciati, cioè proprio la route, il modulo nuovo, la migration e lo
  scenario. Ripetuta leggendoli uno per uno.

### Il rilascio

1. `npx supabase db push --remote` (la migration PRIMA del codice: senza il
   grant il cron riceverebbe `42501` e manderebbe «stato non leggibile»).
2. Su healthchecks.io, un check con cron `0 6 * * *` UTC e una tolleranza che
   copra l'ora del piano Hobby; l'email di notifica è quella di Jomar.
3. Su Vercel, in *Production*: `CRON_SECRET` (una stringa casuale lunga) e
   `HEALTHCHECKS_PING_URL` (l'URL del check, `https://hc-ping.com/<uuid>`).
   Nessuna delle due è `NEXT_PUBLIC_`: le legge il server a ogni chiamata.
4. Il merge. Dopo il deploy, una chiamata a mano alla route con il segreto
   (`curl -H "Authorization: Bearer …"`): il check deve passare a «up». E la
   prova dell'email, con un `fail` mandato a mano all'URL del check.

Collaudato in produzione il 2026-11-23: con il segreto la route ha risposto
`{"ping":"ok","delivered":true}`, il check è passato a «up» con un ping da un
IP AWS di Dublino (la funzione in `dub1`) e il testo «Job giornaliero sano»;
un `fail` mandato a mano ha portato l'email «DOWN | Seichi — job notturno» in
Posta in arrivo.

### La PR 2 — gli errori a Sentry

- **Senza SDK.** `@sentry/nextjs` porta un albero di dipendenze, uno script
  d'installazione (`@sentry/cli`) e un wrapper della config da far convivere
  con Serwist e Turbopack. Qui sono quattro file e nessuna dipendenza:
  - `lib/error-report.ts`, puro: `scrub()`, `scrubPath()`, `parseStack()`,
    `fromConsoleArgs()`, `buildEvent()`, l'envelope;
  - `lib/error-sink.ts`, solo server: spedisce con `after()`, così l'utente
    non aspetta Sentry e la funzione resta viva fino alla fine dell'invio; un
    tetto di 30 eventi al minuto per istanza;
  - `app/api/errori/route.ts`: gli errori del browser passano dal server, così
    Sentry non vede l'IP di chi usa l'app e il DSN resta fuori dal bundle. Una
    route e non un'action, perché le action vanno in coda una alla volta e un
    rapporto davanti al «salva» lo rallenterebbe; solo con una sessione;
  - `instrumentation.ts`: `onRequestError`, ciò che Next cattura da sé.
- ⚠️ **L'evento si costruisce per elenco**: etichetta, codice, messaggio
  ripulito, rotta senza id né query string, pila, versione. Niente utente,
  niente IP, niente richiesta, niente breadcrumb. La ripulitura toglie email,
  UUID, token, numeri e i valori tra virgolette, e tiene gli identificatori
  tra virgolette (`"transactions_amount_check"`), perché Postgres quota allo
  stesso modo i valori e i nomi. Limite dichiarato: un testo libero SENZA
  virgolette dentro un messaggio scritto da noi non si riconosce; le `raise`
  dell'app interpolano solo un periodo o un'azione.
- ⚠️ **Tutti i `console.error`, non solo `genericError()`** (lezione 3): 105
  punti fra server e client, migrati con uno script a `logServerError()` e
  `logClientError()`, che prendono gli stessi argomenti e scrivono la stessa
  riga di log. Resta `console.warn` per le claims non valide (non è un
  guasto) e `console.error` dentro le funzioni stesse.
- **`error.tsx` riferisce solo gli errori nati nel browser** (senza
  `digest`): uno col `digest` l'ha già riferito il server da
  `onRequestError`, col messaggio vero.
- ⚠️ **Gli errori di rete del browser non partono.** Il primo giro verde
  dell'end-to-end portava anche due `[pagina] errore di render: TypeError:
  network error` sulla home: con tre scenari in parallelo, la home lasciata a
  metà caricamento interrompeva una richiesta e `error.tsx` lo riferiva.
  Diagnosticato prima di filtrarlo (non compare da solo, compare in parallelo,
  sempre sulla pagina abbandonata): dice la rete del dispositivo, non un
  difetto. Un server davvero giù lo dicono i suoi log e healthchecks.

### Il collaudo della PR 2

- **Vitest** (`lib/error-report.test.ts`, 21 casi): ciò che si toglie, ciò che
  resta, la rotta, la pila, l'evento per elenco, il DSN.
- **Playwright** (`errori.spec.ts`): un finto Sentry acceso dal
  `globalSetup` per tutta la suite scrive ogni envelope in un file.
  - Un guasto iniettato in un'action (un trigger con la forma dei messaggi di
    Postgres, più email e importo fuori dalle virgolette) arriva con il nome
    del vincolo e senza nota, importo, email né id.
  - Un'eccezione non gestita nel browser arriva ripulita, con la rotta senza
    `?q=`.
  - Senza sessione `/api/errori` non accetta niente.
- **Tre difetti veri trovati dall'end-to-end**, tutti del codice (il terzo
  leggendo i 15 eventi che gli altri scenari producono durante la suite: zero
  email, zero UUID, ma le date ridotte a `<n>-<n>-23T19:<n>`, ora `<data>`):
  - la regola dei numeri girava dopo le virgolette e smontava l'identificatore
    appena tenuto (`"e2e_guasto_160"` → `"e<n>e_guasto_<n>"`). Ora un solo
    passaggio, e un numero si toglie solo se sta da solo;
  - i nomi dei file nella pila passavano da `scrubPath()`, e ogni chunk di
    Turbopack (un hash con cifre) diventava `[id]`.
- **Dalla review della PR intera**: i componenti client riferivano anche gli
  errori delle action, che arrivano al browser col solo `digest` e il testo
  generico di Next, mentre il server li aveva già riferiti col messaggio vero.
  `error.tsx` aveva la regola, `logClientError()` e l'ascoltatore delle
  promise no: la migrazione a campione, di nuovo. Ora `cameFromServer()` vale
  per tutti e tre.
- Un rosso della prova, non dell'app: il trigger leggeva `auth.users` col
  ruolo dell'utente (`permission denied`); ora è `security definer`.
- **Controprove**: senza `queueReport()` in `logServerError()` cade solo lo
  scenario dell'action; senza `scrub()` in `buildEvent()` cadono i due
  scenari, sul primo dato personale.
- `onRequestError` provato una volta con una route temporanea che solleva
  (non committata): arriva come `next: route`, con la rotta come file e il
  messaggio ripulito.

### Il rilascio della PR 2

Nessuna migration. Senza `SENTRY_DSN` il codice non spedisce niente, quindi
l'ordine è libero:

1. Su sentry.io, un'organizzazione nella regione **EU** (si sceglie alla
   creazione e non si cambia) e un progetto «Seichi», piattaforma JavaScript.
   Nelle impostazioni del progetto: *Security & Privacy* → *Prevent Storing of
   IP Addresses* acceso, e un avviso via email al primo evento di un problema.
2. Su Vercel, in *Production*: `SENTRY_DSN` (Secret), dal progetto Sentry
   (*Client Keys (DSN)*). Poi un redeploy.
3. La prova, da loggato, nella console del browser su seichi-app.vercel.app:
   `fetch("/api/errori", { method: "POST", headers: { "content-type":
   "application/json" }, body: JSON.stringify({ scope: "prova", message:
   "prova di rilascio #160" }) })` → risponde 204, e in Sentry compare un
   problema `[prova]` con `source: client`. È la strada vera degli errori del
   browser, senza fabbricare un guasto.

