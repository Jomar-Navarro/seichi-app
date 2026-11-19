import type { Locator, Page } from "@playwright/test";
import { field, newMovement } from "./support/app";
import { expect, login, open, test } from "./support/fixtures";
import { seedBasic } from "./support/seed";

/**
 * I pannelli sono finestre di dialogo vere (#165, che ha assorbito la #211).
 *
 * ⚠️ Il difetto che custodisce: il wizard del movimento e i fogli non si
 * dichiaravano dialog. Nel collaudo di #162 e #163 un `getByRole("dialog")`
 * dopo il tocco su «Aggiungi transazione» contava zero dialog, con il pannello
 * aperto a schermo. Lo sfondo restava raggiungibile col Tab, Esc non chiudeva
 * niente, e alla chiusura il fuoco finiva sul `<body>`.
 *
 * E quello per cui la 28d aveva scartato Esc: col visore delle ricevute aperto
 * DENTRO il wizard, un ascoltatore sul wizard avrebbe chiuso tutto. Esc chiude
 * solo lo strato in cima — anche una tendina aperta dentro il pannello.
 *
 * Controprove (`components/UI/useDialog.ts`):
 *   c1 · togliere `role: "dialog"` da `dialogProps`: ogni test cade al primo
 *        `getByRole("dialog", { name })`;
 *   c2 · in `onKeyDown` chiudere `stack[0]` invece della cima: il secondo test
 *        cade sulla tendina (Esc chiude il wizard sotto di lei);
 *   c3 · non chiamare `inertOutside()`: il primo test cade sul giro di Tab, che
 *        arriva ai comandi della pagina sotto;
 *   c4 · non restituire il fuoco allo smontaggio: tutti e tre cadono sul loro
 *        «il fuoco torna» (al +, alla miniatura, alla matita).
 * Provate il 2026-11-19: ognuna cade dove dichiarato, e c1-c3 in nessun altro
 * test.
 */

const PNG_1X1 = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);

/**
 * Preme Tab `times` volte e restituisce i comandi FUORI dal pannello che hanno
 * ricevuto il fuoco. Il `<body>` non conta: uscito dall'ultimo comando, il
 * fuoco passa per un istante all'interfaccia del browser (fuori dalla pagina)
 * e poi torna al primo comando del pannello.
 */
async function tabLeaks(page: Page, panel: Locator, times: number) {
	const handle = await panel.elementHandle();
	const leaks: string[] = [];
	for (let i = 0; i < times; i++) {
		await page.keyboard.press("Tab");
		const leak = await page.evaluate((el) => {
			const a = document.activeElement;
			if (!a || a === document.body || el?.contains(a)) return null;
			return a.outerHTML.slice(0, 120);
		}, handle);
		if (leak) leaks.push(leak);
	}
	return leaks;
}

/** La voce sintetica di `useCloseOnBack` è stata tolta dalla cronologia (#86). */
async function historyClean(page: Page) {
	await expect.poll(() => page.evaluate(() => Boolean(window.history.state?.seichiModal))).toBe(false);
}

test("il wizard è un dialog: nome, fuoco, sfondo inerte, Esc e il fuoco che torna", async ({ page, account }) => {
	await seedBasic(account);
	await login(page, account);
	await open(page, "/?conto=");

	// Aperto da tastiera, come chi non usa il mouse.
	const fab = page.getByRole("button", { name: "Aggiungi transazione" }).filter({ visible: true }).first();
	await fab.focus();
	await page.keyboard.press("Enter");

	const wizard = page.getByRole("dialog", { name: "Nuovo movimento" });
	await expect(wizard).toBeVisible();
	// Il fuoco è sul pannello (non su un campo: sul telefono aprirebbe la tastiera).
	await expect(wizard).toBeFocused();

	// Il Tab gira dentro il pannello: la pagina sotto è inerte. Venti giri bastano
	// a fare più di un intero ciclo sui comandi del passo dei tipi.
	expect(await tabLeaks(page, wizard, 20)).toEqual([]);

	await page.keyboard.press("Escape");
	await expect(wizard).toHaveCount(0);
	// Il fuoco torna al +, e la voce della cronologia se n'è andata come con la X.
	await expect(fab).toBeFocused();
	await historyClean(page);
});

test("Esc chiude solo lo strato in cima: tendina, poi visore, poi wizard", async ({ page, account }) => {
	await seedBasic(account);
	await login(page, account);
	await open(page, "/?conto=");

	await newMovement(page, "Uscita", "12");
	const wizard = page.getByRole("dialog", { name: "Nuovo movimento" });
	await expect(wizard).toBeVisible();

	// Una tendina aperta dentro il wizard: Esc chiude lei, il wizard resta.
	const conto = field(wizard, "Conto");
	await conto.click();
	await expect(conto).toHaveAttribute("aria-expanded", "true");
	await page.keyboard.press("Escape");
	await expect(conto).toHaveAttribute("aria-expanded", "false");
	await expect(conto).toBeFocused();
	await expect(wizard).toBeVisible();

	// Il visore di una ricevuta in coda: un dialog annidato, col suo nome.
	await wizard.locator('input[type="file"]').setInputFiles({ name: "scontrino.png", mimeType: "image/png", buffer: PNG_1X1 });
	const thumb = wizard.getByRole("button", { name: "Apri a schermo intero" });
	await thumb.click();
	const viewer = page.getByRole("dialog", { name: "Ricevuta" });
	await expect(viewer).toBeVisible();
	await expect(viewer.getByRole("img", { name: "Ricevuta" })).toBeVisible();

	// Esc chiude il visore e non il wizard (il difetto per cui la 28d l'aveva
	// scartato); il fuoco torna alla miniatura.
	await page.keyboard.press("Escape");
	await expect(viewer).toHaveCount(0);
	await expect(wizard).toBeVisible();
	await expect(thumb).toBeFocused();

	// Ora in cima c'è il wizard.
	await page.keyboard.press("Escape");
	await expect(wizard).toHaveCount(0);
	await historyClean(page);
});

test("i fogli e le conferme sono dialog col nome del titolo, ed Esc annulla senza eliminare", async ({ page, account }) => {
	const s = await seedBasic(account);
	await login(page, account);
	await open(page, "/impostazioni/categorie");

	const row = page.getByText("Ristoranti", { exact: true }).filter({ visible: true }).first().locator("..");

	// Il foglio di modifica: il nome è il suo titolo visibile.
	const edit = row.getByRole("button", { name: "Modifica" });
	await edit.click();
	const sheet = page.getByRole("dialog", { name: "Modifica categoria" });
	await expect(sheet).toBeVisible();
	await expect(sheet).toBeFocused();
	await expect(sheet.getByRole("button", { name: "Chiudi" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(sheet).toHaveCount(0);
	await expect(edit).toBeFocused();
	await historyClean(page);

	// La conferma di eliminazione: Esc è «Annulla», non «Elimina».
	await row.getByRole("button", { name: "Elimina" }).click();
	const confirm = page.getByRole("dialog", { name: "Elimina categoria" });
	await expect(confirm).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(confirm).toHaveCount(0);

	const left = await account.rest<{ id: string }[]>("GET", `categories?id=eq.${s.cat("Ristoranti")}&select=id`);
	expect(left).toHaveLength(1);
});
