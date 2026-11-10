import { describe, expect, it } from "vitest";

import {
	AMOUNT_MAX,
	amountErrorMessage,
	applyAmountKey,
	decimalSeparator,
	formatAmountInput,
	isStorableAmount,
	parseAmountInput,
	type AmountInput,
} from "./amount";
import { it as itDict } from "./i18n/dictionaries/it";
import type { Locale } from "./i18n/config";

/*
 * I casi della #119, ricostruiti dalla specifica: il collaudo di allora li
 * aveva scritti in uno scratchpad, che non c'è più. Il contratto da difendere
 * è uno solo — **o il numero che la persona intendeva, o un errore**, mai un
 * terzo numero plausibile.
 */

const ok = (value: number): AmountInput => ({ status: "ok", value });
const EMPTY: AmountInput = { status: "empty" };
const INVALID: AmountInput = { status: "invalid" };
const DECIMALS: AmountInput = { status: "decimals" };
const TOO_LARGE: AmountInput = { status: "tooLarge" };

describe("decimalSeparator", () => {
	it("viene da Intl, per lingua", () => {
		expect(decimalSeparator("it")).toBe(",");
		expect(decimalSeparator("en")).toBe(".");
	});
});

describe("parseAmountInput — uguale nelle due lingue", () => {
	const cases: [string, AmountInput][] = [
		["", EMPTY],
		["   ", EMPTY],
		["12", ok(12)],
		["0", ok(0)],
		["00012", ok(12)],
		// La virgola e il punto sono ENTRAMBI decimali: il tastierino mostra il
		// separatore della regione del telefono, non della lingua dell'app.
		["12,5", ok(12.5)],
		["12.5", ok(12.5)],
		["12,50", ok(12.5)],
		["12.50", ok(12.5)],
		["1,23", ok(1.23)],
		["1.23", ok(1.23)],
		[",5", ok(0.5)],
		["5,", ok(5)],
		["0,01", ok(0.01)],
		// Con entrambi i separatori, l'ultimo è il decimale.
		["1.234,56", ok(1234.56)],
		["1,234.56", ok(1234.56)],
		["1.234.567,89", ok(1234567.89)],
		["1,234,567.89", ok(1234567.89)],
		// Un separatore ripetuto non può che essere delle migliaia.
		["1.234.567", ok(1234567)],
		["1,234,567", ok(1234567)],
		["1.000.000,00", ok(1000000)],
		["1 234", ok(1234)],
		["1 234,5", ok(1234.5)],
		// Gli spazi che `Intl` mette quando l'importo è incollato.
		[" 1.234,56 ", ok(1234.56)],
		["1 234", ok(1234)],
		["99999999,99", ok(99999999.99)],
		["99999999.99", ok(99999999.99)],
		// Leggibili, ma non un numero.
		["abc", INVALID],
		["12a", INVALID],
		["€12", INVALID],
		["1e5", INVALID],
		[",", INVALID],
		[".", INVALID],
		["1.2.3", INVALID],
		["12,3,4", INVALID],
		["1.234,5,6", INVALID],
		["12 , 5", INVALID],
		["01.234.567", INVALID],
		// Il segno meno senza `allowNegative`.
		["-12", INVALID],
		["−12", INVALID],
		// Tre decimali: la colonna li arrotonderebbe in silenzio.
		["12,5050", DECIMALS],
		["12.5050", DECIMALS],
		["0.500", DECIMALS],
		["0,500", DECIMALS],
		// DECIMAL(10,2): otto cifre intere.
		["100000000", TOO_LARGE],
		["999999999", TOO_LARGE],
		["100.000.000", TOO_LARGE],
	];

	for (const locale of ["it", "en"] as const) {
		it.each(cases)(`${locale}: %j`, (raw, expected) => {
			expect(parseAmountInput(raw, locale)).toEqual(expected);
		});
	}
});

describe("parseAmountInput — l'ambiguo lo decide la lingua", () => {
	/*
	 * UN separatore seguito da ESATTAMENTE tre cifre: il separatore delle
	 * migliaia della lingua vale migliaia, quello decimale vale decimale — e tre
	 * decimali sono un errore, non mille volte l'importo.
	 */
	const cases: [Locale, string, AmountInput][] = [
		["it", "1.200", ok(1200)],
		["it", "1,200", DECIMALS],
		["it", "12.999", ok(12999)],
		["it", "12,999", DECIMALS],
		["it", "1.200,5", ok(1200.5)],
		["en", "1,200", ok(1200)],
		["en", "1.200", DECIMALS],
		["en", "12,999", ok(12999)],
		["en", "12.999", DECIMALS],
		["en", "1,200.5", ok(1200.5)],
		// Uno zero davanti non è mai un gruppo di migliaia: nessuno scrive "zero
		// mila", e "0.500" letto come migliaia diventerebbe 500.
		["it", "0.500", DECIMALS],
		["en", "0,500", DECIMALS],
		["it", "01.200", DECIMALS],
	];

	it.each(cases)("%s: %j", (locale, raw, expected) => {
		expect(parseAmountInput(raw, locale)).toEqual(expected);
	});
});

