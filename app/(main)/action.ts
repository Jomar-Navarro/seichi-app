"use server";
import { revalidatePath } from "next/cache";
import { getI18n } from "@/lib/i18n/server";
import { formatDate, shortMonth } from "@/lib/i18n/format";
import { requireUser } from "@/lib/auth";
import { isAccountId, isUuid } from "@/lib/accounts";
import { firstRunFrom, rollForwardPastToday } from "@/lib/recurring";
import type { Frequency } from "@/types";

/**
 * ⚠️ `assertOwnAccount()` NON esiste più, e vale sapere cosa l'ha sostituita.
 *
 * Fino alla 20a una query precedeva ogni salvataggio per verificare che il conto
 * appartenesse a chi scrive: le policy RLS non lo coprono — filtrano su
 * `user_id`, che lo scrive il server, e nessuna guarda `account_id` — quindi una
 * POST costruita a mano poteva attaccare un movimento al conto di un altro
 * utente.
 *
 * Il difetto di quella difesa non era il costo: era che **ogni futuro scrittore
 * di `transactions` doveva ricordarsi di chiamarla**, e `updateRecurringRule`
 * già non lo faceva. Dalla `20260815` la proprietà è una FK COMPOSITA
 * `(account_id, user_id) → accounts (id, user_id)`, più la gemella su
 * `to_account_id`: lo stato illegale non è più vietato per attenzione, è
 * irrappresentabile — e la query in meno è un effetto collaterale, non lo scopo.
 *
 * Resta da tradurre il rifiuto del database in una frase leggibile, ed è ciò che
 * fa `contoError()`.
 */

/** Codici Postgres che qui significano "il conto non va bene". */
const FK_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

/**
 * Il messaggio da mostrare quando un salvataggio viene rifiutato.
 *
 * ⚠️ Il testo grezzo di Postgres NON si mostra: `insert or update on table
 * "transactions" violates foreign key constraint
 * "transactions_to_account_owner_fkey"` non è una frase per un utente, ed è
 * anche in inglese in un'app tradotta. Ma non si scarta nemmeno — finisce nei
 * log, perché è l'unica cosa che dice quale vincolo ha parlato.
 */
function contoError(
	error: { code?: string; message: string },
	t: Awaited<ReturnType<typeof requireUser>>["t"],
) {
	/*
	 * ⚠️ Solo la FK parla di CONTI. Un `check_violation` dice che la FORMA del
	 * movimento è illegale — trasferimento verso se stessi, con categoria, o
	 * destinazione su una spesa — e rispondere "Conto non trovato" sarebbe una
	 * frase **falsa**: manderebbe a controllare i conti, che sono a posto.
	 *
	 * Il primo tentativo li mappava insieme, ed è la stessa classe di difetto
	 * corretta in `assertOwnAccount` durante la review della 20a: un guasto di
	 * rete che diceva "Conto non trovato". Due cause diverse non possono avere lo
	 * stesso messaggio solo perché arrivano dalla stessa `catch`.
	 *
	 * Sulla forma non si dice altro perché i CHECK li garantisce il form: se uno
	 * scatta è un difetto nostro, e il posto dove leggerlo sono i log.
	 */
	if (error.code === FK_VIOLATION) {
		console.error("[transactions] conto non appartenente:", error.message);
		return t.accounts.errors.notFound;
	}
	if (error.code === CHECK_VIOLATION) {
		console.error("[transactions] forma illegale del movimento:", error.message);
		return t.common.genericError;
	}
	console.error("[transactions]", error.message);
	return t.common.genericError;
}

