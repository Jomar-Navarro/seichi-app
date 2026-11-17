import { BASE_URL, expect, login, open, test } from "./support/fixtures";

/**
 * I limiti di frequenza (#161) arrivano all'utente come una frase, nella sua
 * lingua, dall'app vera: la rotta dell'export e la action dell'avatar.
 *
 * Il registro si riempie dalla porta principale — `consume_rate_limit()` è una
 * RPC che l'utente stesso può chiamare col suo token — invece di caricare trenta
 * file: un dato che la RLS rifiuterebbe non entra dalla porta di servizio.
 *
 * Le soglie stanno nel database; qui si leggono i loro effetti (10 export
 * all'ora, 5 cambi di avatar). L'attesa è appena registrata, quindi vale fra 59
 * e 60 minuti: si confronta l'intervallo, non un valore esatto.
 *
 * Controprova: togliere `consumeRateLimit` dalla rotta dell'export. Il primo
 * download non consuma, l'undicesima richiesta è solo la decima, e il test cade
 * su «atteso 429, ricevuto 200».
 */
const PNG_1X1 = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);

const consume = (account: { rest: (m: string, p: string, b?: unknown) => Promise<unknown> }, action: string, times: number) =>
	Promise.all(Array.from({ length: times }, () => account.rest("POST", "rpc/consume_rate_limit", { p_action: action })));

test("superato il tetto, export e avatar lo dicono nella lingua dell'utente", async ({ page, account }) => {
	await login(page, account);
	const download = `${BASE_URL}/impostazioni/esporta/download`;

	// Il gemello che passa: un export vero, che consuma il suo posto.
	const first = await page.request.get(download);
	expect(first.status()).toBe(200);

	// Altri nove: con quello sopra fanno dieci, il tetto dell'ora.
	await consume(account, "export", 9);

	const inItaliano = await page.request.get(download);
	expect(inItaliano.status()).toBe(429);
	expect(Number(inItaliano.headers()["retry-after"])).toBeGreaterThan(3500);
	expect(await inItaliano.text()).toMatch(
		/^Hai scaricato molti file CSV nell'ultima ora\. Potrai scaricarne un altro tra (1 ora|59 minuti)\.$/,
	);

	await page.context().addCookies([{ name: "seichi-lang", value: "en", url: BASE_URL }]);
	const en = await page.request.get(download);
	expect(en.status()).toBe(429);
	expect(await en.text()).toMatch(
		/^You've downloaded a lot of CSV files in the last hour\. You can download another in (1 hour|59 minutes)\.$/,
	);

	// L'avatar, dalla pagina: la frase arriva dalla action fino allo schermo.
	await page.context().addCookies([{ name: "seichi-lang", value: "it", url: BASE_URL }]);
	await consume(account, "avatar", 5);
	await open(page, "/impostazioni/profilo");
	await page.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG_1X1 });
	await expect(
		page.getByText(/^Hai cambiato la foto profilo molte volte nell'ultima ora\. Potrai cambiarla di nuovo tra (1 ora|59 minuti)\.$/),
	).toBeVisible();
});
