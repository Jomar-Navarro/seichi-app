import { describe, expect, it } from "vitest";

import { detectDelimiter, parseAmount, parseCsv, parseDate, repairMojibake } from "./csv";

describe("detectDelimiter", () => {
	it.each([
		["a,b,c\n1,2,3", ","],
		["a;b;c\n1;2;3", ";"],
		["a\tb\tc", "\t"],
		["a;b,c;d", ";"],
		// ⚠️ Il caso per cui il conteggio ignora le virgolette: un export italiano
		// separato da `;` con un importo `"1.234,56"` nella prima riga.
		['"1.234,56";"x"\n', ";"],
		["una-colonna", ","],
	])("%j → %j", (text, delimiter) => {
		expect(detectDelimiter(text)).toBe(delimiter);
	});
});

describe("parseCsv", () => {
	it("righe e campi", () => {
		expect(parseCsv("a,b\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
	});

	it("CRLF come LF", () => {
		expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
	});

	it("l'ultima riga senza a capo", () => {
		expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
	});

	it("un campo quotato tiene il delimitatore", () => {
		// La riga vera di Trade Republic per cui `split(",")` non è un lettore.
		const row = '"Buy trade IE00BK5BQT80 Vanguard Funds PLC - x, quantity: 0.802560",tx-1';
		expect(parseCsv(row)).toEqual([
			["Buy trade IE00BK5BQT80 Vanguard Funds PLC - x, quantity: 0.802560", "tx-1"],
		]);
	});

	it("virgolette raddoppiate e a capo dentro un campo", () => {
		expect(parseCsv('"ha detto ""ciao""",x\n"riga 1\nriga 2",y\n')).toEqual([
			['ha detto "ciao"', "x"],
			["riga 1\nriga 2", "y"],
		]);
	});

	it("il BOM non finisce nel nome della prima colonna", () => {
		const [header] = parseCsv("﻿date,amount\n2026-01-01,1\n");
		expect(header[0]).toBe("date");
	});

	it("le righe vuote spariscono, anche quelle fatte di soli separatori", () => {
		expect(parseCsv("a,b\n\n1,2\n,\n \n")).toEqual([["a", "b"], ["1", "2"]]);
	});

	it("il delimitatore si può imporre", () => {
		expect(parseCsv("a;b,c", ";")).toEqual([["a", "b,c"]]);
	});
});

describe("repairMojibake", () => {
	it.each([
		["AusfÃ¼hrung", "Ausführung"],
		["CaffÃ¨", "Caffè"],
		["Ã¨ Ã¨", "è è"],
	])("%j → %j", (broken, fixed) => {
		expect(repairMojibake(broken)).toBe(fixed);
	});

	// Si applica solo se il giro inverso riesce: un testo sano non si rovina.
	it.each(["Caffè", "Ausführung", "Ãx", "Ã€", "PAM Panorama", ""])("lascia stare %j", (value) => {
		expect(repairMojibake(value)).toBe(value);
	});
});

describe("parseAmount", () => {
	it.each([
		// ⚠️ La controprova della issue: la prima versione leggeva 1,25 — un
		// fattore mille perso in silenzio, con la riga importata senza errori.
		["1.250", 1250],
		["1,250", 1250],
		["1.25", 1.25],
		["1,25", 1.25],
		["1.234,56", 1234.56],
		["1,234.56", 1234.56],
		["1.234.567", 1234567],
		["1,234,567", 1234567],
		["1 234,56", 1234.56],
		// Trade Republic scrive SEI decimali: la coda non è mai di tre cifre.
		["201.400000", 201.4],
		["-24.970000", -24.97],
		["35070.710000", 35070.71],
		["€ 12,50", 12.5],
		["12,50 EUR", 12.5],
		["-1,40", -1.4],
		["+3,00", 3],
		// Zero è un valore (il bollo di TAX_OPTIMIZATION), non un campo vuoto.
		["0", 0],
		["0,00", 0],
		// Uno zero davanti non è mai un gruppo di migliaia (lo stesso caso che
		// `lib/amount.ts` gestisce dalla #119).
		["0,125", 0.125],
		["-0,125", -0.125],
		["0.500", 0.5],
		["0,0001", 0.0001],
		// Ambiguità residua dichiarata: tre cifre dopo un separatore solo.
		["1.500", 1500],
	])("%j → %d", (raw, value) => {
		expect(parseAmount(raw)).toBe(value);
	});

	it.each([undefined, "", "   ", "abc", "12abc"])("%j → null, non 0", (raw) => {
		expect(parseAmount(raw)).toBeNull();
	});
});

describe("parseDate", () => {
	it.each([
		["2026-07-31", "2026-07-31"],
		["2026-07-31T16:37:36Z", "2026-07-31"],
		["31/07/2026", "2026-07-31"],
		["31-07-2026", "2026-07-31"],
		["31.07.2026", "2026-07-31"],
		// ⚠️ Giorno PRIMA: `new Date("03/04/2026")` darebbe il 4 marzo.
		["03/04/2026", "2026-04-03"],
		["3/4/2026", "2026-04-03"],
		["29/02/2024", "2024-02-29"],
		[" 01/01/2026 ", "2026-01-01"],
	])("%j → %j", (raw, iso) => {
		expect(parseDate(raw)).toBe(iso);
	});

	it.each([
		undefined,
		"",
		"luglio 2026",
		// Il formato americano non passa per buono: il mese 31 non esiste.
		"12/31/2026",
		// Una data che non esiste non è una data: arrivata al database, Postgres
		// la rifiuterebbe e con lei l'INTERO import, invece della sola riga.
		"31/02/2026",
		"29/02/2026",
		"32/01/2026",
		"2026-02-31",
		"2026-13-01T10:00:00Z",
	])("%j → null", (raw) => {
		expect(parseDate(raw)).toBeNull();
	});
});
