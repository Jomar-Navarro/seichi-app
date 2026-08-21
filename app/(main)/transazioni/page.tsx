"use client";
import { useState, useEffect, useCallback } from "react";
import { getTransactions } from "@/app/(main)/action";
import { SEARCH_SCAN_LIMIT, TRANSACTIONS_PAGE_SIZE } from "@/lib/transaction-utils";
import { getAccountOptions } from "@/app/(main)/conti/actions";
import { getBudgetOverview } from "@/app/(main)/budget-actions";
import { getCategories } from "@/app/(main)/impostazioni/actions";
import { getAttachmentCounts } from "@/app/(main)/attachment-actions";
import FilterBar from "@/components/features/Filterbar";
import TransactionList from "@/components/features/TransactionList";
import BudgetCards from "@/components/features/BudgetCards";
import { useUIStore } from "@/store/useUIStore";
import { clientClock } from "@/lib/dates";
import { useI18n } from "@/components/features/I18nProvider";
import { fill } from "@/lib/i18n/format";
import type { Account, BudgetOverview, Category, Transaction } from "@/types";

/** Quel poco che serve al filtro: vedi `getAccountOptions`. */
type AccountOption = Pick<Account, "id" | "name" | "archived">;

export default function MovimentiPage() {
	const { t } = useI18n();
	const [search, setSearch] = useState("");
	const [tipo, setTipo] = useState("");
	const [periodo, setPeriodo] = useState("30d");
	const [conto, setConto] = useState("");
	const [categoria, setCategoria] = useState("");
	const [hasMore, setHasMore] = useState(false);
	const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
	const [categories, setCategories] = useState<Category[]>([]);
	const [accounts, setAccounts] = useState<AccountOption[]>([]);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [budgets, setBudgets] = useState<BudgetOverview | null>(null);
	const [loading, setLoading] = useState(true);
	const transactionSavedAt = useUIStore((s) => s.transactionSavedAt);

	/*
	 * ⚠️ CERCARE E SFOGLIARE sono due modi diversi di leggere la stessa lista, e
	 * la paginazione vale solo per il secondo.
	 *
	 * La ricerca filtra lato client (vedi `matches` più sotto) perché confronta
	 * anche il nome della CATEGORIA e quello del CONTO, che stanno su altre
	 * tabelle. Paginando e basta, cercherebbe dentro le sole righe già caricate:
	 * "nessun movimento" comparirebbe mentre la riga cercata sta nella pagina
	 * successiva — un risultato **falso che sembra vero**, cioè il difetto che
	 * questa app evita per regola (17a).
	 *
	 * Quindi: appena c'è del testo nella ricerca si carica il periodo in un colpo
	 * solo, come faceva la pagina prima di questa fase. Nessuna capacità persa, e
	 * il caso comune — sfogliare — smette di scaricare tutto.
	 *
	 * ⚠️ "In un colpo solo" NON vuol dire "senza limite": vale
	 * `SEARCH_SCAN_LIMIT`, e serve perché **PostgREST un limite ce l'ha
	 * comunque** (Max rows = 1000 su questo progetto) e lo applica **in
	 * silenzio**. Meglio un tetto nostro, più basso e dichiarato dalla riga in
	 * fondo alla lista, che uno esterno che tronca senza dirlo.
	 *
	 * ⚠️ La dipendenza è il BOOLEANO `searching`, non il testo: scrivere il
	 * secondo carattere non deve rifare la query, perché i dati che servono ci
	 * sono già. Con `search` fra le dipendenze ogni tasto sarebbe una richiesta.
	 */
	const searching = search.trim().length > 0;

	const loadPage = useCallback(
		async (offset: number, append: boolean) => {
			setLoading(true);
			try {
				const result = await getTransactions({
					tipo: tipo || undefined,
					periodo,
					conto: conto || undefined,
					categoria: categoria || undefined,
					// ⚠️ Anche la ricerca ha un tetto, e NON è paginazione: è ciò che
					// impedisce a PostgREST di troncare in silenzio a 1000 righe. Vedi
					// `SEARCH_SCAN_LIMIT`.
					limit: searching ? SEARCH_SCAN_LIMIT : TRANSACTIONS_PAGE_SIZE,
					offset,
				});
				if ("error" in result) {
					if (!append) setTransactions([]);
					setHasMore(false);
					return;
				}
				const rows = (result.data as Transaction[]) ?? [];
				setTransactions((prev) => (append ? [...prev, ...rows] : rows));
				setHasMore(result.hasMore);

				/*
				 * I conteggi degli allegati per le righe APPENA arrivate (Fase 22).
				 *
				 * ⚠️ Si chiedono solo per quelle, non per l'intera lista: caricando la
				 * quinta pagina rifare la domanda su 250 movimenti sarebbe una query
				 * che cresce a ogni tocco di "carica altri". Si fondono con quelli già
				 * noti invece di sostituirli.
				 *
				 * ⚠️ Degrada in silenzio, e va bene: `getAttachmentCounts` risponde con
				 * un oggetto vuoto se la query fallisce, quindi al massimo manca una
				 * graffetta. Bloccare la lista per un segnaposto sarebbe sproporzionato.
				 */
				if (rows.length > 0) {
					const counts = await getAttachmentCounts(rows.map((r) => r.id));
					setAttachmentCounts((prev) => (append ? { ...prev, ...counts } : counts));
				} else if (!append) {
					setAttachmentCounts({});
				}
			} finally {
				setLoading(false);
			}
		},
		[tipo, periodo, conto, categoria, searching],
	);

	/*
	 * ⚠️ L'offset è `transactions.length`, non un contatore di pagina.
	 *
	 * Un contatore separato è un secondo stato che dice la stessa cosa del primo,
	 * e i due divergono al primo caso non previsto — un salvataggio che ricarica
	 * la lista mentre il contatore resta a 3. La lunghezza di ciò che è mostrato È
	 * il numero di righe da saltare, per definizione.
	 */
	const loadMore = useCallback(
		() => loadPage(transactions.length, true),
		[loadPage, transactions.length],
	);

	/**
	 * Torna allo stato iniziale in un gesto solo.
	 *
	 * ⚠️ `periodo` torna a "30d" e non a "tutto": il default della pagina non è
	 * "nessun filtro", è "l'ultimo mese". Azzerare verso "tutto" mostrerebbe più
	 * righe di quante ne trova chi apre la pagina per la prima volta, cioè un
	 * "azzera" che cambia lo stato invece di ripristinarlo.
	 */
	const resetFilters = useCallback(() => {
		setSearch("");
		setTipo("");
		setPeriodo("30d");
		setConto("");
		setCategoria("");
	}, []);

	/*
	 * I conti servono solo a popolare il filtro, quindi si caricano una volta e
	 * non dipendono da nulla. Gli ARCHIVIATI restano fuori dal selettore, ma i
	 * loro movimenti continuano a comparire in "tutti i conti": archiviare un
	 * conto non nasconde la sua storia, la toglie dai comandi.
	 */
	useEffect(() => {
		let cancelled = false;
		getAccountOptions().then((res) => {
			if (cancelled || !("data" in res)) return;
			// ⚠️ Si tengono TUTTI, archiviati compresi: il filtro deve poter
			// nominare il conto su cui è puntato anche se nel frattempo è stato
			// archiviato. La selezione dei *proponibili* avviene in FilterBar.
			setAccounts(res.data);
		});
		return () => { cancelled = true; };
		// ⚠️ Dipende da `transactionSavedAt`: senza, un conto creato altrove non
		// compariva nel filtro fino a un ricaricamento completo della pagina.
	}, [transactionSavedAt]);

	/*
	 * Le categorie servono solo a popolare il filtro (#9).
	 *
	 * ⚠️ Dipende da `transactionSavedAt` come i conti, e per lo stesso motivo:
	 * una categoria creata dal form transazione — o dalle impostazioni, che pure
	 * fanno scattare il contatore — non comparirebbe nel filtro fino a un
	 * ricaricamento completo della pagina.
	 */
	useEffect(() => {
		let cancelled = false;
		getCategories().then((res) => {
			if (cancelled || !("data" in res)) return;
			setCategories(res.data);
		});
		return () => { cancelled = true; };
	}, [transactionSavedAt]);

	// Ogni cambio di filtro riparte dalla PRIMA pagina: `loadPage` è memoizzata
	// sui filtri, quindi cambia identità esattamente quando serve ricominciare —
	// e `transactionSavedAt` la rifà anche dopo un salvataggio, perché il
	// movimento appena scritto va in cima e non nella pagina che stai guardando.
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => { loadPage(0, false); }, [loadPage, transactionSavedAt]);

	// I budget guardano sempre il periodo corrente e NON dipendono dai filtri:
	// tenerli nello stesso effetto li faceva rileggere — con le transazioni del
	// periodo, per giunta — a ogni tocco su "30 giorni" o "Tutte". Si aggiornano
	// solo all'ingresso e dopo il salvataggio di un movimento, che è ciò che fa
	// diventare rossa la barra subito.
	useEffect(() => {
		let cancelled = false;
		getBudgetOverview(clientClock()).then((res) => {
			if (cancelled) return;
			setBudgets("data" in res ? res.data : null);
		});
		return () => { cancelled = true; };
	}, [transactionSavedAt]);

	/*
	 * ⚠️ La ricerca guarda anche i NOMI DEI CONTI, e solo dalla 20b serve.
	 *
	 * Un trasferimento non ha categoria: cercando "Revolut" la riga
	 * "Corrente → Revolut" — che è ciò che l'utente vede scritto — non
	 * comparirebbe, e l'unico appiglio resterebbe la nota, se c'è. Una ricerca
	 * che non trova ciò che è scritto a schermo fa concludere che il dato non
	 * esista.
	 */
	const accountNames = new Map(accounts.map((a) => [a.id, a.name.toLowerCase()]));
	const matches = (tx: Transaction, needle: string) =>
		tx.categories?.name.toLowerCase().includes(needle) ||
		tx.notes?.toLowerCase().includes(needle) ||
		accountNames.get(tx.account_id)?.includes(needle) ||
		(tx.to_account_id ? accountNames.get(tx.to_account_id)?.includes(needle) : false);

	const filtered = search.trim()
		? transactions.filter((tx) => matches(tx, search.toLowerCase()))
		: transactions;

	/*
	 * ⚠️ Una sola espressione per DUE domande che devono restare la stessa: "la
	 * lista è filtrata?" (che decide il testo dello stato vuoto) e "c'è qualcosa
	 * da azzerare?" (che decide se mostrare il comando). Scritte due volte
	 * divergerebbero al primo filtro aggiunto — ed è esattamente ciò che è appena
	 * successo aggiungendo `categoria`.
	 *
	 * `periodo` di default è "30d", quindi NON conta come filtro: se contasse, la
	 * lista vuota di un utente nuovo direbbe "nessun movimento con questi filtri"
	 * invece di invitarlo ad aggiungerne il primo — cioè il difetto opposto.
	 */
	const hasFilters = Boolean(
		tipo || conto || categoria || search.trim() || periodo !== "30d",
	);

	return (
		<div className="flex flex-col flex-1 px-5 pt-8 pb-34 overflow-y-auto">
			<h1 className="text-2xl font-semibold mb-5">{t.transactions.title}</h1>
			<FilterBar
				search={search}
				tipo={tipo}
				periodo={periodo}
				conto={conto}
				categoria={categoria}
				accounts={accounts}
				categories={categories}
				onSearchChange={setSearch}
				onTipoChange={setTipo}
				onPeriodoChange={setPeriodo}
				onContoChange={setConto}
				onCategoriaChange={setCategoria}
				onReset={hasFilters ? resetFilters : undefined}
			/>
			<div className="mt-5">
				{budgets && <BudgetCards overview={budgets} />}
				{/*
					⚠️ I budget NON si filtrano per conto, e con un filtro attivo lo
					dicono. Sono limiti su una CATEGORIA: "€ 400 per la spesa" non si
					divide fra contanti e carta, quindi filtrarli inventerebbe budget
					per-conto che nessuno ha impostato. Nasconderli toglierebbe di
					vista i budget proprio a chi sta guardando le sue uscite. Resta la
					terza via, già usata due volte in questa fase: quando due numeri
					hanno ambiti diversi, si DICE.
				*/}
				{budgets && conto && (
					<p className="-mt-1 mb-4 ml-1 text-[11px] text-disabled leading-relaxed">
						{t.budget.acrossAllAccounts}
					</p>
				)}
				<TransactionList
					transactions={filtered}
					loading={loading}
					filtered={hasFilters}
					attachmentCounts={attachmentCounts}
					accounts={accounts}
					/*
						⚠️ `conto || null` e non `conto`: la stringa vuota significa
						"tutti i conti", e passata così com'è farebbe credere ad
						`amountSign()` che un conto sia selezionato. Nessun
						`to_account_id` è mai uguale a "", quindi il difetto non
						sarebbe esploso — avrebbe solo dato il segno sbagliato ai
						trasferimenti, che è precisamente il tipo di guasto che non si
						nota finché qualcuno non somma a mano.
					*/
					viewedAccountId={conto || null}
				/>

				{/*
					⚠️ Il pulsante compare solo se c'è davvero un'altra pagina, e
					`hasMore` arriva dal SERVER — che lo sa avendo chiesto una riga in
					più. Dedurlo dal client (`transactions.length % 50 === 0`) sarebbe
					giusto quasi sempre e falso proprio quando il totale è un multiplo
					esatto della pagina: un "carica altri" che non carica niente.

					⚠️ Nascosto anche mentre si CERCA: là non c'è paginazione — il
					periodo è caricato per intero — quindi un pulsante direbbe che
					esiste dell'altro da vedere mentre non è vero.
				*/}
				{/*
					⚠️ Cercando, `hasMore` NON significa "ci sono altri risultati": la
					ricerca filtra ciò che è stato caricato, e il tetto vale sulle righe
					SCANDITE, non sulle corrispondenze. Quindi la frase parla di quante
					ne ha guardate, non di quante ne ha trovate — dire "altri risultati"
					sarebbe falso proprio quando non ce n'è nemmeno uno.

					Senza questa riga il troncamento sarebbe SILENZIOSO: la pagina
					direbbe "nessun movimento" per una riga che esiste ed è solo oltre
					la finestra guardata.
				*/}
				{hasMore && searching && (
					<p className="mt-4 px-1 text-[11.5px] text-disabled leading-relaxed">
						{fill(t.transactions.searchScanLimit, { n: SEARCH_SCAN_LIMIT })}
					</p>
				)}

				{hasMore && !searching && (
					<button
						onClick={loadMore}
						disabled={loading}
						className="w-full mt-4 py-3 rounded-2xl bg-card border border-subtle text-sm font-medium text-secondary disabled:opacity-50"
					>
						{loading ? t.common.loading : t.transactions.loadMore}
					</button>
				)}
			</div>
		</div>
	);
}
