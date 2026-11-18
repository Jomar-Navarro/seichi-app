/**
 * La meccanica della card «Primi passi» (#163), senza testo e senza rete: quali
 * voci sono fatte, quale è la prossima, quante su quattro.
 *
 * Le voci si spuntano da sole leggendo i dati (`first_steps()`, migration
 * `20261121`), e qui si decide solo l'ORDINE in cui la card le propone. È
 * l'ordine in cui conviene farle, non un obbligo: ogni pietra resta toccabile.
 * Il saldo viene prima perché i saldi di /conti partono da lì; la transazione
 * prima del budget perché un budget senza spese non mostra niente.
 *
 * Storia: docs/storia/issue-163-primi-passi.md.
 */

export const FIRST_STEP_KEYS = ["balance", "transaction", "budget", "goal"] as const;

export type FirstStepKey = (typeof FIRST_STEP_KEYS)[number];

export type FirstStepsState = {
	done: Record<FirstStepKey, boolean>;
	/** Un lotto importato esiste: il link «Importa un estratto conto» non serve più. */
	hasImport: boolean;
};

/** La riga di `first_steps()`, con i nomi delle colonne del database. */
export type FirstStepsRow = {
	has_balance: boolean;
	has_transaction: boolean;
	has_budget: boolean;
	has_goal: boolean;
	has_import: boolean;
};

export function firstStepsFromRow(row: FirstStepsRow): FirstStepsState {
	return {
		done: {
			balance: row.has_balance,
			transaction: row.has_transaction,
			budget: row.has_budget,
			goal: row.has_goal,
		},
		hasImport: row.has_import,
	};
}

/** La prima voce non fatta, nell'ordine della card; `null` se sono fatte tutte. */
export function nextFirstStep(state: FirstStepsState): FirstStepKey | null {
	return FIRST_STEP_KEYS.find((k) => !state.done[k]) ?? null;
}

export function firstStepsDoneCount(state: FirstStepsState): number {
	return FIRST_STEP_KEYS.filter((k) => state.done[k]).length;
}
