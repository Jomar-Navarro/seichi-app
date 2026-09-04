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
//
// ⚠️⚠️ Il vincolo che conta più di ogni riga qui sotto: NESSUN
// `runtimeCaching`. Ogni pagina di Seichi è dinamica — cookie di sessione a
// ogni richiesta, proxy sempre attivo — ed è la stessa ragione per cui
// l'export CSV (23a) risponde `Cache-Control: private, no-store` e per cui
// `next.config.ts` esclude dalla cache le quattro rotte che scrivono cookie
// di sessione. Un service worker è una cache in più, sotto la nostra
// responsabilità: qui non c'è nessuna strategia di runtime caching, quindi
// ogni richiesta che non sia nel precache va in rete e basta — mai una
// risposta finanziaria servita da una cache sul dispositivo. Verificato
// anche a build con `npm run audit:pwa-cache` (guardia post-build).
//
// NON si importa `defaultCache` da "@serwist/turbopack/worker": quella è la
// lista di strategie CONSIGLIATA da Serwist per un'app Next generica, e
// include la cache delle pagine RSC (`PAGES_CACHE_NAME.rsc`) — esattamente
// ciò che questa fase esiste per escludere.

import { Serwist } from "serwist";

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
	// Nessuna strategia di runtime caching — vedi il commento in testa al file.
	runtimeCaching: [],
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
