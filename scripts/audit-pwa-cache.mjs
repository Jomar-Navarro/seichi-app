/**
 * Audit della cache del service worker — `npm run audit:pwa-cache`
 *
 * Fase 25. Il vincolo che conta più di ogni riga di codice della fase: nessun
 * dato finanziario nella cache del service worker. Un default di libreria può
 * cambiare da una versione all'altra senza che una riga di QUESTO repo si
 * muova, ed è la classe di guasto silenzioso per cui esiste anche
 * `npm run audit:tokens`: *un controllo che non ha guardato niente non è un
 * controllo*.
 *
 * Tre controlli, perché il service worker mette in cache per tre strade:
 *
 *   A. il PRECACHE — il manifest scritto a build time. Allow-list di URL.
 *   B. il RUNTIME (#127) — fino alla #127 l'audit guardava solo A, e un
 *      `defaultCache` di Serwist (che mette in cache le pagine) passava verde:
 *      metà del rischio per cui lo script esiste gli sfuggiva. Ora ogni
 *      `handler` di `runtimeCaching` dev'essere un'istanza di una classe che non
 *      legge né scrive una cache, verificato risalendo la catena delle classi; e
 *      il NOSTRO codice non deve toccare la Cache API, registrare route o
 *      ascoltare eventi per conto suo.
 *   C. la REVISIONE di `/~offline` (#127) — dev'essere quella che
 *      `lib/offline-revision.mjs` calcola dalle altre voci del precache, e fra
 *      quelle dev'esserci il `_buildManifest` della build, o non cambierebbe
 *      più a ogni deploy. Altrimenti, dopo un deploy che cambia solo gli
 *      stili, la pagina offline può uscire senza stile.
 *
 * ⚠️ Legge il worker REALMENTE COMPILATO in `.next/server/app/serwist/`, non
 * `app/sw.ts`: solo la build sa cosa Serwist ha messo dentro per davvero.
 * Serve quindi una build recente — se manca, il controllo lo dichiara invece di
 * passare in silenzio. E ogni forma che lo script non sa leggere è un
 * FALLIMENTO, non un passaggio.
 *
 * ⚠️ Lo legge con un PARSER vero (`espree` + `eslint-scope`, gli stessi di
 * ESLint) e non con espressioni regolari. La prima versione della #127 aveva un
 * lettore scritto a mano, e la code review ci ha trovato tre falsi verdi: nel
 * codice minificato i nomi corti si riusano in scope diversi (`s=` compariva 49
 * volte, e "il primo `s=[`" era un array qualunque), una regex letterale come
 * `/[)]/` chiudeva in anticipo il corpo di una classe nascondendo un
 * `cachePut`, e una chiave scritta in un'altra forma risultava "assente".
 * Con un albero sintattico i nomi si risolvono per scope, e le tre cose non
 * esistono più. Quale codice è NOSTRO lo dice la source map: i nodi che
 * vengono da `app/sw.ts`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as espree from "espree";
import * as eslintScope from "eslint-scope";
import { OFFLINE_URL, offlineRevision } from "../lib/offline-revision.mjs";

const DIR = join(process.cwd(), ".next/server/app/serwist");
const SW_BODY = join(DIR, "sw.js.body");
const SW_MAP = join(DIR, "sw.js.map.body");
const OUR_SOURCE = "app/sw.ts";

if (!existsSync(SW_BODY) || !existsSync(SW_MAP)) {
	console.log(
		"⚠️  Nessuna build trovata — esegui `npm run build` prima di `audit:pwa-cache`.",
	);
	console.log("Il controllo non ha guardato niente: non è un successo, è un mancato controllo.");
	process.exit(1);
}

const body = readFileSync(SW_BODY, "utf8");
const problems = [];
const fail = (msg) => {
	console.log(`\n❌ ${msg}`);
	console.log("\n❌ Audit della cache PWA: il worker non si lascia leggere — va guardato a mano.");
	process.exit(1);
};

// ---------------------------------------------------------------------------
// Albero sintattico, scope e source map
// ---------------------------------------------------------------------------

// Analizzato come MODULO anche se è uno script: in modalità script
// `eslint-scope` lascia irrisolti i riferimenti alle variabili globali, e ogni
// nome del bundle (il manifest compreso) risulterebbe "non definito".
const ECMA = 2022;
let ast;
try {
	ast = espree.parse(body, { ecmaVersion: ECMA, sourceType: "module", range: true, loc: true });
} catch (e) {
	fail(`Il worker compilato non si analizza (${e.message}).`);
}
const scopes = eslintScope.analyze(ast, { ecmaVersion: ECMA, sourceType: "module" });

/** Riferimento di ogni identificatore, per risolverlo nel suo scope. */
const refOf = new Map();
for (const scope of scopes.scopes) for (const ref of scope.references) refOf.set(ref.identifier, ref);

