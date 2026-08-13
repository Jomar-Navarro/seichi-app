import { parseAmount, parseDate, repairMojibake } from "./csv";
import type { Direction, GroupKind, GroupTarget, ParseResult, ParsedGroup, ParsedRow } from "./types";

/**
 * Il profilo di lettura per l'export di Trade Republic generato da `pytr`.
 *
 * ⚠️ Scritto leggendo un export VERO, non la documentazione: la regola già
 * pagata due volte da questo progetto — *una migration che indovina è peggio di
 * una che manca* — vale identica per un parser. Quasi tutto ciò che segue
 * esisterebbe in una forma sbagliata se le colonne fossero state dedotte.
 *
 * ## Le quattro cose che il file insegna e che nessuna documentazione dice
 *
 * 1. **`amount` non è il movimento di cassa.** Su un acquisto vale il
 *    controvalore e la commissione sta a parte (`amount −24,97`, `fee −1,00`:
 *    dal conto escono 25,97). Su una vendita c'è anche `tax`. Importando il solo
 *    `amount` il saldo del conto deriva dalla realtà per la somma di tutte le
 *    commissioni, sempre nella stessa direzione e senza alcun segnale.
 * 2. **La colonna che contiene la cassa cambia con il tipo di riga.**
 *    `TAX_OPTIMIZATION` (il bollo) ha `amount = 0` e il movimento in `tax`.
 * 3. **Alcune righe non sono movimenti.** `MIGRATION` (trasloco di custodia, a
 *    coppie `−n` / `+n`) e `FREE_RECEIPT` hanno gli importi VUOTI.
 * 4. **`counterparty_iban` è popolata solo sulle righe recenti.** Sulle altre
 *    l'IBAN sta dentro il testo libero, o non c'è affatto.
 *
 * I primi tre si risolvono con una regola sola — `netto = amount + fee + tax`,
 * e **netto zero significa nessun movimento di cassa** — invece che con tre rami
 * speciali da ricordare. La conferma che sia quella giusta la dà il file: il
 * versamento del 07/03/2024 ha `amount 201,40` e `fee −1,40`, cioè **200,00
 * tondi**. Un numero rotondo che esce dall'aritmetica non è una coincidenza.
 *
 * ⚠️ **`mcc_code` NON viene usato**, benché sia un ottimo indizio di categoria
 * (`5411` alimentari, `5812` ristorazione, `4131` autobus). Manca il pezzo che
 * lo renderebbe utile: le categorie sono dati dell'utente, con nomi liberi, e
 * non esiste una corrispondenza fra un codice ISO e "Spesa alimentare" senza un
 * accoppiamento fuzzy sui nomi. Meglio non leggerlo che leggerlo per proporre
 * la categoria sbagliata — sta scritto qui perché la prossima persona non lo
 * riscopra come una dimenticanza.
 */

/** Le colonne senza le quali il file non è un export Trade Republic. */
const REQUIRED = ["date", "type", "amount", "transaction_id"] as const;

/** Le altre che il profilo legge se ci sono. Un `pytr` più vecchio può non averle. */
const OPTIONAL = [
	"datetime",
	"category",
	"asset_class",
	"name",
	"fee",
	"tax",
	"description",
	"counterparty_name",
	"counterparty_iban",
	"payment_reference",
] as const;

/**
 * L'intestazione è di Trade Republic?
 *
 * Il riconoscimento è ciò che permette al passo di mappatura colonne di NON
 * comparire: se il file si annuncia da solo, chiedere all'utente quale colonna
 * è l'importo sarebbe una domanda di cui conosciamo già la risposta.
 */
export function isTradeRepublic(header: string[]): boolean {
	const names = new Set(header.map((h) => h.trim().toLowerCase()));
	// `asset_class` non è fra le richieste ma entra qui: è la colonna che
	// distingue un export di broker da un estratto conto qualsiasi, e senza di
	// lei un CSV bancario con una colonna `type` potrebbe passare per TR.
	return REQUIRED.every((c) => names.has(c)) && names.has("asset_class");
}

/** `crypto` / `azioni` / `etf` sono i valori di `transactions.investment_type`. */
const ASSET_CLASS: Record<string, string> = {
	CRYPTO: "crypto",
	STOCK: "azioni",
	FUND: "etf",
};

/**
 * ⚠️ Un ETF obbligazionario è `FUND` per Trade Republic e `obbligazioni` per
 * Seichi — `Xtrackers II Eurozone Government Bond` finisce quindi fra gli ETF.
 * Non è correggibile dal file: `asset_class` non distingue azionario da
 * obbligazionario, e indovinarlo dal nome sarebbe indovinare. Si corregge dopo,
 * sul singolo movimento, come qualsiasi altro dato inserito a mano.
 */
const ASSET_FALLBACK = "altro";

