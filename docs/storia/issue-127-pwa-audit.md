# #127 — pagina offline, runtimeCaching, icona Apple

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### PWA e audit — pagina offline, runtimeCaching, icona Apple (issue #127)

Dalla review completa del 2026-09-28 (#128). Nessuna migration.

- ⚠️ **La revisione di `/~offline` era l'hash del solo sorgente della
  pagina.** Il worker riscarica una voce del precache solo se la revisione
  cambia, e l'HTML di `/~offline` punta a CSS e JS con l'hash nel nome: un
  deploy che cambiava gli stili senza toccare il testo lasciava al worker
  nuovo l'HTML vecchio, che chiede chunk già tolti dal precache. Ora la
  revisione è l'hash di **tutte le altre voci del precache**
  (`lib/offline-revision.mjs`), calcolato in una `manifestTransforms` che
  aggiunge essa stessa `/~offline`. Il manifest contiene i file della
  cartella dell'id di build, quindi la revisione cambia a ogni build: copre
  anche i testi del dizionario e il markup dei server component, che in
  nessun chunk compaiono. Costo deliberato: qualche KB di HTML riscaricato
  una volta per deploy.
  ⚠️ Due cose dal sorgente di Serwist, entrambe invisibili dalla
  documentazione: le `manifestTransforms` girano PRIMA che vengano accodate le
  `additionalPrecacheEntries` (da lì il manifest non si vede, quindi `/~offline`
  la aggiunge la trasformazione), e DOPO la nostra gira quella
  dell'integrazione che riscrive gli URL (`.next/static/x` → `/_next/static/x`,
  `public/icon.png` → `/icon.png`). La formula toglie quel prefisso, o la route
  e l'audit hasherebbero URL diversi.
  La prima stesura hashava il sorgente più i nomi in `.next/static/chunks`:
  mancava i testi, ripiegava in silenzio in `next dev` e voleva Node ≥ 20.12.
  L'ha trovato la code review.
- ⚠️⚠️ **`audit:pwa-cache` guardava solo il precache.** Un `defaultCache` di
  Serwist in `runtimeCaching`, che mette in cache le pagine RSC, passava verde.
  Ora il controllo B legge il worker compilato con un **parser vero**
  (`espree` + `eslint-scope`, dichiarati in devDependencies) e la **source
  map**, che dice quali nodi vengono da `app/sw.ts`. Trova il nostro
  `new Serwist({precacheEntries…})`, risolve per scope `runtimeCaching`
  (letterale, nome o spread) e, per ogni `handler: new X`, la catena delle
  classi: se una chiama `cachePut`, `cacheMatch` o `fetchAndCachePut`, o usa
  `caches`, l'audit fallisce. Fallisce anche su un handler con `plugins` (un
  `BackgroundSyncPlugin` mette in IndexedDB i corpi delle richieste), su uno
  spread fra le opzioni, e se il NOSTRO codice usa `caches`, `addEventListener`,
  `registerRoute`, `registerCapture`, `setDefaultHandler` o `setCatchHandler`.
  Un nome con più di una scrittura è un errore, non "il primo che capita".
  Ogni forma che non sa leggere è un fallimento, non un passaggio.
  ⚠️ **La prima versione aveva un lettore scritto a mano, e due giri di code
  review ci hanno trovato tre falsi verdi**: i nomi corti si riusano in scope
  diversi (`s=` compare 49 volte, e "il primo `s=[`" era un `[]` qualunque),
  una regex come `/[)]/` chiudeva in anticipo il corpo di una classe e
  nascondeva un `cachePut` nel metodo dopo (falso verde misurato), e una regex
  dopo `if(e)` veniva letta come divisione. Sono le euristiche di un
  tokenizzatore, e ogni forma nuova del minificatore ne avrebbe chiesta
  un'altra: il parser c'era già, con ESLint. **Il livello giusto della
  correzione non era la quarta euristica.**
  Collaudato su 9 varianti del worker scritte a mano, ciascuna rossa per la
  ragione attesa e non per un'altra (una prima tornata dava rosso sul
  controllo A perché la compensazione delle colonne aveva accorciato un URL
  del manifest: verde o rosso, va letto PERCHÉ). Il controllo C ricalcola la
  revisione dalle voci compilate e pretende il `_buildManifest` fra quelle.
  ⚠️ **Non basta cercare nel bundle "una strategia che scrive in cache"**: ce
  n'è già una, un `NetworkFirst` della libreria per Google Analytics offline,
  inattivo senza `offlineAnalyticsConfig`. Si guarda cosa è AGGANCIATO, non
  cosa è compilato. E i nomi delle classi cambiano a ogni build (`NetworkOnly`
  era `T`, poi `C`): l'audit non dipende da loro.
  **Controprova**: con `...defaultCache` iniettato l'audit nuovo dà 18
  problemi (e riconosce le 3 `NetworkOnly` che `defaultCache` contiene), quello
  di master resta verde.
- ⚠️⚠️ **Il difetto della pagina offline è stato VISTO, non solo dedotto** —
  la issue diceva "la resa non è stata osservata". Uno script tiene aperto lo
  stesso browser mentre il server passa dalla build A alla build B (un solo
  colore CSS diverso), poi va offline e apre `/transazioni`. Con `route.ts` di
  master la revisione resta uguale e il worker tiene l'HTML di A, ma **la
  pagina usciva comunque con lo stile**: il CSS vecchio arrivava dalla cache
  HTTP del browser, non dal worker (che non lo conteneva più). Svuotata quella
  cache via CDP (`Network.clearBrowserCache`), cioè un telefono che i file
  vecchi li ha già buttati, master dà **Times New Roman e nessuno sfondo**; il
  codice nuovo carica il CSS di B in entrambi i casi. Quindi il difetto è
  intermittente: dipende da cosa il browser ha ancora in cache, ed è il motivo
  per cui nessuno l'aveva visto.
  ⚠️ Due falsi negativi del driver prima di questo risultato: con un profilo
  Chromium persistente il worker non si registrava affatto, e chiamare
  `registration.update()` ogni secondo durante la prima installazione la
  teneva ferma. Un browser solo, contesto normale, `update()` una volta.
- **L'icona Apple da 180px aveva il tratto ~6 volte troppo spesso.**
  `strokeWidth = 2 * glyph / 22` è nello spazio del viewBox, che lo scala già:
  giusto per il favicon (glifo 22 → 2), una macchia a glifo 128. Ora è fisso a
  2, come in lucide e in `generate-pwa-icons.mjs`. Confrontata a occhio con
  `public/apple-touch-icon.png` e `/icon`: stesso tratto.
- **Due commenti falsi corretti**: la route di Serwist diceva che `withSerwist`
  registra il worker e che `runtimeCaching` è vuoto; `app/layout.tsx` ripeteva
  il secondo. La Fase 25 aveva dimostrato il contrario per entrambi.
- Il quarto punto della issue (`audit:tokens` cieco sui template) era già
  chiuso dalla #114.
- Scartato dalla review: "in `next dev` `/~offline` ora finisce in precache".
  Falso: l'integrazione imposta `disablePrecacheManifest: DEV`, e
  `transformManifest` esce prima di eseguire qualunque trasformazione.