export async function saveTransaction(
	importo: number,
	tipo: string,
	categoria_id: string | null,
	nota: string | null,
	data: string,
	conto_id: string,
	a_conto_id: string | null = null,
) {
	const { supabase, user, t } = await requireUser();

	if (!user) return { error: t.errors.notAuthenticated };

	/*
	 * ⚠️ L'`id` torna al chiamante, e serve alla Fase 22: la ricevuta scelta
	 * PRIMA di salvare si carica subito dopo, e un allegato ha bisogno di un
	 * `transaction_id` che fino a questo momento non esiste.
	 *
	 * È lo stesso motivo per cui `createCategory()` restituisce l'id dalla 17a —
	 * là serviva a impostare il budget sulla categoria appena creata. Senza,
	 * l'unica strada sarebbe una seconda query per ritrovare la riga appena
	 * scritta, cercandola per campi che non la identificano: due movimenti
	 * identici lo stesso giorno sono indistinguibili.
	 */
	const { data: row, error } = await supabase
		.from("transactions")
		.insert({
			user_id: user.id,
			amount: importo,
			type: tipo,
			category_id: categoria_id,
			notes: nota,
			date: data,
			account_id: conto_id,
			to_account_id: a_conto_id,
		})
		.select("id")
		.single();

	if (error) return { error: contoError(error, t) };
	revalidatePath("/", "layout");
	return { success: true, id: row.id as string };
}

/**
 * La lista movimenti, una pagina per volta.
 *
 * ⚠️ Opzioni nominate e non parametri posizionali: erano quattro, con questa
 * fase diventerebbero sei, e due di quelli — `limit` e `offset` — sono numeri
 * adiacenti che si scambiano senza che nulla se ne accorga. Un errore del genere
 * non produce un guasto, produce una pagina di risultati sbagliata.
 */
