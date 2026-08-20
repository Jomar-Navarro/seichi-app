import type { TransactionTypeId } from "@/types";

/**
 * I profili di lettura. Il valore finisce in `imports.source` ed è vincolato da
 * `imports_source_check`, quindi è un dato: resta in italiano come ogni altra
 * chiave scritta nel database.
 */
export type ImportSource = "trade_republic" | "generico";

/**
 * La direzione di un movimento **rispetto al conto del file**.
 *
 * ⚠️ Non è ridondante con `TransactionTypeId`, e tenerla separata è ciò che
 * impedisce l'errore peggiore di questo import: proporre `entrata` per una riga
 * che toglie denaro. In Seichi l'importo è sempre positivo e il segno lo decide
 * il tipo (`amountSign()`), quindi una classificazione sbagliata non produce un
 * numero negativo che salta all'occhio — produce un movimento perfettamente
 * formato che punta dalla parte sbagliata.
 */
export type Direction = "uscita" | "entrata";

/**
 * Cosa diventa un gruppo di righe. `ignora` non è un tipo di transazione: è la
 * decisione di non scrivere niente, e vive qui perché per l'utente è una scelta
 * come le altre.
 */
export type GroupTarget = TransactionTypeId | "ignora";

/**
 * Le famiglie di righe che un profilo sa riconoscere.
 *
 * ⚠️ Sono CHIAVI, non etichette: le parole stanno in `t.import.groups[kind]`,
 * come per `BUDGET_PERIODS`, `FREQUENCIES` e ogni altro modulo di `lib/` dopo la
 * Fase 19. Il dato che accompagna l'etichetta — il nome dell'esercente, l'IBAN
 * della controparte — viaggia a parte in `detail`, perché quello viene dal file
 * e non si traduce.
 */
export type GroupKind =
	| "acquisti"
	| "vendite"
	| "interessi"
	| "dividendi"
	| "regalo"
	| "carta"
	| "imposte"
	| "trasferimentoIn"
	| "trasferimentoOut"
	| "senzaCassa"
	| "movimenti"
	| "altro";

/** Una riga del file, già normalizzata e indipendente dal profilo. */
export interface ParsedRow {
	/**
	 * La chiave di deduplica, già prefissata con la sorgente.
	 *
	 * Per Trade Republic è `trade_republic:<transaction_id>`, cioè una chiave
	 * NATURALE presa dal file. Per il profilo generico è composta, e porta un
	 * contatore di occorrenza — vedi `lib/import/generic.ts`.
	 */
	key: string;
	/** `YYYY-MM-DD`. La data di REGISTRAZIONE contabile, non quella di esecuzione. */
	date: string;
	/**
	 * ⚠️ SEMPRE POSITIVO. Il segno è in `direction`, perché è così che lo tiene
	 * anche il database: `transactions.amount` è positivo e a decidere il segno
	 * mostrato è il tipo.
	 */
	amount: number;
	direction: Direction;
	/** Finisce in `transactions.notes`, troncato a 255 dalla funzione SQL. */
	description: string;
	/** Il gruppo di decisione a cui appartiene. */
	groupId: string;
	/** Suggerimento per `transactions.investment_type`, solo sui gruppi acquisti. */
	investmentType: string | null;
}

/**
 * Un insieme di righe che si decidono INSIEME.
 *
 * ⚠️ È la differenza principale rispetto al mockup, che faceva categorizzare riga
 * per riga. Un estratto Trade Republic di tre anni ha circa duecento righe e una
 * quindicina di decisioni: tutti gli acquisti sono investimenti, tutti gli
 * interessi sono entrate, tutti i bonifici da un certo IBAN vengono dallo stesso
 * conto. Chiedere duecento volte ciò che si decide quindici volte non è
 * scrupolo, è il modo più affidabile di far abbandonare l'import a metà.
 */
