import { AlertTriangle, PiggyBank, Repeat, RefreshCw } from "lucide-react";
import type { ElementType } from "react";
import type { NotificationType } from "@/types";

/** Oltre questo numero il badge mostra "9+": il conteggio esatto smette di dire qualcosa. */
export const BADGE_MAX = 9;

export const NOTIFICATION_META: Record<
	NotificationType,
	{ icon: ElementType; color: string }
> = {
	budget_sforato:      { icon: AlertTriangle, color: "var(--color-aka)" },
	budget_soglia:       { icon: AlertTriangle, color: "var(--color-kin)" },
	obiettivo_soglia:    { icon: PiggyBank,     color: "var(--color-kin)" },
	abbonamento_rinnovo: { icon: Repeat,        color: "var(--color-murasaki)" },
	ricorrenti_generate: { icon: RefreshCw,     color: "var(--color-murasaki)" },
};

/**
 * Timestamp relativo, come nel design: "2 ore fa", "Ieri", "3 giorni fa".
 *
 * Oltre la settimana torna alla data: "12 giorni fa" non aiuta nessuno a
 * collocare un evento, mentre "24 luglio" sì.
 */
export function relativeTime(iso: string): string {
	const then = new Date(iso);
	const diffMs = Date.now() - then.getTime();
	const minutes = Math.floor(diffMs / 60_000);

	if (minutes < 1) return "adesso";
	if (minutes < 60) return `${minutes} ${minutes === 1 ? "minuto" : "minuti"} fa`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} ${hours === 1 ? "ora" : "ore"} fa`;

	// I giorni si contano sui GIORNI DI CALENDARIO, non su multipli di 24 ore:
	// alle 00:30 una notifica delle 23:00 di ieri è "Ieri", non "2 ore fa" che
	// pure sarebbe aritmeticamente vero ma smentito dal calendario dell'utente.
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);
	const startOfThen = new Date(then);
	startOfThen.setHours(0, 0, 0, 0);
	const days = Math.round((startOfToday.getTime() - startOfThen.getTime()) / 86_400_000);

	if (days === 1) return "Ieri";
	if (days < 7) return `${days} giorni fa`;

	return then.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}
