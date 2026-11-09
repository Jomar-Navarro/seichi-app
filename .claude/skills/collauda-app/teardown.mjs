/**
 * Collaudo — elimina l'account di prova creato da `setup.mjs` (SKILL.md, §2).
 *
 * Dall'app, come un utente: login, `/impostazioni/elimina`, i due passi. Così
 * passa anche dalla rimozione dei file nello Storage (ricevute, avatar), che
 * in SQL non si può fare. Poi verifica che il login non entri più: un referto
 * che dice "eliminato" senza averlo provato non distingue il successo da un
 * gesto che non ha fatto niente.
 *
 *   SEICHI_DIR   la stessa cartella del setup (legge `account.json`)
 *   SEICHI_URL   opzionale, default http://localhost:3000
 *
 * ⚠️ Niente `process.exit()` dopo una richiesta di rete: su Windows, chiamato
 * mentre le connessioni di `fetch` si stanno chiudendo, fa fallire
 * un'asserzione di libuv e lo script esce con 127 dopo aver fatto il suo
 * lavoro. Si lascia finire lo script e si imposta `process.exitCode`.
 */
import { chromium } from "playwright";
import nextEnv from "@next/env";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const BASE = process.env.SEICHI_URL ?? "http://localhost:3000";
const DIR = process.env.SEICHI_DIR;
if (!DIR || !existsSync(`${DIR}/account.json`)) {
	console.error("Serve SEICHI_DIR con dentro l'account.json scritto da setup.mjs.");
	process.exit(2);
}
const { email, password } = JSON.parse(readFileSync(`${DIR}/account.json`, "utf8"));
nextEnv.loadEnvConfig(ROOT, false, { info: () => {}, error: console.error });

/** Il login risponde ancora? `invalid_credentials` = l'account non c'è. */
async function loginStatus() {
	const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
		method: "POST",
		headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	const body = await res.json().catch(() => ({}));
	return { status: res.status, code: body.error_code ?? "" };
}
const gone = (s) => s.status === 400 && s.code === "invalid_credentials";

// Rinominato e non cancellato: resta la traccia di quale account è stato
// usato, e setup.mjs non lo scambia per uno ancora vivo.
function retire(message) {
	renameSync(`${DIR}/account.json`, `${DIR}/account.eliminato.json`);
	console.log(message);
}

async function deleteFromApp() {
	const browser = await chromium.launch();
	const context = await browser.newContext({ locale: "it-IT", viewport: { width: 414, height: 896 } });
	const page = await context.newPage();
	try {
		await page.goto(`${BASE}/sign`, { waitUntil: "networkidle" });
		await page.fill('input[name="email"]', email);
		await page.fill('input[name="password"]', password);
		// Il tab "Accedi" in cima ha lo stesso testo del bottone: si cerca nel form.
		await page.locator("form").getByRole("button", { name: "Accedi" }).click();
		await page.waitForURL((u) => !u.pathname.startsWith("/sign"), { timeout: 20000 });
		await page.goto(`${BASE}/impostazioni/elimina`, { waitUntil: "networkidle" });
		await page.getByRole("button", { name: "Continua" }).click();
		await page.waitForTimeout(500);
		await page.fill('input[placeholder="il tuo indirizzo email"]', email);
		await page.fill('input[name="current-password"]', password);
		await page.getByRole("button", { name: "Elimina definitivamente" }).click();
		await page.waitForURL((u) => !u.pathname.startsWith("/impostazioni"), { timeout: 30000 });
	} catch (e) {
		// Un timeout da solo non distingue un selettore sbagliato da
		// un'eliminazione rifiutata dall'app: lo scatto mostra quale dei due,
		// frase d'errore compresa.
		await page.screenshot({ path: `${DIR}/teardown-errore.png` }).catch(() => {});
		console.error(`⚠️ eliminazione dall'app non riuscita: ${e.message.split("\n")[0]}`);
		console.error(`   scatto: ${DIR}/teardown-errore.png`);
	} finally {
		await browser.close();
	}
}

// ⚠️ Prima di tutto: se il setup si è fermato prima di registrare, l'account
// non è mai nato, e il login dal form non potrebbe che fallire — lasciando
// `account.json` lì a bloccare ogni setup successivo in questa cartella.
if (gone(await loginStatus())) {
	retire("nessun account da eliminare: il login risponde già invalid_credentials (mai nato o già eliminato)");
} else {
	await deleteFromApp();
	const after = await loginStatus();
	if (gone(after)) {
		retire("account di prova eliminato: il login risponde invalid_credentials");
	} else {
		console.error(`⚠️ il login risponde ancora ${after.status} ${after.code}: l'account NON risulta eliminato`);
		process.exitCode = 1;
	}
}
