/**
 * Formattazione di numeri, denaro e date secondo il locale (Fase 19).
 *
 * Prima di questa fase ogni `Intl.NumberFormat("it-IT", …)` era una costante di
 * modulo, costruita una volta all'import. Erano tredici punti sparsi in otto file:
 * qui diventano funzioni che prendono il locale, e le istanze `Intl` restano
 * memorizzate — costruirne una è caro, e queste vengono chiamate una volta per
 * riga di una lista.
 */

import { INTL_LOCALE, type Locale } from "./config";

/**
 * Cache delle istanze `Intl`.
 *
 * La chiave include le opzioni: `formatMoney` con e senza decimali sono due
 * formattatori diversi e non devono scacciarsi a vicenda. I locale sono due e le
 * combinazioni di opzioni una manciata, quindi la mappa resta minuscola e non
 * serve alcuna politica di sfratto.
 */
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

function numberFormat(locale: Locale, options: Intl.NumberFormatOptions = {}) {
	const key = `${locale}:${JSON.stringify(options)}`;
	let fmt = numberFormats.get(key);
	if (!fmt) {
		fmt = new Intl.NumberFormat(INTL_LOCALE[locale], options);
		numberFormats.set(key, fmt);
	}
	return fmt;
}

function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions) {
	const key = `${locale}:${JSON.stringify(options)}`;
	let fmt = dateFormats.get(key);
	if (!fmt) {
		fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], options);
		dateFormats.set(key, fmt);
	}
	return fmt;
}

/**
 * La valuta usata dove non ne arriva una dal profilo.
 *
 * ⚠️ È un SEGNAPOSTO, non una decisione. Prima della Fase 19 il simbolo "€" era
 * scritto a mano in una dozzina di componenti, mentre `profiles.currency` è
 * scelta dall'utente fin dall'onboarding e già letta da `getAccountContext()` e
 * dalle notifiche. Far arrivare la valuta fino a ogni foglia è un lavoro
 * indipendente dalla lingua — tocca gli stessi file ma per un'altra ragione —
 * quindi qui il comportamento resta identico a prima. Questo nome esiste perché
 * quando lo si farà basti seguirne i riferimenti, invece di cercare "€" in tutto
 * il codice e distinguerlo dai simboli legittimi.
 */
export const DISPLAY_CURRENCY = "EUR";

/* ---------------------------------------------------------------- numeri --- */

export function formatNumber(
	value: number,
	locale: Locale,
	options?: Intl.NumberFormatOptions,
) {
	return numberFormat(locale, options).format(value);
}

/**
 * Il simbolo della valuta, ricavato da `Intl` invece che da una mappa nostra.
 *
 * Così una valuta diversa da EUR porta il proprio ($, £, ¥) senza che nessuno
 * debba mantenere un elenco. Il ripiego sul codice ISO copre le valute che il
 * runtime non conosce: meglio "CHF 100" di un simbolo mancante.
 */
export function currencySymbol(currency: string, locale: Locale) {
	return (
		numberFormat(locale, { style: "currency", currency })
			.formatToParts(0)
			.find((part) => part.type === "currency")?.value ?? currency
	);
}

/**
 * Denaro nella convenzione di Seichi: simbolo DAVANTI, spazio, numero.
 *
 * ⚠️ Deliberatamente NON `style: "currency"`. Quello darebbe "180 €" in italiano e
 * "€180.00" in inglese: due disposizioni diverse per la stessa cifra a seconda
 * della lingua, mentre le card della dashboard, gli importi delle transazioni e le
 * barre dei budget scrivono tutti "€ 180". La decisione è della Fase 17b ed è
 * annotata in `lib/notifications.ts`; qui viene solo resa unica e valida per
 * entrambe le lingue.
 *
 * Quello che il locale CAMBIA è il numero: `1.234,50` in italiano, `1,234.50` in
 * inglese. Quella parte è delegata a `Intl` e non va toccata a mano.
 */
