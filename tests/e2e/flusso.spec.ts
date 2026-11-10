import { analisiFlow, homeFlow } from "./support/app";
import { expect, login, open, test } from "./support/fixtures";
import { insertMovements, seedBasic } from "./support/seed";

/**
 * Home e /analisi rispondono allo stesso modo a «quanto è entrato e uscito»,
 * con e senza un conto scelto.
 *
 * ⚠️ Il difetto che custodisce (review della 20a): /analisi mostrava un KPI con
 * la stessa parola della home, calcolato come entrate − TUTTO il resto, cioè
 * sottraendo anche risparmi e investimenti. Due schermate a un tocco di
 * distanza, due risposte per lo stesso mese, € 480 di differenza.
 *
 * I numeri sono scelti perché ogni formula sbagliata dia un valore diverso:
 *   giusto         2000 − 300 − 50 − 30            = 1620
 *   − risparmi                                     = 1420
 *   − investimenti                                 = 1220
 *   − entrambi                                     = 1020
 *   − trasferimento                                = 1520
 *
 * Controprova: in `sommaUscite()` contare come uscita ogni tipo diverso da
 * `entrata` (la formula di prima).
 */
test("home e /analisi danno lo stesso Flusso, filtrate o no", async ({ page, account }) => {
	const s = await seedBasic(account);
	const { principale, revolut } = s.accounts;
	await insertMovements(account, [
		{ type: "entrata", amount: 2000, account_id: principale, category_id: s.cat("Stipendio") },
		{ type: "spesa", amount: 300, account_id: principale, category_id: s.cat("Alimentari") },
		{ type: "abbonamento", amount: 50, account_id: principale, category_id: s.cat("Spotify") },
		{ type: "risparmio", amount: 200, account_id: principale, category_id: s.cat("Vacanza") },
		{ type: "investimento", amount: 400, account_id: principale, category_id: s.cat("ETF") },
		{ type: "trasferimento", amount: 100, account_id: principale, to_account_id: revolut },
		{ type: "spesa", amount: 30, account_id: revolut, category_id: s.cat("Ristoranti") },
	]);
	await login(page, account);

	// ⚠️ `?conto=` esplicito: il conto scelto si ricorda in un cookie, quindi
	// «aprire la home» non è uno stato determinato (20b, #148).
	await open(page, "/?conto=");
	expect(await homeFlow(page)).toBe(1620);
	await open(page, "/analisi?conto=");
	expect(await analisiFlow(page)).toBe(1620);

	// Filtrate sul conto di ORIGINE: Revolut ha solo la spesa da 30. Il
	// trasferimento in arrivo non entra nel flusso — spostare non è guadagnare.
	await open(page, `/?conto=${revolut}`);
	expect(await homeFlow(page)).toBe(-30);
	await open(page, `/analisi?conto=${revolut}`);
	expect(await analisiFlow(page)).toBe(-30);
});
