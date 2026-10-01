/**
 * Conversioni fra `YYYY-MM-DD` e `Date`, sempre in ORA LOCALE.
 *
 * ⚠️ "Locale" è il fuso di CHI ESEGUE. In un modulo `"use server"` queste
 * funzioni girano sul server — UTC su Vercel — non sul fuso dell'utente.
 * `todayLocalISO()` va quindi chiamata da un componente client e la data va
 * passata alle server action come parametro. Chiamarla dentro una server action
 * dà "oggi" secondo il server: a Roma, fra mezzanotte e le 2, è ancora ieri.
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

export interface ClientClock {
	/** `YYYY-MM-DD` secondo l'orologio dell'utente */
	today: string;
	/** minuti da aggiungere all'ora locale per ottenere UTC (`getTimezoneOffset()`) */
	tzOffsetMinutes: number;
}

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

/**
 * Fotografia dell'orologio del CLIENT, da passare alle server action.
 *
 * Non basta la data: per sapere quale istante UTC corrisponde alla mezzanotte
 * dell'utente serve anche il suo scostamento dal fuso. `transactions.date` è un
 * istante assoluto, quindi senza offset i confini di periodo verrebbero
 * calcolati sulla mezzanotte del server — a Roma, due ore dopo quella vera.
 *
 * Va chiamata SOLO da un componente client.
 */
export function clientClock(): ClientClock {
	return {
		today: todayLocalISO(),
		// getTimezoneOffset() è i minuti da AGGIUNGERE all'ora locale per ottenere
		// UTC: negativo a est di Greenwich (Roma d'estate: -120).
		tzOffsetMinutes: new Date().getTimezoneOffset(),
	};
}

/** L'istante UTC della mezzanotte locale del client, per una data `YYYY-MM-DD`. */
export function localMidnightInstant(isoDate: string, tzOffsetMinutes: number): string {
	const [y, m, d] = isoDate.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d) + tzOffsetMinutes * 60_000).toISOString();
}

/**
 * L'istante, in millisecondi, di un `transactions.date` come lo restituisce
 * PostgREST — da confrontare con quelli di `localMidnightInstant()`.
 *
 * ⚠️ Mai confrontare le due STRINGHE (#121). La colonna è `timestamp without
 * time zone` e arriva senza fuso (`2026-10-01T00:00:00`), mentre
 * `localMidnightInstant()` scrive `2026-10-01T00:00:00.000Z`: come stringhe la
 * prima è un prefisso della seconda, quindi "minore" anche quando sono lo
 * stesso istante. Una spesa registrata esattamente al confine finiva fuori dal
 * proprio periodo e dentro il precedente — con fuso UTC+0, ogni spesa del primo
 * giorno di un budget.
 *
 * Senza fuso si legge come UTC, cioè come la legge il database: le query
 * confrontano la colonna con confini `timestamptz` nella sessione di Supabase,
 * che è in UTC (debito dichiarato in CLAUDE.md, schema di `transactions`).
 */
export function dbInstant(value: string): number {
	return Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/i.test(value) ? value : `${value}Z`);
}

/**
 * La fine (esclusiva) del giorno `day` nel mese `month` di `year`, fermata alla
 * fine di quel mese — il confine dei confronti "a parità di giorni" (#121).
 *
 * ⚠️ Il fermo non è un dettaglio: il 31 marzo confrontato col mese prima deve
 * dare tutto febbraio, non sconfinare in marzo; il 29 febbraio di un anno
 * bisestile confrontato con l'anno prima deve dare fino al 28 febbraio, non al
 * 2 marzo. Scritto a mano in ogni chiamante, la versione dell'anno era già
 * diversa da quella del mese (review della #121): una definizione sola.
 */
export function endOfDayInMonth(year: number, month: number, day: number): Date {
	return new Date(
		Math.min(new Date(year, month, day + 1).getTime(), new Date(year, month + 1, 1).getTime()),
	);
}

/** Primo giorno del mese di `isoDate` e primo del mese successivo (fine esclusiva). */
export function monthBoundsOf(isoDate: string): { start: string; end: string } {
	const [y, m] = isoDate.split("-").map(Number);
	const nextY = m === 12 ? y + 1 : y;
	const nextM = m === 12 ? 1 : m + 1;
	const pad = (n: number) => String(n).padStart(2, "0");
	return { start: `${y}-${pad(m)}-01`, end: `${nextY}-${pad(nextM)}-01` };
}
