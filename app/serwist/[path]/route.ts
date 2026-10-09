import { createSerwistRoute } from "@serwist/turbopack";
import { OFFLINE_URL, offlineRevision } from "@/lib/offline-revision.mjs";

/**
 * Route Handler richiesta dall'integrazione Turbopack di Serwist (Fase 25):
 * serve il service worker compilato e i suoi asset. ⚠️ La REGISTRAZIONE non
 * sta qui né in `withSerwist` (`next.config.ts`), che è solo un wrapper di
 * config: la fa `<SerwistProvider>` in `app/layout.tsx`, puntato a questa
 * rotta. Senza quello il worker risponde 200 al curl e non si installa in
 * nessun browser — la Fase 25 l'ha scoperto così.
 *
 * `swSrc: "app/sw.ts"` è l'unica opzione esplicita. Tutto il resto
 * (`globDirectory`, `globPatterns`, `injectionPoint`) resta ai default
 * dell'integrazione: sono pensati apposta per un progetto Next e sanno da
 * soli quali asset di build precachare. La garanzia che conta — nessuna
 * pagina applicativa nel precache — non viene da questi parametri (un
 * default può cambiare da una versione all'altra della libreria): viene da
 * `app/sw.ts`, il cui unico `runtimeCaching` è un `NetworkOnly` (non legge né
 * scrive una cache: aggancia soltanto il fallback offline), e da
 * `npm run audit:pwa-cache`, che dopo ogni build ispeziona il worker REALMENTE
 * compilato — precache e strategie di runtime — invece di fidarsi di ciò che
 * questa configurazione dichiara di fare.
 *
 * `useNativeEsbuild: true` (il default su Windows, esplicitato qui perché
 * non è ovvio dal solo `swSrc`): la cartella del progetto contiene un
 * carattere Unicode non-ASCII (`⠀`), e `esbuild-wasm` lo rifiuta con
 * *"the working directory ... is not an absolute path"* — un limite del
 * suo shim WASI di risoluzione dei percorsi, non del progetto. L'`esbuild`
 * nativo usa le API del filesystem del sistema operativo e non ha questo
 * problema. Verificato costruendo con entrambi.
 *
 * `/~offline` NON finisce nel precache di default: eredita `cookies()` dal
 * root layout (tema/lingua), quindi Next la marca `ƒ` dinamica come ogni
 * altra pagina — non un file statico che il glob possa trovare. Va aggiunta a
 * mano: Serwist la richiede DAVVERO all'installazione del worker (non legge un
 * file), quindi funziona lo stesso pur essendo una rotta dinamica — il
 * contenuto non dipende in modo sostanziale dai cookie.
 *
 * ⚠️ La si aggiunge in una `manifestTransforms` e non con
 * `additionalPrecacheEntries` (#127), perché la sua revisione si calcola dalle
 * ALTRE voci del manifest — vedi `lib/offline-revision.mjs` per il perché — e
 * Serwist esegue le trasformazioni PRIMA di accodare `additionalPrecacheEntries`
 * (`transformManifest` in `@serwist/build`): da lì il manifest non si vede.
 */
export const { GET, dynamic, dynamicParams, revalidate, generateStaticParams } = createSerwistRoute({
	swSrc: "app/sw.ts",
	useNativeEsbuild: true,
	manifestTransforms: [
		(manifest) => ({
			manifest: [...manifest, { url: OFFLINE_URL, revision: offlineRevision(manifest), size: 0 }],
			warnings: [],
		}),
	],
});
