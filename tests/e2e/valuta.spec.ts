import type { Page } from "@playwright/test";
import { choose } from "./support/app";
import { localSql } from "./support/db";
import { expect, login, open, test } from "./support/fixtures";
import { insertMovements, seedBasic } from "./support/seed";

/**
 * La valuta scelta nell'onboarding arriva a ogni importo (#171).
 *
 * ⚠️ Il difetto che custodisce: `profiles.currency` si sceglieva e si salvava,
 * ma l'app scriveva sempre in euro (`DISPLAY_CURRENCY = "EUR"`, un segnaposto
 * della Fase 19). Chi sceglieva il dollaro vedeva € ovunque.
 *
 * Ora la valuta viaggia in un cookie, come la lingua: lo scrivono il login e
 * le action delle preferenze, e il proxy lo ricava dal profilo dove manca.
 *
 * Controprove:
 *   c1 · `getCurrency()` che restituisce sempre `FALLBACK_CURRENCY`: cadono
 *        tutti e tre — il primo alla prima pagina, su «c'è un importo in
 *        dollari», il secondo su «il proxy la ricava dal profilo» (il cookie
 *        c'è, ma nessuno lo legge), il terzo su «¥1788»;
 *   c2 · togliere il blocco della valuta da `lib/supabase/proxy.ts`: il secondo
 *        test cade su «il proxy la ricava dal profilo»;
 *   c3 · in `TransactionModal` mostrare sempre il tasto del separatore: il
 *        terzo test cade su «in yen il tastierino non ha la virgola».
 */

/**
 * Il testo di tutta la pagina, anche ciò che a questa larghezza è nascosto,
 * SENZA spazi: la card del saldo mette simbolo e cifra in due span, e si legge
 * «¥1788». Senza gli script: il payload RSC è pieno di `$` (`$RT`, `$Sreact`),
 * e «c'è un $» passava senza aver guardato un importo.
 */
async function pageText(page: Page) {
	return page.evaluate(() => {
		const body = document.body.cloneNode(true) as HTMLElement;
		body.querySelectorAll("script, style, template, noscript").forEach((n) => n.remove());
		return (body.textContent ?? "").replace(/\s+/g, "");
	});
}

test("un account in dollari vede $ ovunque: pagine, report e campanello", async ({ page, account }) => {
	const s = await seedBasic(account);
	await account.rest("PATCH", `profiles?id=eq.${account.id}`, { currency: "USD" });
	await insertMovements(account, [
		{ type: "entrata", amount: 2000, account_id: s.accounts.principale, category_id: s.cat("Stipendio") },
		{ type: "spesa", amount: 12.5, account_id: s.accounts.principale, category_id: s.cat("Ristoranti") },
		{ type: "risparmio", amount: 250, account_id: s.accounts.principale, category_id: s.cat("Vacanza") },
	]);
	await account.rest("POST", "recurring_rules", {
		user_id: account.id,
		account_id: s.accounts.principale,
		category_id: s.cat("Spotify"),
		type: "abbonamento",
		amount: 11.99,
		frequency: "mensile",
		start_date: "2099-01-01",
		next_run: "2099-01-01",
	});
	await account.rest("POST", "budgets", { user_id: account.id, category_id: null, period: "mensile", amount: 800, valid_from: "2026-01-01" });
	// Una notifica con due importi: le scrive solo il cron, quindi si prepara
	// da superutente. Il campanello compone la frase alla lettura.
	localSql(`insert into public.notifications (user_id, type, payload, dedup_key, destination)
		values ('${account.id}', 'budget_sforato', '{"category": "Ristoranti", "spent": 420, "amount": 400}', 'e2e-valuta-${account.id}', '/');`);

	// Il login riversa la valuta del profilo nel cookie.
	await login(page, account);

	for (const path of ["/?conto=", "/transazioni", "/conti", "/analisi", "/analisi/report", "/risparmi", "/impostazioni/ricorrenti", "/impostazioni"]) {
		await open(page, path);
		const text = await pageText(page);
		expect(text, `${path}: c'è un importo in dollari`).toMatch(/\$[−-]?\d/);
		expect(text, `${path}: nessun €`).not.toContain("€");
	}

	// Alcune cifre, per sapere che è il formato giusto e non un $ qualunque.
	await open(page, "/?conto=");
	expect(await pageText(page)).toContain("$12,50");
	await open(page, "/impostazioni/ricorrenti");
	expect(await pageText(page)).toContain("$11,99");

	// Il campanello: la valuta è quella delle pagine, non una lettura sua.
	await open(page, "/?conto=");
	await page.getByRole("button", { name: /^Notifiche, 1 non letta/ }).first().click();
	await expect(page.getByText("Hai speso $ 420 su $ 400").first()).toBeVisible();
});

