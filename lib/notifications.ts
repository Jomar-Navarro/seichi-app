import { AlertTriangle, Bell, PiggyBank, Repeat, RefreshCw } from "lucide-react";
import type { ElementType } from "react";
import {
	capitalize,
	currencySymbol,
	fill,
	formatNumber,
	formatRelativeTime,
	plural,
	relativeDayLabel,
} from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/it";
import type { AppNotification, NotificationType } from "@/types";

/** Oltre questo numero il badge mostra "9+": il conteggio esatto smette di dire qualcosa. */
export const BADGE_MAX = 9;

const DEFAULT_META = { icon: Bell as ElementType, color: "var(--color-kiri)" };

const META: Record<NotificationType, { icon: ElementType; color: string }> = {
	budget_sforato:      { icon: AlertTriangle, color: "var(--color-aka)" },
	budget_soglia:       { icon: AlertTriangle, color: "var(--color-kin)" },
	obiettivo_soglia:    { icon: PiggyBank,     color: "var(--color-kin)" },
	abbonamento_rinnovo: { icon: Repeat,        color: "var(--color-murasaki)" },
	ricorrenti_generate: { icon: RefreshCw,     color: "var(--color-murasaki)" },
};

/**
 * Icona e colore per tipo, con fallback.
 *
 * Il fallback non è pedanteria: i tipi ammessi vivono in un `CHECK` nella
 * migration, che si modifica indipendentemente da questo file. Un tipo presente
 * nel database ma assente qui darebbe `meta.icon` su `undefined` **durante il
 * render di un client component**, e l'error boundary porterebbe via l'intera
 * dashboard — non la singola riga.
 */
export function notificationMeta(type: NotificationType) {
	return META[type] ?? DEFAULT_META;
}

/**
 * Timestamp relativo, come nel design: "2 ore fa", "Ieri", "3 giorni fa".
 * Oltre la settimana torna alla data: "12 giorni fa" non aiuta a collocare un
 * evento, "24 luglio" sì.
 *
 * ⚠️ Era tutto scritto a mano — `minuto`/`minuti`, "adesso", "Ieri", i giorni di
 * calendario — cioè italiano cablato in una funzione di formattazione. Ora la
 * meccanica sta in `formatRelativeTime` e le parole le dà `Intl`, per ogni
 * lingua. `capitalize` perché `Intl` restituisce "ieri" minuscolo e qui la
 * stringa apre una riga.
 */
export function relativeTime(iso: string, locale: Locale, justNow: string): string {
	return capitalize(formatRelativeTime(iso, locale, justNow));
}

/**
 * Compone la frase a partire dai fatti salvati.
 *
 * Sta QUI e non in SQL perché la presentazione dipende da cose che il generatore
 * notturno non conosce e che possono cambiare dopo: la valuta scelta dall'utente
 * e la sua lingua. Salvare la frase nella riga significava cablare "€" e rendere
 * intraducibile tutto lo storico — la Fase 19 è il momento in cui quella
 * previsione si è avverata.
 */
export function renderNotification(
	n: AppNotification,
	{ currency, locale, t }: { currency: string; locale: Locale; t: Dictionary },
): { title: string; body: string | null } {
	const m = t.notifications.messages;

	// ⚠️ Simbolo DAVANTI al numero, non `style: "currency"` puro.
	// Quello, con locale it-IT, produce "180 €" — corretto per la convenzione
	// italiana, ma tutto il resto dell'app scrive "€ 180" (card budget,
	// transazioni, formatAmount in lib/transaction-utils.ts). Due formati
	// diversi per la stessa cifra, uno accanto all'altro, sono una crepa
	// visibile in un'app che parla di soldi.
	// Il simbolo si ricava comunque da Intl, così una valuta diversa da EUR
	// porta il proprio ($, £, ¥) senza bisogno di una mappa da mantenere.
	const money = (v: number) =>
		`${currencySymbol(currency, locale)} ${formatNumber(v, locale, {
			maximumFractionDigits: 0,
		})}`;

	const p = n.payload as Record<string, unknown>;

	switch (n.type) {
		case "budget_sforato":
		case "budget_soglia": {
			const category = p.category as string | null;
			const sforato = n.type === "budget_sforato";
			// `category` NULL è il budget GLOBALE: si chiama "spese variabili" e
			// mai "spese totali", perché affitto e utenze sono categorie
			// `abbonamento` e restano fuori dal limite.
			const title = category
				? fill(sforato ? m.budgetExceeded : m.budgetNearLimit, { category })
				: sforato
					? m.globalExceeded
					: m.globalNearLimit;
			return {
				title,
				body: fill(m.spentOf, {
					spent: money(Number(p.spent)),
					amount: money(Number(p.amount)),
				}),
			};
		}

		case "obiettivo_soglia": {
			const goal = p.goal as string;
			const pct = Number(p.pct);
			return {
				title: fill(pct >= 100 ? m.goalReached : m.goalHalfway, { goal }),
				body: fill(m.savedOf, {
					saved: money(Number(p.saved)),
					target: money(Number(p.target)),
				}),
			};
		}

		case "abbonamento_rinnovo": {
			// "oggi" / "domani" / "fra 3 giorni" — le tre le produce
			// `Intl.RelativeTimeFormat` con `numeric: "auto"`, che è il motivo per
			// cui non stanno nel dizionario: erano tre rami scritti a mano.
			const when = relativeDayLabel(Number(p.days), locale);
			return {
				title: fill(m.renewal, {
					name: (p.name as string | null) ?? m.renewalFallbackName,
					when,
				}),
				body: fill(m.renewalAmount, { amount: money(Number(p.amount)) }),
			};
		}

		case "ricorrenti_generate": {
			return {
				title: plural(m.recurringGenerated, Number(p.count), locale),
				// Nessun totale: gli importi sono senza segno e la direzione la porta
				// `type`, quindi sommare uno stipendio e un affitto darebbe un numero
				// che non corrisponde a niente di trovabile nell'app.
				body: null,
			};
		}

		default:
			return { title: m.fallback, body: null };
	}
}
