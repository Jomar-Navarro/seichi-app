import { INTL_LOCALE, type Locale } from "./i18n/config";
import { DISPLAY_CURRENCY, fill, formatMoney } from "./i18n/format";
import type { Dictionary } from "./i18n/dictionaries/it";

/*
 * Gli importi SCRITTI DALL'UTENTE — issue #119.
 *
 * Prima ogni campo leggeva il testo a modo suo, e in tre casi salvava un valore
 * diverso da quello scritto senza dirlo: le ricorrenti toglievano il punto
 * ("12.50" → 1250), il budget lo leggeva come decimale ("1.200" → 1,2), e con
 * `type="number"` un testo che il browser non capiva ("2.400,50") arrivava
 * vuoto e diventava 0. Qui c'è un parser solo, e il suo contratto è l'opposto:
 * **o legge il numero che la persona intendeva, o dice che non ci riesce.**
 * Mai un terzo numero plausibile.
 *
 * Client-safe: nessun import dal server, lo usano i fogli e le server action.
 */

/**
 * Il massimo di una colonna `DECIMAL(10,2)`: otto cifre intere, due decimali.
 *
 * ⚠️ Oltre, Postgres rifiuta l'insert con un overflow — e il form del
 * movimento quell'errore lo ingoia (#124). Il tetto sta QUI perché il
 * tastierino e i campi smettano di accettare ciò che il database non può
 * scrivere, invece di scoprirlo al salvataggio.
 */
export const AMOUNT_MAX_INTEGER_DIGITS = 8;
export const AMOUNT_MAX = 99_999_999.99;
const AMOUNT_MAX_DECIMALS = 2;

export type AmountInput =
	| { status: "empty" }
	| { status: "ok"; value: number }
	/** caratteri che non sono cifre, separatori messi a caso */
	| { status: "invalid" }
	/** più di due cifre decimali: la colonna le arrotonderebbe in silenzio */
	| { status: "decimals" }
	/** oltre `DECIMAL(10,2)` */
	| { status: "tooLarge" };

export type AmountError = Extract<AmountInput, { status: "invalid" | "decimals" | "tooLarge" }>;

const SEPARATORS = new Map<Locale, "," | ".">();

/**
 * Il separatore decimale della lingua dell'app, da `Intl` e non da una mappa.
 * Memorizzato: il tastierino lo chiede a ogni tasto.
 */
export function decimalSeparator(locale: Locale): "," | "." {
	let sep = SEPARATORS.get(locale);
	if (!sep) {
		const part = new Intl.NumberFormat(INTL_LOCALE[locale])
			.formatToParts(1.5)
			.find((p) => p.type === "decimal")?.value;
		sep = part === "," ? "," : ".";
		SEPARATORS.set(locale, sep);
	}
	return sep;
}

/**
 * Legge un importo scritto a mano.
 *
 * Accetta la virgola E il punto come separatore decimale, in entrambe le
 * lingue: il tastierino `inputMode="decimal"` mostra il separatore della
 * REGIONE del telefono, non della lingua dell'app, e un'italiana con il
 * telefono in inglese ha solo il punto. Accetta anche le migliaia
 * ("1.234,56", "1,234.56", "1 234").
 *
 * ⚠️ L'unico caso ambiguo è UN separatore seguito da ESATTAMENTE tre cifre:
 * "1.200" è milleduecento o uno virgola due? Lo stesso nodo di `parseAmount`
 * dell'import (`lib/import/csv.ts`), ma qui la risposta è diversa, e di
 * proposito: un file arriva da chiunque, un campo lo scrive chi usa l'app in
 * una lingua precisa. Quindi decide la lingua — il suo separatore delle
 * migliaia vale migliaia ("1.200" in italiano è 1200), il suo separatore
 * decimale vale decimale, e allora tre decimali sono un ERRORE ("1,200" in
 * italiano). L'import sceglierebbe le migliaia anche lì: per un campo sarebbe
 * un importo mille volte più grande di quello che forse si intendeva, scritto
 * senza chiedere. Meglio un errore che si corregge in un secondo.
 *
 * Il segno meno solo con `allowNegative` (il saldo iniziale di una carta).
 */