export interface ParsedGroup {
	id: string;
	kind: GroupKind;
	/** Il dato che qualifica il gruppo: esercente, IBAN, nome della controparte. */
	detail: string | null;
	/**
	 * ⚠️ La direzione fa parte dell'IDENTITÀ del gruppo, non è un attributo.
	 * `TAX_OPTIMIZATION` compare sia in addebito (il bollo) sia in accredito (lo
	 * storno del bollo): raccolti insieme, una decisione sola dovrebbe valere per
	 * righe che vanno in versi opposti. Separati, ognuno ha la propria.
	 */
	direction: Direction;
	count: number;
	/** Somma degli importi del gruppo, positiva. */
	total: number;
	/**
	 * `null` = **da decidere**, e l'utente non può proseguire finché non sceglie.
	 *
	 * ⚠️ Nasce per le vendite Trade Republic, che fino alla #52 **non avevano una
	 * proposta possibile**: Seichi non aveva un tipo per il disinvestimento, e le
	 * due scorciatoie sbagliavano in versi opposti — `entrata` gonfiava il Flusso
	 * di quei mesi, `ignora` lasciava il saldo del conto sbagliato di centinaia di
	 * euro. Fra due modi sbagliati la scelta non era dell'app.
	 *
	 * Dalla #52 quel tipo esiste e le vendite una proposta ce l'hanno. Lo stato
	 * `null` RESTA, e non è un residuo: serve al gruppo `altro` — i movimenti che
	 * il profilo non sa classificare — dove nessuna proposta è ancora possibile.
	 * Toglierlo significherebbe inventare un bersaglio per righe che non si sono
	 * capite, cioè il difetto che questo campo esiste per impedire.
	 */
	suggested: GroupTarget | null;
	/** I bersagli ammessi, coerenti con la direzione. */
	allowed: GroupTarget[];
	/**
	 * ⚠️ Nessun `investmentType` qui, ed è deliberato: sta sulla RIGA. Trade
	 * Republic dichiara `asset_class` movimento per movimento, quindi un unico
	 * valore di gruppo appiattirebbe crypto, azioni ed ETF su qualunque cosa
	 * capitasse per prima — e la pagina `/investimenti` si regge esattamente su
	 * quella distinzione. Un campo di gruppo esisterebbe solo per essere
	 * scavalcato da quello di riga, cioè sarebbe codice morto.
	 */
	/** Chiave in `t.import.notes`: perché questo gruppo va guardato. */
	noteKey: string | null;
	/** Il gruppo non è modificabile (righe senza movimento di cassa). */
	locked: boolean;
}

/** Cosa restituisce un profilo dopo aver letto il file. */
export interface ParseResult {
	source: ImportSource;
	rows: ParsedRow[];
	groups: ParsedGroup[];
	/**
	 * Righe che il profilo non ha saputo leggere — data illeggibile, importo
	 * assente dove serviva.
	 *
	 * ⚠️ Contate e mostrate, mai scartate in silenzio. Un import che dice "42
	 * importate" mentre il file ne aveva 45 sta nascondendo tre righe, e chi
	 * legge non ha modo di sapere che esistevano.
	 */
	unreadable: number;
}

/**
 * La decisione dell'utente su un gruppo, che torna dal client alla server action.
 *
 * ⚠️ Il client manda **decisioni, non righe**. È deliberato: le righe le rilegge
 * il server dal file, così ciò che viene scritto nel database non dipende da un
 * payload che il browser potrebbe aver alterato. Il client sceglie il
 * significato, il server tiene i fatti.
 */
export interface GroupDecision {
	groupId: string;
	target: GroupTarget;
	/** Per i tipi che ammettono una categoria. `null` = nessuna. */
	categoryId: string | null;
	/** Per `trasferimento`: l'altro capo. Obbligatorio, lo impone il database. */
	counterpartAccountId: string | null;
}

/**
 * L'esito di un import.
 *
 * ⚠️ Vive qui e non accanto alla server action che lo produce: un modulo
 * `"use server"` può esportare solo funzioni asincrone, e un tipo esportato da
 * lì è una riga che oggi funziona perché il compilatore la cancella. Meglio non
 * dipendere da quella cancellazione.
 */
/**
 * Un import già eseguito, per l'elenco da cui si annulla.
 *
 * ⚠️ Questo elenco esiste perché il primo disegno non ce l'aveva, e la mancanza
 * è costata un import sbagliato da 216 righe. L'annullamento viveva **solo**
 * nello stato del componente, sulla schermata finale: uscendo da lì la riga di
 * `imports` non era più raggiungibile da nessuna parte dell'app, e restava solo
 * il SQL Editor. Progettare il lotto per rendere l'import reversibile e poi dare
 * al comando la vita di una schermata è metà del lavoro — la parte che si vede
 * solo usando l'app.
 */
export interface ImportSummary {
	id: string;
	filename: string;
	source: ImportSource;
	accountId: string;
	createdAt: string;
	/** Righe ANCORA presenti: si conta da `transactions`, non da una colonna. */
	rows: number;
}

export interface ImportOutcome {
	importId: string | null;
	/** Scritte davvero. */
	imported: number;
	/** Già presenti da un import precedente: la deduplica le ha saltate. */
	skipped: number;
	/** Righe dei gruppi marcati "ignora". */
	ignored: number;
	/** Righe che il profilo non ha saputo leggere. */
	unreadable: number;
}
