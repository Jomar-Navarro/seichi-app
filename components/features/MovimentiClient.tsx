"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getTransactions } from "@/app/(main)/action";
import { getMovimentiData } from "@/app/(main)/transazioni/actions";
import { SEARCH_SCAN_LIMIT, TRANSACTIONS_PAGE_SIZE } from "@/lib/transaction-utils";
import { getBudgetOverview } from "@/app/(main)/budget-actions";
import FilterBar from "@/components/features/Filterbar";
import TransactionList from "@/components/features/TransactionList";
import BudgetCards from "@/components/features/BudgetCards";
import LoadError from "@/components/UI/LoadError";
import { useUIStore } from "@/store/useUIStore";
import { useViewedAccount } from "@/components/features/ViewedAccount";
import { rememberAccount } from "@/lib/accounts";
import { clientClock } from "@/lib/dates";
import { useI18n } from "@/components/features/I18nProvider";
import { fill } from "@/lib/i18n/format";
import type { Account, BudgetOverview, Category, Transaction } from "@/types";

/** Quel poco che serve al filtro: vedi `getAccountOptions`. */
type AccountOption = Pick<Account, "id" | "name" | "archived">;

type Filters = { tipo: string; periodo: string; conto: string; categoria: string };

type FirstPage = {
	transactions: Transaction[];
	hasMore: boolean;
	attachmentCounts: Record<string, number>;
};

/*
 * ⚠️⚠️ La lista RICORDATA fra una visita e l'altra (#148).
 *
 * Chiesto usando l'app: ogni ingresso in Movimenti rifaceva il caricamento da
 * capo, con lo scheletro al posto della lista. Ora la prima pagina di ogni
 * combinazione di filtri resta in memoria, e rientrando si mostra SUBITO; nel
 * frattempo la si richiede comunque, e la risposta la sostituisce in silenzio.
 * È il "mostra ciò che sai, poi aggiorna" (stale-while-revalidate).
 *
 * ⚠️ **Si riaggiorna sempre, non ci si fida mai della copia.** I movimenti
 * cambiano anche dove questa pagina non lo sa: un import, il job notturno delle
 * ricorrenti, l'eliminazione di una categoria (che in cascata toglie i suoi
 * movimenti), un altro dispositivo. `transactionSavedAt` copre solo i
 * salvataggi del form: una copia mostrata senza riaggiornare sarebbe un
 * estratto conto vecchio presentato come attuale.
 *
 * ⚠️ **Vive nella memoria della SCHEDA, non nel disco.** Un ricaricamento o la
 * riapertura della PWA la svuotano: niente di finanziario resta sul
 * dispositivo oltre ciò che la pagina già mostra.
 *
 * ⚠️ **È legata all'UTENTE.** Un modulo client sopravvive alle navigazioni, e
 * un'uscita con un altro accesso nella stessa scheda è una navigazione: senza
 * la chiave dell'utente, il secondo vedrebbe per un istante i movimenti del
 * primo. Cambiando utente la copia si butta per intero.
 *
 * ⚠️ **Si scrive solo nel browser.** Questo modulo esiste anche sul server, per
 * il primo render, e lì una variabile di modulo è CONDIVISA fra tutte le
 * richieste di tutti gli utenti. Le scritture stanno in callback e risposte che
 * il server non esegue mai, e `isBrowser` lo rende esplicito.
 *
 * Solo la PRIMA pagina, e mai la ricerca: "carica altri" e i risultati di una
 * ricerca non si ricordano, rientrando si riparte dall'inizio.
 */
type Memory = {
	userId: string;
	/**
	 * ⚠️ Il `transactionSavedAt` per cui pagine e budget valgono. Dopo un
	 * cambiamento dei movimenti fatto nell'app — il form, l'eliminazione di un
	 * obiettivo coi suoi versamenti, un import o il suo annullamento, da
	 * qualunque pagina — si buttano: un movimento appena ELIMINATO ricomparirebbe
	 * per un istante dalla copia, prima dell'aggiornamento, e una barra di budget
	 * appena sforata tornerebbe verde. Con un movimento nuovo sarebbe solo un
	 * ritardo; con uno cancellato, un fantasma.
	 *
	 * Conti e categorie invece restano: servono a nominare i filtri, e un
	 * movimento salvato non li rinomina. Toglierli farebbe dire al chip "Tutti i
	 * conti" sopra una lista filtrata, finché non arriva la risposta.
	 */
	savedAt: number;
	pages: Map<string, FirstPage>;
	accounts: AccountOption[] | null;
	categories: Category[] | null;
	budgets: BudgetOverview | null;
};

