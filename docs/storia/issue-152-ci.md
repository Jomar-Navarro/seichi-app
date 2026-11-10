# #152 — CI

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### CI (#152, 2026-11-07)

`.github/workflows/ci.yml`, un job `verifica` su ogni PR e su master:
installazione, `tsc`, lint, test unitari (dalla #155), `audit:eslint-rules`,
build, `audit:tokens`, `audit:pwa-cache`, `npm audit --audit-level=high`.

- **Node da `engines.node` in `package.json` (24.x)**, che la CI legge con
  `node-version-file: package.json` e Vercel usa per la produzione: una fonte
  sola. ⚠️ La prima stesura usava `.nvmrc`, che Vercel **non legge**: la CI
  sarebbe stata verde su Node 24 senza dire niente del Node di produzione. Con
  `engines` Vercel smette di usare l'impostazione del progetto. `@types/node`
  segue la stessa maggiore, e Dependabot non la alza da solo: si alzano
  insieme, a mano.
- **`npm audit` sull'intero albero, non `--omit=dev`**: esbuild, Tailwind e
  Serwist girano durante `next build`, anche su Vercel. Solo da «alto» in su:
  i moderati (oggi 11, nessuno raggiunge input degli utenti) restano fuori.
- **Una spinta nuova annulla il giro precedente solo sulle PR.** Su master no:
  due merge ravvicinati lascerebbero il primo commit senza un esito.
- Dependabot guarda anche le **azioni** del workflow (`github-actions`).
- **Variabili fittizie** per `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SITE_URL`:
  `next.config.ts` le pretende, e sono inlinizzate in compilazione, quindi la
  build della CI non è pubblicabile. Nessun segreto nel workflow.
- ⚠️ **Uno script non approvato è un errore in CI.** `allowScripts` approva
  versioni esatte: un aggiornamento con uno script d'installazione nuovo non lo
  esegue e lo dice con un avviso che in locale scorre via.
  ⚠️⚠️ Il controllo cerca SOLO la frase `not yet covered by allowScripts`: npm
  11.16 (locale) scrive `npm warn allow-scripts`, npm 11.19 (CI, Node 24.22)
  `npm warn install-scripts`. La prima versione cercava il prefisso vecchio e
  **passava verde con esbuild tolto da `allowScripts`**: lo ha trovato la
  controprova, che è il motivo per cui si fa. Il prefisso da solo no: un
  avviso informativo con lo stesso prefisso farebbe fallire ogni PR.
- Il job si chiama `verifica`, ed è il nome che la protezione di `master`
  richiede verde: rinominarlo vuol dire aggiornare la regola.

