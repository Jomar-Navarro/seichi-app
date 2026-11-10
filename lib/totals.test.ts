import { describe, expect, it } from "vitest";

import { disponibileDaTotali, flussoDaTotali, usciteDaTotali } from "./totals";

/*
 * Le definizioni che quattro schermate devono condividere (home, /analisi, il
 * report, il coach). Banali, ed è il punto: la classe di difetto che questo
 * progetto ha pagato quattro volte è una definizione riscritta altrove.
 */
describe("totals", () => {
	it("le uscite sono spese variabili PIÙ abbonamenti: l'affitto c'è", () => {
		expect(usciteDaTotali(1240, 51.9)).toBe(1291.9);
	});

	it("il flusso non sottrae risparmi e investimenti: non sono consumati", () => {
		// La firma è la garanzia: risparmi e investimenti non sono nemmeno un parametro.
		expect(flussoDaTotali.length).toBe(3);
		expect(flussoDaTotali(2400, 1240, 51.9)).toBeCloseTo(1108.1, 10);
	});

	it("il disponibile può essere negativo: lo stipendio non è ancora arrivato", () => {
		expect(disponibileDaTotali(0, 51.9)).toBe(-51.9);
		expect(disponibileDaTotali(5907.58, 51.9)).toBeCloseTo(5855.68, 10);
	});
});