export function formatMoney(
	value: number,
	{
		locale,
		currency,
		decimals = 0,
	}: { locale: Locale; currency: string; decimals?: number },
) {
	const amount = formatNumber(value, locale, {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
	return `${currencySymbol(currency, locale)} ${amount}`;
}

/**
 * Spezza un importo in parte intera e parte decimale, per renderle di due
 * dimensioni diverse (la card del saldo in home).
 *
 * ⚠️ Passa da `formatToParts` e NON dalla ricerca della virgola. Il codice
 * precedente faceva `lastIndexOf(",")`: giusto in italiano, rotto in inglese,
 * dove la virgola separa le MIGLIAIA e il punto i decimali. "1.234,50" diventa
 * "1,234.50", e cercando la virgola si sarebbe ottenuto `1` + `,234.50` — cioè
 * un saldo di milleduecento euro mostrato come "1" grande e il resto piccolo.
 * `formatToParts` etichetta i pezzi, quindi la domanda "qual è la parte
 * decimale" ha una risposta indipendente dalla lingua.
 */
export function splitAmount(
	value: number,
	locale: Locale,
	decimals = 2,
): { sign: string; integer: string; decimal: string } {
	const parts = numberFormat(locale, {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	}).formatToParts(Math.abs(value));

	let integer = "";
	let decimal = "";
	let seenFraction = false;

	for (const part of parts) {
		if (part.type === "decimal" || part.type === "fraction") {
			seenFraction = true;
			decimal += part.value;
		} else if (!seenFraction) {
			integer += part.value;
		}
	}

	// Il meno tipografico (U+2212), non il trattino: è quello che il design usa
	// accanto agli importi negativi.
	return { sign: value < 0 ? "−" : "", integer, decimal };
}

/* ----------------------------------------------------------------- date --- */

/**
 * Le stringhe "YYYY-MM-DD" vanno costruite come data LOCALE.
 *
 * `new Date("2026-08-15")` è mezzanotte UTC e nei fusi negativi slitta al giorno
 * prima. Vale per `recurring_rules.next_run` e per ogni colonna `DATE`, che
 * arrivano senza orario — a differenza di `transactions.date`, che è un istante.
 */
export function parseDate(iso: string): Date {
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	return dateOnly
		? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3])
		: new Date(iso);
}

export function formatDate(
	value: string | Date,
	locale: Locale,
	options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) {
	const date = typeof value === "string" ? parseDate(value) : value;
	return dateFormat(locale, options).format(date);
}

/**
 * Distanza in GIORNI DI CALENDARIO, non in multipli di 24 ore.
 *
 * Alle 00:30 una notifica delle 23:00 di ieri è "ieri", non "2 ore fa":
 * aritmeticamente vero, ma smentito dal calendario che l'utente ha in testa.
 */
export function calendarDaysAgo(date: Date): number {
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);
	const startOfThen = new Date(date);
	startOfThen.setHours(0, 0, 0, 0);
	return Math.round((startOfToday.getTime() - startOfThen.getTime()) / 86_400_000);
}

/**
 * Le iniziali dei giorni per il calendario, **da lunedì**.
 *
 * Erano un array `["Lun", "Mar", …]` scritto a mano nel form transazione.
 * `Intl` li conosce per ogni lingua, e la settimana che parte da lunedì resta
 * una scelta nostra: si ottiene partendo da una domenica nota (4 gennaio 1970 era
 * una domenica) e saltando al giorno dopo.
 */
export function weekdayInitials(locale: Locale): string[] {
	const fmt = dateFormat(locale, { weekday: "short" });
	// 5 gennaio 1970 = lunedì. Sette giorni consecutivi da lì.
	// ⚠️ `capitalize`: in italiano `Intl` restituisce "lun", "mar" MINUSCOLI,
	// mentre l'array cablato che ha sostituito dava "Lun", "Mar". In inglese non
	// si nota ("Mon" è già maiuscolo), quindi la regressione si vedeva solo nella
	// lingua di default — il caso peggiore per accorgersene.
	return Array.from({ length: 7 }, (_, i) =>
		capitalize(fmt.format(new Date(1970, 0, 5 + i))),
	);
}

/**
 * Mese abbreviato con l'iniziale maiuscola: "Gen", "Feb".
 *
 * Stesso motivo di `weekdayInitials`: `Intl` dà "gen" in italiano e "Jan" in
 * inglese, e le etichette degli assi dei grafici erano capitalizzate.
 */
export function shortMonth(date: Date, locale: Locale): string {
	return capitalize(formatDate(date, locale, { month: "short" }));
}

/** L'istanza `Intl.RelativeTimeFormat` per un locale, memorizzata. */
function relativeFormat(locale: Locale) {
	const key = INTL_LOCALE[locale];
	let rtf = relativeFormats.get(key);
	if (!rtf) {
		rtf = new Intl.RelativeTimeFormat(key, { numeric: "auto" });
		relativeFormats.set(key, rtf);
	}
	return rtf;
}

/**
 * "oggi", "ieri", "3 giorni fa" — dal solo scarto in giorni.
 *
 * È `numeric: "auto"` a trasformare `-1` in "ieri" invece di "1 giorno fa", ed è
 * il motivo per cui quelle due parole non stanno nei dizionari: `Intl` le
 * conosce per ogni lingua. Restituisce minuscolo, quindi a inizio riga va
 * passato per `capitalize`.
 */
export function relativeDayLabel(days: number, locale: Locale): string {
	return relativeFormat(locale).format(days, "day");
}

/**
 * Timestamp relativo — "2 ore fa", "ieri", "3 giorni fa".
 *
 * Usa `Intl.RelativeTimeFormat` con `numeric: "auto"`, che è ciò che trasforma
 * `-1 day` in "ieri" invece di "1 giorno fa". Prima della Fase 19 questa funzione
 * si scriveva i plurali a mano (`minuto`/`minuti`) e le due parole speciali:
 * tutto quel ramo era italiano cablato, e in inglese avrebbe richiesto di
 * riscriverlo. `Intl` lo dà per qualunque lingua.
 *
 * Oltre la settimana torna alla data assoluta: "12 giorni fa" non aiuta a
 * collocare un evento, "24 luglio" sì.
 */
