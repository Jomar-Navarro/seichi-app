/**
 * Ciò che lo script `scripts/e2e.mjs` e la suite `tests/e2e/` devono dire
 * nello STESSO modo (#156): la porta, il marcatore della build, le chiavi del
 * Supabase locale e il controllo che sia davvero locale. Un modulo senza
 * effetti all'import, così entrambi lo importano invece di ricopiarlo.
 */
import { execSync } from "node:child_process";

/** La porta dei test: né 3000 (il dev server) né 3100 (le build di collauda-app). */
export const E2E_PORT = 3200;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
/** Lo scrive `e2e.mjs build`; `next build` svuota `.next`, quindi un'altra build lo cancella. */
export const E2E_MARKER = ".next/e2e-supabase.json";

/**
 * Le chiavi del database locale, lette dalla CLI e mai scritte nel repo.
 * Solleva con una frase che dice cosa fare se lo stack è spento.
 */
export function readLocalStatus(cwd = process.cwd()) {
	let out;
	try {
		out = execSync("npx supabase status -o json", { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	} catch (e) {
		const detail = String(e.stderr || e.message || "").trim().split("\n").pop();
		throw new Error(`Il Supabase locale non risponde: avvialo con \`npm run e2e:db\` (serve Docker). ${detail}`);
	}
	// La CLI può stampare avvisi prima del JSON: si prende l'oggetto.
	const s = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
	if (!s.API_URL || !s.PUBLISHABLE_KEY || !s.SECRET_KEY) {
		throw new Error("`supabase status` non ha restituito API_URL, PUBLISHABLE_KEY e SECRET_KEY");
	}
	assertLocal(s.API_URL);
	return { url: s.API_URL, publishableKey: s.PUBLISHABLE_KEY, secretKey: s.SECRET_KEY };
}

/**
 * ⚠️⚠️ La difesa della produzione, ripetuta ovunque si parli col database: un
 * URL che non è questa macchina non si usa, qualunque variabile l'abbia
 * portato. La chiave segreta del Supabase locale è quella pubblica della CLI;
 * l'URL di produzione arrivato per sbaglio creerebbe account veri.
 */
export function assertLocal(url) {
	let host = "";
	try {
		host = new URL(url).hostname;
	} catch {
		// resta vuoto: non è un URL, quindi non è locale
	}
	if (host !== "127.0.0.1" && host !== "localhost") {
		throw new Error(`I test end-to-end girano solo su un Supabase locale: ${url || "(vuoto)"} non lo è.`);
	}
}