export async function getTransactions(opts: {
	tipo?: string;
	periodo?: string;
	conto?: string;
	categoria?: string;
	limit?: number;
	offset?: number;
} = {}) {
	const { tipo, periodo, conto, categoria, limit, offset } = opts;
	const { supabase, user, t } = await requireUser();

	if (!user) return { error: t.errors.notAuthenticated };

	let query = supabase
		.from("transactions")
		.select("*, categories(name, icon, color)")
		.eq("user_id", user.id)
		.order("date", { ascending: false })
		/*
		 * ⚠️ Il secondo ordinamento NON è cosmetico: senza, la paginazione può
		 * duplicare o PERDERE righe.
		 *
		 * `date` non è univoca — l'import della Fase 21 scrive decine di movimenti
		 * con la stessa data (162 righe su 242 sui dati veri, fino a 8 nello stesso
		 * giorno) — e con un solo criterio di ordinamento Postgres è libero di
		 * restituire le righe a pari merito in un ordine diverso a ogni query. Le
		 * pagine sono query DISTINTE: basta che due giri ordinino diversamente le
		 * righe a cavallo di un confine perché una compaia due volte e un'altra non
		 * compaia affatto.
		 *
		 * Il guasto è silenzioso in entrambi i consumatori — la lista mostrerebbe un
		 * doppione, l'export (23a) scriverebbe un file incompleto senza dirlo — e non
		 * si vede sui dati di prova, dove una pagina sola basta a coprire tutto.
		 * `id` è la chiave primaria, quindi basta lui a rendere l'ordine totale.
		 */
		.order("id", { ascending: false });

	if (tipo) query = query.eq("type", tipo);

	/*
	 * ⚠️ Il filtro prende ORIGINE **o** DESTINAZIONE, e nella 20a prendeva solo
	 * l'origine. La domanda era stata lasciata aperta qui apposta: con
	 * `to_account_id` un movimento appartiene a due conti, e la risposta non
	 * doveva essere ereditata per inerzia.
	 *
	 * Con un conto selezionato questa lista è il suo **estratto conto**, e deve
	 * riconciliare col saldo che `/conti` mostra tre tap più in là. Fermarsi
	 * all'origine significherebbe che i 200 € arrivati sul Libretto non compaiono
	 * in nessuna riga del Libretto pur essendo dentro al suo saldo: una lista che
	 * non sa spiegare il numero scritto sopra di essa.
	 *
	 * ⚠️ La HOME resta all'origine soltanto, ed è coerente invece che
	 * contraddittorio: là si guarda il FLUSSO — quanto è entrato e quanto è
	 * uscito — e i trasferimenti non ci entrano affatto, perché spostare denaro
	 * non è né guadagnarlo né spenderlo. Due domande diverse, due insiemi
	 * diversi. Il segno delle righe segue la stessa distinzione: vedi
	 * `amountSign()` in `lib/transaction-utils.ts`.
	 */
	/*
	 * ⚠️ `isAccountId()` non è cerimonia: qui il conto finisce dentro una STRINGA
	 * di filtro, dove `.eq()` non fa da parametro come altrove. Un valore con una
	 * virgola aggiungerebbe condizioni al gruppo OR. Un id malformato viene
	 * ignorato invece di fare errore — questa è una lista, e "nessun filtro" è una
	 * degradazione onesta; è la home a non potersi permettere lo stesso, perché lì
	 * il valore arriva a Postgres come uuid e la pagina intera morirebbe.
	 */
	if (isAccountId(conto)) {
		query = query.or(`account_id.eq.${conto},to_account_id.eq.${conto}`);
	}

	if (periodo && periodo !== "tutto") {
		const from = new Date();
		if (periodo === "7d") from.setDate(from.getDate() - 7);
		else if (periodo === "30d") from.setDate(from.getDate() - 30);
		else if (periodo === "3m") from.setMonth(from.getMonth() - 3);
		from.setHours(0, 0, 0, 0);
		query = query.gte("date", from.toISOString());
	}

	/*
	 * ⚠️ Il filtro CATEGORIA usa `isUuid()` per la stessa ragione del conto, ma
	 * per un guasto diverso: qui `.eq()` fa da parametro davvero — nessuna
	 * sintassi da iniettare — e il rischio è solo un `22P02` su un id malformato,
	 * che in questa pagina si presenterebbe come una lista vuota con "Errore".
	 * Ignorarlo degrada a "nessun filtro", che è onesto: la barra mostra comunque
	 * quale categoria è selezionata.
	 */
	if (isUuid(categoria)) query = query.eq("category_id", categoria);

	/*
	 * La paginazione, e il modo in cui si sa che c'è dell'altro.
	 *
	 * ⚠️ Si chiede UNA RIGA IN PIÙ di quelle che servono invece di fare una
	 * seconda query con `count: "exact"`. Il conteggio esatto costerebbe una
	 * scansione completa a ogni pagina — sulla stessa tabella che questa fase
	 * esiste per smettere di scandire — e servirebbe a rispondere a una domanda
	 * che nessuno pone: la UI non mostra "pagina 3 di 12", mostra un pulsante
	 * "carica altri". Per quello basta sapere SE esiste una riga successiva.
	 *
	 * La riga in eccesso viene tolta prima di uscire: chi chiama riceve
	 * esattamente `limit` righe, e `hasMore` separatamente. Restituirla e lasciare
	 * al chiamante il compito di scartarla sarebbe un'invariante affidata
	 * all'attenzione di chi scrive la prossima pagina.
	 */
	if (limit !== undefined) {
		const from = offset ?? 0;
		query = query.range(from, from + limit); // `range` è inclusivo: limit + 1 righe
	}

	const { data, error } = await query;
	if (error) return { error: error.message };

	if (limit === undefined) return { data, hasMore: false };

	const hasMore = (data?.length ?? 0) > limit;
	return { data: hasMore ? data!.slice(0, limit) : data, hasMore };
}

