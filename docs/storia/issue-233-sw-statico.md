# #233 — il service worker è un file, non una route

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Da dove arriva (2026-11-24)

La prima email di Sentry dopo la #160: **SEICHI-3**, `Cannot find module "…"`
sulla route `/serwist/[path]`, release `f77b053`. Il modulo è `…` perché
`buildEvent()` ripulisce il testo fra virgolette; nella issue a monte era
`next/dist/server/config.js`, importato allo stesso modo.

La catena, ricostruita e poi riprodotta:

1. `createSerwistRoute()` di `@serwist/turbopack` dichiara la route
   `force-static`, `dynamicParams = false`, `revalidate = false`.
   `/serwist/sw.js` e `/serwist/sw.js.map` si prerenderizzano in build, con
   `initialRevalidateSeconds: false`.
2. Come ogni rotta prerenderizzata portano il tag implicito del layout radice:
   `x-next-cache-tags: _N_T_/layout,_N_T_/serwist/layout,…`.
3. `revalidatePath("/", "layout")` produce proprio `_N_T_/layout`, e le
   nostre action lo chiamano una trentina di volte. Ogni scrittura dichiarava
   scaduto anche il service worker.
4. Alla richiesta successiva Vercel serviva la copia vecchia
   (`x-vercel-cache: STALE`) e rigenerava in background eseguendo la route.
   La route a runtime voleva ricompilare il worker: `import("esbuild")` e
   `import("next/dist/server/config.js")` con `webpackIgnore`, cioè invisibili
   al file tracing, quindi assenti dalla funzione.
5. La rigenerazione falliva, la copia restava `STALE`, e la richiesta dopo
   ci riprovava.

**Riprodotto** con due `curl` su `/serwist/sw.js` alle 08:34 UTC
(`REVALIDATED`, poi `STALE`, `age` ≈ 13 ore): due eventi in più su SEICHI-3.
Il difetto c'era probabilmente dalla Fase 25; si è visto solo perché da un
giorno gli errori arrivano a Sentry.