export function parseAmountInput(
	raw: string,
	locale: Locale,
	{ allowNegative = false }: { allowNegative?: boolean } = {},
): AmountInput {
	// Gli spazi non separabili arrivano incollando un importo formattato
	// da `Intl` o da un'altra app.
	let s = raw.replace(/[\u00a0\u202f]/g, " ").trim();
	if (s === "") return { status: "empty" };

	let negative = false;
	if (/^[-−]/.test(s)) {
		if (!allowNegative) return { status: "invalid" };
		negative = true;
		s = s.slice(1).trim();
	}
	if (!/^[0-9., ]+$/.test(s) || !/[0-9]/.test(s)) return { status: "invalid" };

	const localeDecimal = decimalSeparator(locale);
	const dots = s.split(".").length - 1;
	const commas = s.split(",").length - 1;

	let decimal: "," | "." | null = null;
	if (dots > 0 && commas > 0) {
		// Ci sono entrambi: l'ULTIMO è il decimale, e deve comparire una volta.
		decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
		if ((decimal === "," ? commas : dots) > 1) return { status: "invalid" };
	} else if (dots + commas === 1) {
		const sep = dots === 1 ? "." : ",";
		const head = s.slice(0, s.indexOf(sep));
		const tail = s.slice(s.indexOf(sep) + 1);
		// Vedi la nota in testa: tre cifre dopo il separatore delle migliaia
		// della lingua sono migliaia; dopo qualunque altro sono decimali.
		// ⚠️ Salvo che davanti ci sia uno zero: nessuno scrive "zero mila", e
		// "0.500" letto come migliaia diventerebbe 500 — resta un decimale, e
		// tre decimali sono un errore.
		decimal = tail.length === 3 && sep !== localeDecimal && /^[1-9]/.test(head) ? null : sep;
	}
	// Un separatore ripetuto ("1.234.567") non può che essere delle migliaia:
	// `decimal` resta null.

	const [intPart, decPart = ""] = decimal ? s.split(decimal) : [s];
	const groups = new Set(intPart.replace(/[0-9]/g, ""));
	if (groups.size > 1) return { status: "invalid" };

	let digits = intPart;
	if (groups.size === 1) {
		// Le migliaia devono essere migliaia: "1.2.3" non è un numero, e il
		// primo gruppo non comincia con lo zero.
		const g = [...groups][0].replace(".", "\\.");
		if (!new RegExp(`^[1-9]\\d{0,2}(${g}\\d{3})+$`).test(intPart)) return { status: "invalid" };
		digits = intPart.replace(/[^0-9]/g, "");
	}
	if (!/^\d*$/.test(decPart) || (digits === "" && decPart === "")) {
		return { status: "invalid" };
	}

	if (decPart.length > AMOUNT_MAX_DECIMALS) return { status: "decimals" };
	if (digits.replace(/^0+/, "").length > AMOUNT_MAX_INTEGER_DIGITS) {
		return { status: "tooLarge" };
	}

	const value = Number(`${digits || "0"}.${decPart || "0"}`);
	return { status: "ok", value: negative ? -value : value };
}

/**
 * Il valore da mettere in un campo importo all'apertura, nella lingua
 * dell'app: "12,50" in italiano, "12.50" in inglese, "1200" senza decimali
 * inutili. Niente migliaia: è un testo da modificare, non da leggere.
 *
 * ⚠️ Prima era `toFixed(2).replace(".", ",")`, cioè la virgola anche a chi
 * usa l'app in inglese.
 */
export function formatAmountInput(value: number, locale: Locale): string {
	const text = Number.isInteger(value) ? String(value) : value.toFixed(AMOUNT_MAX_DECIMALS);
	return text.replace(".", decimalSeparator(locale));
}

/**
 * Il messaggio per un importo che non si legge. `null` se il testo è leggibile
 * (o vuoto): "maggiore di zero" e "obbligatorio" restano ai singoli campi, che
 * sanno se lo zero e il vuoto hanno senso per loro.
 */
export function amountErrorMessage(
	input: AmountInput,
	t: Dictionary,
	locale: Locale,
): string | null {
	switch (input.status) {
		case "invalid":
			return fill(t.amountInput.invalid, { example: formatAmountInput(12.5, locale) });
		case "decimals":
			return t.amountInput.decimals;
		case "tooLarge":
			return fill(t.amountInput.tooLarge, {
				max: formatMoney(AMOUNT_MAX, { locale, currency: DISPLAY_CURRENCY, decimals: 2 }),
			});
		default:
			return null;
	}
}

/**
 * Un tasto del tastierino del movimento, applicato al testo corrente.
 *
 * Il tastierino è un campo VINCOLATO, non un testo libero: non c'è modo di
 * scrivere una terza cifra decimale o una nona cifra intera, perché il tasto
 * semplicemente non fa niente. `key` è una cifra, `"sep"` o `"⌫"`; il testo
 * porta il separatore decimale della lingua, lo stesso che il tasto mostra.
 */
export function applyAmountKey(prev: string, key: string, locale: Locale): string {
	const sep = decimalSeparator(locale);
	if (key === "⌫") return prev.slice(0, -1);
	if (key === "sep") {
		if (prev.includes(sep)) return prev;
		return (prev === "" ? "0" : prev) + sep;
	}
	if (!/^[0-9]$/.test(key)) return prev;

	const at = prev.indexOf(sep);
	if (at >= 0) {
		return prev.length - at - 1 >= AMOUNT_MAX_DECIMALS ? prev : prev + key;
	}
	// "05" non è un importo: lo zero iniziale si sostituisce.
	if (prev === "0") return key;
	return prev.length >= AMOUNT_MAX_INTEGER_DIGITS ? prev : prev + key;
}

/**
 * Il controllo delle server action: un importo che la colonna può scrivere
 * così com'è. È la stessa regola dei campi, ripetuta dove una POST diretta
 * arriva senza passare da un campo.
 */
export function isStorableAmount(
	value: unknown,
	{ allowNegative = false, allowZero = false }: { allowNegative?: boolean; allowZero?: boolean } = {},
): value is number {
	if (typeof value !== "number" || !Number.isFinite(value)) return false;
	if (Math.abs(value) > AMOUNT_MAX) return false;
	if (!allowNegative && value < 0) return false;
	if (!allowZero && value === 0) return false;
	// Al centesimo: con i float `12.34 * 100` non è intero, quindi una tolleranza.
	const cents = value * 100;
	return Math.abs(cents - Math.round(cents)) < 1e-6;
}
