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
 */
import { chromium } from "playwright";
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
const env = Object.fromEntries(
	readFileSync(`${ROOT}.env.local`, "utf8")
		.split(/\r?\n/)
		.filter((l) => l.includes("=") && !l.startsWith("#"))
		.map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);

const browser = await chromium.launch();
const context = await browser.newContext({ locale: "it-IT", viewport: { width: 414, height: 896 } });
const page = await context.newPage();
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
await browser.close();

const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
	method: "POST",
	headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
	body: JSON.stringify({ email, password }),
});
const body = await res.json().catch(() => ({}));
if (res.status === 400 && body.error_code === "invalid_credentials") {
	// Rinominato e non cancellato: resta la traccia di quale account è stato
	// usato, e setup.mjs non lo scambia per uno ancora vivo.
	renameSync(`${DIR}/account.json`, `${DIR}/account.eliminato.json`);
	console.log("account di prova eliminato: il login risponde invalid_credentials");
} else {
	console.error(`⚠️ il login risponde ancora ${res.status} ${body.error_code ?? ""}: l'account NON risulta eliminato`);
	process.exit(1);
}
