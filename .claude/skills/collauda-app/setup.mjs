/**
 * Collaudo — prepara un ACCOUNT DI PROVA USA E GETTA (vedi SKILL.md, §2).
 *
 * Registra un utente dall'app vera (`/sign?tab=signup`), poi prepara uno stato
 * rappresentativo via REST col token di quell'utente — quindi sotto RLS, come
 * farebbe l'app. Alla fine si elimina con `teardown.mjs`.
 *
 *   SEICHI_DIR    cartella FUORI dal repo (lo scratchpad della sessione):
 *                 ci finiscono `state.json` (la sessione) e `account.json`
 *                 (email e password dell'account di prova)
 *   SEICHI_URL    opzionale, default http://localhost:3000
 *   SEICHI_EMAIL  opzionale. Senza, `git config user.email` con un `+seichi-…`
 *                 davanti alla chiocciola: un indirizzo che arriva al titolare
 *                 del repo senza scriverlo qui dentro (il repo è pubblico)
 *
 * ⚠️ Serve *Confirm email* SPENTO su Supabase (oggi lo è, vedi #40): con la
 * conferma accesa `signUp` non restituisce una sessione e la registrazione si
 * ferma su "controlla la tua email". Quel giorno il setup va rifatto.
 */
import { chromium } from "playwright";
import nextEnv from "@next/env";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const BASE = process.env.SEICHI_URL ?? "http://localhost:3000";
const DIR = process.env.SEICHI_DIR;

// ⚠️ Nessun default dentro il repository: `account.json` contiene la password
// dell'account di prova e `state.json` una sessione viva.
if (!DIR) {
	console.error("Serve SEICHI_DIR, una cartella FUORI dal repository (lo scratchpad della sessione).");
	process.exit(2);
}
mkdirSync(DIR, { recursive: true });
if (existsSync(`${DIR}/account.json`)) {
	console.error(`${DIR}/account.json esiste già: un account di prova potrebbe essere vivo. Prima teardown.mjs.`);
	process.exit(2);
}

// Il lettore di `.env.local` di Next, non uno scritto a mano: virgolette,
// commenti ed `export` li gestisce come fa l'app.
nextEnv.loadEnvConfig(ROOT, false, { info: () => {}, error: console.error });
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SB || !KEY) {
	console.error("NEXT_PUBLIC_SUPABASE_URL o _PUBLISHABLE_KEY mancanti in .env.local.");
	process.exit(2);
}

/*
 * ⚠️ Niente `process.exit()` da qui in poi: su Windows, chiamato dopo una
 * `fetch` mentre le connessioni si chiudono, fa fallire un'asserzione di libuv
 * (uscita 127). Si imposta `process.exitCode` e si lascia finire lo script.
 */
// Prima di scrivere qualunque cosa: con il server spento si fermerebbe dopo
// aver scritto `account.json` per un account mai nato.
const ping = await fetch(`${BASE}/welcome`).catch(() => null);
if (ping?.status !== 200) {
	console.error(`${BASE}/welcome non risponde 200 (${ping?.status ?? "nessuna risposta"}): il server è acceso?`);
	process.exitCode = 2;
} else {
	await run();
}

