import {
	DISPLAY_CURRENCY,
	capitalize,
	formatDate as formatDateIntl,
	formatMoney,
	parseDate,
	relativeDayLabel,
} from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

export const TIPO_COLOR: Record<string, string> = {
	entrata:      "var(--color-midori)",
	spesa:        "var(--color-aka)",
	risparmio:    "var(--color-kin)",
	investimento: "var(--color-ao)",
	abbonamento:  "var(--color-murasaki)",
};

/**
 * Gli stessi ruoli di TIPO_COLOR, ma per il TESTO.
 *
 * TIPO_COLOR resta per riempimenti, pastiglie e icone, dove l'accento pieno
 * serve a risaltare. Per gli importi serve invece leggibilità: in tema chiaro
 * gli accenti stanno sotto la soglia WCAG AA, e "spesa" e "risparmio"
 * (#b47358 e #ae8b49) sono per giunta quasi lo stesso marrone — proprio i due
 * numeri che non devono mai essere confusi.
 */
export const TIPO_INK: Record<string, string> = {
	entrata:      "var(--ink-midori)",
	spesa:        "var(--ink-aka)",
	risparmio:    "var(--ink-kin)",
	investimento: "var(--ink-ao)",
	abbonamento:  "var(--ink-murasaki)",
};

/*
 * `TIPO_LABEL` stava qui e dalla Fase 19 non esiste più: le etichette dei tipi
 * vivono in `t.types` (plurale, "Entrate") e `t.typesSingular` ("Entrata").
 * Questo modulo distribuisce colori e aritmetica delle date — cose che non
 * cambiano con la lingua — e teneva accanto le uniche tre stringhe che invece
 * cambiavano. Stessa separazione applicata a `lib/password.ts`, `lib/budget.ts`
 * e `lib/recurring.ts`.
 *
 * Anche `numberFormatter` è sparito: era un `Intl.NumberFormat("it-IT")`
 * costruito all'import, quindi impossibile da spostare su un altro locale.
 * Al suo posto `formatMoney`/`formatNumber` in `lib/i18n/format.ts`.
 */

/**
 * "Oggi", "Ieri", oppure la data — per le righe delle liste.
 *
 * Le due parole non stanno nel dizionario: `Intl.RelativeTimeFormat` con
 * `numeric: "auto"` le produce in qualsiasi lingua, ed è la stessa via già usata
 * da `formatRelativeTime` per le notifiche. Due voci in meno da tradurre a mano,
 * e nessun rischio che "Ieri" e "ieri" divergano fra i due punti dell'app che
 * le mostrano.
 */
export function formatDate(iso: string, locale: Locale): string {
	const date = parseDate(iso);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);

	if (date.toDateString() === today.toDateString()) {
		return capitalize(relativeDayLabel(0, locale));
	}
	if (date.toDateString() === yesterday.toDateString()) {
		return capitalize(relativeDayLabel(-1, locale));
	}
	return formatDateIntl(date, locale);
}

/**
 * Importo firmato di una transazione: "+ € 1.234,00" oppure "− € 12,50".
 *
 * Il segno è tipografico (U+2212 per il meno) e resta fuori da `Intl`: fa parte
 * della convenzione di Seichi, come il simbolo davanti al numero.
 */
export function formatAmount(amount: number, type: string, locale: Locale): string {
	const sign = type === "entrata" ? "+ " : "− ";
	const money = formatMoney(Math.abs(amount), {
		locale,
		currency: DISPLAY_CURRENCY,
		decimals: 2,
	});
	return `${sign}${money}`;
}
