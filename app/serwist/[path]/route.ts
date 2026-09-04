import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSerwistRoute } from "@serwist/turbopack";

/**
 * `/~offline` (Fase 25) NON finisce nel precache di default: eredita
 * `cookies()` dal root layout (tema/lingua), quindi Next la marca `ƒ`
 * dinamica come ogni altra pagina — non un file statico che il glob del
 * precache possa trovare. Va aggiunta a mano con `additionalPrecacheEntries`:
 * Serwist la richiede DAVVERO all'installazione del service worker (non
 * legge un file), quindi funziona lo stesso pur essendo una rotta dinamica —
 * il contenuto non dipende in modo sostanziale dai cookie (stessi default
 * "nessuna scelta ancora" del resto dell'app).
 *
 * `revision` è un hash del sorgente della pagina, non un timestamp: cambia
 * solo se il TESTO della pagina cambia, quindi un deploy che non la tocca
 * non forza un refetch inutile alla prossima installazione del worker.
 */
const offlinePageRevision = createHash("md5")
	.update(readFileSync(join(process.cwd(), "app/~offline/page.tsx")))
	.digest("hex")
	.slice(0, 16);

/**
 * Route Handler richiesta dall'integrazione Turbopack di Serwist (Fase 25):
 * serve il service worker compilato e i suoi asset — `withSerwist` in
 * `next.config.ts` inietta da sé lo script di registrazione lato client,
 * puntato qui.
 *
 * `swSrc: "app/sw.ts"` è l'unica opzione esplicita. Tutto il resto
 * (`globDirectory`, `globPatterns`, `injectionPoint`) resta ai default
 * dell'integrazione: sono pensati apposta per un progetto Next e sanno da
 * soli quali asset di build precachare. La garanzia che conta — nessuna
 * pagina applicativa nel precache — non viene da questi parametri (un
 * default può cambiare da una versione all'altra della libreria): viene da
 * `runtimeCaching: []` in `app/sw.ts` e da `npm run audit:pwa-cache`, che
 * ispeziona il manifest REALMENTE generato dopo ogni build invece di
 * fidarsi di ciò che questa configurazione dichiara di fare.
 *
 * `useNativeEsbuild: true` (il default su Windows, esplicitato qui perché
 * non è ovvio dal solo `swSrc`): la cartella del progetto contiene un
 * carattere Unicode non-ASCII (`⠀`), e `esbuild-wasm` lo rifiuta con
 * *"the working directory ... is not an absolute path"* — un limite del
 * suo shim WASI di risoluzione dei percorsi, non del progetto. L'`esbuild`
 * nativo usa le API del filesystem del sistema operativo e non ha questo
 * problema. Verificato costruendo con entrambi.
 */
export const { GET, dynamic, dynamicParams, revalidate, generateStaticParams } = createSerwistRoute({
	swSrc: "app/sw.ts",
	useNativeEsbuild: true,
	additionalPrecacheEntries: [{ url: "/~offline", revision: offlinePageRevision }],
});
