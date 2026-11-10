import type { Page } from "@playwright/test";
import { expect, login, open, test } from "./support/fixtures";
import { seedBasic } from "./support/seed";

/*
 * Il PIN si offre solo con uno schermo touch (#125): sul computer il blocco
 * vero è quello del sistema. E il tastierino si preme con `tap()`, non
 * `click()`: deduplica pointerdown e click (il click fantasma della 26a), e i
 * click sintetici di Playwright ci finiscono dentro.
 */
test.use({ hasTouch: true });

async function typePin(page: Page, pin: string) {
	for (const d of pin) await page.getByRole("button", { name: d, exact: true }).filter({ visible: true }).last().tap();
}

const veil = (page: Page) => page.getByText("Inserisci il tuo PIN a 6 cifre per aprire Seichi.");

/**
 * Il blocco con PIN scatta anche quando il cookie sparisce e il PIN resta.
 *
 * ⚠️ Il difetto che custodisce (#125): il PIN sta in `localStorage`, il flag
 * «c'è un PIN» in un cookie, e il client decideva dal solo cookie. Safari
 * (ITP) tronca a 7 giorni i cookie scritti da `document.cookie`: sparito il
 * cookie, l'app si apriva senza velo mentre le impostazioni dicevano «Attivo».
 * Il blocco era fail-closed sulla finestra di grazia e fail-OPEN sulla propria
 * esistenza. Ora decide l'unione delle due fonti, e il cookie lo riscrive il
 * server.
 *
 * Controprova: in `isPinEnabledOnClient()` guardare solo il cookie.
 */
test("il velo torna anche se il cookie del PIN è sparito", async ({ page, account }) => {
	await seedBasic(account);
	await login(page, account);
	await open(page, "/impostazioni/blocco");

	await page.getByRole("button", { name: "Imposta PIN" }).tap();
	await typePin(page, "123456");
	await expect(page.getByText("Conferma il PIN")).toBeVisible();
	await typePin(page, "123456");
	await expect(page.getByText("PIN impostato")).toBeVisible();
	await page.getByRole("button", { name: "Torna alle impostazioni" }).tap();
	await expect(page.getByText("attivo · 6 cifre")).toBeVisible();

	const cookie = async (name: string) => (await page.context().cookies()).find((c) => c.name === name);
	await expect.poll(async () => (await cookie("seichi-lock-enabled"))?.value).toBe("1");

	// Fuori dall'app oltre la finestra di grazia, e il cookie del flag tolto
	// come lo toglierebbe ITP. ⚠️ Prima `about:blank`: lasciare la pagina fa
	// scattare `visibilitychange`, che riscrive la finestra di grazia — i
	// cookie si toccano DOPO, come quando scadono ad app chiusa.
	await page.goto("about:blank");
	await page.context().clearCookies({ name: "seichi-lock-enabled" });
	await page.context().clearCookies({ name: "seichi-lock-active-until" });

	await open(page, "/?conto=");
	await expect(veil(page)).toBeVisible();

	// Cifre tutte diverse: il tastierino scarta la STESSA cifra ripetuta entro
	// 80ms (il duplicato del tocco), e Playwright tocca più in fretta di un dito.
	await typePin(page, "987650");
	await expect(page.getByText("PIN errato, riprova.")).toBeVisible();
	await expect(veil(page)).toBeVisible();
	// L'errore resta a schermo ~900ms e intanto il tastierino non accetta cifre.
	await expect(page.getByText("PIN errato, riprova.")).toHaveCount(0);

	await typePin(page, "123456");
	await expect(veil(page)).toHaveCount(0);
	// E il server ha riscritto il flag: al prossimo caricamento il primo byte è giusto.
	await expect.poll(async () => (await cookie("seichi-lock-enabled"))?.value).toBe("1");
});