/** Visita ogni nodo sotto `node`. */
function walk(node, visit) {
	if (!node || typeof node.type !== "string") return;
	visit(node);
	for (const [key, value] of Object.entries(node)) {
		if (key === "parent" || key === "loc" || key === "range") continue;
		if (Array.isArray(value)) for (const v of value) walk(v, visit);
		else if (value && typeof value.type === "string") walk(value, visit);
	}
}

/** Il valore assegnato UNA volta sola a un identificatore, o la ragione per cui
 *  non lo si può dire. Più scritture (o una definizione che non è un
 *  inizializzatore) e non si sa quale sia quella che conta: si fallisce. */
function definitionOf(id) {
	const variable = refOf.get(id)?.resolved;
	if (!variable) return { error: `${id.name} non è definito nel worker` };
	if (variable.defs.length !== 1) return { error: `${id.name} ha ${variable.defs.length} definizioni` };
	const def = variable.defs[0];
	if (def.type === "ClassName") return { node: def.node };
	const writes = variable.references.filter((r) => r.isWrite());
	if (writes.length !== 1 || !writes[0].writeExpr) {
		return { error: `${id.name} è scritto ${writes.length} volte` };
	}
	return { node: writes[0].writeExpr };
}

// La source map dice da quale sorgente viene ogni punto del codice compilato.
// Decodifica VLQ a mano: sono poche righe, e si evita un'altra dipendenza.
const map = JSON.parse(readFileSync(SW_MAP, "utf8"));
const ourIndex = map.sources.indexOf(OUR_SOURCE);
if (ourIndex === -1) fail(`La source map non contiene ${OUR_SOURCE}: non so quale codice sia nostro.`);
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** Per ogni riga compilata: [[colonna, indice sorgente], …] in ordine. */
const segments = map.mappings.split(";").map(() => []);
{
	let source = 0;
	map.mappings.split(";").forEach((line, li) => {
		let col = 0;
		for (const seg of line.split(",")) {
			if (!seg) continue;
			const fields = [];
			let value = 0;
			let shift = 0;
			for (const ch of seg) {
				const digit = B64.indexOf(ch);
				value += (digit & 31) << shift;
				if (digit & 32) shift += 5;
				else {
					fields.push(value & 1 ? -(value >> 1) : value >> 1);
					value = 0;
					shift = 0;
				}
			}
			col += fields[0];
			if (fields.length > 1) source += fields[1];
			segments[li].push([col, fields.length > 1 ? source : -1]);
		}
	});
}
/** Il nodo viene da `app/sw.ts`? */
function isOurs(node) {
	const { line, column } = node.loc.start;
	let source = -1;
	for (const [col, src] of segments[line - 1] ?? []) {
		if (col > column) break;
		source = src;
	}
	return source === ourIndex;
}

const keyName = (prop) =>
	prop.type === "Property" && !prop.computed
		? prop.key.type === "Identifier"
			? prop.key.name
			: String(prop.key.value)
		: undefined;
const propValue = (obj, name) => obj.properties.find((p) => keyName(p) === name)?.value;

// ---------------------------------------------------------------------------
// Le opzioni del NOSTRO `new Serwist({...})`
// ---------------------------------------------------------------------------

const optionCalls = [];
walk(ast, (n) => {
	if (n.type === "NewExpression" && isOurs(n) && n.arguments[0]?.type === "ObjectExpression") {
		if (n.arguments[0].properties.some((p) => keyName(p) === "precacheEntries")) optionCalls.push(n);
	}
});
if (optionCalls.length !== 1) {
	fail(`Attesa UNA chiamata con { precacheEntries } nel nostro codice, trovate ${optionCalls.length}.`);
}
const options = optionCalls[0].arguments[0];
if (options.properties.some((p) => p.type !== "Property" || p.computed)) {
	problems.push("B. Le opzioni del service worker contengono uno spread o una chiave calcolata: va guardato a mano.");
}

// ---------------------------------------------------------------------------
// A. Precache
// ---------------------------------------------------------------------------

