import { choose, field, newMovement } from "./support/app";
import { expect, login, open, test } from "./support/fixtures";
import { insertMovements, seedBasic } from "./support/seed";

/**
 * Il nuovo movimento propone il conto che la pagina sta guardando (#112).
 *
 * ⚠️ Il difetto che custodisce: con Revolut scelto in home, «Nuovo movimento»
 * proponeva il primo conto attivo, e dimenticarsi di cambiarlo scriveva il
 * movimento sul conto sbagliato. Il modale sta nel layout e non sa quale
 * pagina c'è sotto: glielo dice `viewedAccountId`.
 *
 * Controprova: nel form ignorare `viewedAccountId` e proporre il primo attivo.
 */
test("il nuovo movimento propone il conto guardato", async ({ page, account }) => {
	const s = await seedBasic(account);
	await login(page, account);

	await open(page, `/?conto=${s.accounts.revolut}`);
	await newMovement(page, "Uscita", "12");
	await expect(field(page, "Conto")).toHaveText("Revolut");

	// Movimenti filtrata su Revolut dichiara anche lei il proprio conto.
	await open(page, `/transazioni?conto=${s.accounts.revolut}`);
	await newMovement(page, "Uscita", "12");
	await expect(field(page, "Conto")).toHaveText("Revolut");

	// «Tutti i conti»: nessun conto guardato, si propone il primo attivo.
	await open(page, "/?conto=");
	await newMovement(page, "Uscita", "12");
	await expect(field(page, "Conto")).toHaveText("Conto principale");
});

/**
 * Tornare indietro nel wizard non perde ciò che si è scritto, e un salvataggio
 * scrive UNA riga (#122).
 *
 * ⚠️ Il difetto che custodisce: il tasto «indietro» smontava il form.
 * Categoria, descrizione, conto e foto in coda sparivano senza avviso.
 *
 * Controprova: montare il form solo quando il passo è «form».
 */
test("indietro nel wizard non perde i campi", async ({ page, account }) => {
	const s = await seedBasic(account);
	await login(page, account);
	await open(page, "/?conto=");

	await newMovement(page, "Uscita", "25");
	await choose(page, "Categoria", "Ristoranti");
	await page.getByPlaceholder(/^Es. Trenord/).fill("pranzo di lavoro");

	// Indietro all'importo, poi alla griglia dei tipi, e di nuovo avanti.
	const back = page.locator("button:has(svg.lucide-chevron-left)").filter({ visible: true }).first();
	await back.click();
	await back.click();
	await page.getByRole("button", { name: /^Uscita/ }).first().click();
	await page.getByRole("button", { name: "Continua" }).filter({ visible: true }).first().click();

	await expect(field(page, "Categoria")).toHaveText("Ristoranti");
	await expect(page.getByPlaceholder(/^Es. Trenord/)).toHaveValue("pranzo di lavoro");
	await page.getByRole("button", { name: "Salva movimento" }).click();
	await expect(page.getByRole("button", { name: "Salva movimento" })).toHaveCount(0);

	const rows = await account.rest<{ amount: number; category_id: string; notes: string; type: string }[]>(
		"GET",
		"transactions?select=amount,category_id,notes,type",
	);
	expect(rows).toEqual([{ amount: 25, category_id: s.cat("Ristoranti"), notes: "pranzo di lavoro", type: "spesa" }]);
});

/**
 * La ricerca trova anche col testo che il telefono lascia in coda (#122).
 *
 * ⚠️ Il difetto che custodisce: «Revolut » — con lo spazio che il suggerimento
 * della tastiera di iOS aggiunge — non trovava niente, perché l'ago non veniva
 * ripulito. La ricerca guarda anche il nome del conto, che sta su un'altra
 * tabella: è proprio il caso in cui si cerca per conto.
 *
 * Controprova: cercare senza togliere gli spazi dall'ago.
 */
test("la ricerca ignora gli spazi in coda", async ({ page, account }) => {
	const s = await seedBasic(account);
	await insertMovements(account, [
		{ type: "spesa", amount: 4.5, account_id: s.accounts.revolut, category_id: s.cat("Ristoranti"), notes: "caffè al banco" },
		{ type: "spesa", amount: 3, account_id: s.accounts.principale, category_id: s.cat("Alimentari"), notes: "pane" },
	]);
	await login(page, account);
	await open(page, "/transazioni?conto=");
	await expect(page.getByText("pane").filter({ visible: true })).toBeVisible();

	await page.getByPlaceholder("Cerca movimenti").fill("Revolut ");
	await expect(page.getByText("caffè al banco").filter({ visible: true })).toBeVisible();
	await expect(page.getByText("pane", { exact: true })).toHaveCount(0);
});