export function formatRelativeTime(
	iso: string,
	locale: Locale,
	/**
	 * Testo per "meno di un minuto fa".
	 *
	 * ⚠️ `Intl` qui NON va bene: `format(0, "second")` in italiano dà **"ora"**,
	 * che capitalizzato diventa "Ora" — nella stessa colonna dove le righe più
	 * vecchie dicono "1 ora fa". Si legge come un conteggio di ore troncato.
	 * È l'unico caso in cui una parola scritta a mano batte `Intl`, quindi arriva
	 * dal dizionario invece di essere dedotta.
	 */
	justNow: string,
): string {
	const then = new Date(iso);
	const minutes = Math.floor((Date.now() - then.getTime()) / 60_000);
	const rtf = relativeFormat(locale);

	if (minutes < 1) return justNow;
	if (minutes < 60) return rtf.format(-minutes, "minute");

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return rtf.format(-hours, "hour");

	const days = calendarDaysAgo(then);
	if (days < 7) return rtf.format(-days, "day");

	return formatDate(then, locale);
}

/* -------------------------------------------------- letture con ripiego --- */

/**
 * Legge una voce da una mappa del dizionario indicizzata con un valore che
 * arriva dal DATABASE, con ripiego.
 *
 * ⚠️ Serve perché TypeScript si fida troppo. `r.frequency` è tipato come l'unione
 * `Frequency`, quindi `t.frequencies[r.frequency].recur` compila — ma il tipo
 * descrive ciò che il database *dovrebbe* contenere, non ciò che contiene. Il
 * codice sostituito aveva un `?? r.frequency` che degradava a mostrare il valore
 * grezzo; dereferenziando subito, una riga inattesa passa da difetto cosmetico a
 * schianto dell'intera pagina.
 *
 * Non è teoria: CLAUDE.md registra che il `CHECK` su `recurring_rules.type` è
 * mancato dal database vero fino al 2026-08-04, e che il repo non sa ancora
 * ricostruire lo schema da zero (issue #43).
 */
export function lookup<T>(
	map: Record<string, T>,
	key: string,
	pick: (entry: T) => string,
	fallback: string,
): string {
	const entry = map[key] as T | undefined;
	return entry ? pick(entry) : fallback;
}

/* -------------------------------------------------------------- stringhe --- */

/**
 * Sostituisce i segnaposto `{nome}` di una voce di dizionario.
 *
 * ⚠️ È il motivo per cui i dizionari contengono SOLO stringhe e oggetti semplici,
 * mai funzioni: il dizionario attraversa il confine server→client come prop di
 * `<I18nProvider>`, e una funzione lì dentro farebbe fallire la serializzazione
 * dell'RSC payload ("Functions cannot be passed directly to Client Components").
 * Un template con segnaposto è dato, quindi passa.
 */
export function fill(template: string, values: Record<string, string | number>) {
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in values ? String(values[key]) : match,
	);
}

/** Le forme plurali che una voce di dizionario può dichiarare. */
export type PluralForms = {
	zero?: string;
	one: string;
	other: string;
};

/**
 * Sceglie la forma giusta e vi inserisce il numero, già formattato per il locale.
 *
 * Italiano e inglese hanno entrambi solo `one`/`other`, quindi qui una `if` a mano
 * basterebbe — ma le categorie plurali sono una proprietà della lingua, non del
 * codice, e delegarle a `Intl.PluralRules` significa che aggiungere una terza
 * lingua non richiede di ripensare questa funzione.
 *
 * `zero` è fuori dalle regole di `Intl` di proposito: in italiano e in inglese non
 * è una categoria grammaticale, ma "nessuna transazione" resta una frase migliore
 * di "0 transazioni". È una scelta di stile, quindi è opzionale.
 */
export function plural(forms: PluralForms, count: number, locale: Locale): string {
	if (count === 0 && forms.zero !== undefined) return fill(forms.zero, { n: 0 });

	const key = INTL_LOCALE[locale];
	let rules = pluralRules.get(key);
	if (!rules) {
		rules = new Intl.PluralRules(key);
		pluralRules.set(key, rules);
	}

	const category = rules.select(count);
	const form = category === "one" ? forms.one : forms.other;
	return fill(form, { n: formatNumber(count, locale) });
}

/**
 * Maiuscola iniziale.
 *
 * Serve perché `Intl.RelativeTimeFormat` restituisce "ieri" minuscolo, mentre in
 * cima a una riga di notifica ci va "Ieri". Non è `text-transform: capitalize` in
 * CSS: quello maiuscolerebbe ogni parola, e il design vuole sentence case.
 */
export function capitalize(text: string) {
	return text.charAt(0).toUpperCase() + text.slice(1);
}