/** A quale famiglia appartiene un tipo Trade Republic. */
const KIND_BY_TYPE: Record<string, GroupKind> = {
	BUY: "acquisti",
	SELL: "vendite",
	INTEREST_PAYMENT: "interessi",
	DIVIDEND: "dividendi",
	STOCKPERK: "regalo",
	CARD_TRANSACTION: "carta",
	TAX_OPTIMIZATION: "imposte",
	TRANSFER_INSTANT_INBOUND: "trasferimentoIn",
	CUSTOMER_INBOUND: "trasferimentoIn",
	CUSTOMER_INPAYMENT: "trasferimentoIn",
	TRANSFER_INSTANT_OUTBOUND: "trasferimentoOut",
	CUSTOMER_OUTBOUND_REQUEST: "trasferimentoOut",
	MIGRATION: "senzaCassa",
	FREE_RECEIPT: "senzaCassa",
};

/**
 * Cosa proporre per ogni famiglia, e cosa lasciar scegliere.
 *
 * ⚠️ `vendite` propone `null`, cioè **niente**. Vedi issue #52: Seichi non ha un
 * tipo per il disinvestimento, e le due scorciatoie disponibili sbagliano in
 * direzioni opposte — `entrata` gonfia il Flusso di quel mese affermando un
 * guadagno che non c'è stato, `ignora` lascia il saldo del conto sbagliato del
 * ricavo. Fra due modi sbagliati non decide l'app.
 */
/**
 * Un bersaglio è compatibile con la direzione della riga?
 *
 * ⚠️ Il filtro si applica a TUTTI i rami, e la prima versione lo faceva solo in
 * quello generico. `vendite` proponeva `entrata` per definizione — vero quasi
 * sempre, falso quando le commissioni superano il ricavo (una vendita da pochi
 * euro con 1 € di commissione e la tassa): quella riga toglie denaro dal conto e
 * l'unica scelta offerta ne registrava l'ingresso. Nessun vincolo del database
 * l'avrebbe intercettata — l'importo in Seichi è sempre positivo, quindi la riga
 * sarebbe stata perfettamente formata e rivolta dalla parte sbagliata.
 *
 * È esattamente il difetto che il tipo `Direction` è stato introdotto per
 * rendere impossibile, sopravvissuto dentro le due eccezioni scritte a mano.
 */
function fits(target: GroupTarget, direction: Direction): boolean {
	if (target === "ignora" || target === "trasferimento") return true;
	return direction === "entrata" ? target === "entrata" : target !== "entrata";
}

function targetsFor(
	kind: GroupKind,
	direction: Direction,
): { suggested: GroupTarget | null; allowed: GroupTarget[]; noteKey: string | null } {
	const narrow = (r: {
		suggested: GroupTarget | null;
		allowed: GroupTarget[];
		noteKey: string | null;
	}) => {
		const allowed = r.allowed.filter((a) => fits(a, direction));
		return {
			...r,
			allowed,
			// Una proposta che non sopravvive al filtro non è una proposta: meglio
			// chiedere che suggerire qualcosa di incompatibile con la riga.
			suggested: r.suggested !== null && allowed.includes(r.suggested) ? r.suggested : null,
		};
	};

	if (kind === "senzaCassa") {
		return { suggested: "ignora", allowed: ["ignora"], noteKey: "senzaCassa" };
	}

	if (kind === "vendite") {
		return narrow({
			suggested: null,
			allowed: ["entrata", "spesa", "ignora"],
			noteKey: "vendite",
		});
	}

	if (kind === "trasferimentoIn" || kind === "trasferimentoOut") {
		return narrow({
			suggested: "trasferimento",
			allowed: ["trasferimento", "entrata", "spesa", "risparmio", "investimento", "ignora"],
			noteKey: "trasferimento",
		});
	}

	if (kind === "acquisti") {
		return narrow({
			suggested: "investimento",
			allowed: ["investimento", "risparmio", "spesa", "entrata", "ignora"],
			noteKey: null,
		});
	}

	return narrow({
		suggested: kind === "altro" ? null : direction === "entrata" ? "entrata" : "spesa",
		allowed: [
			"entrata",
			"spesa",
			"abbonamento",
			"investimento",
			"risparmio",
			"trasferimento",
			"ignora",
		],
		noteKey: kind === "altro" ? "altro" : null,
	});
}

const IBAN_RE = /\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/;

/** Due decimali, o `201.40 + (-1.40)` vale `200.00000000000003`. */
function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

