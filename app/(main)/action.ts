"use server";
import { revalidatePath } from "next/cache";
import { getI18n } from "@/lib/i18n/server";
import { formatDate, shortMonth } from "@/lib/i18n/format";
import { requireUser } from "@/lib/auth";
import { firstRunFrom, rollForwardPastToday } from "@/lib/recurring";
import type { Frequency } from "@/types";

/**
 * Il conto indicato appartiene davvero a chi scrive?
 *
 * ⚠️ Serve, e la RLS da sola NON lo copre. Le policy di `transactions` filtrano
 * su `user_id = auth.uid()`, e `user_id` lo scrive il server: una richiesta
 * costruita a mano con l'`account_id` di un altro utente passerebbe la RLS,
 * perché nessuna policy guarda quella colonna. Il danno è modesto — la riga
 * resterebbe invisibile nel saldo altrui, che legge attraverso la propria RLS —
 * ma è uno stato incoerente che il database oggi permette.
 *
 * ⚠️ Il controllo giusto sarebbe una FK COMPOSITA `(account_id, user_id) →
 * accounts (id, user_id)`, che renderebbe lo stato illegale irrappresentabile
 * invece di vietato per attenzione di chi scrive. Non è nella `20260814`: va
 * aggiunta con una migration dedicata (vedi la nota consegnata con questa fase).
 * Fino ad allora, questa funzione è l'unica difesa.
 */
async function assertOwnAccount(
	supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
	userId: string,
	accountId: string,
) {
	const { data, error } = await supabase
		.from("accounts")
		.select("id")
		.eq("id", accountId)
		.eq("user_id", userId)
		.maybeSingle();

	if (error) return { error: error.message };
	if (!data) return { error: "account_not_found" as const };
	return { ok: true as const };
}

