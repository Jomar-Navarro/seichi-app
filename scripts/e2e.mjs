/**
 * Il collaudo end-to-end (#156) gira su un Supabase LOCALE, in Docker, mai su
 * quello di produzione. Questo script prepara le due cose che servono:
 *
 *   node scripts/e2e.mjs db      avvia il database locale (`supabase start`),
 *                                che ricostruisce lo schema dalle migration
 *   node scripts/e2e.mjs build   costruisce l'app CONTRO quel database, nella
 *                                cartella `.next`, e ci lascia il marcatore
 *
 * Poi `npm run test:e2e` (Playwright) serve quella build su :3200 e la prova.
 *
 * ⚠️⚠️ Il marcatore è la difesa della produzione. Le NEXT_PUBLIC_* sono
 * inlinizzate in compilazione, quindi a decidere su quale database scrivono i
 * test è la BUILD, non le variabili del momento: una `.next` costruita con
 * `.env.local` (cioè per la produzione) e servita ai test creerebbe account
 * sul database vero. `next build` svuota `.next` all'inizio, quindi un
 * marcatore scritto qui sopravvive solo finché nessun'altra build lo
 * sostituisce — e `tests/e2e/global-setup.ts` si rifiuta di partire senza.
 */
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MODE = process.argv[2];

// La porta dei test: né 3000 (il dev server) né 3100 (le build di collauda-app).
// ⚠️ Gli stessi due valori stanno in `tests/e2e/support/env.ts`: questo file
// si esegue all import, quindi non si può importare da lì.
const E2E_PORT = 3200;
const E2E_MARKER = ".next/e2e-supabase.json";

/*
 * I servizi che l'app non usa restano spenti anche in `config.toml` (realtime,
 * edge functions, analytics); questi li escludiamo solo qui, perché in locale
 * Studio fa comodo. imgproxy serve alle trasformazioni delle immagini, che
 * l'app non chiede: avatar e ricevute sono già ridotti dal client.
 */
const EXCLUDED = ["studio", "postgres-meta", "imgproxy", "supavisor"];

/*
 * Comandi come STRINGHE e con la shell: `npx` su Windows è un .cmd, che senza
 * shell non parte, e con la shell Node depreca gli argomenti separati (DEP0190).
 * Sono tutti costanti di questo file, nessun valore arriva da fuori.
 */
function run(command, opts = {}) {
	return execSync(command, { cwd: ROOT, encoding: "utf8", ...opts });
}

/** Le chiavi del database locale, lette dalla CLI e mai scritte nel repo. */
function localStatus() {
	const out = run("npx supabase status -o json", { stdio: ["ignore", "pipe", "ignore"] });
	// La CLI può stampare avvisi prima del JSON: si prende l'oggetto.
	const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
	const s = JSON.parse(json);
	if (!s.API_URL || !s.PUBLISHABLE_KEY) throw new Error("`supabase status` non ha restituito API_URL e PUBLISHABLE_KEY");
	return s;
}

/**
 * La chiave di firma ES256, come in produzione. Senza, il Supabase locale
 * firma con un segreto HS256, e `getClaims()` ripiega in silenzio su
 * `getUser()`: i test girerebbero su un percorso d'autenticazione diverso da
 * quello vero (vedi «Costo delle richieste a Supabase» in CLAUDE.md).
 * Generata alla prima esecuzione e mai committata: è una chiave privata, anche
 * se di un database usa e getta.
 */
async function ensureSigningKey() {
	const path = `${ROOT}supabase/signing_keys.json`;
	if (existsSync(path)) return;
	const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
	const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
	const key = { ...jwk, kid: crypto.randomUUID(), alg: "ES256", use: "sig", key_ops: ["sign", "verify"] };
	writeFileSync(path, JSON.stringify([key], null, 2) + "\n");
	console.log("chiave di firma ES256 generata in supabase/signing_keys.json");
}

async function db() {
	await ensureSigningKey();
	// `start` su uno stack già acceso non riparte: dice che gira e esce.
	run(`npx supabase start -x ${EXCLUDED.join(",")}`, { stdio: "inherit" });
}

function build() {
	const s = localStatus();
	const url = new URL(s.API_URL);
	// La stessa condizione che controlla global-setup: costruire contro un host
	// che non è questa macchina non deve nemmeno cominciare.
	if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
		throw new Error(`API_URL non è locale (${s.API_URL}): rifiuto di costruire i test contro un altro database`);
	}
	const env = {
		...process.env,
		NEXT_PUBLIC_SUPABASE_URL: s.API_URL,
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: s.PUBLISHABLE_KEY,
		NEXT_PUBLIC_SITE_URL: `http://localhost:${E2E_PORT}`,
		NEXT_TELEMETRY_DISABLED: "1",
	};
	// Le variabili del processo battono `.env.local`: è così che questa build
	// non vede le chiavi di produzione pur avendole accanto.
	run("npx next build", { env, stdio: "inherit" });
	writeFileSync(`${ROOT}${E2E_MARKER}`, JSON.stringify({ supabaseUrl: s.API_URL, builtAt: new Date().toISOString() }, null, 2));
	console.log(`build dei test pronta (Supabase ${s.API_URL}), marcatore in ${E2E_MARKER}`);
}

if (MODE === "db") await db();
else if (MODE === "build") build();
else if (MODE === "env") {
	// Per chi vuole puntare `npm run dev` al database locale a mano.
	const s = localStatus();
	console.log(`NEXT_PUBLIC_SUPABASE_URL=${s.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${s.PUBLISHABLE_KEY}`);
} else {
	console.error("uso: node scripts/e2e.mjs db|build|env");
	process.exitCode = 2;
}
