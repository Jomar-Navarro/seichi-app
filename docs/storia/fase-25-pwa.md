# Fase 25 — PWA: manifest e service worker

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 25 — PWA: manifest e Service Worker (2026-09-04, issue #68)

Progettata per intero prima di scrivere codice, come la 17, la 20, la 23 e la
24. **Scambiata di posto con la 26 (blocco PIN)**: vedi Implementation Order
per il motivo.

#### ⚠️⚠️ `next-pwa` era già sbagliato PRIMA di scrivere una riga

Lo Stack nominava `next-pwa`. Verificato contro
`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`:
**Turbopack è il bundler di default in Next 16, sia per `next dev` sia per
`next build`**. `next-pwa` è un plugin **webpack**, non manutenuto da anni, e
non si aggancia più alla pipeline. La guida ufficiale Next per le PWA non lo
nomina nemmeno: rimanda a **Serwist**, con un pacchetto dedicato al Turbopack
(`@serwist/turbopack`, distinto da `@serwist/next` che è per webpack). È
esattamente il genere di scarto fra training data e realtà del repo che
l'intestazione di CLAUDE.md chiede di controllare nei docs — qui l'assunzione
sbagliata era scritta nel repo stesso da prima ancora che la fase iniziasse.

Seconda cosa che gli stessi docs hanno rivelato: Next 16 ha un file-convention
nativo per il manifest (`app/manifest.ts`, zero dipendenze) e una feature
sperimentale, `experimental.useOffline`, che gestisce il retry automatico di
navigazioni e Server Action quando la rete cade — **senza alcun service
worker**. Non sostituisce Serwist (serve per l'installabilità e l'apertura
offline a freddo), è complementare: si usano entrambi.

#### Le decisioni

- **`app/manifest.ts` dinamico, non statico.** Legge `THEME_RESOLVED_COOKIE`
  (Fase 18) per `theme_color`/`background_color` e `getI18n()` per
  `name`/`description` (riuso di `t.meta.*`, zero chiavi di dizionario
  nuove). Usare `cookies()` rende il Route Handler dinamico invece che
  cacheable — lo stesso principio di ogni altra pagina dell'app: il cookie
  decide, il primo byte è quello giusto. ⚠️ `--background` in globals.css è
  un `radial-gradient`, non un colore, e un manifest non sa disegnare un
  gradiente: si usa lo stop dominante di ciascun tema (`--color-tsuki` in
  chiaro — la stessa scelta già fatta per il report stampabile, 23b — e
  `#1a2436`, il primo stop del gradiente scuro, in scuro), duplicato come hex
  perché un manifest non legge `var(--…)`.
- **Icone: due percorsi per due scopi.** Tab del browser/Safari via
  convenzione nativa (`app/icon.tsx` + `app/apple-icon.tsx`, `ImageResponse`
  da `next/og`, zero file statici). `manifest.ts.icons[]` invece vuole PNG
  **statici e stabili** — Chrome pretende almeno un 512×512 per
  l'installabilità — generati una tantum da `scripts/generate-pwa-icons.mjs`
  con `sharp` (già presente in `node_modules`, non una dipendenza nuova) e
  versionati in `public/`. Il glifo è il `Sprout` di `lucide-react`, lo
  stesso già usato in `BrandHeader.tsx`: non un logo nuovo. Condiviso fra
  `icon.tsx`/`apple-icon.tsx` via `lib/pwa-icon.ts`; duplicato a mano nello
  script Node, che gira fuori dalla build Next e non può importare un modulo
  TypeScript.
- **Service worker con l'ambito ridotto al minimo.** `app/sw.ts`:
  `runtimeCaching: []`, **nessun** `defaultCache` da `@serwist/turbopack/worker`
  — quella lista consigliata da Serwist include la cache delle pagine RSC
  (`PAGES_CACHE_NAME.rsc`), esattamente ciò che questa fase esiste per
  escludere. Ogni pagina di Seichi è dinamica — cookie di sessione a ogni
  richiesta, proxy sempre attivo — la stessa ragione per cui l'export CSV
  (23a) risponde `Cache-Control: private, no-store`. Il precache si limita
  (per come Serwist lo costruisce di default: un glob sui file statici di
  build, non sulle rotte applicative, che non sono file su disco) a
  `/_next/static/**`, alle icone e al fallback offline — **verificato**, non
  supposto, vedi sotto.
- **Fallback offline onesto.** `app/~offline/page.tsx`: zero dati, un
  messaggio Zen Glass, `SubmitButton` con `href` (un `<Link>` vero, funziona
  anche se il JS non si idrata mai). Registrato in `fallbacks.entries` del
  service worker con `matcher: ({ request }) => request.destination ===
  "document"` — scatta solo su una navigazione fallita, mai su una fetch di
  dati. Chiude la scelta lasciata aperta dall'issue ("una schermata onesta, o
  niente") a favore della prima, ora che il service worker esiste comunque.
- **`experimental.useOffline: true`**, zero dipendenze: copre il caso più
  comune, diverso dal fallback sopra — rete che cade DURANTE l'uso (una
  Server Action, una navigazione soft), non un'apertura a freddo. Il
  tentativo resta in sospeso e riparte da solo alla riconnessione.
