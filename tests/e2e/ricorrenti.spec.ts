import { choose, newMovement } from "./support/app";
import { expect, login, open, test } from "./support/fixtures";
import { seedBasic } from "./support/seed";

/**
 * Una ricorrenza il cui movimento già dovuto non si genera lo dice nel form
 * (#173).
 *
 * ⚠️ Il difetto che custodisce: `createRecurringRule()` chiamava
 * `generate_recurring_transactions()` e ne scartava l'esito. Se la regola non
 * si generava, il form si chiudeva su «Ricorrenza creata.» e la regola veniva
 * saltata di nuovo ogni notte, senza che nessuno lo sapesse.
 *
 * Il guasto è VERO, non iniettato: una descrizione oltre i 255 caratteri.
 * `recurring_rules.notes` è `text` e la salva, `transactions.notes` è
 * `varchar(255)` e rifiuta il movimento generato. ⚠️ Quando la #220 chiuderà
 * quel buco (il form non accetterà più una nota così lunga), questo scenario
 * va spostato su un'altra iniezione.
 *
 * E il difetto che la correzione poteva introdurre: rispondere `{ error }`
 * terrebbe aperto il pannello su «Crea ricorrenza», e il secondo tocco
 * creerebbe una seconda regola. Lo scenario conta le regole.
 *
 * Controprova: in `createRecurringRule()` tornare a
 * `await supabase.rpc("generate_recurring_transactions")` senza leggerne
 * l'esito, e `return { success: true }`. Il primo test cade su «l'avviso si
 * legge»: il pannello si chiude su «Ricorrenza creata.».

 *
 * ⚠️ In locale, fra mezzanotte e l'una o le due, entrambi gli scenari possono
 * cadere: il server è in ora italiana e il database in UTC, e la regola che il
 * server fa partire «oggi» per il database è domani — niente da generare.
 * In CI e in produzione sono entrambi UTC.
 */

const LONG_NOTE = "Affitto del box in via Roma, ".repeat(11); // 319 caratteri

test("la ricorrenza salvata senza il suo movimento lo dice, e non si duplica", async ({ page, account }) => {
	expect(LONG_NOTE.length).toBeGreaterThan(255);
	await seedBasic(account);
	await login(page, account);
	await open(page, "/?conto=");

	await newMovement(page, "Uscita", "37");
	const wizard = page.getByRole("dialog", { name: "Nuovo movimento" });
	await choose(page, "Categoria", "Alimentari");
	await wizard.getByPlaceholder("Es. Trenord, Esselunga...").fill(LONG_NOTE);
	await wizard.getByRole("button", { name: "Ripeti" }).click();
	await wizard.getByRole("button", { name: "Crea ricorrenza" }).click();

	// L'avviso si legge: dentro il pannello rimasto aperto, e sullo schermo.
	const notice = wizard.getByRole("status").filter({ hasText: "Ricorrenza salvata" });
	await expect(notice).toHaveText(
		"Ricorrenza salvata, ma il movimento già dovuto non è stato registrato. Ci riproviamo stanotte; se non riesce, riceverai una notifica.",
	);
	await expect(notice).toBeInViewport();

	// L'unico gesto rimasto è chiudere: «Crea ricorrenza» non c'è più.
	await expect(wizard.getByRole("button", { name: "Crea ricorrenza" })).toHaveCount(0);
	const rules = await account.rest<{ id: string; notes: string }[]>("GET", "recurring_rules?select=id,notes");
	expect(rules).toHaveLength(1);
	expect(rules[0].notes).toBe(LONG_NOTE);
	const generated = await account.rest<unknown[]>("GET", `transactions?select=id&recurring_rule_id=eq.${rules[0].id}`);
	expect(generated).toHaveLength(0);

	// Il bottone in fondo, col testo: la X dell'intestazione ha lo stesso nome
	// accessibile (`aria-label`), e chiude allo stesso modo.
	await wizard.getByRole("button", { name: "Chiudi" }).filter({ hasText: "Chiudi" }).click();
	await expect(wizard).toHaveCount(0);
	expect(await account.rest<unknown[]>("GET", "recurring_rules?select=id")).toHaveLength(1);
});

// Il gemello: la stessa ricorrenza con una descrizione normale si genera, e il
// pannello si chiude come sempre. Senza, un form che mostrasse l'avviso a ogni
// regola passerebbe il test qui sopra.
test("la ricorrenza che si genera chiude il pannello come sempre", async ({ page, account }) => {
	await seedBasic(account);
	await login(page, account);
	await open(page, "/?conto=");

	await newMovement(page, "Uscita", "37");
	const wizard = page.getByRole("dialog", { name: "Nuovo movimento" });
	await choose(page, "Categoria", "Alimentari");
	await wizard.getByPlaceholder("Es. Trenord, Esselunga...").fill("Box");
	await wizard.getByRole("button", { name: "Ripeti" }).click();
	await wizard.getByRole("button", { name: "Crea ricorrenza" }).click();
	await expect(wizard).toHaveCount(0);
	await expect(page.locator("[data-dialog-keep-alive]")).toHaveText("Ricorrenza creata.");

	const rules = await account.rest<{ id: string }[]>("GET", "recurring_rules?select=id");
	expect(rules).toHaveLength(1);
	const generated = await account.rest<unknown[]>("GET", `transactions?select=id&recurring_rule_id=eq.${rules[0].id}`);
	expect(generated).toHaveLength(1);
});
