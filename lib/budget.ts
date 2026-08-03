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
	/** intestazione della sezione nella pagina Movimenti */
	heading: string;
}[] = [
	{ id: "settimanale", label: "settimanale", suffix: "/ settimana", heading: "Budget della settimana" },
	{ id: "mensile",     label: "mensile",     suffix: "/ mese",      heading: "Budget del mese" },
	{ id: "annuale",     label: "annuale",     suffix: "/ anno",      heading: "Budget dell'anno" },
];

const BY_ID = new Map(BUDGET_PERIODS.map((p) => [p.id, p]));

export function periodSuffix(period: BudgetPeriod): string {
	return BY_ID.get(period)?.suffix ?? "";
}

export function periodHeading(period: BudgetPeriod): string {
	return BY_ID.get(period)?.heading ?? "Budget";
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
 * Colore della barra e degli importi. Lo stato "ok" usa il colore della
 * categoria — così la card resta riconoscibile e il rosso conserva il suo
 * significato invece di diventare decorazione.
 */
export function budgetColor(status: BudgetStatus, categoryColor: string): string {
	if (status === "sforato") return "var(--color-aka)";
	if (status === "soglia") return "var(--color-kin)";
	return categoryColor;
}
