import type { Frequency } from "@/types";

export const FREQUENCIES: { id: Frequency; label: string; recurLabel: string }[] = [
	{ id: "settimanale", label: "Settimanale", recurLabel: "Ogni settimana" },
	{ id: "mensile", label: "Mensile", recurLabel: "Ogni mese" },
	{ id: "annuale", label: "Annuale", recurLabel: "Ogni anno" },
];

// tipo -> "Ogni mese" ecc. (usato nelle card ricorrenti)
export const FREQ_RECUR_LABEL: Record<string, string> = Object.fromEntries(
	FREQUENCIES.map((f) => [f.id, f.recurLabel]),
);

function parseISODate(s: string): Date {
	const [y, m, d] = s.split("-").map(Number);
	return new Date(y, m - 1, d);
}

function toISODate(d: Date): string {
	return d.toLocaleDateString("sv-SE"); // YYYY-MM-DD, ora locale
}

export function advanceDate(d: Date, frequency: Frequency): Date {
	const n = new Date(d);
	if (frequency === "settimanale") n.setDate(n.getDate() + 7);
	else if (frequency === "mensile") n.setMonth(n.getMonth() + 1);
	else n.setFullYear(n.getFullYear() + 1);
	return n;
}

/**
 * Prima esecuzione: mai prima di oggi.
 * Evita il burst di movimenti retroattivi se l'utente sceglie una data di partenza passata.
 * (start_date resta memorizzata come nota storica, ma la generazione parte da oggi.)
 */
export function firstRunFrom(startDate: string): string {
	const today = toISODate(new Date());
	return startDate < today ? today : startDate;
}

/**
 * Avanza next_run finché non è strettamente futuro, mantenendo l'allineamento della cadenza.
 * Usato al "riprendi" di una regola in pausa per non back-fillare i periodi saltati.
 */
export function rollForwardPastToday(nextRun: string, frequency: Frequency): string {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	let d = parseISODate(nextRun);
	while (d <= today) d = advanceDate(d, frequency);
	return toISODate(d);
}
