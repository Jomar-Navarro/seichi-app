import { deleteUser, findUserByEmail, passwordToken, restAs, testEmail, testPassword } from "./support/accounts";
import { expect, login, open, test } from "./support/fixtures";
import { insertMovements } from "./support/seed";

/**
 * Registrazione dal form vero e onboarding, con l'abbandono a metà.
 *
 * ⚠️ Il difetto che custodisce (review della 20a): il primo conto nasceva a
 * `/category`, un passo DOPO `/preference`, che scrive `profiles.currency` —
 * il cancello dell'onboarding. Chi abbandonava in mezzo entrava nell'app senza
 * conti, e con `account_id` NOT NULL il form del movimento diceva «Serve un
 * conto» per sempre. L'invariante va stabilita dove il cancello scatta.
 *
 * Controprova: togliere `ensureFirstAccount()` da `savePreferences()`.
 */
test("registrazione, abbandono dopo le preferenze, poi fine dell'onboarding", async ({ page }) => {
	const email = testEmail();
	const password = testPassword();
	try {
		await open(page, "/sign?tab=signup");
		await page.fill('input[name="name"]', "Prova");
		await page.fill('input[name="surname"]', "Onboarding");
		await page.fill('input[name="email"]', email);
		await page.fill('input[name="password"]', password);
		await page.fill('input[name="confirm-password"]', password);
		await page.check("#privacy");
		await page.locator("form").getByRole("button", { name: "Crea account" }).click();
		await page.waitForURL(/\/start$/);

		await page.getByRole("button", { name: "Inizia" }).filter({ visible: true }).first().click();
		await page.waitForURL(/\/preference$/);
		await page.getByRole("button", { name: "Continua" }).filter({ visible: true }).first().click();
		await page.waitForURL(/\/category$/);

		// L'abbandono: niente categorie, si va in home dall'indirizzo.
		await open(page, "/");
		await expect(page).toHaveURL(/\/$/);
		await page.locator(".fab").first().click();
		await page.getByRole("button", { name: /Uscita/ }).first().click();
		await page.getByRole("button", { name: "1", exact: true }).filter({ visible: true }).last().click();
		await page.getByRole("button", { name: "Continua" }).filter({ visible: true }).first().click();
		await expect(page.getByText("Conto principale").filter({ visible: true }).first()).toBeVisible();
		await expect(page.getByText(/Serve un conto per registrare un movimento/)).toHaveCount(0);

		// Chi torna a finire: `/category` è ancora aperta, perché non ha categorie.
		await open(page, "/category");
		await page.getByText("Alimentari", { exact: true }).filter({ visible: true }).first().click();
		await page.getByRole("button", { name: "Completa la configurazione" }).filter({ visible: true }).first().click();
		await page.waitForURL((u) => u.pathname === "/");

		const { access_token, user } = await passwordToken(email, password);
		const rest = restAs(access_token);
		const [profile] = await rest<{ currency: string; language: string; full_name: string }[]>(
			"GET",
			`profiles?id=eq.${user.id}&select=currency,language,full_name`,
		);
		expect(profile).toEqual({ currency: "EUR", language: "it", full_name: "Prova Onboarding" });
		const accounts = await rest<{ name: string }[]>("GET", "accounts?select=name");
		expect(accounts).toEqual([{ name: "Conto principale" }]);
		const cats = await rest<{ name: string; type: string }[]>("GET", "categories?select=name,type");
		expect(cats).toEqual([{ name: "Alimentari", type: "spesa" }]);
	} finally {
		const u = await findUserByEmail(email);
		if (u) await deleteUser(u.id);
	}
});

/**
 * Completare l'onboarding una seconda volta AGGIUNGE le categorie che mancano
 * e non ne cancella nessuna (#116).
 *
 * ⚠️ Il difetto che custodisce: `saveCategories()` cancellava tutte le
 * categorie dell'utente e reinseriva le scelte. Con la FK dei movimenti in
 * cascata, toccare «Completa» su una `/category` rimasta aperta cancellava
 * ogni movimento — budget, obiettivi e ricevute con loro — senza conferma.
 * La pagina si prepara aperta PRIMA che esistano categorie (il layout rimanda
 * in home chi ha finito), e i dati nascono intanto: è il caso della scheda
 * dimenticata aperta.
 *
 * Controprova: in `saveCategories()` cancellare le categorie dell'utente
 * prima di inserire le scelte.
 */
test("completare di nuovo l'onboarding non cancella i movimenti", async ({ page, account }) => {
	await account.rest("PATCH", `profiles?id=eq.${account.id}`, { currency: "EUR", language: "it" });
	const [conto] = await account.rest<{ id: string }[]>("POST", "accounts", { user_id: account.id, name: "Conto principale", type: "corrente", initial_balance: 0 });
	await login(page, account);
	await open(page, "/category");

	// Mentre la pagina resta aperta, l'app viene usata.
	const cats = await account.rest<{ id: string; name: string }[]>("POST", "categories", [
		{ user_id: account.id, name: "Alimentari", icon: "ShoppingCart", color: "aka", type: "spesa" },
		{ user_id: account.id, name: "Stipendio", icon: "Banknote", color: "midori", type: "entrata" },
	]);
	const cat = (n: string) => cats.find((c) => c.name === n)!.id;
	await insertMovements(account, [
		{ type: "spesa", amount: 40, account_id: conto.id, category_id: cat("Alimentari") },
		{ type: "entrata", amount: 1000, account_id: conto.id, category_id: cat("Stipendio") },
	]);

	await page.getByText("Alimentari", { exact: true }).filter({ visible: true }).first().click();
	await page.getByText("Ristoranti", { exact: true }).filter({ visible: true }).first().click();
	await page.getByRole("button", { name: "Completa la configurazione" }).filter({ visible: true }).first().click();
	await page.waitForURL((u) => u.pathname === "/");

	const movements = await account.rest<unknown[]>("GET", "transactions?select=id");
	expect(movements).toHaveLength(2);
	const names = (await account.rest<{ name: string }[]>("GET", "categories?select=name&order=name")).map((c) => c.name);
	// «Alimentari» c'era già: non si duplica. «Ristoranti» mancava: si aggiunge.
	expect(names).toEqual(["Alimentari", "Ristoranti", "Stipendio"]);
});