- **`npm run audit:pwa-cache`**, sul modello di `audit-tokens.mjs`: legge il
  service worker REALMENTE compilato in `.next/server/app/serwist/sw.js.body`
  dopo una build e fallisce se contiene qualunque URL fuori da un allow-list
  esplicito. Stessa disciplina dell'audit dei token — *un controllo che non
  ha guardato niente non è un controllo* — qui con una posta più alta (dati
  finanziari in una cache persistente sul dispositivo, non un colore
  sbagliato).

#### ⚠️⚠️ Il proxy avrebbe precachato `/welcome` al posto della pagina offline

Il più serio dei problemi emersi, e invisibile finché non si è provato a
sfiorare `curl` sulle rotte nuove: **tutte** rispondevano `307 → /welcome`.
`proxy.ts` (Fase 16, rinominato da `middleware.ts` — altro scarto fra
training data e questa versione di Next) protegge ogni percorso non elencato
in `PUBLIC_PATHS`/nel matcher, e `/manifest.webmanifest`, `/serwist/sw.js`,
`/icon`, `/apple-icon`, `/~offline` non c'erano.

Per il manifest e le icone è "solo" overhead (una chiamata Supabase in più
per una richiesta che il browser fa da sé, mai un utente). Per `/~offline` è
peggio: Serwist la richiede **davvero** in rete quando installa il service
worker (`additionalPrecacheEntries`, non un file letto da disco), e `fetch()`
segue i redirect per default. **Il service worker avrebbe precachato la
pagina di login come fallback offline.** Un utente sloggato che apre l'app
senza rete si sarebbe visto un invito ad accedere invece del messaggio
onesto che l'intera fase esiste per garantire — l'esatto opposto
dell'obiettivo, introdotto da un file che questa fase non ha nemmeno
toccato.

Chiuso in due punti diversi, per due ragioni diverse: `/~offline` in
`PUBLIC_PATHS` (è una pagina reale, resa a chiunque, autenticato o no — lo
stesso trattamento di `/error`); manifest/icone/`serwist` escluse dal
**matcher** di `proxy.ts` invece che da `PUBLIC_PATHS` — non sono navigazioni
di un utente, sono richieste che il browser fa da sé, e un controllo di
sessione su di loro è overhead puro nel caso migliore e un service worker
rotto nel peggiore.

#### Altri due difetti trovati costruendo, non progettando

- ⚠️ **`/~offline` è una rotta dinamica**, perché eredita `cookies()` dal root
  layout (tema/lingua) — quindi non è un file statico che il glob del
  precache di default potrebbe trovare. `additionalPrecacheEntries: [{ url:
  "/~offline", revision }]` la aggiunge a mano: Serwist la richiede
  DAVVERO all'installazione, quindi funziona pur essendo dinamica (il
  contenuto non dipende in modo sostanziale dai cookie). `revision` è un
  hash del sorgente della pagina, non un timestamp — cambia solo se il
  TESTO cambia, non a ogni deploy che non la tocca.
