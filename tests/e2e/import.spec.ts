import { choose } from "./support/app";
import { expect, login, open, test } from "./support/fixtures";
import { seedBasic } from "./support/seed";

/*
 * Un estratto Trade Republic sintetico, con la forma di quello vero (`pytr`).
 * La cassa è `amount + fee + tax` (Fase 21): l'acquisto esce per 501, la
 * vendita rientra per 199.
 */
const CSV = [
	"date,type,asset_class,name,amount,fee,tax,description,transaction_id,counterparty_name,counterparty_iban,payment_reference",
	"2026-01-10,BUY,FUND,Vanguard FTSE All-World,-500.000000,-1.000000,,Buy trade,e2e-buy,,,",
	"2026-02-01,SELL,FUND,Vanguard FTSE All-World,200.000000,-1.000000,,Sell trade,e2e-sell,,,",
].join("\n");

/**
 * Un estratto Trade Republic importato con acquisti e vendite sulla stessa
 * categoria: la posizione si compensa, e /investimenti mostra il netto.
 *
 * ⚠️ Il difetto che custodisce (#118): le vendite prendono IN PRESTITO una
 * categoria degli investimenti (#52), e il client lo sapeva — la tendina le
 * offriva — mentre il server confrontava il tipo della categoria col tipo
 * NUDO del movimento: `investimento !== disinvestimento`, e l'INTERO import
 * falliva. L'unico modo di importare le vendite era senza categoria, cioè
 * senza compensare la posizione: lo scopo stesso della #52.
 *
 * Controprova: in `importTransactions()` confrontare la categoria con
 * `d.target` invece che con `categoryTypeFor(d.target)`.
 */
test("acquisti e vendite Trade Republic si compensano sulla categoria", async ({ page, account }) => {
	const s = await seedBasic(account);
	await account.rest("POST", "accounts", { user_id: account.id, name: "Trade Republic", type: "investimento", initial_balance: 0 });
	await login(page, account);
	await open(page, "/impostazioni/importa");

	await page.locator('input[type="file"]').setInputFiles({
		name: "trade-republic.csv",
		mimeType: "text/csv",
		buffer: Buffer.from(CSV, "utf8"),
	});
	await expect(page.getByText(/^Estratto Trade Republic/)).toBeVisible();
	await choose(page, "Conto dell'estratto", "Trade Republic");
	await page.getByRole("button", { name: "Continua" }).click();

	/** La card di un gruppo: la più interna che contiene il titolo e la scelta del tipo. */
	const card = (title: string) =>
		page
			.locator("div")
			.filter({ has: page.getByText(title, { exact: true }) })
			.filter({ has: page.getByText("Tipo di movimento", { exact: true }) })
			.last();
	await choose(card("Acquisti e piani d'accumulo"), "Categoria", "ETF");
	await choose(card("Vendite"), "Categoria", "ETF");
	await page.getByRole("button", { name: "Continua" }).click();
	await page.getByRole("button", { name: "Importa", exact: true }).click();
	// La schermata finale, non l'assenza dell'errore: un'assenza è vera anche
	// un istante prima che l'errore arrivi.
	await expect(page.getByText("Import completato")).toBeVisible();
	await expect(page.getByText("2 movimenti importati")).toBeVisible();

	expect(
		await account.rest<{ type: string; amount: number; category_id: string }[]>("GET", "transactions?select=type,amount,category_id&order=type"),
	).toEqual([
			{ type: "disinvestimento", amount: 199, category_id: s.cat("ETF") },
			{ type: "investimento", amount: 501, category_id: s.cat("ETF") },
		]);

	// Capitale versato NETTO: 501 − 199.
	await open(page, "/investimenti?conto=");
	await expect(page.getByText("€ 302,00").filter({ visible: true }).first()).toBeVisible();
});
