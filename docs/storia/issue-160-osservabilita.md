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
