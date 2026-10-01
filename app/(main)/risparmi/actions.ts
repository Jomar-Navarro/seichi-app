"use server";

import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { GoalWithProgress, InvestmentData } from "@/types";
import { INVESTMENT_TYPE_COLOR, INVESTMENT_TYPE_FALLBACK } from "@/lib/investment-types";
import { isAccountId } from "@/lib/accounts";
import { lookup } from "@/lib/i18n/format";
import { isStorableAmount } from "@/lib/amount";
import { RECEIPT_BUCKET } from "@/lib/attachments";
import { removeStorageFiles } from "@/lib/storage-files";
import { readAll } from "@/lib/read-all";
import { endOfDayInMonth } from "@/lib/dates";
import { receiptPathsOf } from "@/lib/attachment-paths";
import type { SupabaseServerClient } from "@/lib/supabase/server";

export async function getGoals(): Promise<{ data: GoalWithProgress[] } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const [{ data: cats, error: catsError }, { rows: txns, error: txnsError }] = await Promise.all([
		supabase
			.from("categories")
			.select("*")
			.eq("user_id", user.id)
			.eq("type", "risparmio")
			.order("created_at", { ascending: false }),
		// ⚠️ A blocchi, ordinati per id (#121): senza, oltre le 1000 righe
		// PostgREST tronca in silenzio e un obiettivo risulta meno avanti del vero.
		readAll<{ category_id: string | null; amount: number; date: string }>(
			(from, to) =>
				supabase
					.from("transactions")
					.select("category_id, amount, date")
					.eq("user_id", user.id)
					.eq("type", "risparmio")
					.order("id", { ascending: true })
					.range(from, to),
			"obiettivi",
		),
	]);

	if (catsError) return { error: catsError.message };
	if (txnsError) return { error: txnsError };

	// I versamenti di ciascun obiettivo, in ordine di data.
	const byGoal = new Map<string, { amount: number; date: string }[]>();
	for (const t of txns) {
		if (!t.category_id) continue;
		const list = byGoal.get(t.category_id) ?? [];
		list.push({ amount: t.amount, date: t.date });
		byGoal.set(t.category_id, list);
	}

	// Al centesimo: senza, un residuo in virgola mobile poteva dire "completato"
	// alla card e "non ancora" al calcolo della data (review della #121).
	// `|| 0`: l'arrotondamento di un residuo negativo dà -0, che `Intl` scrive "-0,00".
	const cents = (x: number) => Math.round(x * 100) / 100 || 0;

	const goals: GoalWithProgress[] = (cats ?? []).map((c) => {
		const deposits = byGoal.get(c.id) ?? [];
		const saved = cents(deposits.reduce((acc, d) => acc + d.amount, 0));

		/*
		 * ⚠️ Il giorno in cui il traguardo è stato SUPERATO (#121): il versamento
		 * con cui la somma progressiva arriva al target. La card diceva
		 * «Raggiunto · <scadenza>», cioè una data che con il raggiungimento non
		 * ha niente a che fare — un obiettivo per dicembre chiuso a marzo
		 * risultava "raggiunto a dicembre".
		 *
		 * Solo se l'obiettivo è raggiunto ADESSO: se un versamento è stato poi
		 * cancellato (è così che si "preleva", vedi Key Decisions) la data di un
		 * superamento non più vero non va mostrata.
		 */
		/*
		 * L'ordinamento per data si fa SOLO per un obiettivo completato: home e
		 * coach chiamano questa funzione per `saved_amount` e basta (review della
		 * #121).
		 *
		 * ⚠️ `slice(0, 10)` legge il giorno come lo legge la lista dei movimenti
		 * (`new Date()` su un timestamp senza fuso): la data mostrata qui è quella
		 * che l'utente vede accanto allo stesso versamento. Il caso al confine
		 * della mezzanotte è il debito dichiarato di `transactions.date`.
		 */
		let reached_at: string | null = null;
		if (c.target_amount && saved >= c.target_amount) {
			let progressivo = 0;
			for (const d of [...deposits].sort((a, b) => a.date.localeCompare(b.date))) {
				progressivo += d.amount;
				if (cents(progressivo) >= c.target_amount) {
					reached_at = d.date.slice(0, 10);
					break;
				}
			}
		}

		return { ...c, saved_amount: saved, reached_at };
	});

	return { data: goals };
}

