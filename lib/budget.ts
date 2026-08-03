import type { BudgetPeriod, BudgetStatus } from "@/types";

/**
 * Sopra questa frazione la barra passa in ambra: l'utente ha ancora margine ma
 * conviene che lo sappia. Al 100% diventa rossa (stato "sforato").
 */
export const BUDGET_WARNING_THRESHOLD = 0.8;

export const BUDGET_PERIODS: {
	id: BudgetPeriod;
	/** etichetta nel selettore del form categoria */
	label: string;
	/** suffisso dell'input importo: "€ 250 / mese" */
	suffix: string;
	/** finestra temporale, mostrata sulla card: "€ 10 / € 100" su quanto? */
	window: string;
}[] = [
	{ id: "settimanale", label: "settimanale", suffix: "/ settimana", window: "questa settimana" },
	{ id: "mensile",     label: "mensile",     suffix: "/ mese",      window: "questo mese" },
	{ id: "annuale",     label: "annuale",     suffix: "/ anno",      window: "quest'anno" },
];

const BY_ID = new Map(BUDGET_PERIODS.map((p) => [p.id, p]));

export function periodSuffix(period: BudgetPeriod): string {
	return BY_ID.get(period)?.suffix ?? "";
}

/**
 * La finestra di una card. Va sulla CARD e non nell'intestazione di sezione,
 * perché i periodi possono essere misti (spesa alimentare settimanale, viaggi
 * annuale) e le card si scorrono orizzontalmente: guardandone una a metà scroll,
 * "€ 10 / € 100" non dice su quale arco di tempo, e l'intestazione è già uscita
 * dal campo visivo.
 */
export function periodWindow(period: BudgetPeriod): string {
	return BY_ID.get(period)?.window ?? "";
}

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