let memory: Memory | null = null;
/** Combinazioni di filtri ricordate: le ultime, non tutte quelle mai provate. */
const MAX_PAGES = 8;
const isBrowser = typeof window !== "undefined";

const currentSavedAt = () => useUIStore.getState().transactionSavedAt;

/*
 * ⚠️ LETTURE senza effetti: si chiamano anche durante il render (gli
 * inizializzatori di `useState`), e un render scartato — StrictMode, rendering
 * concorrente — non deve poter cambiare la memoria condivisa. Ciò che è
 * scaduto qui si SALTA; lo butta via `memoryFor`, che gira solo in callback.
 */
function recall(userId: string): Memory | null {
	return memory && memory.userId === userId ? memory : null;
}

function isFresh(m: Memory) {
	return m.savedAt === currentSavedAt();
}

function recallPage(userId: string, key: string): FirstPage | undefined {
	const m = recall(userId);
	return m && isFresh(m) ? m.pages.get(key) : undefined;
}

function recallBudgets(userId: string): BudgetOverview | null {
	const m = recall(userId);
	return m && isFresh(m) ? m.budgets : null;
}

/** Per SCRIVERE: crea la memoria dell'utente, e butta ciò che un salvataggio ha reso vecchio. */
function memoryFor(userId: string): Memory | null {
	if (!isBrowser || !userId) return null;
	if (!memory || memory.userId !== userId) {
		memory = {
			userId,
			savedAt: currentSavedAt(),
			pages: new Map(),
			accounts: null,
			categories: null,
			budgets: null,
		};
	} else if (!isFresh(memory)) {
		memory.pages.clear();
		memory.budgets = null;
		memory.savedAt = currentSavedAt();
	}
	return memory;
}

function filtersKey(f: Filters) {
	return `${f.tipo}|${f.periodo}|${f.conto}|${f.categoria}`;
}

function rememberPage(userId: string, key: string, page: FirstPage, savedAt: number) {
	const m = memoryFor(userId);
	// Una risposta partita PRIMA di un salvataggio descrive lo stato di prima:
	// ricordarla rimetterebbe in memoria proprio il fantasma che `savedAt` toglie.
	if (!m || m.savedAt !== savedAt) return;
	// Rimessa in fondo, così l'ordine della Map è "dalla meno recente": quando si
	// supera il tetto esce la prima.
	m.pages.delete(key);
	m.pages.set(key, page);
	if (m.pages.size > MAX_PAGES) m.pages.delete(m.pages.keys().next().value!);
}

const DEFAULT_PERIODO = "30d";

