import { choose, newMovement } from "./support/app";
import { expect, login, open, test } from "./support/fixtures";
import { seedBasic } from "./support/seed";

/**
 * La descrizione si ferma a 255 caratteri (#220).
 *
 * ⚠️ Il difetto che custodisce: il campo non aveva limite, `transactions.notes`
 * è `varchar(255)` e `recurring_rules.notes` era `text`. Una ricorrenza con una
 * descrizione più lunga si salvava e poi veniva saltata a ogni generazione; un
 * movimento falliva con «Qualcosa è andato storto», senza dire perché.
 *
 * Tre porte, tre prove:
 *   1. il campo si ferma a 255 e lo dice col contatore (da 200 in su);
 *   2. una POST alterata a mano si ferma nell'action, con la sua frase;
 *   3. un insert diretto via REST si ferma nel database (il CHECK nuovo sulle
 *      regole, il `varchar(255)` che c'era già sui movimenti).
 *
 * Controprove:
 *   c1 · in `TransactionForm` tornare a `setDescription(e.target.value)`: il
 *        primo test cade sulla lunghezza del campo (300, attesi 255);
 *   c2 · togliere `isStorableNotes` da `saveTransaction()`: il secondo cade
 *        sulla frase — il database rifiuta lo stesso, ma la action lo traduce
 *        in «Qualcosa è andato storto»;
 *   c3 · togliere il CHECK dal database locale: il secondo cade sull'insert
 *        diretto della regola, che passa.
 */

const DESCRIZIONE = "Es. Trenord, Esselunga...";

test("la descrizione si ferma a 255 caratteri, e il contatore lo dice", async ({ page, account }) => {
	await seedBasic(account);
	await login(page, account);
	await open(page, "/?conto=");

	await newMovement(page, "Uscita", "12");
	const wizard = page.getByRole("dialog", { name: "Nuovo movimento" });
	await choose(page, "Categoria", "Alimentari");
	const field = wizard.getByPlaceholder(DESCRIZIONE);
	const counter = wizard.getByText(/^\d+\/255$/);

	// Sotto i 200 il contatore non c'è: su ogni movimento sarebbe rumore.
	await field.fill("a".repeat(199));
	await expect(counter).toHaveCount(0);
	await field.fill("a".repeat(200));
	await expect(counter).toHaveText("200/255");

	// Un incolla più lungo si ferma al limite, e il contatore lo dice.
	await field.fill("a".repeat(300));
	await expect(field).toHaveValue("a".repeat(255));
	await expect(counter).toHaveText("255/255");

	await wizard.getByRole("button", { name: "Salva movimento" }).click();
	await expect(wizard).toHaveCount(0);
	const rows = await account.rest<{ notes: string }[]>("GET", "transactions?select=notes");
	expect(rows).toHaveLength(1);
	expect(rows[0].notes).toHaveLength(255);
});

test("una nota più lunga mandata a mano si ferma nell'action e nel database", async ({ page, account }) => {
	const s = await seedBasic(account);
	await login(page, account);
	await open(page, "/?conto=");

	/*
	 * La POST della server action, alterata in volo: è la porta di chi scrive
	 * la richiesta a mano, senza passare dal campo. Il corpo è l'elenco degli
	 * argomenti di `saveTransaction` in JSON; la nota è il quarto.
	 */
	let altered = false;
	await page.route("**/*", async (route) => {
		const req = route.request();
		if (req.method() === "POST" && req.headers()["next-action"]) {
			try {
				const args = JSON.parse(req.postData() ?? "");
				if (Array.isArray(args) && args[3] === "Box") {
					args[3] = "a".repeat(300);
					altered = true;
					return route.continue({ postData: JSON.stringify(args) });
				}
			} catch {
				// non è il corpo che cerchiamo
			}
		}
		return route.fallback();
	});

	await newMovement(page, "Uscita", "12");
	const wizard = page.getByRole("dialog", { name: "Nuovo movimento" });
	await choose(page, "Categoria", "Alimentari");
	await wizard.getByPlaceholder(DESCRIZIONE).fill("Box");
	await wizard.getByRole("button", { name: "Salva movimento" }).click();

	await expect(wizard.getByRole("alert")).toHaveText("La descrizione supera i 255 caratteri");
	expect(altered).toBe(true);
	expect(await account.rest<unknown[]>("GET", "transactions?select=id")).toHaveLength(0);

	// Il database, direttamente: la regola dal CHECK nuovo, il movimento dal
	// `varchar(255)` che c'era già.
	await expect(
		account.rest("POST", "recurring_rules", {
			user_id: account.id,
			account_id: s.accounts.principale,
			amount: 5,
			type: "spesa",
			notes: "a".repeat(256),
			frequency: "mensile",
			start_date: "2099-01-01",
			next_run: "2099-01-01",
		}),
	).rejects.toThrow(/recurring_rules_notes_length_check/);
	await expect(
		account.rest("POST", "transactions", {
			user_id: account.id,
			account_id: s.accounts.principale,
			amount: 5,
			type: "spesa",
			notes: "a".repeat(256),
			date: "2026-01-01T12:00:00",
		}),
	).rejects.toThrow(/22001/);
	// Il gemello: al limite esatto la regola si scrive.
	await account.rest("POST", "recurring_rules", {
		user_id: account.id,
		account_id: s.accounts.principale,
		amount: 5,
		type: "spesa",
		notes: "a".repeat(255),
		frequency: "mensile",
		start_date: "2099-01-01",
		next_run: "2099-01-01",
	});
});