test("senza cookie, il proxy ricava la valuta dal profilo", async ({ page, account }) => {
	await seedBasic(account); // EUR
	await login(page, account);
	await open(page, "/?conto=");
	expect(await pageText(page)).toContain("€1800,00");

	// Il profilo cambia altrove (un altro dispositivo), e su questo il cookie
	// sparisce: è il caso di chi era già dentro quando il cookie è nato.
	await account.rest("PATCH", `profiles?id=eq.${account.id}`, { currency: "USD" });
	await page.context().clearCookies({ name: "seichi-currency" });

	await open(page, "/?conto=");
	const text = await pageText(page);
	expect(text, "il proxy la ricava dal profilo").toContain("$1800,00");
	expect(text).not.toContain("€");
	// E la scrive: dalla richiesta dopo non serve più leggerla.
	const cookie = (await page.context().cookies()).find((c) => c.name === "seichi-currency");
	expect(cookie?.value).toBe("USD");

	// All'uscita se ne va: è un fatto dei dati di chi esce, e chi entra dopo
	// per una strada che non lo riallinea vedrebbe il simbolo di un altro.
	// Il proxy ripara un cookie che MANCA, non uno che appartiene a un altro.
	await open(page, "/impostazioni");
	await page.getByRole("button", { name: "Esci" }).filter({ visible: true }).first().click();
	await page.waitForURL(/\/welcome$/);
	const left = (await page.context().cookies()).find((c) => c.name === "seichi-currency");
	expect(left, "all'uscita il cookie della valuta se ne va").toBeUndefined();
});

