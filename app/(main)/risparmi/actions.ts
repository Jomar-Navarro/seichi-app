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
 * Il capitale si compensa su DUE partizioni diverse dello stesso insieme, e
 * vanno tenute distinte perché non coincidono:
 *
 *   · per POSIZIONE (categoria) — quanto è ancora versato su ciascuna;
 *   · per TIPOLOGIA (`investment_type`) — su quali asset.
 *
 * ⚠️ Non è la stessa aggregazione fatta due volte. La decisione dell'import è
 * per GRUPPO ma `investment_type` sta sulla RIGA, quindi una sola categoria
 * "ETF" contiene davvero righe di asset diversi: la posizione ha un solo nome e
 * più tipologie dentro.
 *
 * ⚠️ Da qui il badge di posizione (#56): `investment_type` è valorizzato SOLO
 * quando la posizione ha una tipologia sola, e `typeCount` dice quante ne ha —
 * prima era la tipologia della PRIMA riga d'acquisto, e su una posizione mista
 * descriveva un altro asset (la card "ETF" mostrava "Crypto"). Su una posizione
 * mista non esiste un badge corretto: a dirlo è la sezione "Per tipologia".
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

	/**
	 * ⚠️ `types` è un INSIEME, non una stringa, ed è la correzione della #56.
	 *
	 * Una posizione è una CATEGORIA, e la decisione dell'import è per gruppo:
	 * una sola categoria "ETF" raccoglie davvero righe di asset diversi,
	 * perché `investment_type` sta sulla riga. Tenendo la tipologia della
	 * PRIMA riga d'acquisto, la card mostrava un badge che descriveva un altro
	 * asset — numero giusto, etichetta accanto sbagliata.
	 *
	 * Con l'insieme la domanda diventa esprimibile: una tipologia sola → il
	 * badge è vero e si mostra; più d'una → non esiste UN badge corretto, e a
	 * dirlo è la sezione "Per tipologia" (#61).
	 */
	const catMap = new Map<string, {
		name: string; icon: string; color: string;
		types: Set<string>; total: number;
	}>();

	for (const tx of txns ?? []) {
		if (!tx.category_id || !tx.categories) continue;

		const cat = tx.categories as unknown as { name: string; icon: string; color: string };
		// Il verso: un acquisto aggiunge capitale versato, una vendita lo toglie.
		const signed = tx.type === "disinvestimento" ? -tx.amount : tx.amount;

		const d = new Date(tx.date);
		if (d >= firstOfThisMonth) thisMonthContrib += signed;
		else if (d >= firstOfLastMonth) lastMonthContrib += signed;

		/*
		 * ⚠️ Si contano le righe di ENTRAMBI i versi: una vendita descrive un asset
		 * che la posizione contiene quanto un acquisto. La vecchia guardia "solo un
		 * acquisto fissa la tipologia" serviva a impedire che una vendita senza
		 * tipologia SOVRASCRIVESSE quella giusta — con un insieme nulla viene
		 * sovrascritto, quindi il problema non esiste più.
		 *
		 * ⚠️⚠️ Ma SOLO le tipologie NOTE entrano nell'insieme, e il ripiego
		 * "altro" no: *sconosciuta* non è *diversa*. Il `TransactionForm` non
		 * scrive mai `investment_type` (lo fa solo l'import), quindi un movimento
		 * aggiunto a mano su una posizione importata tutta ETF avrebbe portato
		 * l'insieme a due elementi: il badge "ETF" — corretto — sarebbe sparito, e
		 * nella sezione per tipologia sarebbe comparsa una riga "Altro" che non
		 * descrive un asset ma un dato mancante. È l'istinto giusto della vecchia
		 * guardia, conservato senza il difetto che aveva.
		 */
		const existing = catMap.get(tx.category_id);
		if (existing) {
			existing.total += signed;
			if (tx.investment_type) existing.types.add(tx.investment_type);
		} else {
			catMap.set(tx.category_id, {
				name: cat.name,
				icon: cat.icon,
				color: cat.color,
				types: new Set(tx.investment_type ? [tx.investment_type] : []),
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
	// ⚠️ Due denominatori, non uno. Posizioni e tipologie sono due partizioni
	// diverse dello stesso capitale e i loro totali positivi NON coincidono
	// quando una posizione mescola più asset: un denominatore solo darebbe
	// percentuali che non sommano a 100 in una delle due liste.
	const somma = (v: number[]) => v.filter((x) => x > 0).reduce((a, x) => a + x, 0);
	const shareOf = (v: number, base: number) =>
		base > 0 && v > 0 ? Math.round((v / base) * 100) : 0;
	const basePos = somma(Array.from(catMap.values()).map((c) => c.total));

	/*
	 * ⚠️ La ripartizione per TIPOLOGIA si somma per RIGA, non per posizione, ed
	 * è la correzione di un errore fatto scrivendo questa fase.
	 *
	 * `investment_type` sta sulla transazione perché il file di Trade Republic
	 * distingue l'asset movimento per movimento, mentre la decisione dell'import
	 * è per GRUPPO: una sola categoria "ETF" contiene davvero righe di asset
	 * diversi. Aggregando per categoria — come faceva la prima stesura, per far
	 * quadrare le vendite — quelle righe collassavano tutte sulla tipologia della
	 * prima, cancellando una distinzione **vera**, presente nei dati — ed è la
	 * stessa radice del badge sbagliato della #56, chiusa insieme a questa.
	 *
	 * Le vendite quadrano lo stesso perché l'import ora scrive
	 * `investment_type` anche su `disinvestimento` (vedi `importa/actions.ts`).
	 * Restano fuori le righe inserite a mano, che la tipologia non ce l'hanno in
	 * nessuno dei due versi — acquisti compresi — quindi finiscono in "altro"
	 * insieme, e si compensano fra loro senza sporcare le altre tipologie.
	 */
	const typeMap = new Map<string, number>();
	for (const tx of txns ?? []) {
		if (!tx.category_id || !tx.categories) continue;
		const key = tx.investment_type ?? INVESTMENT_TYPE_FALLBACK;
		const signed = tx.type === "disinvestimento" ? -tx.amount : tx.amount;
		typeMap.set(key, (typeMap.get(key) ?? 0) + signed);
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

	const baseType = somma(Array.from(typeMap.values()));

	const byType = Array.from(typeMap.entries())
		.map(([type, typeTotal]) => ({
			type,
			label: lookup(t.investments.types, type, (label) => label, type),
			color: INVESTMENT_TYPE_COLOR[type] ?? INVESTMENT_TYPE_COLOR[INVESTMENT_TYPE_FALLBACK],
			total: typeTotal,
			pct: shareOf(typeTotal, baseType),
		}))
		.sort((a, b) => b.total - a.total);

	const positions = Array.from(catMap.entries())
		.map(([category_id, cat]) => ({
			category_id,
			name: cat.name,
			icon: cat.icon,
			color: cat.color,
			/*
			 * ⚠️ `size === 0` NON è un caso misto: è una posizione di cui non si
			 * conosce l'asset (righe tutte inserite a mano). Là il badge continua a
			 * mostrare il ripiego "Altro", che e vero: nessuna tipologia
			 * registrata. Nasconderlo direbbe invece che la posizione ne ha
			 * diverse. È il componente a distinguere i due casi con `typeCount <= 1`.
			 */
			investment_type: cat.types.size === 1 ? [...cat.types][0] : null,
			typeCount: cat.types.size,
			total: cat.total,
			pct: shareOf(cat.total, basePos),
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
