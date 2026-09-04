/**
 * Audit del precache del service worker — `npm run audit:pwa-cache`
 *
 * Fase 25. Il vincolo che conta più di ogni riga di codice della fase: nessun
 * dato finanziario nella cache del service worker. `app/sw.ts` non ha
 * `runtimeCaching`, quindi in teoria il rischio è già chiuso — ma un default
 * di libreria può cambiare da una versione all'altra senza che una riga di
 * QUESTO repo si muova, ed è esattamente la classe di guasto silenzioso che
 * `npm run audit:tokens` esiste per la stessa ragione dalla Fase 18: *un
 * controllo che non ha guardato niente non è un controllo*.
 *
 * ⚠️ Legge il manifest REALMENTE COMPILATO in `.next/server/app/serwist/`,
 * non una lista scritta a mano: solo la build sa cosa Serwist ha messo dentro
 * per davvero. Serve quindi una build recente — se manca, il controllo lo
 * dichiara invece di passare in silenzio, la stessa regola di `audit-tokens`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SW_BODY = join(ROOT, ".next/server/app/serwist/sw.js.body");

if (!existsSync(SW_BODY)) {
	console.log(
		"⚠️  Nessuna build trovata — esegui `npm run build` prima di `audit:pwa-cache`.",
	);
	console.log("Il controllo non ha guardato niente: non è un successo, è un mancato controllo.");
	process.exit(1);
}

const body = readFileSync(SW_BODY, "utf8");

// Il manifest è il primo array letterale `[{url:"...",...}]` del file — il
// nome della variabile a cui è assegnato cambia a ogni build (minificato),
// quindi non ci si appoggia a quello. Finisce al primo `}];`: ogni entry
// intermedia chiude con `},`, solo l'ultima con `}]`.
const match = body.match(/\[\{url:"[\s\S]*?\}\];/);
if (!match) {
	console.log("❌ Nessun precache manifest trovato in sw.js.body — atteso un array [{url:...}].");
	console.log("   Il formato compilato da Serwist potrebbe essere cambiato: va guardato a mano.");
	process.exit(1);
}

// Non è JSON valido (chiavi senza virgolette): è però JS valido, esattamente
// come compilato da Serwist — la stessa cosa che il browser eseguirebbe.
const entries = new Function(`return ${match[0].replace(/;$/, "")}`)();

// Allow-list, non deny-list: qualunque cosa non riconosciuta è un fallimento,
// non un'eccezione da aggiungere in fretta — è la stessa scelta di
// `audit-tokens`, che dichiara mancante ogni var(--…) non definita invece di
// fidarsi per default.
const ALLOWED_EXACT = new Set([
	"/~offline", // fallback offline — testo statico, zero dati (app/~offline/page.tsx)
	"/icon-192.png",
	"/icon-512.png",
	"/icon-512-maskable.png",
	"/apple-touch-icon.png",
]);
const ALLOWED_PREFIX = "/_next/static/"; // chunk JS/CSS versionati per build, non dati

const bad = entries.filter((e) => !ALLOWED_EXACT.has(e.url) && !e.url.startsWith(ALLOWED_PREFIX));

console.log(`${entries.length} entry nel precache.\n`);

if (bad.length === 0) {
	console.log("✅ Audit della cache PWA superato: nessuna pagina applicativa nel precache.");
	process.exit(0);
}

for (const e of bad) {
	console.log(`❌ Nel precache un URL fuori dall'allow-list: ${e.url}`);
}
console.log(
	`\n❌ Audit della cache PWA: ${bad.length} entr${bad.length === 1 ? "y" : "ies"} inattes${bad.length === 1 ? "a" : "e"}.`,
);
console.log(
	"Se è un asset statico nuovo e legittimo (es. un'icona aggiunta), aggiungilo all'allow-list qui sopra",
);
console.log(
	"a mano — MAI aggiungere una rotta applicativa: è precisamente ciò che questo controllo esiste per impedire.",
);
process.exit(1);
