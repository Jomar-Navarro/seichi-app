import { describe, expect, it } from "vitest";

import { negotiateLocale, normalizeLocale } from "./config";
import {
	capitalize,
	fill,
	formatMoney,
	formatRetryIn,
	lookup,
	plural,
	relativePastLabel,
	splitAmount,
	currencyDecimals,
	currencySymbol,
	weekdayInitials,
} from "./format";

describe("fill", () => {
	it("sostituisce i segnaposto noti e lascia gli altri dove sono", () => {
		expect(fill("{n} su {tot}", { n: 3, tot: "10" })).toBe("3 su 10");
		expect(fill("{n} e ancora {n}", { n: 2 })).toBe("2 e ancora 2");
		expect(fill("manca {questo}", { n: 1 })).toBe("manca {questo}");
		expect(fill("zero: {n}", { n: 0 })).toBe("zero: 0");
	});
});

describe("plural", () => {
	const forms = { zero: "nessun movimento", one: "{n} movimento", other: "{n} movimenti" };

	it.each([
		[0, "it", "nessun movimento"],
		[1, "it", "1 movimento"],
		[2, "it", "2 movimenti"],
		[12345, "it", "12.345 movimenti"],
		[12345, "en", "12,345 movimenti"],
	] as const)("%d (%s) → %j", (count, locale, text) => {
		expect(plural(forms, count, locale)).toBe(text);
	});

	it("senza forma zero, lo zero è un plurale", () => {
		expect(plural({ one: "{n} riga", other: "{n} righe" }, 0, "it")).toBe("0 righe");
	});
});

describe("formatMoney e splitAmount", () => {
	it("il simbolo davanti, in entrambe le lingue; il numero secondo la lingua", () => {
		expect(formatMoney(12345.5, { locale: "it", currency: "EUR", decimals: 2 })).toBe("€ 12.345,50");
		expect(formatMoney(12345.5, { locale: "en", currency: "EUR", decimals: 2 })).toBe("€ 12,345.50");
		expect(formatMoney(51.9, { locale: "it", currency: "EUR" })).toBe("€ 52");
	});

	// ⚠️ Cercando la virgola, in inglese "1,234.50" diventava `1` + `,234.50`.
	it.each([
		[1234.5, "en", { sign: "", integer: "1,234", decimal: ".50" }],
		[12345.5, "it", { sign: "", integer: "12.345", decimal: ",50" }],
		[-12.5, "it", { sign: "−", integer: "12", decimal: ",50" }],
	] as const)("%d (%s)", (value, locale, parts) => {
		expect(splitAmount(value, { locale, currency: "EUR" })).toEqual(parts);
	});
});

/*
 * #171 — la valuta del profilo arriva a ogni cifra. Due difetti possibili, e
 * le due prove: il simbolo (in `it-IT` il `symbol` di default del dollaro è
 * «USD», in `en-GB` «US$») e i decimali (lo yen non ne ha).
 */
describe("formatMoney nelle valute del profilo (#171)", () => {
	it.each([
		["USD", "it", "$ 12.345,50"],
		["USD", "en", "$ 12,345.50"],
		["GBP", "it", "£ 12.345,50"],
		["CHF", "it", "CHF 12.345,50"],
		["JPY", "it", "¥ 12.346"],
		["JPY", "en", "¥ 12,346"],
		// Il gemello: l'euro resta com'era.
		["EUR", "it", "€ 12.345,50"],
	] as const)("%s (%s) → %j", (currency, locale, text) => {
		expect(formatMoney(12345.5, { locale, currency, decimals: 2 })).toBe(text);
	});

	it("i decimali sono quelli della valuta", () => {
		expect(currencyDecimals("EUR")).toBe(2);
		expect(currencyDecimals("USD")).toBe(2);
		expect(currencyDecimals("CHF")).toBe(2);
		expect(currencyDecimals("JPY")).toBe(0);
	});

	it("splitAmount in yen non ha parte decimale", () => {
		expect(splitAmount(12345.5, { locale: "it", currency: "JPY" })).toEqual({ sign: "", integer: "12.346", decimal: "" });
		expect(splitAmount(-12, { locale: "en", currency: "JPY" })).toEqual({ sign: "−", integer: "12", decimal: "" });
	});

	it("il simbolo da solo, per i campi", () => {
		expect(currencySymbol("USD", "it")).toBe("$");
		expect(currencySymbol("JPY", "en")).toBe("¥");
		expect(currencySymbol("EUR", "en")).toBe("€");
	});
});