export async function saveTransaction(
	importo: number,
	tipo: string,
	categoria_id: string | null,
	nota: string | null,
	data: string,
	conto_id: string,
) {
	const { supabase, user, t } = await requireUser();

	if (!user) return { error: t.errors.notAuthenticated };

	const owned = await assertOwnAccount(supabase, user.id, conto_id);
	if ("error" in owned) return { error: t.accounts.errors.notFound };

	const { error } = await supabase.from("transactions").insert({
		user_id: user.id,
		amount: importo,
		type: tipo,
		category_id: categoria_id,
		notes: nota,
		date: data,
		account_id: conto_id,
	});

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function getTransactions(
	tipo?: string,
	periodo?: string,
	limit?: number,
	conto?: string,
) {
	const { supabase, user, t } = await requireUser();

	if (!user) return { error: t.errors.notAuthenticated };

	let query = supabase
		.from("transactions")
		.select("*, categories(name, icon, color)")
		.eq("user_id", user.id)
		.order("date", { ascending: false });

	if (tipo) query = query.eq("type", tipo);

	/*
	 * ⚠️ Il filtro agisce su `account_id`, cioè l'ORIGINE del movimento.
	 *
	 * Non è una scelta di comodo: un `risparmio` fatto dal conto corrente verso
	 * il Fondo è un atto compiuto DAL corrente, e chi filtra "conto corrente" si
	 * aspetta di vederlo. Quando la 20b introdurrà `to_account_id` la domanda si
	 * riaprirà — un trasferimento appartiene a due conti — e la risposta dovrà
	 * essere decisa allora, non ereditata da qui per inerzia.
	 */
	if (conto) query = query.eq("account_id", conto);

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
	conto_id: string,
) {
	const { supabase, user, t } = await requireUser();

	if (!user) return { error: t.errors.notAuthenticated };

	const owned = await assertOwnAccount(supabase, user.id, conto_id);
	if ("error" in owned) return { error: t.accounts.errors.notFound };

	const { error } = await supabase
		.from("transactions")
		.update({
			amount: importo,
			type: tipo,
			category_id: categoria_id,
			notes: nota,
			date: data,
			account_id: conto_id,
		})
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function deleteTransaction(id: string) {
	const { supabase, user, t } = await requireUser();

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
	conto_id: string,
) {
	const { supabase, user, t } = await requireUser();

	if (!user) return { error: t.errors.notAuthenticated };

	const owned = await assertOwnAccount(supabase, user.id, conto_id);
	if ("error" in owned) return { error: t.accounts.errors.notFound };

	const { error } = await supabase.from("recurring_rules").insert({
		user_id: user.id,
		amount: importo,
		type: tipo,
		category_id: categoria_id,
		notes: nota,
		frequency,
		start_date,
		// ⚠️ Il conto viaggia sulla REGOLA, e `generate_recurring_transactions()`
		// lo copia sulla transazione generata. Senza, il job notturno
		// violerebbe il NOT NULL e la regola verrebbe saltata in silenzio —
		// per-utente, grazie all'isolamento della #47, ma comunque senza
		// che nessuno se ne accorga finché non guarda `job_runs`.
		account_id: conto_id,
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
	const { supabase, user, t } = await requireUser();

	if (!user) return { error: t.errors.notAuthenticated };

	const { data, error } = await supabase
		.from("recurring_rules")
		.select("*, categories(name, icon, color)")
		.eq("user_id", user.id)
		.order("created_at", { ascending: false });

	return error ? { error: error.message } : { data };
}

export async function deleteRecurringRule(id: string) {
	const { supabase, user, t } = await requireUser();

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
	const { supabase, user, t } = await requireUser();

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
	const { supabase, user, t } = await requireUser();

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

/**
 * Che cosa conta come USCITA, in un posto solo.
 *
 * ⚠️ `spesa` e `abbonamento`, non "tutto ciò che non è entrata".
 *
 * Prima `/analisi` sommava come uscita ogni tipo diverso da `entrata`, quindi
 * anche `risparmio` e `investimento`. Con i conti quel denaro è ancora tuo —
 * solo altrove — e contarlo come uscita lo fa sembrare speso: è la premessa
 * dell'intera Fase 20a, quella per cui `saldoTotale` è stato cancellato.
 *
 * ⚠️ Il difetto era invisibile finché la home non ha cambiato formula: da quel
 * momento la home diceva "Flusso · agosto € 1.540" e `/analisi` — raggiungibile
 * col collegamento due righe più sotto, e con l'etichetta **"Flusso netto"**,
 * la stessa parola — ne diceva un altro per lo stesso mese. Due schermate, due
 * risposte: esattamente ciò che la fase esisteva per chiudere, ricreato togliendo
 * il numero da una schermata sola.
 *
 * Sta qui, come funzione condivisa, perché la definizione di "uscita" non può
 * vivere in tre `filter` scritti a mano: il KPI, la variazione e il grafico
 * mensile devono muoversi insieme o la pagina si contraddice da sé.
 */
function sommaUscite(rows: { type: string; amount: number }[]) {
	return rows
		.filter((t) => t.type === "spesa" || t.type === "abbonamento")
		.reduce((acc, t) => acc + t.amount, 0);
}

export async function getDashboardTotals(accountId?: string | null) {
	const { supabase, user, t } = await requireUser();

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

	/*
	 * ⚠️ `p_account_id` è OBBLIGATORIO nella firma SQL, anche quando è null.
	 * La funzione non ha un valore di default apposta (migration 20260814): con
	 * uno, un chiamante non aggiornato avrebbe continuato a girare leggendo un
	 * risultato dal significato cambiato invece di fallire. Qui `?? null` rende
	 * esplicito che "nessun filtro" è un valore, non un'omissione.
	 */
	const { data, error } = await supabase.rpc("dashboard_totals", {
		p_bounds: bounds,
		p_account_id: accountId ?? null,
	});

	if (error) return { error: error.message };

	type TotalRow = { bucket_index: number | null; type: string; total: number | string };
	const totals = (data ?? []) as TotalRow[];

	// `numeric` può arrivare come stringa a seconda di come PostgREST serializza:
	// `Number()` al confine, una volta, invece di sperare che sia già un numero.
	const somma = (bucket: number, tipo: string) =>
		Number(totals.find((r) => r.bucket_index === bucket && r.type === tipo)?.total ?? 0);

	const entrateMese = somma(MESE_CORRENTE, "entrata");
	const speseMese = somma(MESE_CORRENTE, "spesa");
	const investimentiMese = somma(MESE_CORRENTE, "investimento");
	const risparmiMese = somma(MESE_CORRENTE, "risparmio");
	const abbonaMese = somma(MESE_CORRENTE, "abbonamento");

	/*
	 * FLUSSO del mese = entrate − uscite reali. Non è la vecchia `saldoMese`, e
	 * le due sottrazioni che sono cambiate hanno ragioni opposte (Fase 20a):
	 *
	 *   · risparmi e investimenti NON si sottraggono più. Con i conti quel
	 *     denaro è ancora tuo, solo altrove: investire e risparmiare non è
	 *     consumare, è SPOSTARE. Sottrarlo lo farebbe sembrare speso, cioè
	 *     negherebbe la premessa dell'intera fase.
	 *   · ⚠️ gli abbonamenti SÌ, ed è la correzione al mockup. `abbonaMese` non
	 *     ha una card in home: senza questa sottrazione l'affitto sarebbe
	 *     invisibile E non conteggiato, e il numero direbbe "ti resta X" mentre
	 *     deve ancora uscire. È la trappola della 17a — "spese variabili", mai
	 *     "spese totali". Per lo stesso motivo il sottotitolo dice "uscite" e
	 *     non "spese": gli abbonamenti sono un tipo a sé nella tassonomia.
	 *
	 * ⚠️ `saldoTotale` è SPARITO, non rinominato. Era entrate meno tutto il resto
	 * su tutta la storia, e con i conti entrava in contraddizione con la pagina
	 * conti, che alla stessa domanda ("quanto ho") risponde con la somma dei
	 * saldi — diversa, perché sottraeva i risparmi e ignorava `initial_balance`.
	 * Due schermate con due risposte sono la configurazione peggiore, quindi la
	 * 20a ne toglie una. Con lui è sparito il bucket `null` della RPC, di cui era
	 * l'unico consumatore.
	 */
	const flussoMese = entrateMese - speseMese - abbonaMese;

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
		flussoMese,
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
	const { supabase, user } = await requireUser();

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
			uscite: sommaUscite(pts),
		};
	});

	// KPI periodo corrente
	const currentData = trendData?.filter((t) => {
		const d = new Date(t.date);
		return d >= rangeStart && d < rangeEnd;
	}) ?? [];
	const entrateCorrente = currentData.filter((t) => t.type === "entrata").reduce((acc, t) => acc + t.amount, 0);
	const usciteCorrente = sommaUscite(currentData);
	const saldoMese = entrateCorrente - usciteCorrente;

	// Variazione vs periodo precedente
	const prevData = trendData?.filter((t) => {
		const d = new Date(t.date);
		return d >= prevStart && d < prevEnd;
	}) ?? [];
	const entratePrev = prevData.filter((t) => t.type === "entrata").reduce((acc, t) => acc + t.amount, 0);
	const uscitePrev = sommaUscite(prevData);
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
