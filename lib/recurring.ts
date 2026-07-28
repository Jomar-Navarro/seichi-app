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

/**
 * Aggiunge mesi "clampando" al fine mese, come fa Postgres con `+ interval`.
 * Es. 31 gen + 1 mese = 28 feb (JS con setMonth darebbe 3 mar). Mantiene
 * l'allineamento con la funzione SQL generate_recurring_transactions().
 */
function addClampedMonths(d: Date, months: number): Date {
	const day = d.getDate();
	const r = new Date(d.getFullYear(), d.getMonth() + months, 1);
	const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
	r.setDate(Math.min(day, lastDay));
	return r;
}

export function advanceDate(d: Date, frequency: Frequency): Date {
	if (frequency === "settimanale") {
		const n = new Date(d);
		n.setDate(n.getDate() + 7);
		return n;
	}
	return addClampedMonths(d, frequency === "mensile" ? 1 : 12);
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
	// "< today": se next_run cade oggi lo teniamo, così l'occorrenza di oggi
	// viene generata (coerente con firstRunFrom, che ammette oggi).
	while (d < today) d = advanceDate(d, frequency);
	return toISODate(d);
}
