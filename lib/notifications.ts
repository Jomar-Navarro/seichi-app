import { AlertTriangle, Bell, PiggyBank, Repeat, RefreshCw } from "lucide-react";
import type { ElementType } from "react";
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
 */
export function relativeTime(iso: string): string {
	const then = new Date(iso);
	const minutes = Math.floor((Date.now() - then.getTime()) / 60_000);

	if (minutes < 1) return "adesso";
	if (minutes < 60) return `${minutes} ${minutes === 1 ? "minuto" : "minuti"} fa`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} ${hours === 1 ? "ora" : "ore"} fa`;

	// I giorni si contano sui GIORNI DI CALENDARIO, non su multipli di 24 ore:
	// alle 00:30 una notifica delle 23:00 di ieri è "Ieri", non "2 ore fa" —
	// aritmeticamente vero ma smentito dal calendario dell'utente.
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);
	const startOfThen = new Date(then);
	startOfThen.setHours(0, 0, 0, 0);
	const days = Math.round((startOfToday.getTime() - startOfThen.getTime()) / 86_400_000);

	if (days === 1) return "Ieri";
	if (days < 7) return `${days} giorni fa`;

	return then.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

/**
 * Compone la frase a partire dai fatti salvati.
 *
 * Sta QUI e non in SQL perché la presentazione dipende da cose che il generatore
 * notturno non conosce e che possono cambiare dopo: la valuta scelta dall'utente
 * e (Fase 19) la sua lingua. Salvare la frase nella riga significava cablare
 * "€" e rendere intraducibile tutto lo storico.
 */
export function renderNotification(
	n: AppNotification,
	currency: string,
): { title: string; body: string | null } {
	// ⚠️ Simbolo DAVANTI al numero, non `style: "currency"` puro.
	// Quello, con locale it-IT, produce "180 €" — corretto per la convenzione
	// italiana, ma tutto il resto dell'app scrive "€ 180" (card budget,
	// transazioni, formatAmount in lib/transaction-utils.ts). Due formati
	// diversi per la stessa cifra, uno accanto all'altro, sono una crepa
	// visibile in un'app che parla di soldi.
	// Il simbolo si ricava comunque da Intl, così una valuta diversa da EUR
	// porta il proprio ($, £, ¥) senza bisogno di una mappa da mantenere.
	const symbol =
		new Intl.NumberFormat("it-IT", { style: "currency", currency })
			.formatToParts(0)
			.find((p) => p.type === "currency")?.value ?? currency;
	const numberFmt = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
	const money = (v: number) => `${symbol} ${numberFmt.format(v)}`;

	const p = n.payload as Record<string, unknown>;

	switch (n.type) {
		case "budget_sforato":
		case "budget_soglia": {
			const category = p.category as string | null;
			const spent = Number(p.spent);
			const amount = Number(p.amount);
			const sforato = n.type === "budget_sforato";
			// `category` NULL è il budget GLOBALE: si chiama "spese variabili" e
			// mai "spese totali", perché affitto e utenze sono categorie
			// `abbonamento` e restano fuori dal limite.
			const title = category
				? `Budget "${category}" ${sforato ? "superato" : "quasi esaurito"}`
				: sforato
					? "Limite sulle spese variabili superato"
					: "Limite sulle spese variabili quasi raggiunto";
			return { title, body: `Hai speso ${money(spent)} su ${money(amount)}` };
		}

		case "obiettivo_soglia": {
			const goal = p.goal as string;
			const pct = Number(p.pct);
			return {
				title: `Obiettivo "${goal}" ${pct >= 100 ? "raggiunto" : "a metà strada"}`,
				body: `Hai messo da parte ${money(Number(p.saved))} su ${money(Number(p.target))}`,
			};
		}

		case "abbonamento_rinnovo": {
			const days = Number(p.days);
			const when = days === 0 ? "oggi" : days === 1 ? "domani" : `fra ${days} giorni`;
			return {
				title: `Rinnovo "${(p.name as string | null) ?? "abbonamento"}" ${when}`,
				body: `Sono previsti ${money(Number(p.amount))}`,
			};
		}

		case "ricorrenti_generate": {
			const count = Number(p.count);
			return {
				title:
					count === 1
						? "Registrato 1 movimento ricorrente"
						: `Registrati ${count} movimenti ricorrenti`,
				// Nessun totale: gli importi sono senza segno e la direzione la porta
				// `type`, quindi sommare uno stipendio e un affitto darebbe un numero
				// che non corrisponde a niente di trovabile nell'app.
				body: null,
			};
		}

		default:
			return { title: "Notifica", body: null };
	}
}
