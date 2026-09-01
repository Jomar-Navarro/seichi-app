"use server";

import { requireUser } from "@/lib/auth";
import { localMidnightInstant, monthBoundsOf } from "@/lib/dates";
import { DISPLAY_CURRENCY } from "@/lib/i18n/format";
import { disponibileDaTotali, flussoDaTotali } from "@/lib/totals";
import { getBudgetOverview } from "./budget-actions";
import { getGoals } from "./risparmi/actions";
import type { ClientClock } from "@/lib/dates";
import type { CoachSnapshot } from "@/types";

/**
 * I fatti su cui il coach parla, per il mese corrente (Fase 24b).
 *
 * ⚠️ **Il coach non calcola un solo numero proprio.** Budget e uscite fisse
 * arrivano da `getBudgetOverview()`, gli obiettivi da `getGoals()`, il flusso da
 * `flussoDaTotali()` e il disponibile da `disponibileDaTotali()` — le stesse
 * formule che usano la home e la card in impostazioni. Riscriverne anche una
 * sola creerebbe la quinta definizione di
 * «uscita» dopo le tre che la review della 20a ha dovuto unificare, e allora il
 * coach direbbe un numero diverso da quello che l'utente vede due tocchi più in
 * là. È la configurazione peggiore: due schermate, due risposte.
 *
 * ⚠️ L'orologio arriva dal CLIENT. Il server è in UTC su Vercel, e questa
 * funzione vive interamente sui confini di mese: chiamata con `new Date()`,
 * fra mezzanotte e le 2 parlerebbe del mese sbagliato. Vale anche per la
 * coerenza *interna*: il disponibile che il coach cita è lo stesso numero della
 * card in impostazioni, che i confini li calcola già così.
 *
 * ⚠️ Gli errori si propagano, non si ingoiano. Restituire uno snapshot di zeri
 * su lettura fallita farebbe dire al coach «questo mese non hai speso niente» —
 * una lettura fallita travestita da fatto, la classe già corretta due volte
 * nella 23a.
 */
export async function getCoachSnapshot(
	clock: ClientClock,
): Promise<{ data: CoachSnapshot } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { start, end } = monthBoundsOf(clock.today);

	/*
	 * Il primo del mese PRECEDENTE. Si ricava dal confine già calcolato invece
	 * che da `new Date()`: così i tre confini nascono tutti dallo stesso
	 * orologio, e a gennaio si scavalca l'anno senza casi speciali sparsi.
	 */
	const [y, m] = start.split("-").map(Number);
	const prevStart = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-01`;

	/*
	 * Tre confini danno DUE bucket: 0 = mese precedente, 1 = mese corrente.
	 * `dashboard_totals()` li consuma a coppie, quindi è la stessa funzione che
	 * alimenta la home — non una query nuova e non un secondo modo di sommare.
	 */
	const bounds = [prevStart, start, end].map((d) =>
		localMidnightInstant(d, clock.tzOffsetMinutes),
	);

	/*
	 * ⚠️ NON si chiama `getAvailableThisMonth()`: rifarebbe `dashboard_totals`
	 * per il mese corrente — che è già il bucket 1 della chiamata qui sotto — e
	 * rifarebbe le uscite fisse, che `getBudgetOverview()` restituisce già in
	 * `fixedOutflowsThisMonth`. Erano tre andate e ritorni in più a ogni
	 * apertura del pannello: la stessa duplicazione per cui `getFixedOutflows()`
	 * è stata cancellata nella 24a, ricreata un livello più su.
	 *
	 * Il disponibile resta comunque UNA definizione sola, perché la sottrazione
	 * vive in `disponibileDaTotali()` e non qui.
	 */
	const [budget, goals, totals] = await Promise.all([
		getBudgetOverview(clock),
		getGoals(),
		supabase.rpc("dashboard_totals", { p_bounds: bounds, p_account_id: null }),
	]);

	if ("error" in budget) return budget;
	if ("error" in goals) return goals;
	if (totals.error) return { error: totals.error.message };

	type Riga = { bucket_index: number | null; type: string; total: number | string };
	const righe = (totals.data ?? []) as Riga[];
	// `numeric` può arrivare come stringa: `Number()` al confine, una volta sola,
	// come fa `getDashboardTotals`.
	const somma = (bucket: number, tipo: string) =>
		Number(righe.find((r) => r.bucket_index === bucket && r.type === tipo)?.total ?? 0);

	const PREC = 0;
	const CORR = 1;

	const income = somma(CORR, "entrata");
	const variableExpenses = somma(CORR, "spesa");
	const subscriptions = somma(CORR, "abbonamento");

	return {
		data: {
			currency: DISPLAY_CURRENCY,
			month: {
				income,
				variableExpenses,
				subscriptions,
				flow: flussoDaTotali(income, variableExpenses, subscriptions),
				saved: somma(CORR, "risparmio"),
				invested: somma(CORR, "investimento"),
			},
			previousMonthFlow: flussoDaTotali(
				somma(PREC, "entrata"),
				somma(PREC, "spesa"),
				somma(PREC, "abbonamento"),
			),
			fixedOutflows: budget.data.fixedOutflowsThisMonth,
			available: disponibileDaTotali(income, budget.data.fixedOutflowsThisMonth),
			globalBudget: budget.data.global
				? {
						amount: budget.data.global.amount,
						spent: budget.data.global.spent,
						status: budget.data.global.status,
					}
				: null,
			/*
			 * ⚠️ Solo nome, importo, speso e stato: `budgetId` e `categoryId` sono
			 * id di righe e non devono entrare nello snapshot — vedi la nota sul
			 * tipo `CoachSnapshot`.
			 */
			categoryBudgets: budget.data.perCategory.map((b) => ({
				name: b.category?.name ?? "",
				amount: b.amount,
				spent: b.spent,
				status: b.status,
			})),
			goals: goals.data.map((g) => ({
				name: g.name,
				target: g.target_amount ?? 0,
				saved: g.saved_amount,
				targetDate: g.target_date ?? null,
			})),
		},
	};
}
