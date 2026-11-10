/**
 * Il collaudo end-to-end (#156) gira su un Supabase LOCALE, in Docker, mai su
 * quello di produzione. Questo script fa le tre cose che servono:
 *
 *   node scripts/e2e.mjs db      avvia il database locale (`supabase start`),
 *                                che ricostruisce lo schema dalle migration
 *   node scripts/e2e.mjs build   costruisce l'app CONTRO quel database, nella
 *                                cartella `.next`, e ci lascia il marcatore
 *   node scripts/e2e.mjs serve   controlla il marcatore e serve la build su
 *                                :3200 — è il `webServer` di Playwright
 *
 * ⚠️⚠️ Il marcatore è la difesa della produzione. Le NEXT_PUBLIC_* sono
 * inlinizzate in compilazione, quindi a decidere su quale database scrivono i
 * test è la BUILD, non le variabili del momento: una `.next` costruita con
 * `.env.local` (cioè per la produzione) e servita ai test creerebbe account
 * sul database vero. `next build` svuota `.next` all'inizio, quindi il
 * marcatore sopravvive solo finché nessun'altra build lo sostituisce, e
 * `serve` si rifiuta di avviare il server senza. Il controllo sta QUI e non
 * nel `globalSetup`: Playwright avvia il `webServer` prima del `globalSetup`
 * (code review della #156, letto nel sorgente del runner).
 */
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertLocal, E2E_BASE_URL, E2E_MARKER, E2E_PORT, readLocalStatus } from "./e2e-local.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MODE = process.argv[2];
const SIGNING_KEYS = `${ROOT}supabase/signing_keys.json`;

/*
 * I servizi che l'app non usa restano spenti in `config.toml` (realtime, edge
 * functions, analytics, email, S3, vettori); questi li escludiamo solo qui,
 * perché in locale Studio fa comodo. imgproxy serve alle trasformazioni delle
 * immagini, che l'app non chiede: avatar e ricevute li riduce il client.
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

/**
 * La chiave di firma ES256, come in produzione. Senza, il Supabase locale
 * firma con un segreto HS256, e `getClaims()` ripiega in silenzio su
 * `getUser()`: i test girerebbero su un percorso d'autenticazione diverso da
 * quello vero (vedi «Costo delle richieste a Supabase» in CLAUDE.md).
 * Generata alla prima esecuzione e mai committata: è una chiave privata, anche
 * se di un database usa e getta.
 */
async function ensureSigningKey() {
	if (existsSync(SIGNING_KEYS)) return;
	const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
	const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
	const key = { ...jwk, kid: crypto.randomUUID(), alg: "ES256", use: "sig", key_ops: ["sign", "verify"] };
	writeFileSync(SIGNING_KEYS, JSON.stringify([key], null, 2) + "\n");
	console.log("chiave di firma ES256 generata in supabase/signing_keys.json");
}

async function db() {
	await ensureSigningKey();
	// ⚠️ `start` su uno stack già acceso NON riparte: dice che gira ed esce. Una
	// chiave scritta adesso, o configurazione cambiata, non arriverebbe ad Auth.
	run(`npx supabase start -x ${EXCLUDED.join(",")}`, { stdio: "inherit" });
	const s = readLocalStatus(ROOT);
	const [{ kid }] = JSON.parse(readFileSync(SIGNING_KEYS, "utf8"));
	const jwks = await (await fetch(`${s.url}/auth/v1/.well-known/jwks.json`)).json();
	if (!jwks.keys?.some((k) => k.kid === kid)) {
		console.error(
			"⚠️ Auth non firma con supabase/signing_keys.json: lo stack era già acceso con un'altra configurazione. " +
				"`npx supabase stop --no-backup`, poi di nuovo `npm run e2e:db`.",
		);
		process.exitCode = 1;
	}
}

function build() {
	const s = readLocalStatus(ROOT);
	const env = {
		...process.env,
		NEXT_PUBLIC_SUPABASE_URL: s.url,
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: s.publishableKey,
		NEXT_PUBLIC_SITE_URL: E2E_BASE_URL,
		NEXT_TELEMETRY_DISABLED: "1",
	};
	// Le variabili del processo battono `.env.local`: è così che questa build
	// non vede le chiavi di produzione pur avendole accanto.
	run("npx next build", { env, stdio: "inherit" });
	writeFileSync(`${ROOT}${E2E_MARKER}`, JSON.stringify({ supabaseUrl: s.url, builtAt: new Date().toISOString() }, null, 2));
	console.log(`build dei test pronta (Supabase ${s.url}), marcatore in ${E2E_MARKER}`);
}

function serve() {
	const marker = `${ROOT}${E2E_MARKER}`;
	if (!existsSync(marker)) {
		throw new Error(
			`Manca ${E2E_MARKER}: l'ultima build non è quella dei test. Prima \`npm run e2e:build\` (con il database locale acceso: \`npm run e2e:db\`).`,
		);
	}
	const { supabaseUrl } = JSON.parse(readFileSync(marker, "utf8"));
	assertLocal(supabaseUrl);
	const s = readLocalStatus(ROOT);
	if (supabaseUrl !== s.url) {
		throw new Error(`La build punta a ${supabaseUrl}, il database locale risponde su ${s.url}: \`npm run e2e:build\`.`);
	}
	const child = spawn(`npx next start -p ${E2E_PORT}`, {
		cwd: ROOT,
		shell: true,
		stdio: "inherit",
		// Ciò che il server legge a runtime: le stesse della build, e battono `.env.local`.
		env: {
			...process.env,
			NEXT_PUBLIC_SUPABASE_URL: s.url,
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: s.publishableKey,
			NEXT_PUBLIC_SITE_URL: E2E_BASE_URL,
			NEXT_TELEMETRY_DISABLED: "1",
		},
	});
	child.on("exit", (code) => {
		process.exitCode = code ?? 1;
	});
	for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
}

if (MODE === "db") await db();
else if (MODE === "build") build();
else if (MODE === "serve") serve();
else if (MODE === "env") {
	// Per chi vuole puntare `npm run dev` al database locale a mano.
	const s = readLocalStatus(ROOT);
	console.log(`NEXT_PUBLIC_SUPABASE_URL=${s.url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${s.publishableKey}`);
} else {
	console.error("uso: node scripts/e2e.mjs db|build|serve|env");
	process.exitCode = 2;
}
