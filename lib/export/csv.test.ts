import { describe, expect, it } from "vitest";

import { CSV_DELIMITER, toCsv } from "./csv";
import { parseAmount, parseCsv } from "../import/csv";

const BOM = "﻿";

describe("toCsv (Fase 23a)", () => {
	it("BOM in testa, CRLF fra le righe e in fondo", () => {
		expect(toCsv([["a", "b"], ["c", "d"]], "it")).toBe(`${BOM}a;b\r\nc;d\r\n`);
	});

	it("il separatore segue la lingua, e non coincide mai con quello decimale", () => {
		expect(CSV_DELIMITER).toEqual({ it: ";", en: "," });
		expect(toCsv([[1.5, 2]], "it")).toBe(`${BOM}1,5;2\r\n`);
		expect(toCsv([[1.5, 2]], "en")).toBe(`${BOM}1.5,2\r\n`);
	});

	it("i numeri senza separatore delle migliaia, e col loro segno", () => {
		expect(toCsv([[1234.56, -12.5]], "it")).toBe(`${BOM}1234,56;-12,5\r\n`);
		expect(toCsv([[1234.56, -12.5]], "en")).toBe(`${BOM}1234.56,-12.5\r\n`);
	});

	// ⚠️ Il terzo punto dell'app in cui il testo dell'utente diventa sintassi:
	// qui la esegue un foglio di calcolo, sul computer di chi apre il file.
	it.each([
		["=SUM(A1:A9)", "'=SUM(A1:A9)"],
		["+39 333", "'+39 333"],
		["-rimborso", "'-rimborso"],
		["@cmd", "'@cmd"],
		["\t=cmd", "'\t=cmd"],
		["\r=cmd", `"'\r=cmd"`],
	])("una nota che comincia con %j diventa testo", (note, cell) => {
		expect(toCsv([[note]], "it")).toBe(`${BOM}${cell}\r\n`);
	});

	it("un importo negativo NON è una formula: resta un numero", () => {
		expect(toCsv([[-12.5]], "it")).toBe(`${BOM}-12,5\r\n`);
	});

	it("cita ciò che va citato, e solo quello", () => {
		expect(toCsv([["a;b", "a,b"]], "it")).toBe(`${BOM}"a;b";a,b\r\n`);
		expect(toCsv([["a;b", "a,b"]], "en")).toBe(`${BOM}a;b,"a,b"\r\n`);
		expect(toCsv([['ha detto "ciao"']], "it")).toBe(`${BOM}"ha detto ""ciao"""\r\n`);
		expect(toCsv([["riga 1\nriga 2"]], "it")).toBe(`${BOM}"riga 1\nriga 2"\r\n`);
		expect(toCsv([[" spazio "]], "it")).toBe(`${BOM}" spazio "\r\n`);
	});

	it("le celle vuote", () => {
		expect(toCsv([[null, "", Number.NaN]], "it")).toBe(`${BOM};;\r\n`);
	});

	/*
	 * Il giro completo: l'export non promette la re-importabilità, ma le due
	 * metà del progetto non devono contraddirsi sul formato.
	 */
	it.each(["it", "en"] as const)("%s: il lettore dell'import rilegge ciò che l'export scrive", (locale) => {
		const rows = [
			["Data", "Note", "Importo"],
			["2026-03-01", 'Caffè; "speciale", ripetuto', 1234.56],
			["2026-03-02", "=pericoloso", -0.5],
		];
		const back = parseCsv(toCsv(rows, locale));
		expect(back.map((r) => r.slice(0, 2))).toEqual([
			["Data", "Note"],
			["2026-03-01", 'Caffè; "speciale", ripetuto'],
			["2026-03-02", "'=pericoloso"],
		]);
		expect(back.slice(1).map((r) => parseAmount(r[2]))).toEqual([1234.56, -0.5]);
	});
});