/** La chiave della posizione che raccoglie i movimenti senza categoria (#121). */
const UNCATEGORIZED = "__senza_categoria__";

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

	type Riga = {
		category_id: string | null;
		amount: number;
		type: string;
		investment_type: string | null;
		date: string;
		categories: unknown;
	};
	// ⚠️ A blocchi, ordinati per id (#121). Prima una query sola ordinata per
	// data: oltre le 1000 righe PostgREST tagliava in silenzio le PIÙ VECCHIE, e
	// un solo estratto Trade Republic ne aggiunge centinaia per volta. L'ordine
	// non conta per i conti qui sotto — le tipologie sono un insieme (#56).
	const { rows: txns, error } = await readAll<Riga>((from, to) => {
		let query = supabase
			.from("transactions")
			.select("category_id, amount, type, investment_type, date, categories(name, icon, color)")
			.eq("user_id", user.id)
			// ⚠️ `.in` e non `.eq`: senza le vendite il totale cresce e non cala mai,
			// che è letteralmente il difetto della #52.
			.in("type", ["investimento", "disinvestimento"]);

		// ⚠️ `isAccountId()` prima di usarlo: qui non finisce in una stringa di
		// sintassi come nel `.or()` di getTransactions, ma un id malformato
		// produrrebbe comunque un 22P02 che si presenta all'utente come "Errore".
		if (isAccountId(accountId)) query = query.eq("account_id", accountId);
		return query.order("id", { ascending: true }).range(from, to);
	}, "investimenti");

	if (error) return { error };

	/*
	 * ⚠️ La variazione confronta lo STESSO tratto dei due mesi (#121): dal 1°
	 * all'ultimo giorno coperto contro lo stesso tratto del mese scorso. Prima
	 * metteva il mese in corso accanto all'intero mese precedente, e i primi
	 * giorni ogni versamento non ancora fatto si leggeva come un crollo. Deciso
	 * con Jomar il 2026-10-01, insieme a `/analisi` — e con la stessa regola:
	 * il tratto arriva fino all'ultimo versamento del mese se è oltre oggi (il
	 * form accetta date future), vedi `getAnalyticsData`.
	 */
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

	let thisMonthContrib = 0;
	let ultimo = today;
	// Del mese scorso si tengono le righe e si sommano DOPO: il confine dipende
	// dall'ultimo giorno di questo mese, che si conosce solo alla fine del ciclo.
	const lastMonthRows: { d: Date; signed: number }[] = [];

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

	for (const tx of txns) {
		/*
		 * ⚠️ Un movimento SENZA categoria non si scarta più (#121): la categoria è
		 * facoltativa sia nel form sia nell'import, e home, budget e saldi quei
		 * movimenti li contano. Scartandoli qui, un import Trade Republic senza
		 * categorie lasciava "Investimenti € 300" in home e "Nessun investimento
		 * ancora" su questa pagina. Finiscono in una posizione "Senza categoria".
		 */
		const key = tx.category_id ?? UNCATEGORIZED;
		const cat = (tx.categories as { name: string; icon: string; color: string } | null) ?? {
			name: t.common.uncategorized,
			icon: "",
			color: "",
		};
		// Il verso: un acquisto aggiunge capitale versato, una vendita lo toglie.
		const signed = tx.type === "disinvestimento" ? -tx.amount : tx.amount;

		const d = new Date(tx.date);
		if (d >= firstOfThisMonth && d < firstOfNextMonth) {
			thisMonthContrib += signed;
			if (d > ultimo) ultimo = d;
		} else if (d >= firstOfLastMonth && d < firstOfThisMonth) {
			lastMonthRows.push({ d, signed });
		}

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
		const existing = catMap.get(key);
		if (existing) {
			existing.total += signed;
			if (tx.investment_type) existing.types.add(tx.investment_type);
		} else {
			catMap.set(key, {
				name: cat.name,
				icon: cat.icon,
				color: cat.color,
				types: new Set(tx.investment_type ? [tx.investment_type] : []),
				total: signed,
			});
		}
	}

	/*
	 * ⚠️ Al CENTESIMO (review della #121). Le somme in virgola mobile lasciano
	 * residui: una posizione comprata per 100,10 + 200,20 e venduta per 300,30
	 * resta a −5,7e-14 — con la nota "hai liquidato più di quanto versato" e
	 * "€ -0,00". Arrotondando, `total > 0` significa davvero "ancora versato".
	 * Vale anche per i due contributi del mese: lo stesso residuo come
	 * DENOMINATORE della variazione passava il `> 0` e dava percentuali assurde.
	 */
	// `|| 0`: l'arrotondamento di un residuo negativo dà -0, che `Intl` scrive "-0,00".
	const cents = (x: number) => Math.round(x * 100) / 100 || 0;

	const lastMonthEnd = endOfDayInMonth(
		firstOfLastMonth.getFullYear(),
		firstOfLastMonth.getMonth(),
		ultimo.getDate(),
	);
	const lastMonthContrib = cents(
		lastMonthRows.filter((r) => r.d < lastMonthEnd).reduce((acc, r) => acc + r.signed, 0),
	);
	thisMonthContrib = cents(thisMonthContrib);

	for (const c of catMap.values()) c.total = cents(c.total);

	const total = cents(Array.from(catMap.values()).reduce((acc, c) => acc + c.total, 0));

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
	for (const tx of txns) {
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

	for (const [k, v] of typeMap) typeMap.set(k, cents(v));
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
		.map(([key, cat]) => ({
			category_id: key === UNCATEGORIZED ? null : key,
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
	if (payload.target_amount !== null && !isStorableAmount(payload.target_amount)) {
		return { error: t.errors.amountInvalid };
	}

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
	if (payload.target_amount !== null && !isStorableAmount(payload.target_amount)) {
		return { error: t.errors.amountInvalid };
	}

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

/**
 * Che cosa porta via `deleteGoal`, da dire nella conferma (#117).
 *
 * Si chiede al gesto — quando l'utente arma l'eliminazione — non a ogni
 * apertura di `/risparmi`: due conteggi per una domanda che si pone di rado,
 * lo stesso schema di `canDeleteAccount()` (#62). L'importo NON si rilegge qui:
 * è `saved_amount`, che la card mostra già e che somma le stesse righe.
 */
export async function getGoalDeletionImpact(
	id: string,
): Promise<{ data: { deposits: number; rules: number } } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const [deposits, rules] = await Promise.all([
		supabase
			.from("transactions")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id)
			.eq("category_id", id)
			.eq("type", "risparmio"),
		supabase
			.from("recurring_rules")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id)
			.eq("category_id", id),
	]);

	if (deposits.error || rules.error) {
		console.error(
			"[obiettivi] impatto eliminazione:",
			deposits.error?.message ?? rules.error?.message,
		);
		return { error: t.common.genericError };
	}

	return { data: { deposits: deposits.count ?? 0, rules: rules.count ?? 0 } };
}

export async function deleteGoal(id: string): Promise<{ error?: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	/*
	 * ⚠️ Le ricevute si raccolgono PRIMA (#120): i delete qui sotto fanno cascata
	 * su `attachments` e lasciano i file nel bucket, e dopo quali fossero non è
	 * più scritto da nessuna parte.
	 *
	 * ⚠️ Di TUTTI i movimenti della categoria, non dei soli versamenti: il delete
	 * della categoria in fondo fa cascata su ogni movimento che la usa, e il tipo
	 * di una categoria si può cambiare quando ha già dei movimenti — una "spesa"
	 * diventata obiettivo porta con sé spese con ricevute (review della #120).
	 *
	 * Due insiemi, perché diventano orfani in due momenti diversi: i file dei
	 * versamenti appena il loro delete riesce, gli altri solo quando cade la
	 * categoria. Se la lettura fallisce ci si ferma: niente è ancora stato
	 * toccato.
	 */
	const [deposits, all] = await Promise.all([
		receiptPathsOf(supabase, user.id, { category: id, type: "risparmio" }),
		receiptPathsOf(supabase, user.id, { category: id }),
	]);
	if ("error" in deposits || "error" in all) return { error: t.errors.receiptsReadFailed };
	const depositPaths = new Set(deposits.paths);
	const otherPaths = all.paths.filter((p) => !depositPaths.has(p));

	// Delete associated transactions first — otherwise they remain as
	// orphaned outflows that permanently reduce the balance with no visible goal.
	const { error: txnError } = await supabase
		.from("transactions")
		.delete()
		.eq("category_id", id)
		.eq("user_id", user.id)
		.eq("type", "risparmio");

	if (txnError) return { error: txnError.message };

	/*
	 * I file dei versamenti si rimuovono SUBITO, non in fondo alla funzione: da
	 * qui in poi le righe che li indicavano non esistono più, e se il passo delle
	 * regole o quello della categoria fallisse e la funzione uscisse prima, il
	 * secondo tentativo non li troverebbe più — orfani per sempre.
	 *
	 * Un fallimento della rimozione si registra e non annulla niente, come in
	 * `undoImport()`.
	 */
	await removeOrphanedReceipts(supabase, [...depositPaths]);

	/*
	 * ⚠️ E le regole ricorrenti che lo alimentano (#117). La FK
	 * `recurring_rules_category_id_fkey` è `on delete set null`: cancellata la
	 * categoria, la regola restava ATTIVA con `category_id` NULL, e dal mese dopo
	 * il job inseriva ogni mese un `risparmio` senza obiettivo — abbassa il saldo
	 * del conto e non va da nessuna parte. È lo stesso "orphaned outflow" che le
	 * righe qui sopra esistono per evitare, rigenerato ogni mese.
	 *
	 * Eliminate e non messe in pausa: una regola di risparmio senza obiettivo non
	 * ha più niente da finanziare, e ripresa per sbaglio rifarebbe il difetto.
	 * La conferma lo dice (`getGoalDeletionImpact`).
	 *
	 * Dopo i versamenti e prima della categoria: se questo passo fallisce,
	 * l'obiettivo resta con la sua regola, che continua a finanziarlo — uno stato
	 * coerente, e il secondo tentativo finisce il lavoro.
	 */
	const { error: rulesError } = await supabase
		.from("recurring_rules")
		.delete()
		.eq("category_id", id)
		.eq("user_id", user.id);

	if (rulesError) {
		console.error("[obiettivi] eliminazione, regole ricorrenti:", rulesError.message);
		return { error: t.common.genericError };
	}

	const { error } = await supabase
		.from("categories")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };

	// Gli altri movimenti della categoria sono caduti con lei, in cascata.
	await removeOrphanedReceipts(supabase, otherPaths);

	revalidatePath("/", "layout");
	return {};
}

/** Rimuove i file di ricevute le cui righe sono già sparite; un guasto va nei log. */
async function removeOrphanedReceipts(supabase: SupabaseServerClient, paths: string[]) {
	if (paths.length === 0) return;
	const removed = await removeStorageFiles(supabase, RECEIPT_BUCKET, paths);
	if (removed.error) {
		console.error("[obiettivi] ricevute orfane dopo l'eliminazione:", removed.error, paths);
	}
}
