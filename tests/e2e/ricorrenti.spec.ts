import type { Page } from "@playwright/test";
import type { TestAccount } from "./support/accounts";
import { choose, newMovement } from "./support/app";
import { expect, login, open, test } from "./support/fixtures";
import { localSql } from "./support/db";
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
 * Il guasto è INIETTATO: un trigger di prova che rifiuta i movimenti con una
 * nota-marcatore, creato dal test nel database locale e tolto in un `finally`.
 * Fino alla #220 il guasto era vero — una descrizione oltre i 255 caratteri,
 * che la regola salvava e il movimento rifiutava — ma ora il form, le action e
 * un CHECK lo impediscono: l'app non sa più produrre una regola che fallisce,
 * ed è proprio per questo che serve iniettarla. Il trigger guarda solo la nota
 * di questo test: gli scenari che girano in parallelo non lo vedono.
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

/** La nota che il trigger di prova rifiuta: solo questo scenario la scrive. */
const GUASTO = "Guasto di prova #173";

const INSTALL_GUASTO = `
create or replace function public.e2e_guasto_173() returns trigger language plpgsql as $$
begin
	if new.notes = '${GUASTO}' then
		raise exception 'guasto di prova e2e (#173)';
	end if;
	return new;
end $$;
drop trigger if exists e2e_guasto_173 on public.transactions;
create trigger e2e_guasto_173 before insert on public.transactions
	for each row execute function public.e2e_guasto_173();
`;

const REMOVE_GUASTO = `
drop trigger if exists e2e_guasto_173 on public.transactions;
drop function if exists public.e2e_guasto_173();
`;

test("la ricorrenza salvata senza il suo movimento lo dice, e non si duplica", async ({ page, account }) => {
	localSql(INSTALL_GUASTO);
	try {
		await guastoNelForm(page, account);
	} finally {
		localSql(REMOVE_GUASTO);
	}
});

async function guastoNelForm(page: Page, account: TestAccount) {
	await seedBasic(account);
	await login(page, account);
	await open(page, "/?conto=");

	await newMovement(page, "Uscita", "37");
	const wizard = page.getByRole("dialog", { name: "Nuovo movimento" });
	await choose(page, "Categoria", "Alimentari");
	await wizard.getByPlaceholder("Es. Trenord, Esselunga...").fill(GUASTO);
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
	expect(rules[0].notes).toBe(GUASTO);
	const generated = await account.rest<unknown[]>("GET", `transactions?select=id&recurring_rule_id=eq.${rules[0].id}`);
	expect(generated).toHaveLength(0);

	// Il bottone in fondo, col testo: la X dell'intestazione ha lo stesso nome
	// accessibile (`aria-label`), e chiude allo stesso modo.
	await wizard.getByRole("button", { name: "Chiudi" }).filter({ hasText: "Chiudi" }).click();
	await expect(wizard).toHaveCount(0);
	expect(await account.rest<unknown[]>("GET", "recurring_rules?select=id")).toHaveLength(1);
}

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
