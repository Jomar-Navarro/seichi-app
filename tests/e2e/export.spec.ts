import { readFileSync } from "node:fs";
import { parseAmount, parseCsv } from "../../lib/import/csv";
import { choose } from "./support/app";
import { expect, login, open, test } from "./support/fixtures";
import { insertMovements, seedBasic } from "./support/seed";

/**
 * L'export CSV scaricato dalla pagina vera, riletto dal lettore dell'import
 * (23a): le due metà del progetto non si contraddicono sul formato.
 *
 * I test unitari di `lib/export/csv.ts` provano il serializzatore; questo prova
 * ciò che gli sta attorno — la rotta, i filtri, il segno per conto, il nome del
 * file — che è dove sono nati i difetti della 23a.
 *
 * ⚠️ Il difetto che custodisce: la colonna Tipo usciva da `t.typesSingular`,
 * che non ha `trasferimento` né `disinvestimento` (nessuno dei due può avere
 * una categoria propria): `lookup()` ripiegava sull'id del database, e il file
 * diceva «Uscita» per cinque tipi e `trasferimento` minuscolo per il sesto.
 * Ogni riga era sintatticamente perfetta.
 *
 * Controprova: nella rotta del download usare `t.typesSingular` per il Tipo.
 */
test("l'export di un conto si rilegge con il lettore dell'import", async ({ page, account }) => {
	const s = await seedBasic(account);
	const { principale, revolut } = s.accounts;
	await insertMovements(account, [
		{ type: "spesa", amount: 12.5, account_id: principale, category_id: s.cat("Alimentari"), notes: "=1+1" },
		{ type: "spesa", amount: 3, account_id: principale, category_id: s.cat("Ristoranti"), notes: "Caffè; latte" },
		{ type: "trasferimento", amount: 400, account_id: principale, to_account_id: revolut },
		{ type: "disinvestimento", amount: 120, account_id: principale, category_id: s.cat("ETF") },
	]);
	await login(page, account);
	await open(page, "/impostazioni/esporta");
	await choose(page, "Conto", "Conto principale");

	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page.getByRole("link", { name: "Scarica il file CSV" }).click(),
	]);
	expect(download.suggestedFilename()).toMatch(/^seichi-movimenti-[a-z0-9-]+-conto-principale-\d{4}-\d{2}-\d{2}\.csv$/);
	const text = readFileSync((await download.path())!, "utf8");

	// Il BOM, o Excel su Windows apre «Caffè» come «CaffÃ¨».
	expect(text.charCodeAt(0)).toBe(0xfeff);
	const [header, ...rows] = parseCsv(text);
	expect(header).toEqual(["Data", "Tipo", "Categoria", "Conto", "Conto di arrivo", "Importo", "Note", "Ricevute"]);

	const byNote = (n: string) => rows.find((r) => r[6] === n);
	const types = rows.map((r) => r[1]).sort();
	expect(types).toEqual(["Disinvestimento", "Trasferimento", "Uscita", "Uscita"]);
	// La formula resta testo: l'apice davanti la disinnesca.
	expect(byNote("'=1+1")).toBeTruthy();
	expect(parseAmount(byNote("'=1+1")![5])).toBe(-12.5);
	expect(byNote("Caffè; latte")![2]).toBe("Ristoranti");
	// Dal conto di partenza il trasferimento esce, la vendita rientra.
	const transfer = rows.find((r) => r[1] === "Trasferimento")!;
	expect(transfer[4]).toBe("Revolut");
	expect(parseAmount(transfer[5])).toBe(-400);
	expect(parseAmount(rows.find((r) => r[1] === "Disinvestimento")![5])).toBe(120);
});
