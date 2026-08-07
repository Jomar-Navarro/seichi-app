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
export function formatRelativeTime(iso: string, locale: Locale): string {
	const then = new Date(iso);
	const minutes = Math.floor((Date.now() - then.getTime()) / 60_000);

	const key = INTL_LOCALE[locale];
	let rtf = relativeFormats.get(key);
	if (!rtf) {
		rtf = new Intl.RelativeTimeFormat(key, { numeric: "auto" });
		relativeFormats.set(key, rtf);
	}

	if (minutes < 1) return rtf.format(0, "second");
	if (minutes < 60) return rtf.format(-minutes, "minute");

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return rtf.format(-hours, "hour");

	const days = calendarDaysAgo(then);
	if (days < 7) return rtf.format(-days, "day");

	return formatDate(then, locale);
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