export function parseTradeRepublic(rows: string[][]): ParseResult {
	const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
	const index = new Map<string, number>();
	for (const name of [...REQUIRED, ...OPTIONAL]) {
		const i = header.indexOf(name);
		if (i >= 0) index.set(name, i);
	}

	const parsed: ParsedRow[] = [];
	const groups = new Map<string, ParsedGroup>();
	let unreadable = 0;

	for (let r = 1; r < rows.length; r++) {
		const row = rows[r];
		const get = (name: string): string => {
			const i = index.get(name);
			return i === undefined ? "" : (row[i] ?? "").trim();
		};

		const trType = get("type").toUpperCase();
		const date = parseDate(get("date")) ?? parseDate(get("datetime"));
		const id = get("transaction_id");

		// Senza data o senza identità la riga non è scrivibile: la prima
		// finirebbe a `now()`, la seconda non sarebbe deduplicabile e a ogni
		// reimport si moltiplicherebbe.
		if (!date || !id) {
			unreadable++;
			continue;
		}

		const net = round2(
			(parseAmount(get("amount")) ?? 0) +
				(parseAmount(get("fee")) ?? 0) +
				(parseAmount(get("tax")) ?? 0),
		);

		const kind: GroupKind = net === 0 ? "senzaCassa" : (KIND_BY_TYPE[trType] ?? "altro");
		const direction: Direction = net > 0 ? "entrata" : "uscita";

		// Il dato che qualifica il gruppo. Per una carta è l'esercente — è ciò
		// che rende sensato decidere "tutti i PAM sono spesa alimentare". Per un
		// trasferimento è la controparte, cercata prima nella sua colonna e poi
		// nel testo libero, perché sulle righe più vecchie sta solo lì.
		let detail: string | null = null;
		if (kind === "carta") {
			detail = repairMojibake(get("name")) || null;
		} else if (kind === "trasferimentoIn" || kind === "trasferimentoOut") {
			detail =
				get("counterparty_iban") ||
				IBAN_RE.exec(get("description"))?.[1] ||
				IBAN_RE.exec(get("payment_reference"))?.[1] ||
				get("counterparty_name") ||
				null;
		}

		const groupId = `${kind}|${direction}|${detail ?? ""}`;

		const name = repairMojibake(get("name"));
		const description = repairMojibake(get("description"));
		// Per una carta e per un trade il nome è il dato leggibile (l'esercente,
		// il titolo); altrove è il testo libero a dire cosa è successo.
		const text =
			kind === "carta" || kind === "acquisti" || kind === "vendite"
				? name || description
				: description || name;

		parsed.push({
			key: `trade_republic:${id}`,
			date,
			amount: Math.abs(net),
			direction,
			description: text || trType,
			groupId,
			investmentType: get("asset_class")
				? (ASSET_CLASS[get("asset_class").toUpperCase()] ?? ASSET_FALLBACK)
				: null,
		});

		const existing = groups.get(groupId);
		if (existing) {
			existing.count++;
			existing.total = round2(existing.total + Math.abs(net));
		} else {
			const { suggested, allowed, noteKey } = targetsFor(kind, direction);
			groups.set(groupId, {
				id: groupId,
				kind,
				detail,
				direction,
				count: 1,
				total: Math.abs(net),
				suggested,
				allowed,
				noteKey,
				locked: kind === "senzaCassa",
			});
		}
	}

	return {
		source: "trade_republic",
		rows: parsed,
		groups: sortGroups([...groups.values()]),
		unreadable,
	};
}

/**
 * Da decidere in cima, ignorati in fondo, il resto per peso.
 *
 * ⚠️ L'ordine è funzionale: in cima vanno i gruppi che IMPEDISCONO di
 * proseguire, perché metterli in fondo a una lista lunga significa mostrare un
 * pulsante spento senza dire quale card guardare — il difetto del bottone
 * disabilitato senza spiegazione già corretto nella 20a per l'onboarding senza
 * conti.
 *
 * ⚠️ E "bloccante" NON è "senza proposta", benché la prima versione le
 * confondesse. Un gruppo proposto come `trasferimento` ha una proposta e blocca
 * lo stesso, perché gli manca l'altro capo — che il database pretende
 * (`to_account_id` NOT NULL sui trasferimenti) e che nessun profilo di lettura
 * può indovinare. Ordinando sul solo `suggested === null`, i quattro gruppi di
 * bonifici finivano in mezzo alla lista mentre tenevano spento il pulsante in
 * fondo: si vedeva "5 gruppi da decidere" senza sapere quali.
 */
function needsAttention(g: ParsedGroup): boolean {
	return g.suggested === null || g.suggested === "trasferimento";
}

export function sortGroups(groups: ParsedGroup[]): ParsedGroup[] {
	return groups.sort((a, b) => {
		if (needsAttention(a) !== needsAttention(b)) return needsAttention(a) ? -1 : 1;
		// Fra quelli da guardare, prima chi non ha nemmeno una proposta.
		if ((a.suggested === null) !== (b.suggested === null)) return a.suggested === null ? -1 : 1;
		if (a.locked !== b.locked) return a.locked ? 1 : -1;
		return b.count - a.count;
	});
}
