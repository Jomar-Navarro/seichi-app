import { BASE_URL, expect, login, open, test } from "./support/fixtures";
import { insertMovements } from "./support/seed";
import type { TestAccount } from "./support/accounts";
import type { Page } from "@playwright/test";

/**
 * La card «Primi passi» (#163, design B «pietre di passaggio»).
 *
 * Custodisce i tre criteri della issue che solo l'app vera può provare:
 *   · un account nuovo vede la card, e ogni voce si spunta da sola dai dati;
 *   · chiusa su un dispositivo, resta chiusa sugli altri (la chiusura sta in
 *     `profiles`, non nel browser): il secondo dispositivo è un secondo
 *     contesto del browser, con il suo login e i suoi cookie;
 *   · a voci tutte fatte la card dice «completati» e si chiude con «Chiudi»
 *     (decisione di Jomar: non sparisce da sola, così a chiusura avvenuta la
 *     home torna a sette richieste anche per chi non avrebbe premuto niente).
 * I casi «quasi» di ogni voce (la lapide, il saldo a zero, l'obiettivo senza
 * traguardo) stanno in `supabase/tests/primi-passi.test.sql`.
 *
 * Controprove:
 *   c1 · in `loadProfile()` (lib/account.ts) ignorare `first_steps_dismissed_at`
 *        (sempre `open`): il primo test cade su «il secondo dispositivo non la
 *        vede più», con la card ancora lì, e il secondo sull'ultima riga (la
 *        card torna dopo «Chiudi»). La chiusura è scritta in entrambi: cade la
 *        lettura, non la scrittura;
 *   c2 · in `first_steps()` togliere `c.target_amount > 0`: entrambi i test
 *        cadono sul «0 su 4» iniziale, perché l'obiettivo senza traguardo spunta
 *        la voce e la card dice «1 su 4».
 */

type Seeded = { account: string; goal: string; spesa: string };

/** Un account appena uscito dall'onboarding: un conto a zero, un obiettivo senza traguardo. */
async function seedNew(a: TestAccount): Promise<Seeded> {
	// ⚠️ Una PATCH che non trova la riga risponde 200 con zero righe.
	const profile = await a.rest<unknown[]>("PATCH", `profiles?id=eq.${a.id}`, { currency: "EUR", language: "it" });
	if (!profile.length) throw new Error("profilo assente: il trigger handle_new_user() non è scattato?");
	const [acc] = await a.rest<{ id: string }[]>("POST", "accounts", [
		{ user_id: a.id, name: "Conto principale", type: "corrente", initial_balance: 0 },
	]);
	const cats = await a.rest<{ id: string; name: string }[]>("POST", "categories", [
		{ user_id: a.id, name: "Vacanze", icon: "Plane", color: "kin", type: "risparmio", target_amount: null },
		{ user_id: a.id, name: "Alimentari", icon: "ShoppingCart", color: "aka", type: "spesa", target_amount: null },
	]);
	const id = (n: string) => cats.find((c) => c.name === n)!.id;
	return { account: acc.id, goal: id("Vacanze"), spesa: id("Alimentari") };
}

const card = (page: Page) => page.getByRole("region", { name: "Primi passi" });

/** La chiusura come la vede il database, non come la mostra la pagina. */
async function dismissedAt(a: TestAccount) {
	const rows = await a.rest<{ first_steps_dismissed_at: string | null }[]>(
		"GET",
		`profiles?id=eq.${a.id}&select=first_steps_dismissed_at`,
	);
	return rows[0]?.first_steps_dismissed_at ?? null;
}

/** La home è arrivata: un'assenza va guardata sulla schermata finale, non un istante prima. */
async function homeReady(page: Page) {
	await expect(page.getByText(/^Flusso · /).first()).toBeVisible();
}