/** Un array letterale, diretto o tramite un nome definito una volta sola. */
function arrayOf(node, what) {
	if (node?.type === "Identifier") {
		const def = definitionOf(node);
		if (def.error) fail(`${what}: ${def.error}.`);
		node = def.node;
	}
	if (node?.type !== "ArrayExpression") fail(`${what} non è un array letterale.`);
	return node;
}

const manifestNode = arrayOf(propValue(options, "precacheEntries"), "Il precache manifest");
const entries = manifestNode.elements.map((el) => {
	if (el?.type !== "ObjectExpression") fail("Una voce del precache non è un oggetto letterale.");
	const url = propValue(el, "url");
	const revision = propValue(el, "revision");
	if (url?.type !== "Literal" || (revision && revision.type !== "Literal")) {
		fail("Una voce del precache non ha url e revisione letterali.");
	}
	return { url: url.value, revision: revision?.value ?? null };
});

// Allow-list, non deny-list: qualunque cosa non riconosciuta è un fallimento,
// non un'eccezione da aggiungere in fretta — è la stessa scelta di
// `audit-tokens`, che dichiara mancante ogni var(--…) non definita invece di
// fidarsi per default.
const ALLOWED_EXACT = new Set([
	OFFLINE_URL, // fallback offline — testo statico, zero dati (app/~offline/page.tsx)
	"/icon-192.png",
	"/icon-512.png",
	"/icon-512-maskable.png",
	"/apple-touch-icon.png",
]);
const ALLOWED_PREFIXES = [
	"/_next/static/", // chunk JS/CSS versionati per build, non dati
	// Splash `apple-touch-startup-image` (16 file, uno per device×tema — vedi
	// scripts/generate-pwa-splash.mjs): come le icone sopra, sfondo + badge
	// statici e versionati, zero dati dell'utente. Un prefisso e non i 16 nomi
	// esatti perché la lista dei device è dichiaratamente destinata a crescere
	// (Fase 25/splash, "copertura deliberatamente parziale") senza che questo
	// controllo debba essere toccato a ogni aggiunta.
	"/splash/",
];

console.log(`A. ${entries.length} entry nel precache.`);
for (const e of entries) {
	if (!ALLOWED_EXACT.has(e.url) && !ALLOWED_PREFIXES.some((p) => e.url.startsWith(p))) {
		problems.push(
			`A. Nel precache un URL fuori dall'allow-list: ${e.url}\n` +
				"   Se è un asset statico nuovo e legittimo (un'icona), va aggiunto all'allow-list a mano —\n" +
				"   MAI una rotta applicativa: è ciò che questo controllo esiste per impedire.",
		);
	}
}

// ---------------------------------------------------------------------------
// B. Runtime
// ---------------------------------------------------------------------------

// Le chiamate che leggono o scrivono la cache, nei metodi di una strategia
// Serwist (`StrategyHandler`). Un `NetworkOnly` usa solo `fetch`.
const CACHE_METHODS = new Set(["cachePut", "cacheMatch", "fetchAndCachePut"]);
/** Il primo accesso alla cache sotto `node`, o null. */
function cacheAccessUnder(node) {
	let hit = null;
	walk(node, (n) => {
		if (hit) return;
		if (n.type === "MemberExpression") {
			const name = n.computed ? n.property.value : n.property.name;
			if (CACHE_METHODS.has(name)) hit = name;
		}
		// `caches` non definito nel worker è il globale della Cache API.
		if (n.type === "Identifier" && n.name === "caches" && refOf.get(n) && !refOf.get(n).resolved) hit = "caches";
	});
	return hit;
}

/** Risale la catena delle classi; restituisce la ragione del rifiuto, o null. */
function cacheAccessInClass(id, seen = new Set()) {
	if (id.type !== "Identifier") return "una classe che non è un nome semplice";
	const def = definitionOf(id);
	if (def.error) return def.error;
	const cls = def.node;
	if (cls.type !== "ClassExpression" && cls.type !== "ClassDeclaration") return `${id.name} non è una classe`;
	if (seen.has(cls)) return `catena di classi circolare su ${id.name}`;
	seen.add(cls);
	const hit = cacheAccessUnder(cls.body);
	if (hit) return `la classe ${id.name} usa \`${hit}\``;
	return cls.superClass ? cacheAccessInClass(cls.superClass, seen) : null;
}

