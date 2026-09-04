// Questo file gira in un SERVICE WORKER, non nel DOM. Usa `self`, `clients`,
// `caches`, `ExtendableEvent` con firme che il tsconfig del progetto (lib
// "dom") non conosce, e che confliggono se si aggiunge anche "webworker"
// allo stesso programma — le due lib dichiarano `self` in modo incompatibile.
// È per questo escluso dal type-check di `tsc`/`next build`, non con un
// `@ts-nocheck` (bandito dal lint di questo repo, `ban-ts-comment`) ma in
// `tsconfig.json` (`exclude`). Serwist lo compila con un proprio esbuild
// indipendente da quel tsconfig (vedi app/serwist/[path]/route.ts), quindi
// l'esclusione non lo esclude dalla build REALE — solo dal type-check.
//
// Fase 25 (PWA). ⚠️ Sorgente del service worker, NON la sua configurazione —
// quella (swSrc, globDirectory, ecc.) sta in app/serwist/[path]/route.ts.
// ⚠️⚠️ E non basta da sola: senza `<SerwistProvider>` in app/layout.tsx
// questo file non si registra in NESSUN browser (verificato — `withSerwist`
// in next.config.ts non lo fa, è solo un wrapper di config).
//
// ⚠️⚠️ Il vincolo che conta più di ogni riga qui sotto: NESSUNA cache di
// pagine applicative. Ogni pagina di Seichi è dinamica — cookie di sessione
// a ogni richiesta, proxy sempre attivo — ed è la stessa ragione per cui
// l'export CSV (23a) risponde `Cache-Control: private, no-store` e per cui
// `next.config.ts` esclude dalla cache le quattro rotte che scrivono cookie
// di sessione. Un service worker è una cache in più, sotto la nostra
// responsabilità: nessuna strategia qui sotto SCRIVE in una cache — solo la
// route qui sotto legge dal precache (già scritto a build time) quando la
// rete manca. Verificato anche a build con `npm run audit:pwa-cache`
// (guardia post-build).
//
// NON si importa `defaultCache` da "@serwist/turbopack/worker": quella è la
// lista di strategie CONSIGLIATA da Serwist per un'app Next generica, e
// include la cache delle pagine RSC (`PAGES_CACHE_NAME.rsc`) — esattamente
// ciò che questa fase esiste per escludere.

import { NetworkOnly, Serwist } from "serwist";

declare global {
	interface WorkerGlobalScope {
		__SW_MANIFEST: (import("serwist").PrecacheEntry | string)[] | undefined;
	}
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
	precacheEntries: self.__SW_MANIFEST,
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
	// ⚠️⚠️ `fallbacks` da solo non fa NIENTE: si aggancia solo alle strategie
	// elencate qui sotto (verificato nel sorgente — `Serwist` cicla
	// `runtimeCaching` e attacca il plugin del fallback a ogni handler). Con
	// `runtimeCaching: []` la prima versione di questo file il fallback
	// restava configurato ma MAI collegato a niente: offline, il browser
	// mostrava la sua pagina di errore nativa invece di `/~offline` — provato
	// con Playwright, non supposto.
	//
	// `NetworkOnly` è la strategia meno delle strategie: va sempre in rete,
	// non legge né scrive MAI una cache. È qui solo per dare al fallback un
	// punto d'aggancio — "prova la rete per una navigazione, se fallisce usa
	// il precache" — senza introdurre alcuna cache di pagine applicative.
	runtimeCaching: [
		{
			matcher: ({ request }) => request.destination === "document",
			handler: new NetworkOnly(),
		},
	],
	fallbacks: {
		entries: [
			{
				url: "/~offline",
				// Solo su una navigazione a DOCUMENTO fallita (apertura di una
				// pagina), mai su una fetch di dati: una RSC/Server Action fallita
				// deve restare un errore visibile all'app — che `useOffline()`
				// gestisce lato client — non essere sostituita in silenzio da
				// questa pagina statica.
				matcher: ({ request }) => request.destination === "document",
			},
		],
	},
});

serwist.addEventListeners();
