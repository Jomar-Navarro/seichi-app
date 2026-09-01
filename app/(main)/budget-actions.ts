"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { localMidnightInstant, monthBoundsOf, parseLocalDate } from "@/lib/dates";
import { advanceDate } from "@/lib/recurring";
import { budgetStatus } from "@/lib/budget";
import { disponibileDaTotali } from "@/lib/totals";
import type { ClientClock } from "@/lib/dates";
import type {
	BudgetAt,
	BudgetOverview,
	BudgetPeriod,
	BudgetWithSpending,
	Category,
	Frequency,
} from "@/types";

/**
 * ⚠️ Tutte le funzioni qui girano SUL SERVER, che su Vercel è in UTC. Nessuna
 * può chiedersi "che giorno è oggi": otterrebbe il giorno del server, e fra
 * mezzanotte e le 2 ora italiana è ancora ieri — periodo sbagliato, budget
 * sbagliato. L'orologio arriva dal client come parametro (`ClientClock`), che
 * porta con sé anche lo scostamento di fuso: senza quello i confini di periodo
 * sarebbero comunque calcolati sulla mezzanotte del server.
 */

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
	clock: ClientClock;
}): Promise<{ success: true } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	if (input.amount !== null && !(input.amount > 0)) {
		return { error: t.errors.amountMustBePositive };
	}

	const { error } = await supabase.rpc("set_budget", {
		p_category_id: input.categoryId,
		p_period: input.period,
		p_amount: input.amount,
		p_today: input.clock.today,
	});

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

/** Le righe di `budgets_at()` per l'utente corrente. */
async function readBudgetsAt(
	supabase: SupabaseServerClient,
	clock: ClientClock,
): Promise<{ data: BudgetAt[] } | { error: string }> {
	const { data, error } = await supabase.rpc("budgets_at", { ref_date: clock.today });
	if (error) return { error: error.message };
	return { data: (data ?? []) as BudgetAt[] };
}

/**
 * Il budget attualmente in vigore per una categoria, per pre-compilare il form.
 * `null` = nessun budget (mai impostato, oppure rimosso con una lapide: da qui
 * in poi i due casi sono equivalenti, perché entrambi lasciano il campo vuoto).
 */
export async function getBudgetForCategory(
	categoryId: string,
	clock: ClientClock,
): Promise<{ data: { period: BudgetPeriod; amount: number } | null } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const rows = await readBudgetsAt(supabase, clock);
	if ("error" in rows) return rows;

	const row = rows.data.find((b) => b.category_id === categoryId);
	if (!row || row.amount === null) return { data: null };

	return { data: { period: row.period, amount: row.amount } };
}

/**
 * Il budget globale in vigore, o `null` se non impostato.
 * È sempre mensile: il globale è ancorato allo stipendio (vincolo sulla tabella).
 */
export async function getGlobalBudget(
	clock: ClientClock,
): Promise<{ data: number | null } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const rows = await readBudgetsAt(supabase, clock);
	if ("error" in rows) return rows;

	const row = rows.data.find((b) => b.category_id === null);
	return { data: row?.amount ?? null };
}

/**
 * Il quadro budget del periodo corrente: globale, per categoria, e le uscite
 * fisse previste nel mese.
 */
export async function getBudgetOverview(
	clock: ClientClock,
): Promise<{ data: BudgetOverview } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const [rows, fixed] = await Promise.all([
		readBudgetsAt(supabase, clock),
		// ⚠️ `readFixedOutflows`, non `getFixedOutflows`: quella è una server
		// action a sé e aprirebbe un secondo client, rifacendo il proprio
		// controllo di autenticazione e il proprio caricamento del dizionario per
		// query che da qui partono già nello stesso `Promise.all`. È la forma
		// annidata rimossa da `getNotifications()`, che qui era sopravvissuta.
		readFixedOutflows(supabase, user.id, clock),
	]);
	if ("error" in rows) return rows;
	if ("error" in fixed) return fixed;

	// Le righe con amount NULL sono lapidi: budget rimosso a partire da quel
	// periodo. Vengono restituite dal DB di proposito (distinguono "rimosso" da
	// "mai impostato"), ma da qui in poi non ci servono più.
	const budgets = rows.data.filter((b) => b.amount !== null);

	if (budgets.length === 0) {
		return { data: { global: null, perCategory: [], fixedOutflowsThisMonth: fixed.data } };
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
				.gte("date", localMidnightInstant(from, clock.tzOffsetMinutes))
				.lt("date", localMidnightInstant(to, clock.tzOffsetMinutes)),
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
		const start = localMidnightInstant(b.period_start, clock.tzOffsetMinutes);
		const end = localMidnightInstant(b.period_end, clock.tzOffsetMinutes);

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

	return { data: { global, perCategory, fixedOutflowsThisMonth: fixed.data } };
}

