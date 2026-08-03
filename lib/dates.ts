/**
 * Conversioni fra `YYYY-MM-DD` e `Date`, sempre in ORA LOCALE.
 *
 * Il punto è evitare `new Date("2026-08-01")`, che le specifiche impongono di
 * interpretare come UTC: a Roma diventa il 31 luglio alle 02:00, e una
 * transazione del primo del mese finisce nel periodo precedente. Lo stesso
 * motivo per cui `TransactionForm` salva le date con `toLocaleDateString("sv-SE")`
 * invece di `toISOString()`.
 *
 * NB: `lib/recurring.ts` ha due helper privati equivalenti. Non sono stati
 * accorpati qui per non toccare il codice della Fase 14 in un branch che parla
 * di budget — sono due domini con ancoraggi temporali deliberatamente diversi.
 */

/** Parsa `YYYY-MM-DD` come mezzanotte LOCALE, non UTC. */
export function parseLocalDate(iso: string): Date {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d);
}

/** Formatta una `Date` in `YYYY-MM-DD` usando i campi locali. */
export function toLocalISODate(d: Date): string {
	return d.toLocaleDateString("sv-SE"); // sv-SE = YYYY-MM-DD
}

/** La data di oggi come `YYYY-MM-DD` locale. */
export function todayLocalISO(): string {
	return toLocalISODate(new Date());
}