test("un account nuovo vede la card; chiusa su un dispositivo, resta chiusa sull'altro", async ({ page, account, browser }) => {
	await seedNew(account);
	await login(page, account);
	await open(page, "/");

	await expect(card(page)).toBeVisible();
	await expect(card(page).getByText("0 su 4")).toBeVisible();
	// La voce aperta è la prima che manca, e la sua pietra lo dice.
	await expect(card(page).getByRole("heading", { name: "Imposta il saldo iniziale del conto" })).toBeVisible();
	await expect(
		card(page).getByRole("button", { name: "Passo 1: Imposta il saldo iniziale del conto, il prossimo" }),
	).toHaveAttribute("aria-pressed", "true");

	// Un'altra pietra apre la sua voce: la transazione, con il link dell'import.
	await card(page).getByRole("button", { name: /^Passo 2: / }).click();
	await expect(card(page).getByRole("button", { name: "Aggiungi transazione" })).toBeVisible();
	await expect(card(page).getByRole("link", { name: "Importa un estratto conto" })).toBeVisible();

	const other = await browser.newContext({ baseURL: BASE_URL });
	try {
		const page2 = await other.newPage();
		await login(page2, account);
		await open(page2, "/");
		// Il gemello: prima della chiusura anche il secondo dispositivo la vede.
		await expect(card(page2)).toBeVisible();

		await card(page).getByRole("button", { name: "Ho capito" }).click();
		await expect(card(page)).toBeHidden();
		await expect.poll(() => dismissedAt(account), { message: "la chiusura è scritta in profiles" }).not.toBeNull();

		await open(page2, "/");
		await homeReady(page2);
		await expect(card(page2), "il secondo dispositivo non la vede più").toHaveCount(0);

		// E nemmeno il primo, ricaricando: non era solo uno stato del componente.
		await open(page, "/");
		await homeReady(page);
		await expect(card(page)).toHaveCount(0);
	} finally {
		await other.close();
	}
});

test("le voci si spuntano da sole; a voci fatte la card dice «completati» e si chiude", async ({ page, account }) => {
	const s = await seedNew(account);
	await login(page, account);
	await open(page, "/");
	await expect(card(page).getByText("0 su 4")).toBeVisible();

	// Saldo e prima transazione: la prossima voce diventa il budget.
	await account.rest("PATCH", `accounts?id=eq.${s.account}`, { initial_balance: 250 });
	await insertMovements(account, [{ type: "spesa", amount: 12.5, account_id: s.account, category_id: s.spesa }]);
	await open(page, "/");
	await expect(card(page).getByText("2 su 4")).toBeVisible();
	await expect(card(page).getByRole("heading", { name: "Imposta un budget" })).toBeVisible();
	await expect(
		card(page).getByRole("button", { name: "Passo 2: Registra la prima transazione, fatto" }),
	).toBeVisible();
	// Il passo porta alla sezione del budget, non in cima alle impostazioni.
	await expect(card(page).getByRole("link", { name: "Imposta un budget" })).toHaveAttribute("href", "/impostazioni#budget");

	// Budget globale del mese e un traguardo all'obiettivo.
	const d = new Date();
	const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
	await account.rest("POST", "budgets", [
		{ user_id: account.id, category_id: null, period: "mensile", amount: 800, valid_from: monthStart },
	]);
	await account.rest("PATCH", `categories?id=eq.${s.goal}`, { target_amount: 1000 });

	await open(page, "/");
	await expect(card(page).getByText("4 su 4")).toBeVisible();
	await expect(card(page).getByRole("heading", { name: "Primi passi completati" })).toBeVisible();
	// Il «Chiudi» del pannello è l'unico comando: niente «Ho capito» accanto.
	await expect(card(page).getByRole("button", { name: "Ho capito" })).toHaveCount(0);

	await card(page).getByRole("button", { name: "Chiudi" }).click();
	await expect(card(page)).toBeHidden();
	// ⚠️ La card sparisce SUBITO, prima che la action arrivi: ricaricare qui
	// interrompeva la richiesta, e la card tornava (trovato al primo giro).
	await expect.poll(() => dismissedAt(account), { message: "la chiusura è scritta in profiles" }).not.toBeNull();
	await open(page, "/");
	await homeReady(page);
	await expect(card(page)).toHaveCount(0);
});
