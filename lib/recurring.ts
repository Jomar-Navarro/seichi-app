import type { Frequency } from "@/types";

/**
 * Le cadenze ammesse, nell'ordine del selettore.
 *
 * Solo gli ID (Fase 19): le due etichette che ogni cadenza portava — quella del
 * selettore ("Mensile") e quella delle card ("Ogni mese") — stanno in
 * `t.frequencies[id]`. Questo modulo fa aritmetica sulle date, non copy.
 */
export const FREQUENCIES: Frequency[] = ["settimanale", "mensile", "annuale"];

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
 * Prima esecuzione di una regola NUOVA: l'occorrenza più recente già dovuta,
 * alla sua data vera — oppure la data di partenza, se è ancora da venire (#117).
 *
 * ⚠️ Non `firstRunFrom`, che qui spostava la cadenza. L'affitto del 31 agosto
 * registrato il 2 settembre con "Ripeti" usciva col 2 settembre: il movimento
 * finiva nel flusso del mese sbagliato, e da lì la regola usciva ogni 2 del mese
 * invece che l'ultimo giorno. Nemmeno `rollForwardPastToday` basta da sola: il
 * 31 agosto lo salterebbe del tutto, e quello è proprio il movimento che
 * l'utente stava registrando.
 *
 * Quindi: si avanza dalla data scelta finché il passo successivo è ancora nel
 * passato o oggi, e la regola riparte da lì. La chiamata a
 * `generate_recurring_transactions()` subito dopo l'insert genera quell'unica
 * occorrenza alla sua data, poi `next_run` passa al futuro. **Al più un
 * movimento retroattivo, mai una raffica** — che era la ragione di
 * `firstRunFrom`.
 *
 * Residuo dichiarato: con una partenza lontana (15 gennaio, registrata a
 * settembre) il movimento generato è quello del 15 agosto, non del 15 gennaio.
 * Da gennaio a luglio non si genera niente, per la stessa ragione di sempre: chi
 * li ha già inseriti a mano se li ritroverebbe doppi.
 *
 * Si avanza un passo alla volta, come fa il job in SQL (`next_run + interval`),
 * così le date coincidono con quelle che il job produrrebbe da sé.
 */
export function firstRunForNewRule(startDate: string, frequency: Frequency): string {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	let d = parseISODate(startDate);
	if (d >= today) return startDate;
	for (let next = advanceDate(d, frequency); next <= today; next = advanceDate(next, frequency)) {
		d = next;
	}
	return toISODate(d);
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