export default function MovimentiClient({
	userId,
	initialConto,
	contoFromUrl,
}: {
	userId: string;
	/**
	 * Il conto con cui la pagina si apre (#148): quello scelto in home, letto dal
	 * server con `getSelectedAccount()` — `?conto=` è un'istruzione e vince, il
	 * cookie è una memoria. Letto UNA volta, al montaggio: dopo, il filtro è
	 * della pagina. Un `revalidatePath` dopo un salvataggio rende di nuovo il
	 * server component, e il valore nuovo non deve rimettere a posto un filtro
	 * che l'utente ha appena cambiato.
	 */
	initialConto: string;
	/** Da dove veniva `initialConto`: decide cosa fare se il conto non esiste più. */
	contoFromUrl: boolean;
}) {
	const { t } = useI18n();
	const [search, setSearch] = useState("");
	const [tipo, setTipo] = useState("");
	const [periodo, setPeriodo] = useState(DEFAULT_PERIODO);
	const [conto, setConto] = useState(initialConto);
	const [categoria, setCategoria] = useState("");

	// Il primo render parte dalla copia ricordata, se c'è: è ciò che toglie lo
	// scheletro rientrando. Su un caricamento completo della pagina la memoria è
	// vuota sia sul server sia nel browser, quindi i due render coincidono.
	const [initialPage] = useState(() =>
		recallPage(
			userId,
			filtersKey({ tipo: "", periodo: DEFAULT_PERIODO, conto: initialConto, categoria: "" }),
		),
	);
	const [transactions, setTransactions] = useState<Transaction[]>(initialPage?.transactions ?? []);
	const [hasMore, setHasMore] = useState(initialPage?.hasMore ?? false);
	const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>(
		initialPage?.attachmentCounts ?? {},
	);
	const [categories, setCategories] = useState<Category[]>(() => recall(userId)?.categories ?? []);
	const [accounts, setAccounts] = useState<AccountOption[]>(() => recall(userId)?.accounts ?? []);
	const [budgets, setBudgets] = useState<BudgetOverview | null>(() => recallBudgets(userId));
	const [loading, setLoading] = useState(!initialPage);
	/*
	 * ⚠️ A schermo c'è la copia e la sua versione aggiornata è in viaggio (#148).
	 * Non è `loading` — niente scheletro — ma "carica altri" va spento: la sua
	 * richiesta numerata scarterebbe per sempre quella dell'aggiornamento, e la
	 * pagina successiva, letta all'offset dei dati VERI, si appenderebbe a una
	 * prima pagina vecchia. Righe doppie o mancanti, trovato dalla review.
	 */
	const [refreshing, setRefreshing] = useState(Boolean(initialPage));
	/*
	 * ⚠️ Una lettura fallita NON è una lista vuota (#124).
	 * `page` = la prima pagina non è arrivata (al posto della lista c'è
	 * `LoadError`); `more` = "carica altri" non è arrivato (le righe già viste
	 * restano, e il bottone è il "riprova"); `refresh` = a schermo c'è la copia
	 * ricordata e il suo aggiornamento è fallito (#148): le righe restano, ma la
	 * pagina dice che potrebbero essere vecchie.
	 */
	const [loadError, setLoadError] = useState<"page" | "more" | "refresh" | null>(null);
	const transactionSavedAt = useUIStore((s) => s.transactionSavedAt);

	/*
	 * #112 — il filtro conto è anche il conto proposto a un nuovo movimento.
	 * Dalla #148 il filtro parte dal conto ricordato, quindi da Movimenti filtrata
	 * su Revolut il FAB propone Revolut, come dalla home.
	 */
	useViewedAccount(conto || null);

	/*
	 * ⚠️ CERCARE E SFOGLIARE sono due modi diversi di leggere la stessa lista, e
	 * la paginazione vale solo per il secondo.
	 *
	 * La ricerca filtra lato client (vedi `matches` più sotto) perché confronta
	 * anche il nome della CATEGORIA e quello del CONTO, che stanno su altre
	 * tabelle. Paginando e basta, cercherebbe dentro le sole righe già caricate:
	 * "nessun movimento" comparirebbe mentre la riga cercata sta nella pagina
	 * successiva — un risultato **falso che sembra vero** (17a).
	 *
	 * ⚠️ "In un colpo solo" NON vuol dire "senza limite": vale
	 * `SEARCH_SCAN_LIMIT`, perché **PostgREST un limite ce l'ha comunque** (Max
	 * rows = 1000) e lo applica **in silenzio**.
	 *
	 * ⚠️ La dipendenza è il BOOLEANO `searching`, non il testo: con `search` fra
	 * le dipendenze ogni tasto sarebbe una richiesta.
	 */
	const searching = search.trim().length > 0;

	/*
	 * ⚠️ `requestId`: solo l'ULTIMA richiesta numerata scrive lo stato (#122).
	 * Oggi Next spedisce le server action una alla volta, quindi le risposte
	 * arrivano in ordine; ma la documentazione lo chiama "un dettaglio
	 * d'implementazione che può cambiare", e una lista che mostra un altro filtro
	 * è il difetto che non deve dipendere da lui.
	 */
	const requestId = useRef(0);

	/*
	 * Per quale `transactionSavedAt` conti e categorie del filtro sono già
	 * arrivati. Diverso dall'attuale = vanno chiesti insieme ai movimenti
	 * (all'apertura, e dopo un salvataggio, che può averne creati di nuovi).
	 * Si aggiorna solo a risposta ARRIVATA: una richiesta superata da un cambio
	 * di filtro non li ha consegnati, e la successiva deve chiederli lei.
	 */
	const optionsLoadedFor = useRef<number | null>(null);

	const loadPage = useCallback(
		async (offset: number, append: boolean, withOptions = false) => {
			const myRequest = ++requestId.current;
			const savedAtAtStart = currentSavedAt();
			const filters: Filters = { tipo, periodo, conto, categoria };
			const key = filtersKey(filters);
			const remembered = !append && !searching ? recallPage(userId, key) : undefined;

			// Con la copia a schermo l'aggiornamento è SILENZIOSO: niente
			// scheletro, che toglierebbe proprio ciò che la copia esiste per dare.
			if (remembered) {
				setTransactions(remembered.transactions);
				setHasMore(remembered.hasMore);
				setAttachmentCounts(remembered.attachmentCounts);
				setLoading(false);
			} else {
				setLoading(true);
			}
			setRefreshing(Boolean(remembered));
			setLoadError(null);

			/*
			 * Un fallimento, detto in tre modi secondo ciò che c'è a schermo. Uno
			 * solo per il ramo `{ error }` e per l'eccezione: scritto due volte
			 * divergerebbe alla prima modifica (review della #148).
			 *
			 * `hasMore` resta com'era SOLO dopo un "carica altri" fallito: là il
			 * bottone È il comando per riprovare. Su una prima pagina fallita si
			 * azzera, o la riga "la ricerca ha guardato N movimenti" del filtro
			 * precedente resterebbe sotto l'errore (review della #124).
			 */
			const fail = () => {
				if (append) setLoadError("more");
				else if (remembered) setLoadError("refresh");
				else {
					setTransactions([]);
					setHasMore(false);
					setLoadError("page");
				}
			};

			const limit = searching ? SEARCH_SCAN_LIMIT : TRANSACTIONS_PAGE_SIZE;
			const query = {
				tipo: tipo || undefined,
				periodo,
				conto: conto || undefined,
				categoria: categoria || undefined,
			};

			// Il conto sconosciuto riparte da solo con `conto` vuoto: fino ad allora
			// la lista resta in caricamento, invece di passare per un fotogramma di
			// "nessun movimento" fra le due richieste.
			let restarting = false;
			try {
				let result: Awaited<ReturnType<typeof getTransactions>>;
				if (withOptions && offset === 0) {
					const data = await getMovimentiData({ ...query, limit });
					if (myRequest !== requestId.current) return;

					if (data.accounts) {
						setAccounts(data.accounts);
						const m = memoryFor(userId);
						if (m) m.accounts = data.accounts;
					}
					if (data.categories) {
						setCategories(data.categories);
						const m = memoryFor(userId);
						if (m) m.categories = data.categories;
					}
					// ⚠️ Solo se sono arrivati ENTRAMBI: altrimenti "Riprova" non li
					// chiederebbe più, fino al prossimo salvataggio (review della #148).
					if (data.accounts && data.categories) optionsLoadedFor.current = currentSavedAt();

					/*
					 * ⚠️ Un conto filtrato che non si sa NOMINARE: i conti non sono
					 * arrivati e non ce n'è una copia. Il chip direbbe "Tutti i conti"
					 * sopra una lista filtrata sul conto ricordato — la contraddizione
					 * etichetta/dati che questa pagina esiste per evitare. Meglio dire
					 * che la pagina non si è caricata, col suo "Riprova", che ora
					 * richiede anche i conti. Trovato dalla review.
					 */
					if (conto && !data.accounts && !recall(userId)?.accounts) {
						fail();
						return;
					}

					/*
					 * ⚠️ Il conto non è fra quelli dell'utente: la lista è vuota per la
					 * RLS e il chip, non trovandone il nome, direbbe "Tutti i conti".
					 * Si torna davvero su tutti, e la richiesta riparte da sola perché
					 * `conto` cambia. La memoria si dimentica solo se il conto veniva da
					 * LEI: un `?conto=` sbagliato è un'istruzione di quella pagina, e
					 * non deve cancellare la scelta fatta in home.
					 */
					if (data.contoUnknown) {
						if (!contoFromUrl) rememberAccount(null);
						restarting = true;
						setConto("");
						return;
					}
					result = data.transactions;
				} else {
					result = await getTransactions({
						...query,
						limit,
						offset,
						withAttachmentCounts: true,
					});
					if (myRequest !== requestId.current) return; // superata da una richiesta più recente
				}

				if ("error" in result) {
					fail();
					return;
				}

				const rows = (result.data as Transaction[]) ?? [];
				const counts = ("attachmentCounts" in result && result.attachmentCounts) || {};
				setTransactions((prev) => (append ? [...prev, ...rows] : rows));
				setHasMore(result.hasMore);
				setAttachmentCounts((prev) => (append ? { ...prev, ...counts } : counts));
				if (!append && !searching) {
					rememberPage(
						userId,
						key,
						{ transactions: rows, hasMore: result.hasMore, attachmentCounts: counts },
						savedAtAtStart,
					);
				}
			} catch (e) {
				// L'azione ha SOLLEVATO invece di restituire `{ error }`: stesso ramo.
				if (myRequest !== requestId.current) return;
				console.error("[movimenti] lettura:", e);
				fail();
			} finally {
				if (myRequest === requestId.current && !restarting) {
					setLoading(false);
					setRefreshing(false);
				}
			}
		},
		[userId, contoFromUrl, tipo, periodo, conto, categoria, searching],
	);

	/*
	 * ⚠️ L'offset è `transactions.length`, non un contatore di pagina: un secondo
	 * stato che dice la stessa cosa del primo divergerebbe al primo caso non
	 * previsto.
	 */
	const loadMore = useCallback(
		() => loadPage(transactions.length, true),
		[loadPage, transactions.length],
	);

	/** Rifà la prima pagina, e con lei i dati dei filtri se non sono ancora arrivati. */
	const reload = useCallback(
		() => loadPage(0, false, optionsLoadedFor.current !== transactionSavedAt),
		[loadPage, transactionSavedAt],
	);

	/*
	 * Conto scelto nella barra filtri = conto scelto per tutta l'app (#148,
	 * deciso il 2026-11-03): scrive la stessa memoria del selettore della home, e
	 * "Tutti i conti" la cancella. Due memorie per la stessa domanda — "quale
	 * conto sto guardando" — direbbero cose diverse in pagine diverse.
	 */
	const changeConto = useCallback((v: string) => {
		setConto(v);
		rememberAccount(v || null);
	}, []);

	/**
	 * Torna allo stato iniziale in un gesto solo.
	 *
	 * ⚠️ `periodo` torna a "30d" e non a "tutto": il default della pagina non è
	 * "nessun filtro", è "l'ultimo mese". E il conto torna su TUTTI e si
	 * dimentica, come scegliendo "Tutti i conti" (#148): azzerare in Movimenti e
	 * ritrovarsi la home ancora filtrata contraddirebbe la memoria unica.
	 */
	const resetFilters = useCallback(() => {
		setSearch("");
		setTipo("");
		setPeriodo(DEFAULT_PERIODO);
		changeConto("");
		setCategoria("");
	}, [changeConto]);

	/*
	 * Ogni cambio di filtro riparte dalla PRIMA pagina: `loadPage` è memoizzata
	 * sui filtri, quindi cambia identità esattamente quando serve ricominciare —
	 * e `transactionSavedAt` la rifà anche dopo un salvataggio, perché il
	 * movimento appena scritto va in cima. Conti e categorie viaggiano nella
	 * stessa richiesta solo quando servono (`reload`).
	 */
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => { reload(); }, [reload]);

	/*
	 * I budget guardano sempre il periodo corrente e NON dipendono dai filtri.
	 * Si aggiornano all'ingresso e dopo un salvataggio, e partono DOPO la
	 * richiesta della lista: Next spedisce le server action in fila, e la lista
	 * non deve aspettare la lettura più pesante della pagina. Anche loro si
	 * ricordano (#148), e anche loro si riaggiornano comunque.
	 */
	useEffect(() => {
		let cancelled = false;
		getBudgetOverview(clientClock())
			.then((res) => {
				if (cancelled) return;
				const data = "data" in res ? res.data : null;
				setBudgets(data);
				const m = memoryFor(userId);
				if (m) m.budgets = data;
			})
			.catch((e) => console.error("[movimenti] budget:", e));
		return () => { cancelled = true; };
	}, [transactionSavedAt, userId]);

	/*
	 * ⚠️ La ricerca guarda anche i NOMI DEI CONTI (20b): cercando "Revolut" la
	 * riga "Corrente → Revolut" di un trasferimento, che non ha categoria, deve
	 * comparire.
	 */
	const accountNames = new Map(accounts.map((a) => [a.id, a.name.toLowerCase()]));
	const matches = (tx: Transaction, needle: string) =>
		tx.categories?.name.toLowerCase().includes(needle) ||
		tx.notes?.toLowerCase().includes(needle) ||
		accountNames.get(tx.account_id)?.includes(needle) ||
		(tx.to_account_id ? accountNames.get(tx.to_account_id)?.includes(needle) : false);

	// ⚠️ L'ago è il testo SENZA spazi ai lati (#122): il suggerimento della
	// tastiera di iOS aggiunge uno spazio dopo la parola.
	const needle = search.trim().toLowerCase();
	const filtered = needle
		? transactions.filter((tx) => matches(tx, needle))
		: transactions;

	/*
	 * ⚠️ Una sola espressione per DUE domande che devono restare la stessa: "la
	 * lista è filtrata?" e "c'è qualcosa da azzerare?". `periodo` di default è
	 * "30d", quindi NON conta come filtro. Il conto ricordato invece sì: la lista
	 * È filtrata, e "Azzera" deve poterlo togliere.
	 */
	const hasFilters = Boolean(
		tipo || conto || categoria || search.trim() || periodo !== DEFAULT_PERIODO,
	);

	// issue #86 — l'unica pagina di `(main)` che scorre su un contenitore
	// INTERNO invece che sul documento: `scrollbar-none` sull'`<html>` non la
	// raggiunge, va ripetuta qui. Da `lg:` la pagina è LARGA (`max-w-6xl`, #108).
	return (
		<div className="flex flex-col flex-1 px-5 pt-8 pb-34 overflow-y-auto scrollbar-none lg:px-10 lg:pt-9 lg:pb-12 lg:max-w-6xl lg:mx-auto lg:w-full">
			<h1 className="text-2xl font-semibold mb-5 lg:text-[30px] lg:tracking-[-0.6px]">
				{t.transactions.title}
			</h1>
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
				onContoChange={changeConto}
				onCategoriaChange={setCategoria}
				onReset={hasFilters ? resetFilters : undefined}
			/>
			<div className="mt-5">
				{budgets && <BudgetCards overview={budgets} accountFiltered={Boolean(conto)} />}

				{loadError === "refresh" && (
					<div role="alert" className="mb-3 flex items-center gap-3 px-1">
						<p className="flex-1 text-[11.5px] leading-snug text-aka-ink">
							{t.transactions.refreshFailed}
						</p>
						<button
							type="button"
							onClick={reload}
							// issue #69 — almeno 44px di altezza.
							className="shrink-0 min-h-11 px-4 rounded-full text-[12.5px] font-medium bg-surface card-shadow-ring text-secondary active:opacity-80 cursor-pointer"
						>
							{t.common.retry}
						</button>
					</div>
				)}

				{loadError === "page" ? (
					<LoadError message={t.transactions.loadError} onRetry={reload} />
				) : (
					<TransactionList
						transactions={filtered}
						loading={loading}
						filtered={hasFilters}
						attachmentCounts={attachmentCounts}
						accounts={accounts}
						/*
							⚠️ `conto || null` e non `conto`: la stringa vuota significa
							"tutti i conti", e passata così com'è farebbe credere ad
							`amountSign()` che un conto sia selezionato.
						*/
						viewedAccountId={conto || null}
					/>
				)}

				{/*
					⚠️ Cercando, `hasMore` NON significa "ci sono altri risultati": il
					tetto vale sulle righe SCANDITE, non sulle corrispondenze. Senza
					questa riga il troncamento sarebbe SILENZIOSO.
				*/}
				{hasMore && searching && (
					<p className="mt-4 px-1 text-[11.5px] text-disabled leading-relaxed">
						{fill(t.transactions.searchScanLimit, { n: SEARCH_SCAN_LIMIT })}
					</p>
				)}

				{loadError === "more" && (
					<p role="alert" className="mt-4 px-1 text-[11.5px] leading-snug text-aka-ink">
						{t.transactions.loadError}
					</p>
				)}

				{/*
					⚠️ `hasMore` arriva dal SERVER, che lo sa avendo chiesto una riga in
					più: dedurlo dal client sarebbe falso proprio quando il totale è un
					multiplo esatto della pagina. Nascosto mentre si cerca, dove non c'è
					paginazione.
				*/}
				{hasMore && !searching && loadError !== "page" && (
					<button
						onClick={loadMore}
						disabled={loading || refreshing}
						className="w-full mt-4 py-3 rounded-2xl bg-card ring-border text-sm font-medium text-secondary disabled:opacity-50"
					>
						{loading ? t.common.loading : t.transactions.loadMore}
					</button>
				)}
			</div>
		</div>
	);
}