/**
 * Quanto resta in un mese dopo le uscite fisse, e l'ammontare delle uscite
 * fisse stesse: i due numeri che stanno accanto al budget globale.
 *
 * ⚠️ **NON si chiama «stipendio meno fisse»**, e non è una differenza di stile:
 * l'app non sa quale `entrata` sia lo stipendio. Non c'è una colonna che lo
 * dica, e una regola ricorrente di tipo `entrata` è un indizio, non un fatto.
 * Il numero è la somma di TUTTE le entrate registrate nel mese, e va chiamato
 * così ovunque compaia. È la correzione già fatta tre volte in questo progetto
 * — «spese totali» → «spese variabili» (17a), «Saldo totale» → «Saldo · N conti
 * attivi» (20a), «Valore portafoglio» → «Capitale versato» (21b) — applicata
 * prima di sbagliare invece che dopo.
 *
 * ⚠️ **Le entrate non si risommano qui**: le chiede a `dashboard_totals()`, la
 * stessa funzione che alimenta la home. Riscrivere il filtro creerebbe una
 * definizione concorrente di «entrata», che è esattamente il difetto che la
 * review della 20a ha dovuto unificare in `sommaUscite()` dopo averlo trovato
 * divergente in tre punti scritti a mano.
 *
 * ⚠️ **Rimpiazza `getFixedOutflows()`**, che restituiva il solo secondo numero
 * ed era chiamata dallo stesso componente: tenerle entrambe avrebbe calcolato
 * due volte le uscite fisse nella stessa schermata, in due richieste.
 *
 * ⚠️ **Nessun filtro per conto** (`p_account_id: null`), ed è voluto: il budget
 * globale non appartiene a un conto — «€ 400 per la spesa» non si divide fra
 * contanti e carta — quindi il disponibile che gli sta accanto deve guardare lo
 * stesso insieme. È la stessa affermazione che il dizionario fa già a voce
 * (`acrossAllAccounts`).
 */
export async function getAvailableThisMonth(clock: ClientClock): Promise<
	{ data: { income: number; fixedOutflows: number; available: number } } | { error: string }
> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { start, end } = monthBoundsOf(clock.today);

	/*
	 * Due confini danno UN bucket: `dashboard_totals()` li consuma a coppie
	 * (`generate_subscripts`), quindi la stessa funzione che in home produce sei
	 * mesi qui produce il mese solo, senza una query nuova e senza un secondo
	 * modo di sommare le entrate.
	 *
	 * ⚠️ I confini vengono dall'orologio del CLIENT — vedi la nota in testa a
	 * questo file. Il numero vive accanto al budget globale, che i propri
	 * confini li calcola già così: con due orologi diversi, nelle prime ore del
	 * mese la stessa card mostrerebbe due mesi.
	 */
	const bounds = [
		localMidnightInstant(start, clock.tzOffsetMinutes),
		localMidnightInstant(end, clock.tzOffsetMinutes),
	];

	const [totals, fixed] = await Promise.all([
		supabase.rpc("dashboard_totals", { p_bounds: bounds, p_account_id: null }),
		readFixedOutflows(supabase, user.id, clock),
	]);

	if (totals.error) return { error: totals.error.message };
	if ("error" in fixed) return fixed;

	type TotalRow = { bucket_index: number | null; type: string; total: number | string };
	const rows = (totals.data ?? []) as TotalRow[];

	// `numeric` può arrivare come stringa a seconda di come PostgREST serializza:
	// `Number()` al confine, una volta, come fa `getDashboardTotals`.
	const income = Number(
		rows.find((r) => r.bucket_index === 0 && r.type === "entrata")?.total ?? 0,
	);

	/*
	 * ⚠️ Il risultato NON si azzera quando è negativo. Uscite fisse maggiori
	 * delle entrate registrate è un fatto — e all'inizio del mese è pure il caso
	 * normale, perché lo stipendio non è ancora arrivato. Sostituirlo con uno
	 * zero direbbe «sei in pari» a chi non lo è; a spiegarlo è la frase accanto,
	 * che distingue «nessuna entrata ancora» da «le fisse superano le entrate».
	 * Stesso trattamento della posizione negativa in 21b: si mostra col segno.
	 */
	return {
		data: {
			income,
			fixedOutflows: fixed.data,
			available: disponibileDaTotali(income, fixed.data),
		},
	};
}