- ⚠️ **`esbuild-wasm` rifiutava la build**: *"the working directory ... is
  not an absolute path"*. La cartella del progetto contiene un carattere
  Unicode non-ASCII (`⠀`), e lo shim WASI di risoluzione percorsi di
  `esbuild-wasm` non lo digerisce — un limite suo, non del progetto.
  L'`esbuild` nativo usa le API del filesystem del sistema operativo e non
  ha il problema: cambiato `useNativeEsbuild` a `true` (il default su
  Windows, comunque esplicitato). Costo: un pacchetto con uno script nativo
  di post-install in più da vagliare — stessa cautela già applicata a
  `sharp`/`unrs-resolver`/`@swc/core`, verificato che `install.js` faccia
  solo la risoluzione standard del binario di piattaforma.

#### Il lint ha bloccato due pattern che questo repo vieta per regola scritta

- **`@ts-nocheck` in `app/sw.ts`** (bandito da `@typescript-eslint/ban-ts-comment`).
  Il file gira in un service worker — `self`, `clients`, `caches`,
  `ExtendableEvent` non esistono nella lib "dom" del tsconfig del progetto, e
  aggiungere anche "webworker" allo stesso programma confligge (le due lib
  dichiarano `self` in modo incompatibile). Il file era comunque già escluso
  dal type-check in `tsconfig.json` (`exclude`) — l'unica sede corretta,
  visto che Serwist lo compila con un proprio esbuild indipendente da quel
  tsconfig: il commento in testa al file lo dice esplicitamente, o il
  prossimo che lo legge si chiede perché non ci sono errori di `self` non
  definito.
- **`setShowIosHint(true)` sincrono dentro un `useEffect`** in
  `PwaStatus.tsx` (`react-hooks/set-state-in-effect`) — la stessa regola già
  scritta nelle Rules di questo documento per i pannelli, applicata qui alla
  lettura di stato esterno (`navigator.userAgent`, `matchMedia`,
  `localStorage`). Corretto con `useSyncExternalStore`, lo stesso pattern
  già in `EmailConfirmedStatus.tsx` per il fragment dell'URL: un valore che
  differisce fra server e client va **espresso**, non scoperto un render
  dopo. L'ascolto di `controllerchange` invece resta un `useEffect` normale
  — è il caso esplicitamente permesso dalla stessa regola: ci si iscrive a
  un sistema esterno e si chiama `setState` dentro il CALLBACK dell'evento,
  non sincronamente nel corpo dell'effetto.

#### `PwaStatus`: dove vive, e perché non nel root layout

Monta in `app/(main)/layout.tsx`, non nel root layout come la stesura
iniziale del progetto prevedeva: riguarda l'app autenticata che si usa ogni
giorno, non le pagine di benvenuto/accesso — un banner "nuova versione" sopra
un form di login centrato sarebbe fuori posto, ed è nell'app autenticata che
il ciclo di vita "installata" ha senso pieno.

Due avvisi, entrambi dismissibili: **aggiornamento disponibile**
(`controllerchange` sul service worker — mai un `location.reload()`
automatico, chi sta compilando `TransactionForm` non deve vedersi ricaricare
la pagina sotto le dita) e **suggerimento iOS** (Safari non emette mai
`beforeinstallprompt`, quindi senza un avviso manuale un utente iPhone non
avrebbe MAI modo di scoprire che l'app si installa; stato di dismissione in
`localStorage`, non un cookie — comodità per-dispositivo, non un dato che il
server deve conoscere per rendere qualcosa).

#### La verifica del precache — non supposta, letta dal compilato

`.next/server/app/serwist/sw.js.body` dopo `next build`: 54 entry, tutte
`/_next/static/**` più le quattro icone e `/~offline`. **Nessuna pagina
applicativa.** La controprova (iniettato a mano un URL `/transazioni` nel
file compilato): `audit:pwa-cache` lo segnala e fallisce; ripristinato il
file vero, torna verde. È la stessa disciplina della Fase 22/23 — *un
controllo va messo alla controprova disattivandolo, o "funziona" e "non ha
guardato niente" restano indistinguibili*.

Rimossi anche 5 SVG placeholder di `create-next-app` mai referenziati da
nessun file (`window.svg`, `vercel.svg`, `next.svg`, `globe.svg`,
`file.svg`): stavano per finire nel precache come rumore, ed erano comunque
morti.

#### Collaudato

