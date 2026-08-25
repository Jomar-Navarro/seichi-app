import { capitalize, formatDate } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/it";

/**
 * Le finestre temporali di `/analisi`.
 *
 * ⚠️ Sta qui perché ha DUE lettori: la pagina e il report stampabile (23b), che
 * il periodo lo riceve dalla query string e deve validarlo. È la stessa ragione
 * per cui `TRANSACTION_PERIODS` è uscita da `Filterbar` nella 23a — e vale la
 * stessa avvertenza: `getAnalyticsData` su un periodo che non riconosce non
 * lascia passare tutto, **ripiega sul mese**. Su una schermata si vedrebbe dal
 * titolo; dentro un documento stampato diventerebbe un foglio che dichiara un
 * arco di tempo e ne mostra un altro.
 */
export const ANALYTICS_PERIODS = ["settimana", "mese", "anno"] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export function isAnalyticsPeriod(value: string | undefined): value is AnalyticsPeriod {
	return (ANALYTICS_PERIODS as readonly string[]).includes(value ?? "");
}

/**
 * L'intestazione del periodo: "Ultima settimana", "2026", "Agosto 2026".
 *
 * ⚠️ `MESI_LUNGHI` non esiste più: era un array di dodici nomi di mese in
 * italiano, e `Intl` li conosce per ogni lingua. La maiuscola iniziale la mette
 * `capitalize`, perché `Intl` restituisce "agosto" minuscolo mentre qui il
 * design vuole "Agosto". L'anno da solo non si traduce.
 *
 * ⚠️ Condivisa fra la pagina e il report: se fossero due funzioni, lo stesso
 * periodo potrebbe avere due nomi nelle due schermate — la classe di difetto
 * che questo progetto ha già pagato con "Flusso" contro "Flusso netto".
 */
export function periodoLabel(periodo: string, locale: Locale, t: Dictionary): string {
	const now = new Date();
	if (periodo === "settimana") return t.analytics.lastWeek;
	if (periodo === "anno") return String(now.getFullYear());
	return capitalize(formatDate(now, locale, { month: "long", year: "numeric" }));
}
