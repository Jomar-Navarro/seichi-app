"use server";
import { revalidatePath } from "next/cache";
import { getDictionary, getI18n } from "@/lib/i18n/server";
import { formatDate, shortMonth } from "@/lib/i18n/format";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { firstRunFrom, rollForwardPastToday } from "@/lib/recurring";
import type { Frequency } from "@/types";

export async function saveTransaction(
	importo: number,
	tipo: string,
	categoria_id: string | null,
	nota: string | null,
	data: string,
) {
	const supabase = await createClient();
	const user = await getSessionUser();
	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	const { error } = await supabase.from("transactions").insert({
		user_id: user.id,
		amount: importo,
		type: tipo,
		category_id: categoria_id,
		notes: nota,
		date: data,
	});

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function getTransactions(
	tipo?: string,
	periodo?: string,
	limit?: number,
) {
	const supabase = await createClient();
	const user = await getSessionUser();
	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	let query = supabase
		.from("transactions")
		.select("*, categories(name, icon, color)")
		.eq("user_id", user.id)
		.order("date", { ascending: false });

	if (tipo) query = query.eq("type", tipo);

	if (periodo && periodo !== "tutto") {
		const from = new Date();
		if (periodo === "7d") from.setDate(from.getDate() - 7);
		else if (periodo === "30d") from.setDate(from.getDate() - 30);
		else if (periodo === "3m") from.setMonth(from.getMonth() - 3);
		from.setHours(0, 0, 0, 0);
		query = query.gte("date", from.toISOString());
	}

	if (limit !== undefined) query = query.limit(limit);

	const { data, error } = await query;
	return error ? { error: error.message } : { data };
}

export async function updateTransaction(
	id: string,
	importo: number,
	tipo: string,
	categoria_id: string | null,
	nota: string | null,
	data: string,
) {
	const supabase = await createClient();
	const user = await getSessionUser();
	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	const { error } = await supabase
		.from("transactions")
		.update({
			amount: importo,
			type: tipo,
			category_id: categoria_id,
			notes: nota,
			date: data,
		})
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function deleteTransaction(id: string) {
	const supabase = await createClient();
	const user = await getSessionUser();
	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	const { error } = await supabase
		.from("transactions")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

// ─── Transazioni ricorrenti (Fase 14) ──────────────────────────────────────────

export async function createRecurringRule(
	importo: number,
	tipo: string,
	categoria_id: string | null,
	nota: string | null,
	start_date: string, // YYYY-MM-DD
	frequency: string,
) {
	const supabase = await createClient();
	const user = await getSessionUser();
	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	const { error } = await supabase.from("recurring_rules").insert({
		user_id: user.id,
		amount: importo,
		type: tipo,
		category_id: categoria_id,
		notes: nota,
		frequency,
		start_date,
		// La generazione parte al più da oggi: evita il burst di movimenti
		// retroattivi se start_date è nel passato.
		next_run: firstRunFrom(start_date),
	});

	if (error) return { error: error.message };

	// Materializza subito le occorrenze già dovute — best-effort:
	// se l'RPC fallisce, la regola è comunque salvata e il cron genererà le occorrenze.
	await supabase.rpc("generate_recurring_transactions");

	revalidatePath("/", "layout");
	return { success: true };
}

export async function getRecurringRules() {
	const supabase = await createClient();
	const user = await getSessionUser();
	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	const { data, error } = await supabase
		.from("recurring_rules")
		.select("*, categories(name, icon, color)")
		.eq("user_id", user.id)
		.order("created_at", { ascending: false });

	return error ? { error: error.message } : { data };
}

export async function deleteRecurringRule(id: string) {
	const supabase = await createClient();
	const user = await getSessionUser();
	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	// Elimina solo la regola: le transazioni già generate restano (recurring_rule_id -> null)
	const { error } = await supabase
		.from("recurring_rules")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function updateRecurringRule(
	id: string,
	importo: number,
	categoria_id: string | null,
	nota: string | null,
	frequency: string,
	next_run: string, // YYYY-MM-DD
) {
	const supabase = await createClient();
	const user = await getSessionUser();
	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	const { error } = await supabase
		.from("recurring_rules")
		.update({
			amount: importo,
			category_id: categoria_id,
			notes: nota,
			frequency,
			// "Prossima data" mai nel passato: evita back-fill al prossimo cron.
			next_run: firstRunFrom(next_run),
		})
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function setRecurringActive(id: string, active: boolean) {
	const supabase = await createClient();
	const user = await getSessionUser();
	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	// Al "riprendi": porta next_run al primo periodo futuro, così non genera
	// una raffica di movimenti retroattivi per i periodi trascorsi in pausa.
	let patch: { active: boolean; next_run?: string } = { active };
	if (active) {
		const { data: rule } = await supabase
			.from("recurring_rules")
			.select("frequency, next_run")
			.eq("id", id)
			.eq("user_id", user.id)
			.single();
		if (rule) {
			patch = {
				active,
				next_run: rollForwardPastToday(rule.next_run, rule.frequency as Frequency),
			};
		}
	}

	const { error } = await supabase
		.from("recurring_rules")
		.update(patch)
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function getDashboardTotals() {
	const supabase = await createClient();
	const user = await getSessionUser();
	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	/*
	 * Le somme le fa Postgres (`dashboard_totals`, migration 20260808).
	 *
	 * Prima questa funzione scaricava OGNI transazione dell'account — tutta la
	 * storia, a ogni vista della home e dopo ogni salvataggio — per sommarle
	 * qui. Ora torna al massimo una riga per (bucket, tipo): una trentina di
	 * numeri, indipendentemente da quanto è lungo lo storico.
	 *
	 * ⚠️ I confini li calcola l'APP e li passa alla funzione: il fuso resta
	 * quello del processo che rende la pagina, esattamente come prima. Farli
	 * calcolare al database con `date_trunc` li avrebbe spostati in UTC,
	 * cambiando in silenzio i totali in sviluppo locale nelle prime ore del mese.
	 *
	 * I 7 confini danno 6 bucket, e l'ULTIMO è il mese corrente — `m-5+i` con
	 * i=5 è proprio `inizioMese`. Per questo il trend e il mese sono una domanda
	 * sola: chiederli separatamente avrebbe sommato due volte le stesse righe.
	 */
	const now = new Date();
	const TREND_MONTHS = 6;
	const MESE_CORRENTE = TREND_MONTHS - 1;

	const bounds = Array.from({ length: TREND_MONTHS + 1 }, (_, i) =>
		new Date(now.getFullYear(), now.getMonth() - (TREND_MONTHS - 1) + i, 1).toISOString(),
	);

	const { data, error } = await supabase.rpc("dashboard_totals", { p_bounds: bounds });

	if (error) return { error: error.message };

	type TotalRow = { bucket_index: number | null; type: string; total: number | string };
	const totals = (data ?? []) as TotalRow[];

	// `numeric` può arrivare come stringa a seconda di come PostgREST serializza:
	// `Number()` al confine, una volta, invece di sperare che sia già un numero.
	const somma = (bucket: number | null, tipo: string) =>
		Number(totals.find((r) => r.bucket_index === bucket && r.type === tipo)?.total ?? 0);

	const entrateMese = somma(MESE_CORRENTE, "entrata");
	const speseMese = somma(MESE_CORRENTE, "spesa");
	const investimentiMese = somma(MESE_CORRENTE, "investimento");
	const risparmiMese = somma(MESE_CORRENTE, "risparmio");
	const abbonaMese = somma(MESE_CORRENTE, "abbonamento");

	const saldoMese = entrateMese - speseMese - risparmiMese - investimentiMese - abbonaMese;

	// bucket NULL = nessuna finestra, cioè tutta la storia dell'account.
	const saldoTotale =
		somma(null, "entrata") -
		somma(null, "spesa") -
		somma(null, "risparmio") -
		somma(null, "investimento") -
		somma(null, "abbonamento");

	// Trend ultimi 6 mesi per sparkline
	function monthlyTrend(tipo: string): number[] {
		return Array.from({ length: TREND_MONTHS }, (_, i) => somma(i, tipo));
	}

	return {
		entrateMese,
		speseMese,
		investimentiMese,
		risparmiMese,
		abbonaMese,
		saldoMese,
		saldoTotale,
		entrateTrend: monthlyTrend("entrata"),
		speseTrend: monthlyTrend("spesa"),
		investimentiTrend: monthlyTrend("investimento"),
		risparmiTrend: monthlyTrend("risparmio"),
	};
}

/*
 * ⚠️ `MESI` e `GIORNI` erano due array italiani cablati — le etichette dell'asse
 * X dei grafici. Sono l'unico testo di questo file, che per il resto fa solo
 * query e aritmetica sulle date, ed erano invisibili al controllo sulle stringhe
 * perché una sigla come "Ago" non ha spazi e non somiglia a una frase.
 *
 * Ora le produce `Intl` nella lingua dell'utente: il grafico è un server
 * component e la lingua sta nel cookie, quindi la si legge qui e le etichette
 * arrivano già giuste, senza cambiare la forma dei dati.
 */

export async function getAnalyticsData(periodo: string = "mese") {
	const supabase = await createClient();
	const user = await getSessionUser();

	const { locale, t } = await getI18n();
	const month = (d: Date) => shortMonth(d, locale);
	const weekday = (d: Date) =>
		formatDate(d, locale, { weekday: "short" });

	if (!user) return { error: t.errors.notAuthenticated };

	const now = new Date();
	const oggi = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	// Calcola range corrente, precedente e punti del trend in base al periodo
	let rangeStart: Date;
	let rangeEnd: Date;
	let prevStart: Date;
	let prevEnd: Date;
	let trendPoints: { label: string; start: Date; end: Date }[];
	let fetchStart: Date;

	if (periodo === "settimana") {
		rangeStart = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - 6);
		rangeEnd = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 1);
		prevStart = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - 13);
		prevEnd = rangeStart;
		fetchStart = prevStart;
		trendPoints = Array.from({ length: 7 }, (_, i) => {
			const d = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - 6 + i);
			return {
				label: weekday(d),
				start: d,
				end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
			};
		});
	} else if (periodo === "anno") {
		rangeStart = new Date(now.getFullYear(), 0, 1);
		rangeEnd = new Date(now.getFullYear() + 1, 0, 1);
		prevStart = new Date(now.getFullYear() - 1, 0, 1);
		prevEnd = rangeStart;
		fetchStart = prevStart;
		trendPoints = Array.from({ length: 12 }, (_, i) => ({
			label: month(new Date(now.getFullYear(), i, 1)),
			start: new Date(now.getFullYear(), i, 1),
			end: new Date(now.getFullYear(), i + 1, 1),
		}));
	} else {
		// mese (default)
		rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
		rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
		prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		prevEnd = rangeStart;
		fetchStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
		trendPoints = Array.from({ length: 6 }, (_, i) => {
			const m = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
			return {
				label: month(m),
				start: m,
				end: new Date(now.getFullYear(), now.getMonth() - 5 + i + 1, 1),
			};
		});
	}

	const [
		{ data: trendData, error: trendError },
		{ data: speseData, error: speseError },
	] = await Promise.all([
		supabase
			.from("transactions")
			.select("amount, type, date")
			.eq("user_id", user.id)
			.in("type", ["entrata", "spesa", "risparmio", "investimento", "abbonamento"])
			.gte("date", fetchStart.toISOString())
			.lt("date", rangeEnd.toISOString()),
		supabase
			.from("transactions")
			.select("amount, categories(name, color)")
			.eq("user_id", user.id)
			.eq("type", "spesa")
			.gte("date", rangeStart.toISOString())
			.lt("date", rangeEnd.toISOString()),
	]);

	if (trendError || speseError) return { error: (trendError ?? speseError)!.message };

	// Trend
	const trend = trendPoints.map(({ label, start, end }) => {
		const pts = trendData?.filter((t) => {
			const d = new Date(t.date);
			return d >= start && d < end;
		}) ?? [];
		return {
			mese: label,
			entrate: pts.filter((t) => t.type === "entrata").reduce((acc, t) => acc + t.amount, 0),
			uscite: pts.filter((t) => t.type !== "entrata").reduce((acc, t) => acc + t.amount, 0),
		};
	});

	// KPI periodo corrente
	const currentData = trendData?.filter((t) => {
		const d = new Date(t.date);
		return d >= rangeStart && d < rangeEnd;
	}) ?? [];
	const entrateCorrente = currentData.filter((t) => t.type === "entrata").reduce((acc, t) => acc + t.amount, 0);
	const usciteCorrente = currentData.filter((t) => t.type !== "entrata").reduce((acc, t) => acc + t.amount, 0);
	const saldoMese = entrateCorrente - usciteCorrente;

	// Variazione vs periodo precedente
	const prevData = trendData?.filter((t) => {
		const d = new Date(t.date);
		return d >= prevStart && d < prevEnd;
	}) ?? [];
	const entratePrev = prevData.filter((t) => t.type === "entrata").reduce((acc, t) => acc + t.amount, 0);
	const uscitePrev = prevData.filter((t) => t.type !== "entrata").reduce((acc, t) => acc + t.amount, 0);
	const saldoPrecedente = entratePrev - uscitePrev;
	const variazionePct = saldoPrecedente !== 0
		? Math.round(((saldoMese - saldoPrecedente) / Math.abs(saldoPrecedente)) * 100)
		: null;

	// Spese per categoria (donut)
	const spesePerCategoria = speseData?.reduce(
		(acc, t) => {
			const cat = t.categories as unknown as { name: string; color: string } | null;
			const nome = cat?.name;
			const color = cat?.color ?? "";
			if (!nome) return acc;
			if (!acc[nome]) {
				acc[nome] = { name: nome, color, total: t.amount };
			} else {
				acc[nome].total += t.amount;
			}
			return acc;
		},
		{} as Record<string, { name: string; color: string; total: number }>,
	);

	return {
		spese: Object.values(spesePerCategoria ?? {}),
		saldoMese,
		variazionePct,
		trend,
	};
}
