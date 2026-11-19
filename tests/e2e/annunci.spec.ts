import type { Page } from "@playwright/test";
import { choose, newMovement } from "./support/app";
import { expect, login, open, test } from "./support/fixtures";
import { seedBasic } from "./support/seed";

/**
 * Gli esiti si annunciano agli screen reader (#165, seconda PR).
 *
 * ⚠️ Il difetto che custodisce: un pannello che si chiude da solo dopo il
 * salvataggio portava via con sé ogni traccia dell'esito. Chi vede capiva
 * dalla riga nuova nella lista; chi usa VoiceOver non sentiva niente.
 *
 * E il difetto che la regione stessa può avere: `useDialog` rende inerte tutto
 * ciò che sta fuori dal pannello, e un elemento inerte è muto anche per lo
 * screen reader. L'annuncio parte col pannello ancora aperto: la regione deve
 * restare viva proprio in quell'istante.
 *
 * Controprove:
 *   c1 · in `claim()` (`components/UI/useDialog.ts`) non guardare
 *        `KEEP_ALIVE_ATTR`: il primo test cade su «la regione è viva col
 *        wizard aperto»;
 *   c2 · in `handleSave()` (`TransactionForm`) annunciare sempre
 *        `transactionSaved`: il primo test cade su «Ricorrenza creata.»;
 *   c3 · togliere `<Announcer />` dal layout di `(main)`: entrambi cadono al
 *        primo controllo sulla regione.
 */

/** L'unica regione degli annunci (`Announcer`). */
const region = (page: Page) => page.locator("[data-dialog-keep-alive]");

/** Vero se l'elemento, o un suo antenato, è inerte. */
async function insideInert(page: Page, selector: string) {
	return page.evaluate((s) => Boolean(document.querySelector(s)?.closest("[inert]")), selector);
}

test("un salvataggio che chiude il wizard si annuncia, e la regione resta viva sotto il pannello", async ({ page, account }) => {
	await seedBasic(account);
	await login(page, account);
	await open(page, "/?conto=");

	await expect(region(page)).toHaveAttribute("role", "status");

	await newMovement(page, "Uscita", "12");
	const wizard = page.getByRole("dialog", { name: "Nuovo movimento" });
	await expect(wizard).toBeVisible();
	await choose(page, "Categoria", "Ristoranti");

	// Il controllo ha senso solo se il wizard ha davvero reso inerte la pagina:
	// il + sta fuori dal pannello, e deve esserlo.
	expect(await insideInert(page, ".fab")).toBe(true);
	// La regione no, o l'annuncio partirebbe muto.
	expect(await insideInert(page, "[data-dialog-keep-alive]")).toBe(false);

	await wizard.getByRole("button", { name: "Salva movimento" }).click();
	await expect(wizard).toHaveCount(0);
	await expect(region(page)).toHaveText("Movimento salvato.");

	// Con «Ripeti» acceso si scrive una regola, e l'annuncio dice quella.
	await newMovement(page, "Uscita", "9");
	await choose(page, "Categoria", "Alimentari");
	const repeat = page.getByRole("button", { name: "Ripeti" });
	await repeat.click();
	await expect(repeat).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Crea ricorrenza" }).click();
	await expect(wizard).toHaveCount(0);
	await expect(region(page)).toHaveText("Ricorrenza creata.");

	const rules = await account.rest<{ id: string }[]>("GET", "recurring_rules?select=id");
	expect(rules).toHaveLength(1);
});

test("il foglio e la conferma della categoria annunciano salvataggio ed eliminazione", async ({ page, account }) => {
	const s = await seedBasic(account);
	await login(page, account);
	await open(page, "/impostazioni/categorie");

	const row = (name: string) =>
		page.getByText(name, { exact: true }).filter({ visible: true }).first().locator("..");

	await row("Ristoranti").getByRole("button", { name: "Modifica" }).click();
	const sheet = page.getByRole("dialog", { name: "Modifica categoria" });
	await sheet.getByRole("button", { name: "Salva modifiche" }).click();
	await expect(sheet).toHaveCount(0);
	await expect(region(page)).toHaveText("Categoria salvata.");

	await row("Alimentari").getByRole("button", { name: "Elimina" }).click();
	const confirm = page.getByRole("dialog", { name: "Elimina categoria" });
	await confirm.getByRole("button", { name: "Elimina" }).click();
	await expect(confirm).toHaveCount(0);
	await expect(region(page)).toHaveText("Categoria eliminata.");

	const left = await account.rest<{ id: string }[]>("GET", `categories?id=eq.${s.cat("Alimentari")}&select=id`);
	expect(left).toHaveLength(0);
});
