# #151 — dipendenze e avvisi di sicurezza

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Dipendenze e avvisi di sicurezza (#151, 2026-11-07)

Next 16.3.1 aveva un avviso critico e un DoS sulle server action, e nessuno lo
sapeva: `npm audit` non lo lanciava nessuno. Passati a 16.4.5 con le minori.

- **Dependabot** (`.github/dependabot.yml`): minori e patch in una PR il
  lunedì, maggiori una per volta. Avvisi e PR di sicurezza accesi nelle
  impostazioni del repository, non nel file.
- ⚠️ **`allowScripts` è legato alla versione esatta.** Un aggiornamento che
  porta uno script d'installazione nuovo lo segnala con `npm warn
  allow-scripts`: si legge lo script, poi `npm approve-scripts <pkg>`, e si
  tolgono a mano le voci di pacchetti spariti (oggi `sharp` 0.35 e
  `unrs-resolver` 1.13 non ne hanno).
- **`overrides["@serwist/turbopack"].zod` (`^4.6.6`)**: `@serwist/build` fissa
  `zod` 4.6.5, sotto l'avviso alto GHSA-mrhx-c7xc-m3w5. La patch è nella stessa
  minore. L'override vale solo nel ramo di Serwist, non nell'intero albero: un
  pacchetto futuro che chieda un altro `zod` non ne resta forzato. Si toglie
  quando Serwist porta da sé la 4.6.6 (`npm ls zod`).
- **Restano due avvisi moderati, accettati**: `glob` 13 e `minimatch` 10 dentro
  `@serwist/build`. ⚠️ `npm audit` li conta **quattro** volte, perché li
  attribuisce anche a `@serwist/build` e `@serwist/turbopack`. La correzione è
  una maggiore che Serwist fissa. Girano quando si costruisce il service
  worker — in `next build`, e in `next dev` alla richiesta della rotta — sui
  nostri file e sulla nostra configurazione; in produzione `/serwist/sw.js` è
  già prerenderizzato in build (● nell'output), quindi nessun input di un
  utente li raggiunge.
  ⚠️ Non solo Serwist (ricontato il 2026-11-10, 12 voci moderate): lo stesso
  `minimatch` 10 arriva anche da ESLint 10 (`@eslint/config-array`) e da
  typescript-eslint. Girano solo nel lint, sui nostri file: stesso giudizio.

#### Le prime maggiori di Dependabot (2026-11-07)

Quattro PR aperte da Dependabot appena acceso, valutate provandole su un ramo
locale invece che leggendo i numeri di versione:

| | esito | come si è visto |
|---|---|---|
| espree 11, eslint-scope 9 | **adottate** | li usa solo `audit:pwa-cache`: la controprova della #127 (`...defaultCache` nel worker) dà gli stessi **18 problemi** di prima |
| ESLint 10 | **adottata, con un limite** | un file con una violazione per famiglia (react, react-hooks, jsx-a11y, import, @next, typescript-eslint): **8 regole e 8 messaggi identici** a ESLint 9. ESLint 9 è già segnalato da npm come non più supportato |
| TypeScript 7 | **rimandata** | `npm run lint` si ferma su «typescript-eslint does not support TS 7.0»; regola `ignore` in `dependabot.yml` da `>=6.1`, il limite del peer di typescript-eslint. La 6.0 ci rientra ~~ma **non è stata provata**: arriverà come PR da provare come ogni maggiore~~ — provata e adottata, riga sotto |
| TypeScript 6.0.3 | **adottata** il 2026-11-10 (#186) | la PR di Dependabot, aggiornata sulla `master` col collaudo end-to-end: `verifica` (tipi, lint, `audit:eslint-rules`, build) ed `e2e` verdi; typescript-eslint 8.72 dichiara `typescript <6.1.0`, quindi nessun peer forzato; nessun avviso di opzioni deprecate |
| CLI di Supabase 3.0.0 | **adottata** il 2026-11-13 (#196) | serve solo al database del collaudo (`e2e:db`). CI verde, e provata anche su Windows: 20 migration, chiave ES256, **12 test su 12**. Due cose che la CI non vede, sotto |

**La CLI v3 legge `.env.local` della radice** (e quello di `supabase/`), e le
sue variabili `SUPABASE_*` vincono su `config.toml`. Il nostro `.env.local`
porta `SUPABASE_DB_URL` di produzione, che la guida di migrazione non nomina
mai. Misurato il 2026-11-13: `start` e `status` restano su `127.0.0.1` (API e
database). E con un `.env.local` di prova che puntava `SUPABASE_DB_URL` a un
indirizzo finto (203.0.113.1), `migration list` stampa comunque
`Target: local stack (127.0.0.1:54322)`, come senza. Nel binario quel nome
compare solo fra le variabili che la CLI passa alle Edge Functions. Il rischio
vero è un nome `SUPABASE_*` che sia una chiave della configurazione: vince su
`config.toml` in silenzio.

**`enable_signup` in `[auth.email]` e `[auth.sms]` è deprecata a favore di
`enabled`, ed è un sinonimo**: nel binario della 3.0.0 c'è una tabella che
rinomina la chiave vecchia in quella nuova, e la vecchia alimentava già
`GOTRUE_EXTERNAL_EMAIL_ENABLED`. Ingannava il commento di serie («Allow/disallow
new user signups via email»): l'interruttore spegne il *provider*, quindi con
`false` non entra nemmeno chi è registrato. Le registrazioni nuove le governa
`enable_signup` in `[auth]`. ⚠️ La prima versione della #198 sosteneva che il
significato fosse cambiato, con una controprova che non poteva distinguere le
due tesi: l'ha smentita la code review, verificata sul binario. Controprova
(vale per entrambe le chiavi): con `[auth.email] enabled = false` Auth risponde
`external.email: false` e i due test dell'onboarding cadono su
`email_provider_disabled`; con `true` tornano 12 su 12. ⚠️ Il primo tentativo
di controprova era verde per sbaglio: un `sed` aveva cambiato il primo
`enabled = true` del file, quello di `[auth]`. L'ha smascherato leggere
`/auth/v1/settings` prima di credere al test.

⚠️ **Il primo giro locale della suite era 12 rossi su 12**, tutti su
`browserType.launch: Executable doesn't exist`: sulla macchina c'erano i
browser di un Playwright vecchio. Nessun test aveva aperto una pagina.

⚠️⚠️ **Il limite di ESLint 10 sta nei plugin col peer forzato.**
`eslint-plugin-react`, `-import` e `-jsx-a11y` arrivano con
`eslint-config-next` e dichiarano solo fino a ESLint 9: npm li installa con
tre `npm warn ERESOLVE overriding peer dependency` e li annida sotto
`eslint-config-next/node_modules`. ESLint 10 ha tolto metodi sia dal
`context` delle regole (`getFilename`, `getSourceCode`, `parserOptions`…) sia
da `SourceCode` (`getJSDocComment`, `isSpaceBetweenTokens`,
`getTokenOrCommentBefore/After`): misurato, in ESLint 9.39 c'erano.

⚠️ **`eslint-config-next` avvolge react e import con un proprio strato di
compatibilità** (`dist/rule-context.js`, `fixupPluginRules`), che rimette i
metodi del **`context`** ma non quelli di **`SourceCode`**. Quindi,
misurato regola per regola il 2026-11-07:

- **sei regole vanno in CRASH**, tutte su `SourceCode`: `import/order` e le
  cinque di spaziatura JSX di react (`jsx-curly-spacing`, `jsx-equals-spacing`,
  `jsx-tag-spacing`, `jsx-one-expression-per-line`,
  `jsx-space-before-closing`). **Nessuna è accesa**: non accenderle finché
  quei plugin non dichiarano ESLint 10;
- il riconoscimento dei componenti dichiarati con `@extends React.Component`
  nel JSDoc si spegne **in silenzio** (`try/catch` attorno a
  `getJSDocComment`): `no-direct-mutation-state` su una classe così dà 0
  segnalazioni, su una che estende `Component` 1. L'app non ha componenti di
  classe;
- `import/no-default-export`, `no-named-export`, `unambiguous`,
  `react/forward-ref-uses-ref` e `jsx-filename-extension` usano il `context`
  e funzionano, grazie allo strato di Next. ⚠️ La prima code review le dava in
  crash leggendo il sorgente del plugin: era vero per ESLint nudo, non dentro
  la configurazione di Next. **Un'API tolta va provata nella configurazione
  vera, non dedotta dal sorgente**;
- jsx-a11y non è avvolto e non usa nessuna delle API tolte.

⚠️ **Un lint verde non dimostra che le regole girino**: un crash fa rumore, ma
una regola che smette di scattare tace come una che funziona, perché il codice
dell'app non ha violazioni. Da qui **`npm run audit:eslint-rules`**
(`scripts/audit-eslint-rules.mjs`, nella CI dopo il lint): fa lintare un file
**virtuale** con una violazione per regola e pretende che tutte le regole
attese scattino, senza crash. Se una va in crash la spegne e riprova, così
l'elenco dice tutti i crash e controlla comunque le altre. ⚠️ **È una
sentinella, non una copertura**: dieci regole campione su 86 accese, una per
famiglia più `set-state-in-effect`, su cui questo progetto si appoggia.
Controprova: con `set-state-in-effect` spenta esce 1 su quella regola; con
`jsx-tag-spacing` accesa e `jsx-key` spenta esce 1 con entrambi i problemi.
Quando cambia il preset di `eslint-config-next`, l'elenco `EXPECTED` va
riletto.

⚠️ **`strict-peer-deps` deve restare spento** (il default di npm): acceso in
un `.npmrc`, o con un gestore di pacchetti più severo, `npm ci` fallisce sui
tre peer. Il lock porta anche copie doppie annidate (`minimatch`,
`brace-expansion`, `semver`, `typescript-eslint`…): è il prezzo dell'annidamento,
non un difetto. Tornare a ESLint 9 è una riga in `package.json`.