describe("parseAmountInput — negativi", () => {
	it.each([
		["-12", -12],
		["−12", -12],
		["- 12,50", -12.5],
		["-1.234,56", -1234.56],
	])("%j con allowNegative", (raw, value) => {
		expect(parseAmountInput(raw, "it", { allowNegative: true })).toEqual(ok(value));
	});

	it("il segno da solo non è un numero", () => {
		expect(parseAmountInput("-", "it", { allowNegative: true })).toEqual(INVALID);
	});
});

describe("formatAmountInput", () => {
	it.each([
		[12.5, "it", "12,50"],
		[12.5, "en", "12.50"],
		[1200, "it", "1200"],
		[1200, "en", "1200"],
		[0.1, "it", "0,10"],
		[-3.5, "it", "-3,50"],
	] as const)("%d in %s → %j", (value, locale, text) => {
		expect(formatAmountInput(value, locale)).toBe(text);
	});

	// Ciò che il campo mostra all'apertura deve rileggersi uguale: altrimenti
	// basterebbe aprire e salvare per cambiare un importo.
	it.each(["it", "en"] as const)("%s: si rilegge identico", (locale) => {
		for (const v of [0, 0.01, 0.5, 1, 12.5, 999.99, 1200, 1234.56, 99999999.99]) {
			expect(parseAmountInput(formatAmountInput(v, locale), locale)).toEqual(ok(v));
		}
	});
});

describe("applyAmountKey — il tastierino è un campo vincolato", () => {
	const type = (keys: string[], locale: Locale) =>
		keys.reduce((text, key) => applyAmountKey(text, key, locale), "");

	it.each([
		["", "1", "it", "1"],
		["0", "5", "it", "5"],
		["0", "0", "it", "0"],
		["", "sep", "it", "0,"],
		["", "sep", "en", "0."],
		["12", "sep", "it", "12,"],
		["12,", "sep", "it", "12,"],
		["12,", "5", "it", "12,5"],
		["12,5", "0", "it", "12,50"],
		// La terza cifra decimale non entra.
		["12,50", "9", "it", "12,50"],
		["12.34", "5", "en", "12.34"],
		// La nona cifra intera non entra.
		["12345678", "9", "it", "12345678"],
		["1234567", "8", "it", "12345678"],
		// …ma i decimali sì, anche dopo otto cifre intere.
		["12345678,", "9", "it", "12345678,9"],
		["12,5", "⌫", "it", "12,"],
		["", "⌫", "it", ""],
		["12", "x", "it", "12"],
		["12", "10", "it", "12"],
	] as const)("%j + %j (%s) → %j", (prev, key, locale, next) => {
		expect(applyAmountKey(prev, key, locale)).toBe(next);
	});

	it("«1.250» col punto delle migliaia si ferma a 1,25: si salva ciò che si vede", () => {
		expect(type(["1", "sep", "2", "5", "0"], "it")).toBe("1,25");
	});

	it("qualunque sequenza di tasti si rilegge come un importo valido", () => {
		const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "sep", "⌫"];
		for (const locale of ["it", "en"] as const) {
			// Un generatore deterministico: ripetibile, e nessuna dipendenza in più.
			let seed = 155;
			const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
			for (let run = 0; run < 300; run++) {
				const sequence = Array.from({ length: 1 + Math.floor(next() * 16) }, () => keys[Math.floor(next() * keys.length)]);
				const text = type(sequence, locale);
				const parsed = parseAmountInput(text, locale);
				expect(["ok", "empty"], `${locale}: ${sequence.join(" ")} → ${JSON.stringify(text)}`).toContain(parsed.status);
				if (parsed.status === "ok") expect(isStorableAmount(parsed.value, { allowZero: true })).toBe(true);
			}
		}
	});
});

describe("isStorableAmount — la stessa regola nelle server action", () => {
	it.each([
		[12.5, {}, true],
		[0.01, {}, true],
		[AMOUNT_MAX, {}, true],
		// 0.1 + 0.2 = 0.30000000000000004: al centesimo, con tolleranza.
		[0.1 + 0.2, {}, true],
		[0, {}, false],
		[0, { allowZero: true }, true],
		[-5, {}, false],
		[-5, { allowNegative: true }, true],
		[-AMOUNT_MAX, { allowNegative: true }, true],
		[12.345, {}, false],
		[100_000_000, {}, false],
		[-100_000_000, { allowNegative: true }, false],
		[Number.NaN, {}, false],
		[Number.POSITIVE_INFINITY, {}, false],
		["12", {}, false],
		[null, {}, false],
	] as const)("%j %j → %s", (value, options, expected) => {
		expect(isStorableAmount(value, options)).toBe(expected);
	});
});

describe("amountErrorMessage", () => {
	it("dice cosa scrivere, nella lingua dell'esempio", () => {
		expect(amountErrorMessage(INVALID, itDict, "it")).toContain("12,50");
		expect(amountErrorMessage(DECIMALS, itDict, "it")).toBe(itDict.amountInput.decimals);
		expect(amountErrorMessage(TOO_LARGE, itDict, "it")).toContain("99.999.999,99");
	});

	it("tace su un importo leggibile o vuoto: lo zero e il vuoto li decide il campo", () => {
		expect(amountErrorMessage(ok(12), itDict, "it")).toBeNull();
		expect(amountErrorMessage(EMPTY, itDict, "it")).toBeNull();
	});
});
