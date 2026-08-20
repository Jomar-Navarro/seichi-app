"use server";

import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { GoalWithProgress, InvestmentData } from "@/types";
import { INVESTMENT_TYPE_COLOR, INVESTMENT_TYPE_FALLBACK } from "@/lib/investment-types";
import { isAccountId } from "@/lib/accounts";
import { lookup } from "@/lib/i18n/format";

export async function getGoals(): Promise<{ data: GoalWithProgress[] } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const [{ data: cats, error: catsError }, { data: txns, error: txnsError }] = await Promise.all([
		supabase
			.from("categories")
			.select("*")
			.eq("user_id", user.id)
			.eq("type", "risparmio")
			.order("created_at", { ascending: false }),
		supabase
			.from("transactions")
			.select("category_id, amount")
			.eq("user_id", user.id)
			.eq("type", "risparmio"),
	]);

	if (catsError) return { error: catsError.message };
	if (txnsError) return { error: txnsError.message };

	// Aggrega i risparmi per categoria
	const sums = (txns ?? []).reduce(
		(acc, t) => {
			if (t.category_id) acc[t.category_id] = (acc[t.category_id] ?? 0) + t.amount;
			return acc;
		},
		{} as Record<string, number>,
	);

	const goals: GoalWithProgress[] = (cats ?? []).map((c) => ({
		...c,
		saved_amount: sums[c.id] ?? 0,
	}));

	return { data: goals };
}

/**
 * Il portafoglio: capitale VERSATO, al netto di ciò che è stato liquidato.
 *
 * ⚠️ Non è il valore di mercato, e la differenza non è cosmetica: Seichi non ha
 * quotazioni, quindi questo numero è la somma di quanto hai messo meno quanto
 * hai ripreso. L'etichetta diceva "Valore portafoglio" ed era **falsa da
 * sempre** — la issue #52 l'ha resa visibile invece di crearla.
 *
 * ⚠️ Il netting è per POSIZIONE (categoria), non per riga, e la ragione è
 * `investment_type`: la scrive solo l'import, non il `TransactionForm`. Una
 * vendita inserita a mano lo avrebbe `null` e finirebbe nel secchio "altro"
 * mentre gli acquisti che liquida stanno in "etf" — la compensazione per
 * tipologia darebbe due numeri sbagliati invece di uno giusto. La tipologia si
 * prende quindi dalla posizione, decisa dalle righe di ACQUISTO, che sono le
 * uniche che possano averla.
 *
 * @param accountId conto su cui restringere, o `null`/assente per tutti (#53).
 *   Filtra su `account_id`, cioè il conto su cui il movimento AGISCE — per un
 *   acquisto è quello da cui il denaro esce, per una vendita quello in cui
 *   rientra. È lo stesso criterio con cui filtrano home e `/analisi`.
 */
