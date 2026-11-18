import { describe, expect, it } from "vitest";
import { firstStepsDoneCount, firstStepsFromRow, nextFirstStep, type FirstStepsRow } from "./first-steps";

const row = (over: Partial<FirstStepsRow> = {}): FirstStepsRow => ({
	has_balance: false,
	has_transaction: false,
	has_budget: false,
	has_goal: false,
	has_import: false,
	...over,
});

describe("primi passi (#163)", () => {
	it("le colonne arrivano ciascuna alla sua voce", () => {
		// Una sola colonna vera per volta: due colonne scambiate darebbero
		// la voce sbagliata, e il test direbbe quale.
		expect(firstStepsFromRow(row({ has_balance: true })).done).toEqual({
			balance: true, transaction: false, budget: false, goal: false,
		});
		expect(firstStepsFromRow(row({ has_transaction: true })).done.transaction).toBe(true);
		expect(firstStepsFromRow(row({ has_budget: true })).done.budget).toBe(true);
		expect(firstStepsFromRow(row({ has_goal: true })).done.goal).toBe(true);
		expect(firstStepsFromRow(row({ has_import: true })).hasImport).toBe(true);
		expect(firstStepsFromRow(row()).hasImport).toBe(false);
	});

	it("la prossima voce è la prima non fatta, nell'ordine della card", () => {
		expect(nextFirstStep(firstStepsFromRow(row()))).toBe("balance");
		expect(nextFirstStep(firstStepsFromRow(row({ has_balance: true })))).toBe("transaction");
		// Fatte fuori ordine: si torna alla prima che manca, non alla successiva
		// dell'ultima fatta.
		expect(nextFirstStep(firstStepsFromRow(row({ has_goal: true, has_budget: true })))).toBe("balance");
		expect(nextFirstStep(firstStepsFromRow(row({ has_balance: true, has_transaction: true })))).toBe("budget");
		expect(nextFirstStep(firstStepsFromRow(row({ has_balance: true, has_transaction: true, has_budget: true })))).toBe("goal");
	});

	it("tutte fatte: nessuna prossima, e l'import non conta come voce", () => {
		const all = firstStepsFromRow(row({ has_balance: true, has_transaction: true, has_budget: true, has_goal: true }));
		expect(nextFirstStep(all)).toBeNull();
		expect(firstStepsDoneCount(all)).toBe(4);
		expect(firstStepsDoneCount(firstStepsFromRow(row({ has_import: true })))).toBe(0);
	});

	it("il conteggio conta le voci fatte, qualunque siano", () => {
		expect(firstStepsDoneCount(firstStepsFromRow(row()))).toBe(0);
		expect(firstStepsDoneCount(firstStepsFromRow(row({ has_goal: true, has_transaction: true })))).toBe(2);
	});
});