`next build` (Turbopack) pulito, `npm run lint` pulito, `npm run
audit:tokens` verde, `npm run audit:pwa-cache` verde con controprova.
`next start` in locale: `/manifest.webmanifest` risponde 200 con
`theme_color`/`background_color`/lingua coerenti coi cookie inviati
(verificato sui quattro incroci tema×lingua), `/serwist/sw.js` risponde 200
con `Content-Type: application/javascript`, `/~offline` risponde 200 col
testo giusto, `/icon`/`apple-icon` rispondono 200 `image/png`, e una rotta
protetta vera (`/`) continua a rispondere `307 → /welcome` senza sessione —
il fix del proxy non ha allargato il perimetro oltre le rotte PWA.

⚠️ **Resta da fare a mano, dal telefono sull'IP di LAN** (vale la regola già
scritta più volte in CLAUDE.md: ogni fase che tocca un'API del browser ha una
parte di collaudo che nessun driver headless può fare): il prompt/voce
"Installa app" su Android/Chrome, il banner "Aggiungi a Home" e l'apertura a
schermo intero su iOS/Safari, l'avviso "nuova versione" dopo un deploy reale,
e la conferma che `npm run dev` non fa scambiare per "forse è la cache" una
modifica vera — il rischio che l'issue #68 nominava esplicitamente.

#### ⚠️⚠️⚠️ Emerso dal code-review: il service worker non si registrava in NESSUN browser

Il rilievo più grave mai emerso da un code-review di questo repo. La fase era
stata dichiarata "collaudata" — build verde, audit verde, `/serwist/sw.js`
risponde 200 al curl — ma **nessuna di quelle prove dimostrava che un
browser registrasse mai il service worker**. Il curl vede l'ASSET, non chi lo
installa. Trovato da un sub-agent del code-review, verificato leggendo il
sorgente del pacchetto (`node_modules/@serwist/turbopack/src/index.ts`):

```ts
export const withSerwist = (nextConfig = {}) => ({
  ...nextConfig,
  serverExternalPackages: [...(nextConfig.serverExternalPackages ?? []), "esbuild", "esbuild-wasm"],
});
```

**Tutto qui.** Nessuno script di registrazione iniettato, contro quanto
affermava (sbagliando) sia il commento originale in `next.config.ts` sia il
riassunto del WebFetch sulla guida Turbopack di Serwist consultata in fase di
progettazione ("registration occurs automatically through the plugin" — non
è vero per questa versione, o si riferiva a un pacchetto diverso). Un
sub-agent l'ha trovato grep-ando il repo per `serviceWorker.register`:
zero risultati.

**Conseguenza**: precache, fallback offline, avviso di aggiornamento erano
tutti codice morto — presenti, corretti, mai eseguiti. L'installazione su
iPhone "funzionava" comunque perché **iOS non richiede un service worker per
"Aggiungi a Home"** (solo manifest + HTTPS): l'unico segnale positivo che
c'era stato non testava affatto la parte rotta.

**Chiusura**: `<SerwistProvider>` da `@serwist/turbopack/react`, montato nel
**root layout** (non in `(main)`, a differenza di `PwaStatus`: la
registrazione deve avvenire ovunque, l'installabilità deve funzionare anche
da `/welcome`, prima del login).

⚠️⚠️ **E `SerwistProvider` ha due default pericolosi**, letti dal suo
sorgente prima di fidarsene:

- `reloadOnOnline: true` — fa `location.reload()` a OGNI evento `online` del
  browser. Su mobile un blip di connessione (ascensore, cambio wifi↔dati)
  capita in continuazione: senza disattivarlo, la pagina si sarebbe
  ricaricata sotto le dita di chi sta compilando `TransactionForm` — **la
  stessa cosa che questo documento vieta esplicitamente due paragrafi sopra**
  per l'avviso di aggiornamento, reintrodotta dal default di una libreria.
- `cacheOnNavigation: true` — manda al service worker un messaggio
  `CACHE_URLS` a ogni navigazione client-side. Verificato che con
  `runtimeCaching: []` e nessun `setDefaultHandler` il messaggio non trova
  alcuna route e non cachea nulla (`Serwist.handleRequest` senza handler
  ritorna `undefined` — stesso codice del `fetch` normale, letto nel
  sorgente). Innocuo **oggi**, ma disattivato comunque per esplicito: la
  garanzia "nessuna pagina applicativa in cache" non deve dipendere da una
  coincidenza (route vuote) che un domani, aggiungendone anche una sola,
  farebbe silenziosamente franare.