export async function getInvestments(
	accountId?: string | null,
): Promise<{ data: InvestmentData } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	let query = supabase
		.from("transactions")
		.select("category_id, amount, type, investment_type, date, categories(name, icon, color)")
		.eq("user_id", user.id)
		// ⚠️ `.in` e non `.eq`: senza le vendite il totale cresce e non cala mai,
		// che è letteralmente il difetto della #52.
		.in("type", ["investimento", "disinvestimento"])
		.order("date", { ascending: false });

	// ⚠️ `isAccountId()` prima di usarlo: qui non finisce in una stringa di
	// sintassi come nel `.or()` di getTransactions, ma un id malformato
	// produrrebbe comunque un 22P02 che si presenta all'utente come "Errore".
	if (isAccountId(accountId)) query = query.eq("account_id", accountId);

	const { data: txns, error } = await query;

	if (error) return { error: error.message };

	const now = new Date();
	const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

	let thisMonthContrib = 0;
	let lastMonthContrib = 0;

	const catMap = new Map<string, {
		name: string; icon: string; color: string;
		investment_type: string | null; total: number;
	}>();

	for (const tx of txns ?? []) {
		if (!tx.category_id || !tx.categories) continue;

		const cat = tx.categories as unknown as { name: string; icon: string; color: string };
		// Il verso: un acquisto aggiunge capitale versato, una vendita lo toglie.
		const signed = tx.type === "disinvestimento" ? -tx.amount : tx.amount;

		const d = new Date(tx.date);
		if (d >= firstOfThisMonth) thisMonthContrib += signed;
		else if (d >= firstOfLastMonth) lastMonthContrib += signed;

		const existing = catMap.get(tx.category_id);
		if (existing) {
			existing.total += signed;
			// ⚠️ Solo un ACQUISTO può fissare la tipologia, e solo se non c'è già:
			// le righe arrivano in ordine di data decrescente, quindi senza questa
			// guardia una vendita recente con `investment_type` null sovrascriverebbe
			// la tipologia stabilita dagli acquisti.
			if (existing.investment_type === null && tx.type === "investimento") {
				existing.investment_type = tx.investment_type ?? null;
			}
		} else {
			catMap.set(tx.category_id, {
				name: cat.name,
				icon: cat.icon,
				color: cat.color,
				investment_type: tx.type === "investimento" ? (tx.investment_type ?? null) : null,
				total: signed,
			});
		}
	}

	const total = Array.from(catMap.values()).reduce((acc, c) => acc + c.total, 0);

	/*
	 * ⚠️ Le percentuali si calcolano sul solo capitale POSITIVO.
	 *
	 * Una posizione può risultare negativa — hai liquidato più di quanto versato,
	 * perché c'erano plusvalenze — e va MOSTRATA: azzerarla direbbe "non hai mai
	 * versato niente qui", che è falso. Ma lasciarla dentro al denominatore
	 * produrrebbe percentuali che non sommano a 100 e, con un totale vicino allo
	 * zero, valori come 1.400%. Il numero resta vero, la proporzione si calcola
	 * su ciò che una proporzione può descrivere.
	 */
	const basePct = Array.from(catMap.values())
		.filter((c) => c.total > 0)
		.reduce((acc, c) => acc + c.total, 0);
	const share = (v: number) => (basePct > 0 && v > 0 ? Math.round((v / basePct) * 100) : 0);

	const typeMap = new Map<string, number>();
	for (const cat of catMap.values()) {
		const key = cat.investment_type ?? INVESTMENT_TYPE_FALLBACK;
		typeMap.set(key, (typeMap.get(key) ?? 0) + cat.total);
	}

	/*
	 * ⚠️ La variazione ha senso solo se il mese scorso è stato di ACCUMULO netto.
	 * Con un mese scorso negativo (più venduto che comprato) la percentuale
	 * cambierebbe segno per un motivo che nessuno legge nella card — un +50% che
	 * significa "hai disinvestito meno" si legge come "hai investito di più".
	 * `null` = la card non mostra la riga, ed è la stessa scelta già fatta per il
	 * mese scorso a zero.
	 */
	const variazionePct =
		lastMonthContrib > 0
			? Math.round(((thisMonthContrib - lastMonthContrib) / lastMonthContrib) * 1000) / 10
			: null;

	const byType = Array.from(typeMap.entries())
		.map(([type, typeTotal]) => ({
			type,
			label: lookup(t.investments.types, type, (label) => label, type),
			color: INVESTMENT_TYPE_COLOR[type] ?? INVESTMENT_TYPE_COLOR[INVESTMENT_TYPE_FALLBACK],
			total: typeTotal,
			pct: share(typeTotal),
		}))
		.sort((a, b) => b.total - a.total);

	const positions = Array.from(catMap.entries())
		.map(([category_id, cat]) => ({
			category_id,
			name: cat.name,
			icon: cat.icon,
			color: cat.color,
			investment_type: cat.investment_type,
			total: cat.total,
			pct: share(cat.total),
		}))
		.sort((a, b) => b.total - a.total);

	return { data: { total, variazionePct, byType, positions } };
}

export async function createGoal(payload: {
	name: string;
	target_amount: number | null;
	target_date: string | null;
	icon: string;
}): Promise<{ error?: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { error } = await supabase.from("categories").insert({
		user_id: user.id,
		name: payload.name,
		icon: payload.icon,
		color: "kin",
		type: "risparmio",
		target_amount: payload.target_amount,
		target_date: payload.target_date,
	});

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return {};
}

export async function updateGoal(
	id: string,
	payload: {
		name: string;
		target_amount: number | null;
		target_date: string | null;
		icon: string;
	},
): Promise<{ error?: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { error } = await supabase
		.from("categories")
		.update({
			name: payload.name,
			icon: payload.icon,
			target_amount: payload.target_amount,
			target_date: payload.target_date,
		})
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return {};
}

export async function deleteGoal(id: string): Promise<{ error?: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	// Delete associated transactions first — otherwise they remain as
	// orphaned outflows that permanently reduce the balance with no visible goal.
	const { error: txnError } = await supabase
		.from("transactions")
		.delete()
		.eq("category_id", id)
		.eq("user_id", user.id)
		.eq("type", "risparmio");

	if (txnError) return { error: txnError.message };

	const { error } = await supabase
		.from("categories")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return {};
}
