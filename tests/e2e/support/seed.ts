import type { TestAccount } from "./accounts";

/**
 * Lo stato di partenza comune: profilo configurato (`currency` è il cancello
 * dell'onboarding), due conti e una categoria per tipo. I movimenti li scrive
 * ogni scenario, con importi scelti perché ogni difetto dia un numero diverso.
 */
export type Seeded = {
	accounts: { principale: string; revolut: string };
	cat: (name: SeedCategory) => string;
};

export type SeedCategory = "Alimentari" | "Ristoranti" | "Stipendio" | "ETF" | "Spotify" | "Vacanza";

export async function seedBasic(a: TestAccount): Promise<Seeded> {
	// ⚠️ Una PATCH che non trova la riga risponde 200 con zero righe.
	const profile = await a.rest<unknown[]>("PATCH", `profiles?id=eq.${a.id}`, { currency: "EUR", language: "it" });
	if (!profile.length) throw new Error("profilo assente: il trigger handle_new_user() non è scattato?");

	const accounts = await a.rest<{ id: string; name: string }[]>("POST", "accounts", [
		{ user_id: a.id, name: "Conto principale", type: "corrente", initial_balance: 1500 },
		{ user_id: a.id, name: "Revolut", type: "corrente", initial_balance: 300 },
	]);
	// ⚠️ Un insert multiplo vuole le STESSE chiavi su ogni riga (`PGRST102`).
	const cats = await a.rest<{ id: string; name: SeedCategory }[]>(
		"POST",
		"categories",
		(
			[
				{ name: "Alimentari", icon: "ShoppingCart", color: "aka", type: "spesa" },
				{ name: "Ristoranti", icon: "Utensils", color: "aka", type: "spesa" },
				{ name: "Stipendio", icon: "Banknote", color: "midori", type: "entrata" },
				{ name: "ETF", icon: "TrendingUp", color: "ao", type: "investimento" },
				{ name: "Spotify", icon: "Music", color: "murasaki", type: "abbonamento" },
				{ name: "Vacanza", icon: "Plane", color: "kin", type: "risparmio", target_amount: 1000 },
			] as const
		).map((c) => ({ user_id: a.id, target_amount: null, ...c })),
	);
	const byName = (n: string) => accounts.find((x) => x.name === n)!.id;
	return {
		accounts: { principale: byName("Conto principale"), revolut: byName("Revolut") },
		cat: (name) => cats.find((c) => c.name === name)!.id,
	};
}

/**
 * Un istante di OGGI a mezzogiorno, nel formato della colonna `date`
 * (`timestamp without time zone`, letta come UTC: vedi `dbInstant()`).
 * Mezzogiorno e oggi: lontano da ogni confine di giorno e di mese, sia nel fuso
 * del browser sia in quello del server, che in CI è UTC.
 */
export function todayNoon(daysAgo = 0) {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	d.setHours(12, 0, 0, 0);
	return d.toISOString().slice(0, 19);
}

export type Movement = {
	type: string;
	amount: number;
	account_id: string;
	category_id?: string | null;
	to_account_id?: string | null;
	notes?: string | null;
	date?: string;
	investment_type?: string | null;
};

export async function insertMovements(a: TestAccount, rows: Movement[]) {
	return a.rest<{ id: string }[]>(
		"POST",
		"transactions",
		rows.map((r) => ({
			user_id: a.id,
			category_id: null,
			to_account_id: null,
			notes: null,
			investment_type: null,
			date: todayNoon(),
			...r,
		})),
	);
}
