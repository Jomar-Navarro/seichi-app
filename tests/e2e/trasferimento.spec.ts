import { choose, field, homeFlow, newMovement } from "./support/app";
import { expect, login, open, test } from "./support/fixtures";
import { seedBasic } from "./support/seed";

/**
 * Un trasferimento fatto dal form: sposta il saldo fra due conti, non cambia
 * il totale e non entra nel Flusso. Visto dal conto di arrivo è un'entrata.
 *
 * ⚠️ Il difetto che custodisce (20b): il segno di un movimento dipende da QUALE
 * conto si guarda. In `amountSign()` il ramo della destinazione viene PRIMA del
 * tipo: invertiti, l'estratto del conto di arrivo mostrerebbe «− € 100,00» per
 * denaro appena arrivato, e non riconcilierebbe col saldo.
 *
 * Controprova: in `amountSign()` controllare il tipo prima della destinazione.
 */
test("il trasferimento sposta il saldo, non il totale né il Flusso", async ({ page, account }) => {
	const s = await seedBasic(account);
	const { principale, revolut } = s.accounts;
	await login(page, account);

	await open(page, "/?conto=");
	await newMovement(page, "Trasferimento", "100");
	// Il conto di partenza è il primo attivo; quello di arrivo si sceglie.
	await expect(field(page, "Conto di partenza")).toHaveText("Conto principale");
	await choose(page, "Conto di arrivo", "Revolut");
	await page.getByRole("button", { name: "Salva movimento" }).click();
	await expect(page.getByRole("button", { name: "Salva movimento" })).toHaveCount(0);

	const rows = await account.rest<{ type: string; amount: number; account_id: string; to_account_id: string; category_id: string | null }[]>(
		"GET",
		"transactions?select=type,amount,account_id,to_account_id,category_id",
	);
	expect(rows).toEqual([{ type: "trasferimento", amount: 100, account_id: principale, to_account_id: revolut, category_id: null }]);

	const balances = await account.rest<{ id: string; balance: number }[]>("GET", "account_balances?select=id,balance");
	const balance = (id: string) => Number(balances.find((b) => b.id === id)!.balance);
	expect(balance(principale)).toBe(1400);
	expect(balance(revolut)).toBe(400);
	expect(balance(principale) + balance(revolut)).toBe(1800);

	// Il Flusso non si muove: spostare denaro non è guadagnarlo né spenderlo.
	await open(page, "/?conto=");
	expect(await homeFlow(page)).toBe(0);

	// L'estratto del conto di arrivo: + € 100,00. Quello di partenza: − € 100,00.
	await open(page, `/transazioni?conto=${revolut}`);
	await expect(page.getByText("+ € 100,00").filter({ visible: true })).toBeVisible();
	await open(page, `/transazioni?conto=${principale}`);
	await expect(page.getByText("− € 100,00").filter({ visible: true })).toBeVisible();
	// Senza un conto davanti il segno non ha riferimento: neutro.
	await open(page, "/transazioni?conto=");
	await expect(page.getByText(/^€ 100,00$/).filter({ visible: true })).toBeVisible();
});
