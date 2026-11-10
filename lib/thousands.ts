/**
 * Un separatore solo, seguito da questa coda, PUÒ essere quello delle migliaia?
 *
 * La usano i due lettori di importi del progetto: `lib/amount.ts` (ciò che la
 * persona scrive in un campo) e `lib/import/csv.ts` (ciò che arriva in un
 * file). Sul resto divergono di proposito — nel campo l'ambiguo lo decide la
 * lingua, nel file vince sempre la lettura in migliaia — ma QUESTA regola è la
 * stessa, ed era scritta due volte: la seconda copia aveva perso lo zero (#155),
 * e `0,125` diventava 125 nell'import mentre il campo lo leggeva bene. È la
 * «migrazione a campione» che CLAUDE.md registra dalla Fase 18.
 *
 * - **Tre cifre esatte** dopo il separatore: nessuno scrive tre decimali per una
 *   somma di denaro, mentre un gruppo di migliaia ne ha sempre tre.
 * - **Niente zero davanti**: nessuno scrive "zero mila", e `0.500` letto come
 *   migliaia diventerebbe 500. Il segno, se c'è, non conta.
 *
 * "Può essere", non "è": decide il chiamante, che sa se c'è una lingua.
 */
export function couldBeThousandsGroup(head: string, tail: string): boolean {
	return /^\d{3}$/.test(tail) && /^[-+−]?[1-9]/.test(head);
}
