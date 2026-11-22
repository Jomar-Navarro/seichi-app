import type { Page } from "@playwright/test";
import { choose, newMovement } from "./support/app";
import { expect, login, open, test } from "./support/fixtures";
import { seedBasic } from "./support/seed";

/**
 * Indietro chiude il pannello in cima, e solo lui (#214).
 *
 * ⚠️ Il difetto che custodisce: col visore di una ricevuta aperto dentro il
 * wizard del movimento, il tasto o il gesto Indietro chiudeva l'INTERO
 * wizard, form compreso. Il visore non aveva una voce sua nella cronologia, e
 * `useCloseOnBack` non ne spingeva una seconda: i due pannelli condividevano
 * una voce, e il `popstate` arrivava a entrambi. Con una conferma aperta (che
 * una voce non l'aveva affatto) Indietro lasciava la pagina.
 *
 * Ora ogni pannello che passa da `useDialog` ha la sua voce, con la sua
 * profondità, e un solo ascoltatore chiude dall'alto.
 *
 * Controprova: con `useCloseOnBack`, `useDialog`, `BottomSheetShell` e
 * `TransactionModal` di prima, il primo test cade su «il wizard resta, con i
 * campi scritti» e il secondo su «la conferma si chiude e si resta sulla
 * pagina».
 */

const PNG_1X1 = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);

/** Indietro, dal pulsante del browser: la stessa strada del gesto di iOS. */
async function back(page: Page) {
	await page.evaluate(() => window.history.back());
}

test("col visore aperto, Indietro chiude il visore; poi il wizard; poi lascia la pagina", async ({ page, account }) => {
	await seedBasic(account);
	await login(page, account);
	await open(page, "/impostazioni");
	await open(page, "/?conto=");

	await newMovement(page, "Uscita", "12");
	const wizard = page.getByRole("dialog", { name: "Nuovo movimento" });
	await choose(page, "Categoria", "Ristoranti");
	const description = wizard.getByPlaceholder("Es. Trenord, Esselunga...");
	await description.fill("Pizza al taglio");

	await wizard.locator('input[type="file"]').setInputFiles({ name: "scontrino.png", mimeType: "image/png", buffer: PNG_1X1 });
	await wizard.getByRole("button", { name: "Apri a schermo intero" }).click();
	const viewer = page.getByRole("dialog", { name: "Ricevuta" });
	await expect(viewer).toBeVisible();

	// Primo Indietro: solo il visore.
	await back(page);
	await expect(viewer).toHaveCount(0);
	await expect(wizard, "il wizard resta, con i campi scritti").toBeVisible();
	await expect(description).toHaveValue("Pizza al taglio");
	await expect(page).toHaveURL(/\/\?conto=$/);

	// Secondo: il wizard, e si resta sulla pagina.
	await back(page);
	await expect(wizard).toHaveCount(0);
	await expect(page).toHaveURL(/\/\?conto=$/);
	await expect.poll(() => page.evaluate(() => Boolean(window.history.state?.seichiModal))).toBe(false);

	// Terzo: la pagina di prima. Nessuna voce sintetica è rimasta appesa a
	// consumare un Indietro a vuoto.
	await back(page);
	await expect(page).toHaveURL(/\/impostazioni$/);
});

test("con una conferma aperta, Indietro la chiude e si resta sulla pagina", async ({ page, account }) => {
	const s = await seedBasic(account);
	await login(page, account);
	await open(page, "/impostazioni");
	await open(page, "/impostazioni/categorie");

	const row = page.getByText("Ristoranti", { exact: true }).filter({ visible: true }).first().locator("..");
	await row.getByRole("button", { name: "Elimina" }).click();
	const confirm = page.getByRole("dialog", { name: "Elimina categoria" });
	await expect(confirm).toBeVisible();

	await back(page);
	await expect(confirm).toHaveCount(0);
	// La conferma sparirebbe anche lasciando la pagina: conta l'URL.
	await expect(page, "la conferma si chiude e si resta sulla pagina").toHaveURL(/\/impostazioni\/categorie$/);
	// Chiudere non è eliminare.
	const left = await account.rest<{ id: string }[]>("GET", `categories?id=eq.${s.cat("Ristoranti")}&select=id`);
	expect(left).toHaveLength(1);

	// Il gemello: chiusa la conferma dal suo bottone, Indietro lascia la pagina
	// al primo colpo — la voce della conferma non è rimasta appesa.
	await row.getByRole("button", { name: "Elimina" }).click();
	await expect(confirm).toBeVisible();
	await confirm.getByRole("button", { name: "Annulla" }).click();
	await expect(confirm).toHaveCount(0);
	await expect.poll(() => page.evaluate(() => Boolean(window.history.state?.seichiModal))).toBe(false);
	await back(page);
	await expect(page).toHaveURL(/\/impostazioni$/);
});

/*
 * Il rischio che la #214 poteva introdurre: ora anche la conferma ha una voce
 * nella cronologia. Dopo un'eliminazione la lista chiede `router.refresh()` e
 * chiude la conferma; la chiusura toglie la voce con `history.go()`, e il
 * ritorno ripristina l'albero della pagina salvato in quella voce. Se vincesse
 * sul refresh, la riga eliminata ricomparirebbe a schermo.
 */
test("eliminare dalla conferma toglie la riga, e non torna", async ({ page, account }) => {
	const s = await seedBasic(account);
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
	await login(page, account);

	await open(page, "/impostazioni/categorie");
	const row = page.getByText("Ristoranti", { exact: true }).filter({ visible: true });
	await row.first().locator("..").getByRole("button", { name: "Elimina" }).click();
	const confirmCat = page.getByRole("dialog", { name: "Elimina categoria" });
	await confirmCat.getByRole("button", { name: "Elimina" }).click();
	await expect(confirmCat).toHaveCount(0);
	await expect(row).toHaveCount(0);
	await expect.poll(() => page.evaluate(() => Boolean(window.history.state?.seichiModal))).toBe(false);
	await page.waitForTimeout(800);
	await expect(row, "la categoria eliminata non ricompare").toHaveCount(0);

	await open(page, "/impostazioni/ricorrenti");
	const rule = page.getByText("Spotify", { exact: true }).filter({ visible: true });
	await expect(rule.first()).toBeVisible();
	// Nella lista delle ricorrenti il comando è «elimina», in minuscolo.
	await page.getByRole("button", { name: "elimina", exact: true }).filter({ visible: true }).first().click();
	const confirmRule = page.getByRole("dialog", { name: "Elimina ricorrenza" });
	await confirmRule.getByRole("button", { name: "Elimina", exact: true }).click();
	await expect(confirmRule).toHaveCount(0);
	await expect(rule).toHaveCount(0);
	await page.waitForTimeout(800);
	await expect(rule, "la ricorrenza eliminata non ricompare").toHaveCount(0);
	expect(await account.rest<unknown[]>("GET", "recurring_rules?select=id")).toHaveLength(0);
});