/**
 * Quanto costano gli abbonamenti nel mese corrente.
 *
 * NON entrano in nessun budget — le categorie `abbonamento` sono escluse per
 * scelta — e si mostrano accanto al globale perché un limite di spesa che
 * ignora in silenzio affitto e utenze è un numero sbagliato che sembra giusto.
 *
 * Somma due cose che non si sovrappongono:
 *   - le transazioni `abbonamento` già registrate nel mese
 *   - le occorrenze ancora da generare, contate avanzando `next_run` con la
 *     cadenza della regola fino a fine mese (una regola settimanale può
 *     scattare più volte: fermarsi alla prima sottostimerebbe il totale)
 *
 * Gli errori delle query vengono propagati, non ingoiati: restituire 0 su
 * fallimento mostrerebbe "uscite fisse € 0" come se fosse un dato vero, che è
 * esattamente il numero sbagliato dall'aria giusta che questa riga esiste per
 * evitare.
 *
 * Riceve il client invece di aprirsene uno, stessa forma di `readBudgetsAt()`:
 * così `getBudgetOverview()` e `getAvailableThisMonth()` possono riusarlo senza
 * passare da una server action, che ripeterebbe autenticazione e dizionario per
 * nulla.
 */
async function readFixedOutflows(
	supabase: SupabaseServerClient,
	userId: string,
	clock: ClientClock,
): Promise<{ data: number } | { error: string }> {
	const { start, end } = monthBoundsOf(clock.today);

	const [{ data: txns, error: txnsError }, { data: rules, error: rulesError }] =
		await Promise.all([
			supabase
				.from("transactions")
				.select("amount")
				.eq("user_id", userId)
				.eq("type", "abbonamento")
				.gte("date", localMidnightInstant(start, clock.tzOffsetMinutes))
				.lt("date", localMidnightInstant(end, clock.tzOffsetMinutes)),
			supabase
				.from("recurring_rules")
				.select("amount, frequency, next_run, end_date")
				.eq("user_id", userId)
				.eq("type", "abbonamento")
				.eq("active", true),
		]);

	if (txnsError) return { error: txnsError.message };
	if (rulesError) return { error: rulesError.message };

	const alreadyCharged = (txns ?? []).reduce((acc, t) => acc + t.amount, 0);

	// Qui si confrontano solo date fra loro, tutte costruite allo stesso modo:
	// è aritmetica di calendario, indipendente dal fuso.
	const monthStart = parseLocalDate(start);
	const monthEnd = parseLocalDate(end);

	const upcoming = (rules ?? []).reduce((acc, r) => {
		const ruleEnd = r.end_date ? parseLocalDate(r.end_date) : null;
		let occurrence = parseLocalDate(r.next_run);
		let total = 0;
		// Il limite di iterazioni protegge da un next_run rimasto molto indietro
		// (cron fermo a lungo): senza, una regola settimanale di due anni fa
		// farebbe un centinaio di giri inutili.
		for (let i = 0; i < 400 && occurrence < monthEnd; i++) {
			// ⚠️ Il limite INFERIORE conta quanto quello superiore. Un next_run
			// arretrato — cron saltato, regola riattivata — porterebbe dentro anche
			// le occorrenze dei mesi passati, gonfiando il totale (un abbonamento da
			// 60€/mese comparirebbe a 120€).
			if (occurrence >= monthStart && (!ruleEnd || occurrence <= ruleEnd)) {
				total += r.amount;
			}
			occurrence = advanceDate(occurrence, r.frequency as Frequency);
		}
		return acc + total;
	}, 0);

	return { data: alreadyCharged + upcoming };
}
