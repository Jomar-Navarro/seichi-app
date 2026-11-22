import type { Page } from "@playwright/test";
import { expect, login, open, test } from "./support/fixtures";
import { seedBasic } from "./support/seed";

/**
 * Due rami dei conti dichiarati e mai provati (#175).
 *
 * 1. «riattiva» un conto archiviato (#62): il ramo non era mai stato
 *    verificato, perché l'account di collaudo non aveva conti archiviati. Una
 *    prova che si autoesclude resta dichiarata finché non la si riprende.
 * 2. il saldo iniziale negativo dal telefono (residuo della #119): il
 *    tastierino decimale di iOS non ha il meno, e un conto in rosso non si
 *    apriva. Ora c'è il comando ± accanto al campo.
 *
 * Controprove:
 *   c1 · in `setAccountArchived()` scrivere sempre `archived: true`: il primo
 *        test cade su «la riga torna fra gli attivi». (Togliere il
 *        `router.refresh()` di `reactivate()` NON lo fa cadere, e non deve: la
 *        action chiama `revalidatePath`, e la risposta di una server action che
 *        rivalida porta già la pagina aggiornata. Quella era la controprova
 *        sbagliata, provata e scartata il 2026-11-22.)
 *   c2 · togliere il comando ± da `AccountSheet`: il secondo test cade al
 *        primo tocco su «Saldo negativo»;
 *   c3 · togliere `onPointerDown` dal comando: il secondo test cade su «il
 *        fuoco resta nel campo» — sul telefono la tastiera si chiuderebbe a
 *        ogni tocco.
 */

/** Il saldo della card in home: «€ 1800,00» → 1800. */
async function homeBalance(page: Page, chip: string) {
	const card = page.locator("div.relative.h-full").filter({ has: page.getByText(chip, { exact: true }) }).first();
	const text = (await card.innerText()).replace(/\s+/g, " ");
	const m = /€ ?(-?[\d.]+) ?,(\d{2})/.exec(text);
	if (!m) throw new Error(`nessun importo nella card del saldo: ${text}`);
	return Number(m[1].replace(/\./g, "") + "." + m[2]);
}

test("un conto archiviato si riattiva: torna nel saldo, nel selettore e fra gli attivi", async ({ page, account }) => {
	const s = await seedBasic(account); // Conto principale 1500, Revolut 300
	// L'archiviazione è il preparativo, non la prova: dal telefono si fa con lo
	// swipe, già provato a mano sul dispositivo (#62).
	await account.rest("PATCH", `accounts?id=eq.${s.accounts.revolut}`, { archived: true });
	await login(page, account);

	// Prima: Revolut è fuori dal saldo e dal selettore.
	await open(page, "/?conto=");
	expect(await homeBalance(page, "1 conto attivo")).toBe(1500);
	await page.getByRole("button", { name: /Tutti i conti/ }).first().click();
	await expect(page.getByRole("button", { name: /Revolut/ })).toHaveCount(0);

	await open(page, "/conti");
	await expect(page.getByText("Archiviato · 1")).toBeVisible();
	await page.getByRole("button", { name: "riattiva" }).click();

	// La pagina lo dice: la sezione degli archiviati sparisce e il conteggio sale.
	await expect(page.getByText("Archiviato · 1"), "la riga torna fra gli attivi").toHaveCount(0);
	await expect(page.getByText("2 conti attivi").first()).toBeVisible();
	await expect(page.locator("[data-dialog-keep-alive]")).toHaveText("Conto riattivato.");
	const [row] = await account.rest<{ archived: boolean }[]>("GET", `accounts?id=eq.${s.accounts.revolut}&select=archived`);
	expect(row.archived).toBe(false);

	// E torna nel saldo e nel selettore della home.
	await open(page, "/?conto=");
	expect(await homeBalance(page, "2 conti attivi")).toBe(1800);
	await page.getByRole("button", { name: /Tutti i conti/ }).first().click();
	await expect(page.getByRole("button", { name: /Revolut/ }).first()).toBeVisible();
});

test("un saldo iniziale negativo si scrive col comando ±, senza il tasto meno", async ({ page, account }) => {
	await seedBasic(account);
	await login(page, account);
	await open(page, "/conti");

	await page.getByRole("button", { name: "Nuovo conto" }).filter({ visible: true }).first().click();
	const sheet = page.getByRole("dialog", { name: "Nuovo conto" });
	await sheet.getByPlaceholder("Es. Conto corrente, Contanti…").fill("Carta di credito");

	// Solo cifre e virgola, come dal tastierino decimale di iOS: il meno non c'è.
	const balance = sheet.locator('input[inputmode="decimal"]');
	await balance.fill("120,50");
	const sign = sheet.getByRole("button", { name: "Saldo negativo" });
	await expect(sign).toHaveAttribute("aria-pressed", "false");
	await sign.click();
	await expect(balance).toHaveValue("-120,50");
	await expect(sign).toHaveAttribute("aria-pressed", "true");
	// Il fuoco resta nel campo: sul telefono la tastiera non si chiude. Con un
	// mouse VERO, premuto e tenuto: un `pointerdown` sintetico non sposta mai
	// il fuoco, e la prova passerebbe senza aver guardato.
	await balance.focus();
	await sign.hover();
	await page.mouse.down();
	await expect(balance, "il fuoco resta nel campo").toBeFocused();
	await page.mouse.up(); // il click: torna al positivo
	await expect(balance).toHaveValue("120,50");
	await sign.click();
	await expect(balance).toHaveValue("-120,50");

	// Il gemello: un secondo tocco torna al positivo, un terzo al negativo.
	await sign.click();
	await expect(balance).toHaveValue("120,50");
	await sign.click();

	await sheet.getByRole("button", { name: "Salva conto" }).click();
	await expect(sheet).toHaveCount(0);
	const rows = await account.rest<{ name: string; initial_balance: number }[]>(
		"GET",
		"accounts?select=name,initial_balance&name=eq.Carta%20di%20credito",
	);
	expect(rows).toHaveLength(1);
	expect(Number(rows[0].initial_balance)).toBe(-120.5);
});