async function run() {
	function testEmail() {
		if (process.env.SEICHI_EMAIL) return process.env.SEICHI_EMAIL;
		const own = execSync("git config user.email", { cwd: ROOT, encoding: "utf8" }).trim();
		const at = own.indexOf("@");
		if (at < 1) throw new Error("git config user.email vuoto: passa SEICHI_EMAIL");
		// Al secondo più un suffisso casuale: due setup nello stesso minuto (il
		// branch e la controprova su master) non devono chiedere lo stesso indirizzo.
		const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
		return `${own.slice(0, at)}+seichi-${stamp}-${randomBytes(2).toString("hex")}${own.slice(at)}`;
	}
	const EMAIL = testEmail();
	// Generata qui e scritta solo in SEICHI_DIR: non passa mai dalla conversazione.
	const PASSWORD = `Prova-${randomBytes(9).toString("base64url")}!7`;

	// Scritto PRIMA della registrazione: se qualcosa si rompe a metà, teardown.mjs
	// sa comunque quale account eliminare — o scopre che non è mai nato.
	writeFileSync(`${DIR}/account.json`, JSON.stringify({ email: EMAIL, password: PASSWORD }, null, 2));

	const browser = await chromium.launch();
	const context = await browser.newContext({ locale: "it-IT", viewport: { width: 414, height: 896 } });
	const page = await context.newPage();

	try {
		await page.goto(`${BASE}/sign?tab=signup`, { waitUntil: "networkidle" });
		await page.fill('input[name="name"]', "Prova");
		await page.fill('input[name="surname"]', "Collaudo");
		await page.fill('input[name="email"]', EMAIL);
		await page.fill('input[name="password"]', PASSWORD);
		await page.fill('input[name="confirm-password"]', PASSWORD);
		await page.check("#privacy");
		await page.locator("form").getByRole("button", { name: "Crea account" }).click();
		await page.waitForURL(/\/start/, { timeout: 20000 });

		// Il token dal cookie di sessione, che Supabase spezza in `.0`, `.1`…
		const parts = (await context.cookies())
			.filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((c) => c.value)
			.join("");
		const session = JSON.parse(Buffer.from(parts.replace(/^base64-/, ""), "base64url").toString("utf8"));
		const token = session.access_token;
		const uid = session.user.id;

		async function rest(method, path, body, prefer = "return=representation") {
			const res = await fetch(`${SB}/rest/v1/${path}`, {
				method,
				headers: { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: prefer },
				body: body ? JSON.stringify(body) : undefined,
			});
			const text = await res.text();
			if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
			return text ? JSON.parse(text) : null;
		}

		/*
		 * Lo stato che il driver si aspetta: due conti (il passo 2 ne sceglie uno),
		 * una categoria per ogni tipo, sei mesi di movimenti per i grafici, un
		 * trasferimento, un versamento su un obiettivo, una regola ricorrente (passo
		 * 11) e un budget (la nota del passo 5 compare solo se ce n'è uno).
		 */
		// `currency` è il cancello dell'onboarding: valorizzata, si entra in home.
		// ⚠️ Una PATCH che non trova la riga risponde 200 con zero righe: senza
		// questo controllo il driver finirebbe su /start e accumulerebbe KO fuorvianti.
		const profilo = await rest("PATCH", `profiles?id=eq.${uid}`, { currency: "EUR", language: "it" });
		if (!profilo?.length) throw new Error("la PATCH su profiles non ha toccato nessuna riga: il profilo manca?");

		const conti = await rest("POST", "accounts", [
			{ user_id: uid, name: "Conto principale", type: "corrente", initial_balance: 1500 },
			{ user_id: uid, name: "Revolut", type: "corrente", initial_balance: 300 },
		]);
		const principale = conti.find((c) => c.name === "Conto principale");
		const revolut = conti.find((c) => c.name === "Revolut");
		// ⚠️ Un inserimento multiplo di PostgREST vuole le STESSE chiavi su ogni riga
		// (`PGRST102`): `target_amount` va scritto anche dove è nullo.
		const cats = await rest("POST", "categories", [
			{ name: "Alimentari", icon: "ShoppingCart", color: "aka", type: "spesa" },
			{ name: "Ristoranti", icon: "Utensils", color: "aka", type: "spesa" },
			{ name: "Stipendio", icon: "Banknote", color: "midori", type: "entrata" },
			{ name: "ETF", icon: "TrendingUp", color: "ao", type: "investimento" },
			{ name: "Spotify", icon: "Music", color: "murasaki", type: "abbonamento" },
			{ name: "Vacanza", icon: "Plane", color: "kin", type: "risparmio", target_amount: 1000 },
		].map((c) => ({ user_id: uid, target_amount: null, ...c })));
		const cat = (name) => cats.find((c) => c.name === name).id;

		const at = (daysAgo) => {
			const d = new Date();
			d.setDate(d.getDate() - daysAgo);
			d.setHours(12, 0, 0, 0);
			return d.toISOString().slice(0, 19);
		};
		const row = (r) => ({ user_id: uid, account_id: principale.id, to_account_id: null, category_id: null, notes: "collaudo", ...r });
		const rows = [];
		for (let m = 0; m < 6; m++) {
			const d = m * 30 + 1;
			rows.push(row({ type: "entrata", amount: 1800 + m * 40, category_id: cat("Stipendio"), date: at(d + 2) }));
			rows.push(row({ type: "spesa", amount: 220 + m * 15, category_id: cat("Alimentari"), date: at(d) }));
			rows.push(row({ type: "spesa", amount: 90 + m * 10, category_id: cat("Ristoranti"), date: at(d + 1) }));
			rows.push(row({ type: "investimento", amount: 300, category_id: cat("ETF"), date: at(d + 3) }));
			rows.push(row({ type: "abbonamento", amount: 11.99, category_id: cat("Spotify"), date: at(d + 4) }));
		}
		rows.push(row({ account_id: revolut.id, type: "spesa", amount: 18.5, category_id: cat("Ristoranti"), date: at(0) }));
		rows.push(row({ type: "trasferimento", amount: 100, to_account_id: revolut.id, date: at(1) }));
		rows.push(row({ type: "risparmio", amount: 150, category_id: cat("Vacanza"), date: at(2) }));
		await rest("POST", "transactions", rows, "return=minimal");

		const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		const today = new Date();
		const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(today.getDate(), 28));
		await rest("POST", "recurring_rules", {
			user_id: uid,
			account_id: principale.id,
			category_id: cat("Spotify"),
			type: "abbonamento",
			amount: 11.99,
			notes: "collaudo",
			frequency: "mensile",
			start_date: iso(today),
			// Nel futuro: il job notturno non deve generare niente nella vita breve
			// di questo account.
			next_run: iso(nextMonth),
			active: true,
		}, "return=minimal");
		// La data LOCALE, come la passa l'app (`ClientClock`, Fase 17a).
		await rest("POST", "rpc/set_budget", { p_category_id: cat("Alimentari"), p_period: "mensile", p_amount: 300, p_today: iso(today) }, "return=minimal");

		await context.storageState({ path: `${DIR}/state.json` });
		console.log(`account di prova pronto (${rows.length} movimenti, 2 conti, 1 regola, 1 budget)`);
		console.log(`sessione: ${DIR}/state.json — ricordati teardown.mjs alla fine`);
	} catch (e) {
		await page.screenshot({ path: `${DIR}/setup-errore.png` }).catch(() => {});
		console.error(`⚠️ setup interrotto: ${e.message.split("\n")[0]}`);
		console.error(`   scatto: ${DIR}/setup-errore.png — ora teardown.mjs, che elimina l'account o scopre che non è mai nato`);
		process.exitCode = 1;
	} finally {
		await browser.close();
	}
}
