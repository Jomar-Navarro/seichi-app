---
paths:
  - "app/sw.ts"
  - "app/~offline/**"
  - "app/manifest.ts"
  - "app/icon.tsx"
  - "app/apple-icon.tsx"
  - "app/layout.tsx"
  - "app/serwist/**"
  - "lib/offline-revision.mjs"
  - "lib/pwa-icon.tsx"
  - "scripts/audit-pwa-cache.mjs"
  - "scripts/generate-pwa-*.mjs"
  - "next.config.ts"
  - "components/features/PwaStatus.tsx"
  - "components/UI/BootSplash.tsx"
---

# PWA, avvio e splash

Storia: `docs/storia/fase-25-pwa`, `issue-127-pwa-audit`, `splash-avvio`.

1. **Si usa Serwist (`@serwist/turbopack`), non `next-pwa`.**
   - La registrazione la fa `<SerwistProvider>` nel root layout: `withSerwist`
     non inietta niente.
   - `reloadOnOnline` e `cacheOnNavigation` sono spenti: il primo ricaricherebbe
     la pagina sotto le dita a ogni ritorno della rete.
2. ⚠️ **Nessuna pagina applicativa in cache**: ogni pagina è dinamica e porta
   dati finanziari.
   - Il precache contiene solo `/_next/static/**`, icone, splash e `/~offline`.
   - `runtimeCaching` ha una rotta sola, `NetworkOnly` sui documenti, che esiste
     per agganciare il fallback offline: i `fallbacks` da soli non scattano.
   - Niente `defaultCache`.
3. **`npm run audit:pwa-cache` legge il worker compilato** con un parser vero e
   la source map. Fallisce su ogni strategia che scrive in cache, su un plugin,
   su uno spread e su ogni forma che non sa leggere. Si collauda con varianti
   del worker iniettate.
4. **La revisione di `/~offline` è l'hash delle ALTRE voci del precache**
   (`lib/offline-revision.mjs`, in una `manifestTransforms`): cambia a ogni
   build, o il worker terrebbe un HTML che chiede chunk già tolti.
5. **`/~offline` sta in `PUBLIC_PATHS`**, o il worker precacherebbe la pagina di
   login. Manifest, icone e `serwist` sono esclusi dal matcher del proxy.
6. **L'avviso «nuova versione» compare solo se prima c'era un controller**:
   `clientsClaim` fa scattare `controllerchange` anche alla prima installazione.
   Mai un `location.reload()` automatico.
7. **Il manifest è dinamico** (tema e lingua dai cookie). I colori sono hex
   duplicati da `globals.css`, perché un manifest non legge `var()`.
8. **L'avvio su iOS** ha tre difese, una per istante:
   - `apple-touch-startup-image` per ogni modello, con la lista duplicata fra
     `scripts/generate-pwa-splash.mjs` e `generateMetadata()`;
   - `<meta name="color-scheme">` da `generateViewport()`;
   - uno `style` inline su `<html>` con lo sfondo del tema.

   Il bianco che resta prima del primo byte è latenza di rete: si toglierebbe
   solo con un app-shell in cache, scartato.
9. **`BootSplash` vive nel root layout, senza JavaScript**: un `loading.tsx`
   accenderebbe il prefetch delle rotte dinamiche.
10. **`esbuild` è quello nativo** (`useNativeEsbuild: true`): quello WASM non
    digerisce il carattere `⠀` nel percorso del progetto.
11. **Su iOS, Safari e l'app installata non condividono `localStorage`**: un dato
    scritto da Safari non arriva all'icona sulla home.
12. **Ogni cambiamento si prova dal telefono**, sulla PWA reinstallata: un
    cambiamento «che non si vede» va escluso come cache prima di dare la colpa
    al codice.
