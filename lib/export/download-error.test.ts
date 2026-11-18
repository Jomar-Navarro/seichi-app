import { describe, expect, it } from "vitest";

import { exportErrorPath, parseExportError } from "./download-error";

/** Rilegge un percorso prodotto dalla rotta come farebbe la pagina. */
function roundTrip(path: string) {
	const url = new URL(path, "http://x");
	return parseExportError(Object.fromEntries(url.searchParams));
}

describe("gli errori dei download nell'URL (#162)", () => {
	it("ogni errore che la rotta produce, la pagina lo rilegge uguale", () => {
		for (const error of [
			{ target: "csv", code: "filtro" },
			{ target: "csv", code: "lettura" },
			{ target: "csv", code: "limite", wait: 3540 },
			{ target: "archivio", code: "limite", wait: 86_400 },
			{ target: "archivio", code: "troppo-grande" },
			{ target: "archivio", code: "rete" },
		] as const) {
			expect(roundTrip(exportErrorPath(error))).toEqual(error);
		}
	});

	it("il percorso porta un codice, mai una frase", () => {
		expect(exportErrorPath({ target: "csv", code: "limite", wait: 60 })).toBe(
			"/impostazioni/esporta?errore=limite&per=csv&attesa=60#csv",
		);
	});

	it("l'ancora porta lo schermo sul comando che ha fallito", () => {
		expect(exportErrorPath({ target: "archivio", code: "rete" })).toMatch(/#archivio$/);
		expect(exportErrorPath({ target: "csv", code: "lettura" })).toMatch(/#csv$/);
	});

	it("niente errore, nessun avviso", () => {
		expect(parseExportError({})).toBeNull();
	});

	// ⚠️ Un URL lo può scrivere chiunque: niente di ciò che non è nell'elenco
	// arriva a schermo.
	it.each([
		[{ errore: "Il tuo conto è bloccato", per: "csv" }],
		[{ errore: "lettura", per: "altro" }],
		[{ errore: "lettura" }],
		[{ per: "csv" }],
		[{ errore: "troppo-grande", per: "csv" }],
		[{ errore: "rete", per: "csv" }],
		[{ errore: "filtro", per: "archivio" }],
	])("un codice o un comando sconosciuto si ignora: %j", (params) => {
		expect(parseExportError(params)).toBeNull();
	});

	it.each(["", "0", "-5", "1.5", "abc", "60s", "86401", "0060", "9999999"])(
		"un limite senza un'attesa valida si scarta: %j",
		(attesa) => {
			expect(parseExportError({ errore: "limite", per: "csv", attesa })).toBeNull();
		},
	);

	it("un parametro ripetuto vale per il primo valore", () => {
		expect(parseExportError({ errore: ["rete", "lettura"], per: ["archivio"] })).toEqual({
			target: "archivio",
			code: "rete",
		});
	});

	it("l'attesa conta solo per il limite", () => {
		expect(parseExportError({ errore: "lettura", per: "csv", attesa: "abc" })).toEqual({ target: "csv", code: "lettura" });
	});
});
