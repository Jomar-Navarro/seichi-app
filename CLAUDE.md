# Seichi (整地) — app personale di budgeting

<!--
Per chi mantiene questo file (i commenti HTML non entrano nel contesto di Claude Code).
CLAUDE.md entra INTERO in ogni sessione e dopo ogni compattazione: ogni riga costa a
ogni turno. Ci va solo ciò che serve in ogni sessione. Le regole di un'area stanno in
.claude/rules/<area>.md e si caricano quando si apre un file di quell'area; la storia
delle fasi, le decisioni e i collaudi stanno in docs/storia/. La versione integrale
precedente si legge nella cronologia di git, prima della PR della ristrutturazione.
-->

PWA di budgeting personale in Next.js 16 + Supabase, in produzione su
https://seichi-app.vercel.app. La sviluppa e la usa Jomar; le registrazioni non
sono ancora aperte al pubblico (#40).

## Prima di scrivere codice

1. **Questo non è il Next.js che conosci.** Next 16 ha API, convenzioni e
   struttura diverse dai tuoi dati di addestramento (Turbopack anche in
   `next build`, `proxy.ts` al posto di `middleware.ts`, `error.tsx` riceve
   `retry`). Prima di scrivere codice Next leggi la guida pertinente in
   `node_modules/next/dist/docs/` e rispetta gli avvisi di deprecazione. Vale per
   ogni libreria: la forma di un'API si legge nella versione installata, non si
   ricorda (qui la memoria ha già sbagliato su `next-pwa` e su Serwist).
2. **Prima di cambiare un'area, leggi la sua storia** (indice in «Dove sta la
   storia»). Lì ci sono le decisioni prese con Jomar e i difetti già pagati:
   ripeterne uno è il rischio più alto di questo progetto. Le regole dell'area
   arrivano da sole da `.claude/rules/` quando apri un suo file.
3. **Lingua**: commenti, commit, PR, issue e documentazione in italiano; colonne
   del database in inglese; ogni testo per l'utente nei dizionari
   (`lib/i18n/dictionaries/`, `it.ts` è la fonte).

## Comandi

```bash
npm run dev                 # dev server sulla 3000 (di solito ne gira già uno)
npm run build               # build di produzione (Turbopack)
npm run lint                # eslint
npm test                    # Vitest, le funzioni pure di lib/ (`test:watch` in sviluppo)
npm run audit:eslint-rules  # le regole di eslint scattano ancora (sentinella, #151)
npm run audit:tokens        # token e classi di colore; il controllo B vuole una build
npm run audit:pwa-cache     # cosa mette in cache il service worker; vuole una build

# collaudo end-to-end — su un Supabase LOCALE in Docker, mai la produzione
npm run e2e:db              # avvia il database locale, ricostruito dalle migration
npm run e2e:build           # costruisce l'app contro quel database (sovrascrive .next)
npm run test:e2e            # la suite Playwright su `next start -p 3200`
```

La CI (`.github/workflows/ci.yml`) esegue tutto su ogni PR e su master nei job
`verifica` ed `e2e`, più `npm audit --audit-level=high`. Node viene da
`engines.node` in `package.json` (24.x), lo stesso per locale, CI e Vercel.

## Regole che valgono ovunque

Ogni regola ha accanto il perché: se un caso non è coperto, decidi in base al
perché. Le regole di dettaglio sono nei file di `.claude/rules/`.

### Dati, sicurezza, server

1. **Ogni tabella ha RLS**, una policy per operazione nella forma
   `(select auth.uid())`. L'unica eccezione è un registro che nessun client deve
   toccare (`job_runs`): RLS accesa e zero policy, con la migration che dice
   perché, o alla rilettura sembra una dimenticanza.
