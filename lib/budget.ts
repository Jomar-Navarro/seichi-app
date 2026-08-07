import type { BudgetPeriod, BudgetStatus } from "@/types";

/**
 * Sopra questa frazione la barra passa in ambra: l'utente ha ancora margine ma
 * conviene che lo sappia. Al 100% diventa rossa (stato "sforato").
 */
export const BUDGET_WARNING_THRESHOLD = 0.8;

/**
 * I periodi ammessi, nell'ordine in cui vanno mostrati.
 *
 * ⚠️ Solo gli ID (Fase 19). Le tre stringhe che ogni periodo portava con sé —
 * l'etichetta del selettore, il suffisso dell'importo ("/ mese") e la finestra
 * mostrata sulla card ("questo mese") — vivono in `t.budgetPeriods[id]`.
 *
 * La FINESTRA in particolare va sulla CARD e non nell'intestazione di sezione,
 * perché i periodi possono essere misti (spesa alimentare settimanale, viaggi
 * annuale) e le card si scorrono orizzontalmente: guardandone una a metà scroll,
 * "€ 10 / € 100" non dice su quale arco di tempo, e l'intestazione è già uscita
 * dal campo visivo.
 */
export const BUDGET_PERIODS: BudgetPeriod[] = ["settimanale", "mensile", "annuale"];

/**
 * Lo stato di un budget. `amount` è già garantito > 0 dal vincolo sulla tabella,
 * ma la guardia resta: una divisione per zero qui produrrebbe `Infinity` e una
 * barra larga quanto lo schermo invece di un errore visibile.
 */
export function budgetStatus(spent: number, amount: number): BudgetStatus {
	if (amount <= 0) return "ok";
	const ratio = spent / amount;
	if (ratio >= 1) return "sforato";
	if (ratio >= BUDGET_WARNING_THRESHOLD) return "soglia";
	return "ok";
}

/**
 * Colore della barra e degli importi: neutro → ambra → rosso.
 *
 * ⚠️ Lo stato "ok" NON usa il colore della categoria, anche se il mockup lo
 * faceva. Ogni categoria con un budget è di tipo `spesa`, e tutte le spese
 * hanno colore `aka`: la scala sarebbe diventata rosso → ambra → rosso, cioè
 * illeggibile sotto l'80%. In un mockup non si vede, perché c'è una sola card
 * sforata e nessuna progressione da seguire.
 *
 * L'identità della categoria resta comunque sulla card: la porta la pastiglia
 * dell'icona, che il colore ce l'ha.
 */
export function budgetColor(status: BudgetStatus): string {
	if (status === "sforato") return "var(--color-aka)";
	if (status === "soglia") return "var(--color-kin)";
	return "var(--color-kiri)";
}

/**
 * Gli stessi stati, per il TESTO — l'importo speso.
 *
 * `budgetColor` colora la barra, che è un riempimento e sull'accento ci sta
 * bene. La cifra no: in tema chiaro l'accento la porterebbe a ~3,4:1, cioè
 * meno leggibile del denominatore neutro che le sta accanto. Sarebbe il numero
 * che il rosso esiste apposta per far notare.
 */
export function budgetInk(status: BudgetStatus): string {
	if (status === "sforato") return "var(--ink-aka)";
	if (status === "soglia") return "var(--ink-kin)";
	return "var(--ink-kiri)";
}