const rc = propValue(options, "runtimeCaching");
if (!rc) {
	console.log("B. Nessuna strategia di runtime.");
} else {
	const rules = [];
	const collect = (node, depth = 0) => {
		if (depth > 3) fail("runtimeCaching: troppi livelli di indirezione.");
		for (const el of arrayOf(node, "runtimeCaching").elements) {
			if (el?.type === "SpreadElement") collect(el.argument, depth + 1);
			else rules.push(el);
		}
	};
	collect(rc);
	console.log(`B. ${rules.length} strategi${rules.length === 1 ? "a" : "e"} di runtime.`);
	rules.forEach((rule, i) => {
		const n = i + 1;
		const handler = rule?.type === "ObjectExpression" ? propValue(rule, "handler") : undefined;
		if (handler?.type !== "NewExpression") {
			problems.push(`B. Strategia ${n}: l'handler non è un \`new <Strategia>\`: va guardato a mano.`);
			return;
		}
		const name = handler.callee.name ?? "?";
		const cacheName = handler.arguments[0]?.type === "ObjectExpression" ? propValue(handler.arguments[0], "cacheName") : undefined;
		const label = `B. Strategia ${n} (new ${name}${cacheName?.type === "Literal" ? `, cache "${cacheName.value}"` : ""})`;
		// Le opzioni della strategia: niente o un oggetto letterale senza plugin.
		// I plugin girano dentro la strategia e possono scrivere da sé: un
		// BackgroundSyncPlugin mette in IndexedDB il corpo delle richieste
		// fallite, server action comprese. La catena delle classi non li vede.
		const args = handler.arguments;
		const readable =
			args.length === 0 ||
			(args.length === 1 &&
				args[0].type === "ObjectExpression" &&
				args[0].properties.every((p) => p.type === "Property" && !p.computed));
		if (!readable) {
			problems.push(`${label}: opzioni non leggibili: va guardato a mano.`);
			return;
		}
		if (args[0] && propValue(args[0], "plugins")) {
			problems.push(`${label}: riceve dei plugin, che possono scrivere da sé: va guardato a mano.`);
			return;
		}
		const why = cacheAccessInClass(handler.callee);
		if (why) {
			problems.push(`${label}: ${why}.\n   Una strategia che usa la cache a runtime può salvare pagine con dati finanziari.`);
		} else console.log(`   ${n}. new ${name} — non usa la cache`);
	});
}

// Il nostro codice fuori da runtimeCaching: niente Cache API, niente route
// registrate a mano, niente ascoltatori propri. `serwist.addEventListeners()`
// (plurale) è il metodo della libreria, e passa.
const ROUTE_CALLS = new Set(["registerRoute", "registerCapture", "setDefaultHandler", "setCatchHandler", "addEventListener"]);
const ourHits = new Set();
walk(ast, (n) => {
	if (!isOurs(n)) return;
	if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && !n.callee.computed) {
		if (ROUTE_CALLS.has(n.callee.property.name)) ourHits.add(`chiama \`${n.callee.property.name}\``);
	}
	if (n.type === "Identifier" && n.name === "caches" && refOf.get(n) && !refOf.get(n).resolved) {
		ourHits.add("usa la Cache API (`caches`)");
	}
});
for (const hit of ourHits) problems.push(`B. ${OUR_SOURCE} ${hit} fuori da runtimeCaching: va guardato a mano.`);

// ---------------------------------------------------------------------------
// C. Revisione di /~offline
// ---------------------------------------------------------------------------

const offline = entries.find((e) => e.url === OFFLINE_URL);
const expected = offlineRevision(entries);
if (!offline) {
	problems.push("C. /~offline non è nel precache: offline il browser mostrerebbe il suo errore.");
} else if (offline.revision !== expected) {
	problems.push(
		`C. Revisione di /~offline ${offline.revision}, attesa ${expected} dalle altre voci del precache.\n` +
			"   Non segue più ciò che il worker scarica: dopo un deploy la pagina offline può uscire senza stile.",
	);
} else if (!entries.some((e) => /^\/_next\/static\/[^/]+\/_buildManifest\.js$/.test(e.url))) {
	problems.push(
		"C. Nel precache non c'è il _buildManifest della build: la revisione di /~offline non cambia più a ogni build.",
	);
} else {
	console.log(`C. Revisione di /~offline ${offline.revision}, calcolata dalle altre ${entries.length - 1} voci.`);
}

// ---------------------------------------------------------------------------

if (problems.length === 0) {
	console.log("\n✅ Audit della cache PWA superato: nessuna pagina applicativa in cache.");
	process.exit(0);
}
console.log("");
for (const p of problems) console.log(`❌ ${p}`);
console.log(`\n❌ Audit della cache PWA: ${problems.length} problem${problems.length === 1 ? "a" : "i"}.`);
process.exit(1);