Entrambi spenti esplicitamente su `<SerwistProvider>`.

#### ⚠️⚠️ Secondo buco nello stesso giro: `fallbacks` da solo non fa niente

Corretta la registrazione, il fallback offline **ancora non scattava** —
provato con Playwright reale (non supposto): offline, una navigazione verso
una rotta mai visitata mostrava la pagina di errore NATIVA del browser, non
`/~offline`. Causa, letta in `node_modules/serwist/src/Serwist.ts`: il
plugin del fallback si aggancia **solo** alle strategie elencate in
`runtimeCaching`, ciclandole una per una. Con `runtimeCaching: []` (il
design originale — "nessuna cache di pagine applicative") il ciclo non ha
niente su cui agganciarsi, e `fallbacks.entries` resta configurato ma non
collegato a nulla.

Chiuso aggiungendo **una** route con `NetworkOnly` (la strategia che non
legge né scrive MAI una cache — esiste solo per dare al fallback un punto
d'aggancio):

```ts
runtimeCaching: [
  { matcher: ({ request }) => request.destination === "document", handler: new NetworkOnly() },
],
```

Non è una violazione del vincolo "niente cache di pagine applicative": è
l'unico modo di dire "prova la rete per una navigazione, se fallisce usa il
precache" senza mai scrivere una risposta in una cache persistente. Riprovato
con lo stesso script Playwright: `/~offline` compare, col testo giusto.

**La lezione, e vale oltre questa fase**: due prove "verdi" — la build che
compila, il curl che risponde 200 — avevano nascosto due difetti che
rendevano l'intera fase inerte. Solo un browser vero, con `getRegistrations()`
e `context.setOffline(true)`, li ha mostrati. È la stessa regola già scritta
altrove in questo documento — *un controllo che segnala successo va
diagnosticato prima di crederci* — applicata alla scala più alta vista finora
in questo repo: non "il messaggio giusto dal percorso sbagliato", ma
"l'intera funzionalità assente dietro ogni prova che sembrava confermarla".

#### Altri rilievi del code-review, tutti applicati

- ⚠️ Il matcher di `proxy.ts` escludeva `icon`/`apple-icon`/`serwist` come
  prefissi NUDI: una futura rotta che comincia per quelle lettere (es.
  `/icone-personalizzate`) avrebbe saltato in silenzio il controllo di
  sessione. Ancorati al confine di segmento (`icon(?=$|/)` invece di `icon`).
- **`experimental.useOffline` era acceso ma il hook `useOffline()` non era
  usato da nessuna parte** — il commento in `next.config.ts` lo dichiarava
  falsamente. Aggiunto un terzo avviso in `PwaStatus` ("sei offline, riprova
  da solo alla riconnessione"), per il caso — diverso dal fallback a
  freddo — di rete che cade DURANTE l'uso.
- **Duplicazione reale, non cosmetica**: `app/icon.tsx`/`apple-icon.tsx`
  ripetevano l'intero albero JSX (estratto `sproutIconElement()` in
  `lib/pwa-icon.ts`); `app/manifest.ts` ridichiarava `"#f5f1e8"` invece di
  importare `TSUKI` dallo stesso modulo; i tre avvisi di `PwaStatus`
  ripetevano tre volte lo stesso riquadro (estratto un `Notice` locale).
- ⚠️ **Il commento su `MIDORI`/`TSUKI` in `lib/pwa-icon.ts` affermava il
  falso**: diceva che `--color-midori` "non cambia fra i temi". Invece
  `.dark` lo ridefinisce (`#67b89a`, più pastello — la stessa regola del
  Design System per cui gli accenti si invertono fra i due temi). La
  decisione di usare un colore fisso per le icone statiche restava corretta,
  ma per la ragione sbagliata — corretto: un'icona sulla home screen non
  segue il tema della sessione, è un'identità fissata una volta, non perché
  il token sia invariante.