A monte è [serwist/serwist#360](https://github.com/serwist/serwist/issues/360),
con la stessa diagnosi, chiusa il 2026-11-23 come *not planned*.

### Quanto era grave

- Per l'utente, niente finché la copia `STALE` c'era: era il worker giusto.
- Il giorno in cui Vercel l'avesse scartata (scadenza, regione fredda) la
  richiesta sarebbe andata alla funzione senza riserva: **500**, nessuna
  installazione nuova, niente offline.
- ⚠️ **Rendere esbuild raggiungibile non sarebbe stata una correzione.** Nella
  funzione mancano `.next/static/**`, `public/**` e `app/sw.ts`: la
  ricompilazione avrebbe dato un worker col precache vuoto, un difetto
  silenzioso al posto di uno rumoroso. E `outputFileTracingIncludes` con
  Turbopack non è collegato (lo riferisce la issue a monte).

### Le due strade, e quella scelta

1. **Togliere l'innesco**: `revalidatePath("/(main)", "layout")` al posto di
   `("/", "layout")` nei circa 30 chiamanti, e una regola eslint per la forma
   vecchia. Scartata: è la migrazione a campione più larga possibile, e non
   copre la copia che Vercel scarta da sé.
2. **Togliere la route** (scelta da Jomar): il worker si genera in build e si
   serve come file statico. Nessuna funzione può ricompilarlo, qualunque cosa
   la faccia partire.

### Come è fatto

- **`scripts/build-sw.mjs`**, chiamato da `compiler.runAfterProductionCompile`
  in `next.config.ts`: l'hook documentato di Next 16, che parte dopo la
  compilazione (`.next/static` esiste già) e prima della generazione statica,
  anche con Turbopack. Se lancia, la build fallisce: un worker rotto non arriva
  in produzione. Import dinamico, così `next dev` non carica esbuild.
- Fa il lavoro della route con `getFileManifestEntries` di `@serwist/build` ed
  esbuild, e **ogni opzione che l'integrazione ricavava da sé è scritta a
  mano**: glob, `dontCacheBustURLsMatching`, riscrittura degli URL, target. Un
  default di libreria che cambia non deve cambiare il worker senza che il repo
  si muova.
  - Il target è `MODERN_BROWSERSLIST_TARGET` di Next senza spazi
    (`chrome111`…): `browserslistToEsbuild()` dà esattamente quello, misurato,
    senza dichiarare `@serwist/utils` e `browserslist`. Una voce di forma
    diversa ferma la build.
  - Un avviso del precache (un file oltre i 2 MB, un glob vuoto) **ferma la
    build**; l'integrazione lo stampava e basta, e un file che manca dal
    precache manca offline.
  - `basePath` e `assetPrefix` sono rifiutati: la riscrittura degli URL suppone
    il sito alla radice.
  - L'uscita di esbuild è calcolata alla radice del progetto, come con la
    route: la source map nomina `app/sw.ts`, la chiave con cui
    `audit:pwa-cache` riconosce il nostro codice.
- Scrive `public/sw.js` e `public/sw.js.map`, ignorati da git e da ESLint.
  Da `/sw.js` lo scope è la radice senza `Service-Worker-Allowed`.
- **Via** la route e `withSerwist`, che serviva solo a esternalizzare esbuild
  per quella route. `@serwist/turbopack` resta per `SerwistProvider`;
  `@serwist/build` è dichiarato in `devDependencies`, alla versione già
  nell'albero (9.5.13).
  - ⚠️ `npm install` con il npm locale toglieva i campi `libc` da tutto il
    lock (glibc/musl, che su Linux scelgono i binari nativi). Il lock ha
    ricevuto a mano la sola riga della dipendenza diretta, e `npm ci` l'ha
    accettato.
- ⚠️ **`proxy.ts`**: il matcher escludeva `serwist`, non `sw.js`. Un file di
  `public/` con un'estensione qualunque passa dal proxy, e senza sessione
  `/sw.js` sarebbe andato a `/welcome`: un worker rediretto non si installa.
  È la trappola della Fase 25. Ora `sw\.js(?:\.map)?$`, ancorato: `/sw.jsx`
  passa ancora dal proxy.
- **In `next dev` la registrazione è spenta** (`disable` su
  `SerwistProvider`). Il file lo scrive solo `next build`: in sviluppo
  `/sw.js` è quello dell'ultima build, con chunk che il dev server non ha.
  La route di prima, in sviluppo, dava un worker col precache vuoto.

### I worker già installati

Il documento è sempre `NetworkOnly`: la prima pagina aperta dopo il deploy
arriva dal server, e `SerwistProvider` registra `/sw.js` sullo scope `/`. Per
le specifiche, uno scope già registrato con un altro script si aggiorna, non
raddoppia. Il controllo d'aggiornamento del worker vecchio su
`/serwist/sw.js` riceve intanto un 307 dal proxy e fallisce, lasciando il
worker com'è fino a quel momento.

### Collaudo

- **Parità del precache**, nella stessa build con la route ancora presente:
  70 voci identiche, `_ssgManifest.js` compreso, e il codice del worker prima
  e dopo il manifest identico byte per byte. L'unica differenza era
  un artefatto di quella build: la route, che gira dopo l'hook, aveva messo in
  precache `/sw.js` stessa (e quindi la revisione di `/~offline` cambiava).
  Lo esclude `globIgnores`, e l'allow-list dell'audit lo respingerebbe.
- `audit:pwa-cache` verde sul percorso nuovo; controprove: senza file dichiara
  di non aver guardato, con `/transazioni` iniettato fallisce su A e su C.
- **Migrazione in un browser vero**: master in un worktree e il ramo serviti
  a turno sulla stessa origine, con lo stesso Chromium aperto. Con master,
  `/serwist/sw.js` attivo; dopo il passaggio, **una** registrazione, scope
  `/`, `/sw.js` attivo e di controllo; offline, `/transazioni` mostra
  `/~offline`.
  ⚠️ Il primo conteggio del precache dava 101 voci invece di 71: avanzi del
  worker vecchio? No, conteggio troppo presto. `registration.active` esiste già
  nello stato `activating`, e Serwist toglie le voci vecchie in
  `handleActivate`. Aspettando `activated`: 71, come su un browser pulito.
- **Scenario e2e** `tests/e2e/service-worker.spec.ts`, con tre controprove:
  il matcher del proxy senza `sw.js` fa cadere tutti e due i test (307); il
  codice di master fa cadere «è un file» (`/sw.js` non è un 200, lo ha
  mostrato la prova di migrazione); `app/sw.ts` senza la rotta `NetworkOnly`
  fa cadere solo il fallback offline.
- La suite intera, a Docker appena acceso e con 3,4 GB liberi, ha dato a ogni
  giro uno o due rossi DIVERSI (archivio, conti, dialog, valuta). Il Sentry
  finto della suite ha dato il motivo: `An invalid response was received
  from the upstream server`, un 502 del gateway del Supabase locale. Rilanciati
  insieme, i quattro passano.
- Resta da fare **su Vercel**, dove il difetto viveva: che `public/sw.js`,
  scritto durante la build, sia servito dal deploy; una scrittura seguita da
  `curl` su `/sw.js` senza eventi nuovi su SEICHI-3. Poi il telefono, con la
  PWA reinstallata.