test("lo yen dalle impostazioni: niente decimali, né a schermo né nei campi", async ({ page, account }) => {
	const s = await seedBasic(account);
	await insertMovements(account, [
		{ type: "spesa", amount: 12.5, account_id: s.accounts.principale, category_id: s.cat("Ristoranti") },
	]);
	await login(page, account);

	// Il gemello in euro: il tastierino ha la virgola.
	await open(page, "/?conto=");
	await page.locator(".fab").first().click();
	await page.getByRole("button", { name: /^Uscita/ }).first().click();
	const keypadSep = page.getByRole("button", { name: ",", exact: true }).filter({ visible: true });
	await expect(keypadSep).toHaveCount(1);

	// La valuta si sceglie dal menu disegnato, non da una `<select>` nativa:
	// la riga dichiara l'elenco, l'elenco ha le sue voci.
	await open(page, "/impostazioni");
	const row = page.getByRole("button", { name: /^Valuta/ });
	await expect(row).toHaveAccessibleDescription(/Cambia solo il simbolo/);
	await expect(page.locator("select")).toHaveCount(0);
	await row.click();
	const menu = page.getByRole("listbox", { name: "Valuta" });
	await expect(menu.getByRole("option")).toHaveCount(5);
	await expect(menu.getByRole("option", { name: "EUR — Euro" })).toHaveAttribute("aria-selected", "true");
	// Da tastiera: il fuoco è sulla scelta attuale, Esc chiude e torna alla riga.
	await expect(menu.getByRole("option", { name: "EUR — Euro" })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(menu).toHaveCount(0);
	await expect(row).toBeFocused();
	await row.click();
	await menu.getByRole("option", { name: "JPY — Yen" }).click();
	await expect(menu).toHaveCount(0);
	// La riga cambia subito (la scelta si mostra prima della conferma): conta
	// il profilo, e il salvataggio finito.
	await expect(row).toContainText("JPY — Yen");
	await expect
		.poll(async () => (await account.rest<{ currency: string }[]>("GET", `profiles?id=eq.${account.id}&select=currency`))[0].currency)
		.toBe("JPY");
	await expect(row).toBeEnabled();
	// In yen l'avviso dice anche dei centesimi arrotondati.
	await expect(row).toHaveAccessibleDescription(/gli importi con i centesimi si vedono arrotondati/);

	// A schermo: il simbolo, e nessun decimale. 1800 − 12,50 = 1787,50 → ¥ 1788.
	await open(page, "/?conto=");
	const home = await pageText(page);
	expect(home).toContain("¥1788");
	expect(home).not.toContain("€");
	expect(home, "nessun decimale in yen").not.toMatch(/¥[−-]?[\d.]+,\d/);

	// Il movimento da 12,50, riaperto in yen: «Continua» resta spento, e la
	// riga sotto la cifra dice perché. Tolti i decimali, si può proseguire.
	await page.getByRole("button", { name: /^Ristoranti/ }).filter({ visible: true }).first().click();
	const editing = page.getByRole("dialog").filter({ hasText: "Importo" });
	await expect(editing).toContainText("¥12,50");
	const why = editing.getByRole("alert");
	await expect(why, "il passo dell'importo dice perché").toHaveText("Questa valuta non ha decimali: scrivi un numero intero");
	await expect(editing.getByRole("button", { name: "Continua" })).toBeDisabled();
	for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");
	await expect(editing).toContainText("¥12");
	await expect(why).toHaveCount(0);
	await expect(editing.getByRole("button", { name: "Continua" })).toBeEnabled();
	await page.keyboard.press("Escape");
	await expect(editing).toHaveCount(0);
	await open(page, "/?conto=");

	// Il tastierino non ha la virgola, e la tastiera fisica non la scrive.
	await page.locator(".fab").first().click();
	await page.getByRole("button", { name: /^Uscita/ }).first().click();
	await expect(keypadSep, "in yen il tastierino non ha la virgola").toHaveCount(0);
	await page.keyboard.type("1500,5");
	// Simbolo e cifra stanno in due nodi: «¥15005» nel testo del dialog.
	await expect(page.getByRole("dialog", { name: "Nuovo movimento" })).toContainText("¥15005");
	await page.keyboard.press("Backspace");
	await page.getByRole("button", { name: "Continua" }).filter({ visible: true }).first().click();
	await choose(page, "Categoria", "Alimentari");
	await page.getByRole("button", { name: "Salva movimento" }).filter({ visible: true }).first().click();
	await expect(page.getByRole("dialog", { name: "Nuovo movimento" })).toHaveCount(0);
	const rows = await account.rest<{ amount: number }[]>("GET", `transactions?category_id=eq.${s.cat("Alimentari")}&select=amount`);
	expect(rows.map((r) => Number(r.amount))).toEqual([1500]);

	// Un campo con i decimali li rifiuta, e lo dice.
	await open(page, "/conti");
	await page.getByRole("button", { name: "Nuovo conto" }).filter({ visible: true }).first().click();
	const sheet = page.getByRole("dialog", { name: "Nuovo conto" });
	await sheet.getByPlaceholder("Es. Conto corrente, Contanti…").fill("Contanti");
	const balance = sheet.locator('input[inputmode="numeric"]');
	await balance.fill("120,50");
	// Il foglio dice l'errore al tentativo di salvataggio, non a ogni tasto.
	await sheet.getByRole("button", { name: "Salva conto" }).click();
	await expect(sheet.getByText("Questa valuta non ha decimali: scrivi un numero intero")).toBeVisible();
	expect(await account.rest<unknown[]>("GET", "accounts?name=eq.Contanti&select=id")).toHaveLength(0);
	// Il gemello: lo stesso conto, intero, si salva.
	await balance.fill("120");
	await expect(sheet.getByText("Questa valuta non ha decimali")).toHaveCount(0);
	await sheet.getByRole("button", { name: "Salva conto" }).click();
	await expect(sheet).toHaveCount(0);
	const saved = await account.rest<{ initial_balance: number }[]>("GET", "accounts?name=eq.Contanti&select=initial_balance");
	expect(saved.map((r) => Number(r.initial_balance))).toEqual([120]);
});
