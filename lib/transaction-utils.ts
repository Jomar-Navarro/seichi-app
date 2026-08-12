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
	// Neutro: vedi la nota su `TRANSACTION_TYPES` in `types/index.ts`. Un
	// trasferimento non afferma nulla sul denaro, si limita a spostarlo.
	trasferimento: "var(--color-kiri)",
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
	/*
	 * ⚠️ `--text-primary` e non `--ink-kiri`, ed è l'unico inchiostro che non
	 * corrisponde al proprio accento.
	 *
	 * `--ink-kiri` è il neutro di RIPIEGO — serve a dire "questa cosa non ha un
	 * tipo" (una categoria senza tipo, la sesta fetta dei grafici) e per farlo è
	 * volutamente più spento del testo intorno. Un trasferimento invece un tipo
	 * ce l'ha eccome: è una scelta esplicita dell'utente, e il suo importo è una
	 * cifra come le altre. Smorzarlo lo farebbe leggere come un dato incompleto.
	 *
	 * È lo stesso ragionamento con cui la 20a ha reso NEUTRO — non spento —
	 * l'importo del saldo nel carosello della home.
	 */
	trasferimento: "var(--text-primary)",
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
 * La freccia fra origine e destinazione: "Corrente → Revolut".
 *
 * Sta qui e non nei dizionari per la stessa ragione del meno tipografico di
 * `formatAmount`: è una convenzione di Seichi, non una parola. Tradurla non
 * significherebbe nulla in nessuna delle due lingue, e averla in un posto solo
 * evita che la lista e il form disegnino la direzione in due modi diversi.
 */
export const DIRECTION_ARROW = "→";

/** `null` = nessun segno: il movimento non entra né esce. */
export type AmountSign = "+" | "−" | null;

/**
 * Il segno di un movimento dipende da CHI lo guarda.
 *
 * Fino alla 20a la regola stava in una riga (`type === "entrata" ? "+" : "−"`)
 * perché ogni movimento aveva un solo conto e quindi un solo punto di vista.
 * Con i trasferimenti non è più vero: **la stessa riga toglie denaro a un conto
 * e lo dà a un altro**, e affermare che "esce" sarebbe vero solo per metà.
 *
 * Due letture, e sono due domande diverse:
 *
 * - **senza conto selezionato** la lista è il diario di ciò che hai FATTO. Un
 *   trasferimento resta senza segno: non c'è un riferimento rispetto a cui
 *   dirlo, ed è la stessa ragione per cui la sua icona non ha una direzione
 *   dominante.
 * - **con un conto davanti** la lista è il suo ESTRATTO CONTO, e deve
 *   riconciliare col saldo che `/conti` mostra tre tap più in là. Il denaro che
 *   arriva è `+`, quello che parte è `−`, qualunque sia il tipo che lo porta.
 *
 * ⚠️ Il ramo della destinazione viene PRIMA del tipo, e l'ordine è la sostanza:
 * un `risparmio` di 200 € dal Corrente al Libretto è `−` guardando il Corrente e
 * `+` guardando il Libretto. Mettendo prima il tipo, il Libretto mostrerebbe
 * "− € 200" per denaro che vi è appena entrato — una riga che contraddice il
 * saldo scritto sopra di essa.
 */
export function amountSign(
	tx: { type: string; account_id: string; to_account_id: string | null },
	viewedAccountId?: string | null,
): AmountSign {
	if (viewedAccountId && tx.to_account_id === viewedAccountId) return "+";
	if (tx.type === "trasferimento") return viewedAccountId ? "−" : null;
	return tx.type === "entrata" ? "+" : "−";
}

/**
 * Importo firmato: "+ € 1.234,00", "− € 12,50", oppure "€ 100,00" senza segno.
 *
 * Il segno è tipografico (U+2212 per il meno) e resta fuori da `Intl`: fa parte
 * della convenzione di Seichi, come il simbolo davanti al numero. Arriva già
 * deciso da `amountSign()` invece di essere ricavato qui dal tipo, perché
 * dedurlo richiede di sapere quale conto si sta guardando — un'informazione che
 * appartiene alla schermata, non al formattatore.
 */
export function formatAmount(amount: number, sign: AmountSign, locale: Locale): string {
	const money = formatMoney(Math.abs(amount), {
		locale,
		currency: DISPLAY_CURRENCY,
		decimals: 2,
	});
	return sign ? `${sign} ${money}` : money;
}
