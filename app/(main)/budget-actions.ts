"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseLocalDate, todayLocalISO } from "@/lib/dates";
import { advanceDate } from "@/lib/recurring";
import { budgetStatus } from "@/lib/budget";
import type {
	BudgetAt,
	BudgetOverview,
	BudgetPeriod,
	BudgetWithSpending,
	Category,
	Frequency,
} from "@/types";

/**
 * Le date di periodo arrivano dal DB come `YYYY-MM-DD` e vanno confrontate con
 * `transactions.date`, che è un istante UTC. Interpretarle come mezzanotte
 * LOCALE (e non come UTC) è ciò che tiene una spesa del primo del mese dentro
 * il mese giusto — stessa ragione per cui getDashboardTotals costruisce i
 * confini con `new Date(anno, mese, 1)` prima di chiamare toISOString().
 */
function boundaryToInstant(isoDate: string): string {
	return parseLocalDate(isoDate).toISOString();
}

/**
 * Imposta, modifica o rimuove un budget.
 *
 * `amount: null` è la rimozione (la "lapide"): non cancella la riga, ne scrive
 * una che dice "da questo periodo, nessun budget", così i periodi passati
 * conservano il limite che avevano davvero.
 *
 * Il grosso del lavoro sta nella funzione SQL `set_budget()`: calcola lei
 * `valid_from` con la stessa funzione usata dal CHECK, fa un upsert atomico e
 * valida ciò che i vincoli non possono esprimere.
 */
export async function setBudget(input: {
	categoryId: string | null;
	period: BudgetPeriod;
	amount: number | null;
}): Promise<{ success: true } | { error: string }> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	if (input.amount !== null && !(input.amount > 0)) {
		return { error: "L'importo deve essere maggiore di zero" };
	}

	const { error } = await supabase.rpc("set_budget", {
		p_category_id: input.categoryId,
		p_period: input.period,
		p_amount: input.amount,
		p_today: todayLocalISO(),
	});

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

/**
 * Il budget attualmente in vigore per una categoria, per pre-compilare il form.
 * `null` = nessun budget (mai impostato, oppure rimosso con una lapide: da qui
 * in poi i due casi sono equivalenti, perché entrambi lasciano il campo vuoto).
 */
export async function getBudgetForCategory(
	categoryId: string,
): Promise<{ data: { period: BudgetPeriod; amount: number } | null } | { error: string }> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const { data, error } = await supabase.rpc("budgets_at", { ref_date: todayLocalISO() });
	if (error) return { error: error.message };

	const row = ((data ?? []) as BudgetAt[]).find((b) => b.category_id === categoryId);
	if (!row || row.amount === null) return { data: null };

	return { data: { period: row.period, amount: row.amount } };
}

/**
 * Il budget globale in vigore, o `null` se non impostato.
 * È sempre mensile: il globale è ancorato allo stipendio (vincolo sulla tabella).
 */
export async function getGlobalBudget(): Promise<
	{ data: number | null } | { error: string }
> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const { data, error } = await supabase.rpc("budgets_at", { ref_date: todayLocalISO() });
	if (error) return { error: error.message };

	const row = ((data ?? []) as BudgetAt[]).find((b) => b.category_id === null);
	return { data: row?.amount ?? null };
}

/**
 * Il quadro budget del periodo corrente: globale, per categoria, e le uscite
 * fisse previste nel mese.
 */
export async function getBudgetOverview(): Promise<
	{ data: BudgetOverview } | { error: string }
> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const today = todayLocalISO();

	const { data: rows, error: rowsError } = await supabase.rpc("budgets_at", {
		ref_date: today,
	});
	if (rowsError) return { error: rowsError.message };

	// Le righe con amount NULL sono lapidi: budget rimosso a partire da quel
	// periodo. Vengono restituite dal DB di proposito (distinguono "rimosso" da
	// "mai impostato"), ma da qui in poi non ci servono più.
	const budgets = ((rows ?? []) as BudgetAt[]).filter((b) => b.amount !== null);

	if (budgets.length === 0) {
		return {
			data: {
				global: null,
				perCategory: [],
				fixedOutflowsThisMonth: await sumFixedOutflows(supabase, user.id, today),
			},
		};
	}

	// Una sola query per tutte le spese: i periodi possono essere diversi fra
	// categorie (settimanale, mensile, annuale), quindi si prende l'intervallo
	// che li copre tutti e si divide in memoria. Meglio di una query per budget.
	const from = budgets.reduce((min, b) => (b.period_start < min ? b.period_start : min), budgets[0].period_start);
	const to   = budgets.reduce((max, b) => (b.period_end   > max ? b.period_end   : max), budgets[0].period_end);

	const [{ data: txns, error: txnsError }, { data: cats, error: catsError }] =
		await Promise.all([
			supabase
				.from("transactions")
				.select("category_id, amount, date")
				.eq("user_id", user.id)
				.eq("type", "spesa")
				.gte("date", boundaryToInstant(from))
				.lt("date", boundaryToInstant(to)),
			supabase
				.from("categories")
				.select("id, name, icon, color")
				.eq("user_id", user.id),
		]);

	if (txnsError) return { error: txnsError.message };
	if (catsError) return { error: catsError.message };

	const catById = new Map(
		(cats ?? []).map((c) => [c.id, c as Pick<Category, "id" | "name" | "icon" | "color">]),
	);

	const withSpending = budgets.map((b) => {
		const start = boundaryToInstant(b.period_start);
		const end = boundaryToInstant(b.period_end);

		// Il globale somma TUTTE le spese del periodo, non una categoria sola.
		const spent = (txns ?? [])
			.filter(
				(t) =>
					t.date >= start &&
					t.date < end &&
					(b.category_id === null || t.category_id === b.category_id),
			)
			.reduce((acc, t) => acc + t.amount, 0);

		const amount = b.amount as number;
		const cat = b.category_id ? catById.get(b.category_id) : undefined;

		const result: BudgetWithSpending = {
			budgetId: b.budget_id,
			categoryId: b.category_id,
			category: cat ? { name: cat.name, icon: cat.icon, color: cat.color } : null,
			period: b.period,
			amount,
			spent,
			remaining: amount - spent,
			pct: Math.min(100, Math.round((spent / amount) * 100)),
			status: budgetStatus(spent, amount),
			periodStart: b.period_start,
			periodEnd: b.period_end,
		};
		return result;
	});

	// Un budget su una categoria cancellata nel frattempo non ha nulla da
	// mostrare: la FK ha già rimosso la riga in cascade, ma la guardia protegge
	// dal caso in cui la categoria esista senza essere leggibile.
	const perCategory = withSpending.filter((b) => b.categoryId !== null && b.category !== null);
	const global = withSpending.find((b) => b.categoryId === null) ?? null;

	return {
		data: {
			global,
			perCategory,
			fixedOutflowsThisMonth: await sumFixedOutflows(supabase, user.id, today),
		},
	};
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Quanto costano gli abbonamenti nel mese corrente.
 *
 * NON entra in nessun budget — le categorie `abbonamento` sono escluse per
 * scelta — e si mostra accanto al globale perché un limite di spesa che ignora
 * in silenzio affitto e utenze è un numero sbagliato che sembra giusto.
 *
 * Somma due cose che non si sovrappongono:
 *   - le transazioni `abbonamento` già registrate nel mese
 *   - le occorrenze ancora da generare, contate avanzando `next_run` con la
 *     cadenza della regola fino a fine mese (una regola settimanale può
 *     scattare più volte: fermarsi alla prima sottostimerebbe il totale)
 */
async function sumFixedOutflows(
	supabase: SupabaseServerClient,
	userId: string,
	today: string,
): Promise<number> {
	const now = parseLocalDate(today);
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
	const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

	const [{ data: txns }, { data: rules }] = await Promise.all([
		supabase
			.from("transactions")
			.select("amount")
			.eq("user_id", userId)
			.eq("type", "abbonamento")
			.gte("date", monthStart.toISOString())
			.lt("date", monthEnd.toISOString()),
		supabase
			.from("recurring_rules")
			.select("amount, frequency, next_run, end_date")
			.eq("user_id", userId)
			.eq("type", "abbonamento")
			.eq("active", true),
	]);

	const alreadyCharged = (txns ?? []).reduce((acc, t) => acc + t.amount, 0);

	const upcoming = (rules ?? []).reduce((acc, r) => {
		const end = r.end_date ? parseLocalDate(r.end_date) : null;
		let occurrence = parseLocalDate(r.next_run);
		let total = 0;
		while (occurrence < monthEnd && (!end || occurrence <= end)) {
			total += r.amount;
			occurrence = advanceDate(occurrence, r.frequency as Frequency);
		}
		return acc + total;
	}, 0);

	return alreadyCharged + upcoming;
}
