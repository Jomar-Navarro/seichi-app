---
paths:
  - "app/sw.ts"
  - "app/~offline/**"
  - "app/manifest.ts"
  - "app/icon.tsx"
  - "app/apple-icon.tsx"
  - "app/layout.tsx"
  - "lib/offline-revision.mjs"
  - "lib/pwa-icon.tsx"
  - "scripts/build-sw.mjs"
  - "scripts/audit-pwa-cache.mjs"
  - "scripts/generate-pwa-*.mjs"
  - "next.config.ts"
  - "proxy.ts"
  - "components/features/PwaStatus.tsx"
  - "components/UI/BootSplash.tsx"
---

# PWA, avvio e splash

Storia: `docs/storia/fase-25-pwa`, `issue-127-pwa-audit`, `splash-avvio`,
`issue-233-sw-statico`.

1. **Si usa Serwist, non `next-pwa`.**
   - La registrazione la fa `<SerwistProvider>` (`@serwist/turbopack/react`)
     nel root layout, spenta in `next dev`.
   - `reloadOnOnline` e `cacheOnNavigation` sono spenti: il primo ricaricherebbe
     la pagina sotto le dita a ogni ritorno della rete.
2. ⚠️ **Il worker è un file generato da `next build`, mai una route.**
   `scripts/build-sw.mjs`, chiamato da `compiler.runAfterProductionCompile`,
   scrive `public/sw.js` e la sua mappa (ignorati da git). Perché: la route di
   `@serwist/turbopack` portava il tag `_N_T_/layout`, ogni
   `revalidatePath("/", "layout")` la faceva rieseguire su Vercel, e a runtime
   ricompilare il worker falliva o, peggio, dava un precache vuoto (#233).
   - Le opzioni del precache stanno scritte in `build-sw.mjs`, non lasciate ai
     default della libreria.
   - Un avviso del precache ferma la build: un file che manca dal precache
     manca offline.
   - La PWA si prova su `next start`: in sviluppo non c'è worker.
3. ⚠️ **Nessuna pagina applicativa in cache**: ogni pagina è dinamica e porta
   dati finanziari.
   - Il precache contiene solo `/_next/static/**`, icone, splash e `/~offline`.
   - `runtimeCaching` ha una rotta sola, `NetworkOnly` sui documenti, che esiste
     per agganciare il fallback offline: i `fallbacks` da soli non scattano.
   - Niente `defaultCache`.
4. **`npm run audit:pwa-cache` legge il worker compilato** (`public/sw.js`) con
   un parser vero e la source map. Fallisce su ogni strategia che scrive in
   cache, su un plugin, su uno spread e su ogni forma che non sa leggere. Si
   collauda con varianti del worker iniettate.
5. **La revisione di `/~offline` è l'hash delle ALTRE voci del precache**
   (`lib/offline-revision.mjs`, in una `manifestTransforms`): cambia a ogni
   build, o il worker terrebbe un HTML che chiede chunk già tolti.
6. **`/~offline` sta in `PUBLIC_PATHS`**, o il worker precacherebbe la pagina di
   login. Manifest, icone e `/sw.js` sono esclusi dal matcher del proxy, per
   nome intero: senza, il worker andrebbe a `/welcome`, e un worker rediretto
   non si installa.
7. **L'avviso «nuova versione» compare solo se prima c'era un controller**:
   `clientsClaim` fa scattare `controllerchange` anche alla prima installazione.
   Mai un `location.reload()` automatico.
8. **Il manifest è dinamico** (tema e lingua dai cookie). I colori sono hex
   duplicati da `globals.css`, perché un manifest non legge `var()`.
9. **L'avvio su iOS** ha tre difese, una per istante:
   - `apple-touch-startup-image` per ogni modello, con la lista duplicata fra
     `scripts/generate-pwa-splash.mjs` e `generateMetadata()`;
   - `<meta name="color-scheme">` da `generateViewport()`;
   - uno `style` inline su `<html>` con lo sfondo del tema.

   Il bianco che resta prima del primo byte è latenza di rete: si toglierebbe
   solo con un app-shell in cache, scartato.
10. **`BootSplash` vive nel root layout, senza JavaScript**: un `loading.tsx`
    accenderebbe il prefetch delle rotte dinamiche.
11. **`esbuild` è quello nativo**, mai `esbuild-wasm`: quello WASM non digerisce
    il carattere `⠀` nel percorso del progetto.
12. **Su iOS, Safari e l'app installata non condividono `localStorage`**: un dato
    scritto da Safari non arriva all'icona sulla home.
13. **Ogni cambiamento si prova dal telefono**, sulla PWA reinstallata: un
    cambiamento «che non si vede» va escluso come cache prima di dare la colpa
    al codice. `registration.active` esiste già in `activating`: chi conta il
    precache aspetta `activated`, o vede le voci del worker precedente.
