import { createHash } from "node:crypto";

/** La pagina che il service worker mostra quando una navigazione fallisce. */
export const OFFLINE_URL = "/~offline";

/**
 * La `revision` di `/~offline` nel precache del service worker (Fase 25, #127).
 *
 * Il worker riscarica una voce del precache SOLO se la sua revisione cambia.
 * `/~offline` è una pagina resa dal server, e il suo HTML punta a CSS e JS con
 * l'hash nel nome. Fino alla #127 la revisione era l'hash del solo sorgente
 * della pagina: un deploy che cambiava gli stili senza toccarne il testo
 * lasciava al worker nuovo l'HTML vecchio, che chiede chunk già tolti dal
 * precache — e offline la pagina compariva senza stile.
 *
 * Ora la revisione è l'hash di TUTTE le altre voci del precache, cioè di ciò
 * che il worker scarica davvero: cambia quando cambia un chunk. E siccome il
 * manifest contiene i file della cartella dell'id di build
 * (`/_next/static/<buildId>/_buildManifest.js`), cambia a ogni build — anche
 * quando cambiano solo i testi del dizionario o il markup di un server
 * component, che in nessun chunk compaiono. Il costo, deliberato, è riscaricare
 * qualche KB di HTML una volta per deploy.
 *
 * ⚠️ Una funzione pura in un `.mjs` perché la usano due lati: la trasformazione
 * del manifest in `app/serwist/[path]/route.ts`, che la scrive, e
 * `scripts/audit-pwa-cache.mjs`, che la ricalcola dal worker compilato e
 * controlla che coincida. Due formule scritte a mano divergerebbero.
 *
 * @param {ReadonlyArray<{ url: string, revision?: string | null }>} entries
 *   le voci del precache; quella di `/~offline`, se c'è, viene ignorata
 * @returns {string}
 */
export function offlineRevision(entries) {
	const lines = entries
		.filter((e) => e.url !== OFFLINE_URL)
		// ⚠️ La route vede gli URL PRIMA che Serwist li riscriva (la sua
		// trasformazione gira dopo la nostra: `.next/static/x` → `/_next/static/x`,
		// `public/icon.png` → `/icon.png`), l'audit li vede DOPO. Togliendo il
		// prefisso i due lati arrivano alla stessa chiave. Con un `assetPrefix` o
		// un `basePath` non coinciderebbero più, e l'audit lo direbbe.
		.map((e) => `${e.url.replace(/^(?:\.next\/|\/_next\/|public\/|\/)/, "")} ${e.revision ?? ""}`)
		// L'ordine del glob dipende dal filesystem: ordinate, o la stessa build
		// darebbe revisioni diverse su macchine diverse.
		.sort();
	return createHash("md5").update(lines.join("\n")).digest("hex").slice(0, 16);
}