export async function updateTransaction(
	id: string,
	importo: number,
	tipo: string,
	categoria_id: string | null,
	nota: string | null,
	data: string,
	conto_id: string,
	a_conto_id: string | null = null,
) {
	const { supabase, user, t } = await requireUser();

	if (!user) return { error: t.errors.notAuthenticated };

	const { error } = await supabase
		.from("transactions")
		.update({
			amount: importo,
			type: tipo,
			category_id: categoria_id,
			notes: nota,
			date: data,
			account_id: conto_id,
			// ⚠️ Sempre scritta, anche quando è `null`. Omettere il campo su un
			// update PostgREST significa "non toccarlo": cambiando il tipo di un
			// movimento da `risparmio` a `spesa` la vecchia destinazione
			// resterebbe attaccata, e `transactions_dest_type_check` rifiuterebbe
			// l'intero salvataggio con un messaggio che parla di vincoli.
			to_account_id: a_conto_id,
		})
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: contoError(error, t) };
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

	if (error) return { error: contoError(error, t) };

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
	conto_id: string,
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
			/*
			 * ⚠️ Il conto era a SCRITTURA UNICA fino alla 20b, e non per scelta:
			 * `createRecurringRule` lo prendeva, questa no, e `RecurringSheet` non
			 * mostrava il campo. Una regola nata sul conto sbagliato non si poteva
			 * più spostare — l'unico rimedio era cancellarla e rifarla.
			 *
			 * Serve anche a rendere praticabile il divieto di archiviare un conto
			 * con regole attive (`setAccountArchived`): senza una via per spostarle,
			 * quel divieto sarebbe un vicolo cieco.
			 *
			 * La proprietà del conto la garantisce la FK composita della
			 * `20260815`, non un controllo qui: questa action non ha MAI chiamato
			 * `assertOwnAccount`, ed è precisamente il buco che un vincolo chiude e
			 * una convenzione no.
			 */
			account_id: conto_id,
		})
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: contoError(error, t) };
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

/**
 * ⚠️ `accountId` NON è un'aggiunta di comodo: senza, questa pagina contraddice
 * la home.
 *
 * `sommaUscite()` è stata introdotta perché home e `/analisi` mostravano due
 * numeri diversi sotto la stessa parola. Ma la 20a ha reso la home filtrabile
 * per conto **nello stesso commit**: selezionando "Contanti" la home dice
 * "Flusso · € 120" e il collegamento "Analisi" — due card più sotto — apriva un
 * "Flusso netto · € 1.540" calcolato su tutti i conti, senza alcun segno che i
 * due fossero su insiemi diversi. La correzione e la sua riapertura erano nella
 * stessa PR.
 *
 * Il filtro agisce su `account_id` come ovunque: l'ORIGINE del movimento.
 */
export async function getAnalyticsData(periodo: string = "mese", accountId?: string | null) {
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

	/*
	 * Il filtro conto si applica a ENTRAMBE le query: il KPI e la torta devono
	 * parlare dello stesso insieme, o la pagina si contraddice al proprio interno.
	 *
	 * ⚠️ Solo `account_id`, cioè l'ORIGINE — e la differenza con
	 * `getTransactions()`, che dalla 20b prende origine **o** destinazione, è
	 * deliberata. Non allinearle per simmetria: rispondono a domande diverse.
	 * Qui si guarda il FLUSSO di un conto (quanto è entrato, quanto è uscito) e i
	 * trasferimenti non ci entrano affatto, perché spostare denaro non è né
	 * guadagnarlo né spenderlo; là si guarda il suo ESTRATTO CONTO, che deve
	 * riconciliare col saldo e quindi include ciò che è arrivato.
	 */
	const byAccount = <T>(q: T): T =>
		accountId ? ((q as { eq: (c: string, v: string) => T }).eq("account_id", accountId)) : q;

	const [
		{ data: trendData, error: trendError },
		{ data: speseData, error: speseError },
	] = await Promise.all([
		byAccount(
			supabase
				.from("transactions")
				.select("amount, type, date")
				.eq("user_id", user.id)
				.in("type", ["entrata", "spesa", "risparmio", "investimento", "abbonamento"])
				.gte("date", fetchStart.toISOString())
				.lt("date", rangeEnd.toISOString()),
		),
		byAccount(
			supabase
				.from("transactions")
				.select("amount, categories(name, color)")
				.eq("user_id", user.id)
				.eq("type", "spesa")
				.gte("date", rangeStart.toISOString())
				.lt("date", rangeEnd.toISOString()),
		),
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
