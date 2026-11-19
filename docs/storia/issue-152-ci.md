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


### Le eccezioni degli avvisi alti (2026-11-18, deciso con Jomar)

Il 2026-11-18 `npm audit` ha cominciato a segnalare **picomatch**
(GHSA-fc5q-39xc-vjpf, ReDoS su pattern extglob), alto, fino alla 4.0.7: cioè
ogni versione pubblicata. Il passo «Avvisi di sicurezza» è diventato rosso su
ogni PR, anche su quelle che non toccavano le dipendenze (#209, #210), e
`verifica` è richiesto dalla protezione di `master`: nessun merge possibile.

Tre strade, scelta la prima:

- **un'eccezione dichiarata**: `scripts/audit-security.mjs` prende il posto di
  `npm audit --audit-level=high`, con lo stesso perimetro e la stessa soglia,
  più un elenco di avvisi accettati, ciascuno col motivo e una scadenza;
- aspettare la correzione: il rilascio di #162 e #163 fermo per un tempo che
  nessuno conosce;
- scavalcare la protezione da amministratore: scartata, smette di proteggere
  proprio quando serve, e ogni PR successiva resta rossa.

Perché picomatch si può accettare **qui**: `npm audit --omit=dev` non lo vede,
quindi non arriva in produzione; lo usano vitest, ESLint e fast-glob in build e
nei test, su pattern scritti da noi e mai su testo degli utenti. Scadenza
2026-12-18: quel giorno la CI cade, e si rivaluta.

Lo script cade anche quando un'eccezione **non serve più** (l'avviso sparito):
la PR che aggiorna picomatch alla versione corretta deve togliere la voce, o
resterebbe a coprire il prossimo avviso con lo stesso id. Nessuna dipendenza
nuova: `audit-ci` e simili avrebbero fatto lo stesso con un pacchetto in più.

#### L'eccezione di picomatch esce (2026-11-19)

Il giorno dopo, la CI di #165 è caduta su «l'eccezione GHSA-fc5q-39xc-vjpf
(picomatch) non serve più». Non c'era stato un aggiornamento: GitHub aveva
**ritirato** l'avviso (`withdrawn_at` 2026-11-18 15:38, ancora senza una
versione corretta), e `npm audit` aveva smesso di riportarlo. La voce è uscita
dall'elenco, che resta vuoto; lo script è rimasto com'era. È il caso per cui
esiste il controllo: lasciata lì, la voce avrebbe coperto in silenzio un
avviso futuro con lo stesso id.

Prima di togliere un'eccezione si guarda **perché** l'avviso è sparito
(`gh api advisories/<id>`): ritirato, o chiuso da una versione che il lock
ha già preso. Le due storie si scrivono in modo diverso.