describe("relativePastLabel (#123)", () => {
	it.each([
		[1, "it", "ieri"],
		// L'apostrofo è tipografico (U+2019): lo scrive Intl, non noi.
		[2, "it", "l’altro ieri"],
		[6, "it", "6 giorni fa"],
		// Unità intere TRASCORSE: 13 giorni sono una settimana, non due.
		[13, "it", "1 settimana fa"],
		[13, "en", "1 week ago"],
		// `numeric: "always"`: non "la settimana scorsa", che è di calendario.
		[7, "it", "1 settimana fa"],
		// Il mese medio: 360 giorni non sono "12 mesi fa".
		[360, "it", "11 mesi fa"],
		[400, "it", "1 anno fa"],
	] as const)("%d giorni (%s) → %j", (days, locale, text) => {
		expect(relativePastLabel(days, locale)).toBe(text);
	});
});

describe("formatRetryIn (#161)", () => {
	it("arrotonda per eccesso, mai sotto il minuto", () => {
		expect(formatRetryIn(1, "it")).toBe("tra 1 minuto");
		expect(formatRetryIn(60, "it")).toBe("tra 1 minuto");
		expect(formatRetryIn(61, "it")).toBe("tra 2 minuti");
		expect(formatRetryIn(600, "en")).toBe("in 10 minutes");
	});

	it("oltre l'ora passa alle ore, sempre per eccesso", () => {
		expect(formatRetryIn(59 * 60, "it")).toBe("tra 59 minuti");
		expect(formatRetryIn(3600, "it")).toBe("tra 1 ora");
		expect(formatRetryIn(3601, "it")).toBe("tra 2 ore");
		expect(formatRetryIn(86_400, "en")).toBe("in 24 hours");
	});
});

describe("weekdayInitials e capitalize", () => {
	it("da lunedì, con la maiuscola anche in italiano", () => {
		expect(weekdayInitials("it")[0]).toBe("Lun");
		expect(weekdayInitials("it")).toHaveLength(7);
		expect(weekdayInitials("en")[6]).toBe("Sun");
	});

	it("capitalize tocca solo la prima lettera", () => {
		expect(capitalize("ieri alle 10")).toBe("Ieri alle 10");
		expect(capitalize("")).toBe("");
	});
});

describe("lookup", () => {
	it("un valore del database fuori elenco ripiega invece di far cadere la pagina", () => {
		const map: Record<string, { recur: string }> = { mensile: { recur: "Ogni mese" } };
		expect(lookup(map, "mensile", (e) => e.recur, "?")).toBe("Ogni mese");
		expect(lookup(map, "quindicinale", (e) => e.recur, "quindicinale")).toBe("quindicinale");
	});
});

describe("normalizeLocale e negotiateLocale", () => {
	it.each([
		["it", "it"],
		["IT", "it"],
		[" en-GB ", "en"],
		["en-US", "en"],
		["fr", null],
		["", null],
		[null, null],
		[42, null],
	])("normalizeLocale(%j) → %j", (value, locale) => {
		expect(normalizeLocale(value)).toBe(locale);
	});

	it.each([
		[null, "it"],
		["", "it"],
		["en-US,en;q=0.9", "en"],
		["fr-FR,en;q=0.8,it;q=0.9", "it"],
		["de-DE", "it"],
		// Un `q` a zero o illeggibile non scavalca niente.
		["en;q=0, it;q=0.5", "it"],
		["en;q=abc", "it"],
	])("negotiateLocale(%j) → %j", (header, locale) => {
		expect(negotiateLocale(header)).toBe(locale);
	});
});
