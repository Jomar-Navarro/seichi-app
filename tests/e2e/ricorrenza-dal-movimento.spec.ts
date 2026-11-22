import { expect, login, open, test } from "./support/fixtures";
import { seedBasic, todayNoon } from "./support/seed";

/**
 * Da un movimento generato si arriva alla SUA regola (#222).
 *
 * ⚠️ Il difetto che custodisce: il pannello «Modifica movimento» di un
 * movimento generato da una ricorrenza non portava da nessuna parte. Per
 * cambiare importo o frequenza della regola bisognava sapere che esiste
 * Impostazioni › Ricorrenti, e ritrovarla lì.
 *
 * E i difetti che la strada scelta poteva introdurre:
 *   - il parametro `?regola=` è un'istruzione dall'URL: un id falso o non
 *     dell'utente non apre niente e non rompe la pagina;
 *   - eseguita l'istruzione, il parametro si toglie: ricaricando, la regola già
 *     chiusa non si riapre;
 *   - dopo il salvataggio la lista mostra l'importo NUOVO (la pulizia dell'URL
 *     non deve scavalcare il refresh del pannello);
 *   - la regola cambia, il movimento già generato no.
 *
 * Controprove (dichiarate prima di eseguirle):
 *   c1 · in `RecurringManager` inizializzare `editing` a `null` (ignorare il
 *        parametro): il primo test cade su «il pannello della regola è aperto»;
 *   c2 · in `closeEditing()` non togliere il parametro (togliere le righe dopo
 *        `setEditing(null)`): il primo test cade su «l'URL non porta più
 *        ?regola»;
 *   c3 · in `TransactionForm` mostrare la riga anche senza regola
 *        (`transaction?.id` al posto di `transaction?.recurring_rule_id`): il
 *        secondo test cade su «un movimento senza regola non la offre».
 *
 * La regola e il movimento generato si scrivono via REST col token
 * dell'utente: il movimento porta `recurring_rule_id`, come quelli del job.
 */

test("dal movimento generato si apre la sua regola, la si modifica, e il movimento resta com'è", async ({ page, account }) => {
	const s = await seedBasic(account);
	const [rule] = await account.rest<{ id: string }[]>("POST", "recurring_rules", {
		user_id: account.id,
		account_id: s.accounts.principale,
		category_id: s.cat("Spotify"),
		type: "abbonamento",
		amount: 11.99,
		frequency: "mensile",
		start_date: todayNoon(30).slice(0, 10),
		next_run: todayNoon(-1).slice(0, 10),
	});
	const [tx] = await account.rest<{ id: string }[]>("POST", "transactions", {
		user_id: account.id,
		account_id: s.accounts.principale,
		category_id: s.cat("Spotify"),
		type: "abbonamento",
		amount: 11.99,
		date: todayNoon(),
		recurring_rule_id: rule.id,
	});

	await login(page, account);
	await open(page, "/?conto=");

	await page.getByRole("button", { name: /Spotify/ }).first().click();
	const movement = page.getByRole("dialog", { name: "Modifica movimento" });
	await expect(movement).toBeVisible();
	const hint = "Le modifiche alla ricorrenza valgono per i prossimi movimenti: questo resta com'è.";
	await expect(movement.getByText(hint)).toBeVisible();
	const link = movement.getByRole("button", { name: "Modifica la ricorrenza" });
	// Lo screen reader la legge col bottone, non come un testo staccato.
	await expect(link).toHaveAccessibleDescription(hint);
	await link.click();

	// Il pannello del movimento è chiuso, e quello della regola è aperto.
	await expect(movement).toHaveCount(0);
	await expect(page).toHaveURL(new RegExp(`/impostazioni/ricorrenti\\?regola=${rule.id}$`));
	const sheet = page.getByRole("dialog", { name: "Modifica ricorrenza" });
	await expect(sheet, "il pannello della regola è aperto").toBeVisible();
	const amount = sheet.locator("input[inputmode=decimal]");
	await expect(amount).toHaveValue("11,99");

	await amount.fill("13,49");
	await sheet.getByRole("button", { name: "Salva modifiche" }).click();
	await expect(sheet).toHaveCount(0);

	// Eseguita l'istruzione, il parametro se ne va.
	await expect(page, "l'URL non porta più ?regola").toHaveURL(/\/impostazioni\/ricorrenti$/);
	// La lista ha l'importo nuovo: la pulizia dell'URL non ha scavalcato il refresh.
	await expect(page.getByText("€ 13,49")).toBeVisible();

	const [saved] = await account.rest<{ amount: number }[]>("GET", `recurring_rules?select=amount&id=eq.${rule.id}`);
	expect(Number(saved.amount)).toBe(13.49);
	const [generated] = await account.rest<{ amount: number }[]>("GET", `transactions?select=amount&id=eq.${tx.id}`);
	expect(Number(generated.amount), "il movimento già generato resta com'è").toBe(11.99);

	// Ricaricando, la regola già chiusa non si riapre.
	await page.reload();
	await expect(page.getByText("€ 13,49")).toBeVisible();
	await expect(page.getByRole("dialog", { name: "Modifica ricorrenza" })).toHaveCount(0);
});

// I gemelli: un movimento senza regola non offre il collegamento, e un
// parametro che non indica una regola dell'utente non apre niente.
test("un movimento senza regola non la offre, e un ?regola= sbagliato non apre niente", async ({ page, account }) => {
	const s = await seedBasic(account);
	await account.rest("POST", "transactions", {
		user_id: account.id,
		account_id: s.accounts.principale,
		category_id: s.cat("Ristoranti"),
		type: "spesa",
		amount: 23,
		date: todayNoon(),
	});
	await account.rest("POST", "recurring_rules", {
		user_id: account.id,
		account_id: s.accounts.principale,
		category_id: s.cat("Spotify"),
		type: "abbonamento",
		amount: 11.99,
		frequency: "mensile",
		start_date: todayNoon(-1).slice(0, 10),
		next_run: todayNoon(-1).slice(0, 10),
	});

	await login(page, account);
	await open(page, "/?conto=");
	await page.getByRole("button", { name: /Ristoranti/ }).first().click();
	const movement = page.getByRole("dialog", { name: "Modifica movimento" });
	await expect(movement).toBeVisible();
	await expect(
		movement.getByRole("button", { name: "Modifica la ricorrenza" }),
		"un movimento senza regola non la offre",
	).toHaveCount(0);

	for (const bad of ["00000000-0000-4000-d000-000000000999", "affitto"]) {
		await open(page, `/impostazioni/ricorrenti?regola=${bad}`);
		// La lista c'è (la regola dell'utente), e nessun pannello si apre.
		await expect(page.getByText("Spotify").first()).toBeVisible();
		await expect(page.getByRole("dialog", { name: "Modifica ricorrenza" })).toHaveCount(0);
	}
});