2. **`anon` non ha privilegi in `public`** (#154), e i default di `postgres` fanno
   nascere così anche gli oggetti nuovi. Un grant ad `anon` si dà a una tabella e
   a un privilegio, in una migration che lo motiva.
3. **Ogni scrittura passa da una Server Action.** Unica eccezione dichiarata: le
   letture di conti e categorie dei moduli (`components/UI/useClientRows.ts`,
   #150) partono dal browser, perché Next spedisce le server action una alla
   volta e finirebbero in coda dietro a quelle della pagina.
4. **L'utente si legge con `requireUser()`** (`lib/auth.ts`): claims del JWT
   verificate in locale, zero rete. `auth.getUser()`, `requireLiveUser()` e
   `getAccountContext()` solo dove serve il dato vivo — cambio email e password,
   eliminazione, impostazioni dell'account, recupero password, `/callback`.
   Perché: `getUser()` è una chiamata di rete a ogni invocazione, e le claims
   sono una fotografia (dopo un cambio email portano l'indirizzo vecchio per
   un'ora).
5. **Le operazioni sensibili riautenticano dentro ogni action** con
   `signInWithPassword`: lo stato del passo precedente vive nel client.
6. **Nessun testo del server arriva a schermo.** `genericError()` e
   `authErrorMessage()` (`lib/errors.ts`) registrano il motivo vero e mostrano
   una frase del dizionario.
7. **Un valore dell'utente non diventa sintassi**: un id interpolato in `.or()`
   passa da `isAccountId()`; le liste di `.in()` vanno a blocchi; il testo libero
   esportato in CSV ha la difesa dalle formule.
8. **`profiles` si scrive con `upsert`, mai con `update`**: un update su zero
   righe non è un errore, e l'app direbbe «salvato» a vuoto.
9. **Variabili d'ambiente**: Supabase in `.env.local`, mai nel codice;
   `NEXT_PUBLIC_SITE_URL` solo tramite `lib/site-url.ts`. Le `NEXT_PUBLIC_*` sono
   inlinizzate in compilazione, quindi i controlli stanno in `next.config.ts`.
10. **Il proxy è una comodità di navigazione, non il perimetro**: ogni pagina e
    ogni action si autentica da sé, perché un'action si raggiunge con una POST.

### Numeri

1. **Denaro**: `numeric(10,2)` nel database, mai float; a schermo solo tramite
   `lib/i18n/format.ts` (`formatMoney`); importi scritti a mano solo tramite
   `lib/amount.ts`, e `isStorableAmount()` nelle action.
2. **Un numero mostrato in due posti viene dalla stessa funzione**
   (`lib/totals.ts`, `sommaUscite()`). Due schermate non possono rispondere
   diversamente alla stessa domanda; una differenza di ambito è ammessa solo se
   la pagina la dichiara («su tutti i conti»).
3. **Nessun totale memorizzato** (speso, saldo, risparmiato, conteggi): si
   calcolano alla lettura, o divergono al primo punto di scrittura dimenticato.
4. **Una lettura che può superare 1000 righe passa da `readAll()`**
   (`lib/read-all.ts`), ordinata su una chiave univoca: PostgREST tronca in
   silenzio a 1000, e una paginazione senza ordine totale perde righe.
5. **L'oggi lo dice il client.** Il server è in UTC: data e fuso arrivano dal
   browser (`ClientClock`, `todayLocalISO()`), e i confronti con
   `transactions.date` passano da `dbInstant()`.

### Interfaccia

1. **Il testo colorato usa l'inchiostro** (`--ink-*`, `TIPO_INK`), mai l'accento
   pieno: sul chiaro l'accento sta a circa 3:1. Sopra un riempimento d'accento va
   `--on-accent`, mai `#fff`.
2. **Mai un `border` vero su un elemento arrotondato**: si usano gli anelli
   (`ring-border`, `card-shadow-ring`…), o Firefox disegna quadrati agli angoli
   (#81).
3. **Classi Tailwind scritte per intero**: mai `bg-${colore}`, mai una classe
   incollata a `${` in un template (lo scanner non la vede, #114).
   `npm run audit:tokens` lo controlla.
4. **Una lettura fallita non è uno stato vuoto**: `LoadError`, mai `EmptyState`,
   il cui invito («aggiungi…») porterebbe a duplicare dati che esistono (#124).
5. **I pannelli si montano e si smontano**, li apre il chiamante con una `key`
   per record; niente prop `isOpen` che nasconde. Montare è l'azzeramento.
6. **Ogni animazione dichiara cosa fa con `prefers-reduced-motion`**, accanto
   alla sua definizione (#153).
7. **Dove stanno le cose**: componenti generici in `components/UI/`, logica in
   `components/features/`; grafici solo Recharts; icone Lucide outline e
   `lib/seichi-icons.tsx`; stato UI in Zustand (`store/useUIStore.ts`), mai i dati
   del database.

### Lavoro

1. **Una dipendenza si aggiunge quando serve, non quando è comoda**: ognuna è
   codice altrui da tenere allineato e un avviso di sicurezza in più.
2. **Le migration le esegue Jomar a mano dal SQL Editor**; la PR dice in che
   ordine rispetto al deploy del codice.
3. **Fasi grandi: prima il progetto** (e il mockup su Claude Design quando c'è
   interfaccia), poi il codice; una PR per ogni pezzo che sia un prodotto finito
   da solo.

## Glossario — una parola, un significato

La confusione fra due numeri con lo stesso nome è il difetto più ricorrente del
progetto. Queste parole sono fissate: usale così nell'interfaccia, nei
dizionari e nei commenti.

| parola | significa | dove si calcola |
|---|---|---|
| **Flusso** | entrate − spese − abbonamenti del periodo. Non contiene trasferimenti, risparmi, investimenti né disinvestimenti | `flussoDaTotali()`, `sommaUscite()` |
| **Uscite** | spese + abbonamenti. **Spese** sono solo le `spesa`. Mai «spese totali» | `usciteDaTotali()` |
| **Spese variabili** | ciò su cui vale il budget globale: le `spesa`, non gli abbonamenti | budget |
| **Uscite fisse** | abbonamenti del mese, registrati e ancora da generare dalle ricorrenti | `getBudgetOverview()` |
| **Disponibile** | entrate del mese − uscite fisse previste. Mai «stipendio»: l'app non sa quale entrata lo sia | `disponibileDaTotali()` |
| **Saldo · N conti attivi** | somma dei saldi dei conti non archiviati; importo neutro, mai colorato. Mai «Saldo totale» | vista `account_balances` |
| **Giacenza** | dove sta il denaro (pagina Conti) | `account_balances` |
| **Capitale versato** | acquisti − vendite (pagina Investimenti). Seichi non ha quotazioni: mai «valore» | `getInvestments()` |
| **Obiettivo** | una categoria `risparmio` con un traguardo; un **conto** è un luogo. Non coincidono | `getGoals()` |
| **Conto guardato** | il conto che la pagina mostra: l'URL è un'istruzione, il cookie una memoria | `getSelectedAccount()` |
| **Lapide** | riga di `budgets` con `amount` NULL: da quel periodo, nessun budget | `set_budget()` |
| **Lotto** | una riga di `imports`; eliminarla annulla l'import | `undoImport()` |

## Lezioni di metodo

Valgono per ogni modifica. Ciascuna è costata almeno un difetto arrivato in
produzione o una giornata persa.

1. **Prova una difesa disattivandola.** Ogni correzione ha la sua controprova sul
   codice di prima: se il controllo non diventa rosso, non ha dimostrato niente.
2. **Diagnostica ogni esito prima di crederci, rosso o verde.** Più della metà
   dei KO di questo progetto erano della verifica; e alcuni verdi passavano senza
   aver guardato (`every` su un array vuoto, un `if` senza `else`, il messaggio di
   successo stampato da un rollback).
3. **Cerca una correzione in tutti i chiamanti**, non solo dove ci hai pensato.
   La «migrazione a campione» — una regola applicata a un punto e non al suo
   gemello — è il difetto più ripetuto qui.
4. **Un DEFAULT è un'affermazione sul mondo.** Dove una colonna distingue
   «scelto» da «non ancora scelto», il default è NULL.
5. **Quando cambia un numero, rileggi le parole accanto; quando aggiungi un
   elemento, rileggi i testi vicini.** Un'etichetta può diventare falsa o ambigua
   senza essere toccata.
6. **Un'etichetta si sceglie insieme alla frase che la conterrà.** `Select`
   compone «Seleziona {etichetta}», e in italiano articoli e accordi cambiano con
   il numero e il genere: si verifica in italiano, dove il difetto si vede.
7. **Un'invariante fra due tabelle si difende da entrambi i lati** da cui si può
   rompere. E aggiungere una fonte a un dato (un cookie accanto all'URL) riapre
   ogni domanda già risolta sull'altra fonte.
8. **Due cause diverse, due messaggi diversi.** Un messaggio che attribuisce il
   guasto alla causa sbagliata manda a controllare la cosa sana.
9. **Build verde non è app funzionante.** `tsc`, lint e build non vedono la
   serializzazione RSC (una funzione passata a un client component), le
   esportazioni non async da `"use server"`, le classi Tailwind non generate, i
   testi falsi e i numeri sbagliati. Guarda l'app.
10. **Ciò che dipende dal dispositivo si prova sul dispositivo**: API che vogliono
    un contesto sicuro (`crypto.randomUUID()`, WebAuthn), stampa, splash e cookie
    di iOS, movimento ridotto vero. Telefono sulla LAN o deploy HTTPS. Su una PWA
    installata, prima di incolpare il codice escludi la cache: disinstalla e
    reinstalla.
11. **Un controllo che legge numeri formattati non li confronta come esatti**:
    confronta l'intervallo degli arrotondamenti possibili.

## Stack e struttura

- Next.js 16 App Router, TypeScript strict, Tailwind CSS v4 con i token «Zen
  Glass», Supabase cloud (Postgres, Auth con JWT ES256 + RLS, Storage), Zustand,
  Recharts, Lucide.
- PWA con Serwist (`@serwist/turbopack`): non `next-pwa`, che è un plugin webpack
  e Turbopack non lo aggancia.
- Vitest per `lib/`, Playwright per l'end-to-end.
- Deploy su Vercel con le funzioni a `dub1`, accanto al database (`eu-west-1`):
  la regione sta in `vercel.json`.
- Design: minimalismo giapponese, superfici di vetro satinato, tema chiaro e
  scuro (classe `.dark` su `<html>`, scelta da cookie). Token, classi e trappole
  in `.claude/rules/stili.md`.

```
app/
├── (auth)/            welcome, sign (login + registrazione), callback OAuth,
│                      recupera-password, reimposta-password, email-confermata
├── (onboarding)/      start → preference → category (+ actions.ts)
├── (main)/            l'app autenticata
│   ├── page.tsx       home + action.ts (movimenti, totali, ricorrenti)
│   ├── *-actions.ts   budget, attachment, coach, notification, app-lock (l'unico
│   │                  che scrive il cookie del PIN)
│   ├── transazioni/   lista movimenti (MovimentiClient + getMovimentiData)
│   ├── conti/         conti e /conti/[id]
│   ├── risparmi/      obiettivi · investimenti/ · analisi/ (+ report stampabile)
│   └── impostazioni/  account, profilo, email, password, elimina, categorie,
│                      ricorrenti, blocco (PIN), importa, esporta
├── auth/confirm/      verifyOtp per i link email
├── sw.ts, ~offline/, manifest.ts, icon.tsx, apple-icon.tsx   la PWA
└── layout.tsx         root layout: legge i cookie e decide `.dark` e `lang`
components/UI/         componenti generici (Select, BottomSheetShell, LoadError…)
components/features/   componenti con logica di business
lib/                   meccanica senza testo: auth, account, totals, dates, amount,
                       read-all, errors, attachments, storage-files, import/,
                       export/, i18n/, supabase/ (client, server, proxy)…
store/useUIStore.ts    stato UI condiviso (modale, refresh, conto guardato)
supabase/migrations/   SQL eseguito a mano · supabase/config.toml: SOLO il locale
tests/e2e/             scenari Playwright, uno per difetto storico
scripts/               audit, e2e, generatori di icone e splash
docs/storia/           la storia delle fasi e delle issue
.claude/rules/         le regole per area · .claude/skills/collauda-app
```

## Database

Le migration stanno in `supabase/migrations/` e le esegue Jomar dal SQL Editor;
la CI prova a ogni PR che ricostruiscano il database da zero. Come scriverle:
`.claude/rules/database.md`. Colonne in inglese, id UUID (eccezione:
`job_runs.id`), denaro `numeric(10,2)`.

```
profiles         id (= auth.users.id), currency (NULL = onboarding non finito), language
                 ('it'|'en'), theme, full_name, avatar_url — nessun default
categories       id, user_id, name, icon, color, type, target_amount, target_date
                 type: spesa | entrata | investimento | risparmio | abbonamento
accounts         id, user_id, name, type (solo icona ed etichetta), icon, color,
                 initial_balance, archived
transactions     id, user_id, account_id, to_account_id, category_id, type, amount > 0
                 (senza segno), date (timestamp SENZA fuso), notes(255), investment_type,
                 recurring_rule_id, import_id, import_key
                 type: le cinque delle categorie + trasferimento + disinvestimento
recurring_rules  id, user_id, account_id, category_id, type, amount > 0, notes, frequency
                 (settimanale|mensile|annuale), start_date, next_run, end_date, active
budgets          id, user_id, category_id (NULL = globale, solo mensile), period, amount
                 (NULL = lapide), valid_from (sempre un confine di periodo)
notifications    id, user_id, type, payload jsonb (fatti, non frasi), dedup_key,
                 destination, read
imports          id, user_id, account_id (il conto del file), source, filename
attachments      id, user_id, transaction_id, storage_path, mime_type, size_bytes
job_runs         id (identity), job_name, run_at, step, status, details — RLS, zero policy
```

Ogni tabella ha anche `created_at`.

**Funzioni e viste**:

- `account_balances` (vista, `security_invoker`);
- `dashboard_totals(bounds, account)`;
- `budgets_at()` e `set_budget()`;
- `generate_recurring_transactions()`, che restituisce le regole saltate;
- `run_daily_jobs()`, lanciata da pg_cron alle 03:00 UTC: ricorrenti, poi
  notifiche;
- `daily_job_health()`;
- `import_transactions()` (`security invoker`);
- `delete_current_user(dry_run)`.

**Invarianti che il database impone**, e su cui l'app conta:

- **Destinazione** (`to_account_id`): obbligatoria su `trasferimento`,
  facoltativa su `risparmio` e `investimento`, vietata altrove, mai uguale
  all'origine. Un trasferimento non ha categoria; un `disinvestimento` usa una
  categoria di tipo `investimento`, presa in prestito.
- **Saldo**: aumentano il saldo solo `entrata` e `disinvestimento`; il
  trasferimento sposta denaro fra due conti.
- **Chiavi esterne**: `category_id` è in cascata (eliminare una categoria
  cancella i suoi movimenti: ci poggia l'eliminazione di un obiettivo);
  `account_id` non ha azione (un conto si archivia, e si elimina solo a zero
  movimenti); `import_id` è in cascata (annulla l'import). Le chiavi composite
  `(account_id, user_id)` e `(transaction_id, user_id)` legano i dati al
  proprietario.
- **Deduplica**: `transactions` è unica su `(user_id, import_key)`, con i NULL
  distinti; `budgets` è unica con `NULLS NOT DISTINCT`. Le notifiche non si
  cancellano mai: la riga è la prova che l'evento è già stato emesso.

**Debiti aperti, deliberati**:

- `transactions.date` è senza fuso, e regge perché Supabase è in UTC;
- `categories.user_id` è nullable, quindi le chiavi verso `categories` sono a
  colonna singola e una riga può puntare alla categoria di un altro utente.

## Accesso e onboarding

`/welcome` → `/sign` (login o registrazione) → onboarding `/start` →
`/preference` → `/category` → `/`. Il cancello dell'onboarding è
`profiles.currency` (NULL = da fare), e il primo conto nasce prima di scriverla.
Flusso, recupero password, cambio email e trappole: `.claude/rules/auth.md`.

## Collaudo

- **`npm test`**: le funzioni pure di `lib/`.
- **`npm run test:e2e`**: scenari Playwright su un Supabase locale. Ogni scenario
  custodisce un difetto storico, con la sua controprova (`.claude/rules/test.md`).
- **Lo skill `collauda-app`**: per guardare l'app vera, con un account di prova
  usa e getta registrato ed eliminato dall'app.
  - Non chiedere cookie o password a Jomar.
  - Il database è di produzione: il collaudo finisce quando i dati sono come li
    ha trovati, non quando il referto è verde.
- **Il telefono**: per ciò che dipende dal dispositivo.

## Dove sta la storia

Prima di cambiare un'area, leggi i suoi file in `docs/storia/`: decisioni,
alternative scartate, difetti trovati e come sono stati collaudati. I commenti
del codice e delle migration citano ancora «CLAUDE.md, Fase N» o «sezione Auth
Flow»: quei titoli sono rimasti identici nei file, quindi li trovi con
`grep -rn "<titolo>" docs/storia`.

| area | file in `docs/storia/` |
|---|---|
| database, migration, schema | `schema-annotato`, `issue-043-ricostruzione-schema`, `issue-123-database-integrita`, `issue-154-anon` |
| job notturno, ricorrenti, notifiche | `issue-047-job-giornaliero`, `fase-17-budget-notifiche`, `issue-117-ricorrenti-obiettivi` |
| budget e disponibile | `fase-17-budget-notifiche`, `fase-24a-disponibile` |
| conti, saldi, trasferimenti, conto ricordato | `fase-20a-conti`, `fase-20b-trasferimenti`, `issue-112-conto-guardato`, `issue-062-conti-swipe` |
| movimenti: lista, form, importi | `issue-009-lista-movimenti`, `issue-148-movimenti`, `issue-150-form-tre-stati`, `issue-122-form-movimento`, `issue-119-importi` |
| home, /analisi, report: i numeri | `fase-20a-conti`, `issue-121-numeri`, `fase-23-export-report` |
| import ed export | `fase-21-import`, `issue-118-import`, `fase-23-export-report` |
| investimenti | `fase-21b-disinvestimento`, `issue-061-investimenti-tipologie` |
| ricevute, avatar, Storage | `fase-22-ricevute`, `issue-120-ricevute-orfane`, `fase-16-storage` |
| coach | `fase-24a-disponibile`, `fase-24b-coach`, `fase-24c-chat-progetto` |
| tema, stili, accessibilità | `fase-18-tema`, `issue-081-firefox-bordi`, `issue-126-contrasto`, `issue-153-movimento-ridotto` |
| lingua | `fase-19-lingua` |
| accesso, onboarding, sessione | `auth-flusso`, `costo-richieste-supabase` |
| errori e letture fallite | `issue-124-errori` |
| PWA, avvio, splash | `fase-25-pwa`, `issue-127-pwa-audit`, `splash-avvio` |
| blocco app | `fase-26a-pin`, `fase-26b-biometrico`, `issue-125-pin` |
| telefono, tablet, desktop | `fase-27-mobile`, `fase-28-responsive`, `fase-28e-desktop` |
| prestazioni, regione | `costo-richieste-supabase` |
| dipendenze, CI, test | `issue-151-dipendenze`, `issue-152-ci`, `issue-155-test-unitari`, `issue-156-e2e` |
| l'ordine delle fasi com'era | `ordine-delle-fasi` |

## Stato, al 2026-11-10

- **Fatto**: fasi 1-28, eccetto 24c e 29, e le issue fino alla #156.
- **Aperte**:
  - 24c, la chat del coach (#74): ultima di proposito, non proporla prima;
  - 29, le animazioni (#71);
  - #146, Pianifica;
  - #147, le icone;
  - #40, i debiti prima di aprire le registrazioni: SMTP, *Confirm email* e la
    riautenticazione degli account solo-OAuth.
- La lista viva è la board del progetto su GitHub.

## Come si aggiorna questa memoria

- **La storia** di una fase o di una issue va in un file nuovo,
  `docs/storia/fase-NN-…md` o `issue-NNN-…md`, con le stesse righe d'intestazione
  degli altri, più una riga nella tabella qui sopra. Mai qui dentro.
- **Una regola nuova** va nel file di `.claude/rules/` della sua area, nella
  forma «imperativo. Perché: …» con il rimando alla storia. Qui solo se vale per
  tutto il codice.
- **Ogni regola sta in un posto solo**; gli altri rimandano. Due copie divergono.
- **Niente date né stati** («da fare», «non ancora») nelle regole e nel
  riferimento: invecchiano senza far rumore. Una riga di questo file è rimasta
  «DA ESEGUIRE» per una settimana dopo l'esecuzione. Fa eccezione la sezione
  «Stato», che porta la sua data.
- **⚠️ solo dove sbagliare perde dati o apre un buco di sicurezza**: un allarme
  ovunque non allarma più.
- **Le misure**: questo file sotto i ~40.000 caratteri; ogni file di regole
  sotto i ~10.000 (Claude Code tronca oltre 40.000 quelli caricati su
  richiesta). Il frontmatter `paths:` deve essere YAML valido, o la regola si
  carica sempre.
