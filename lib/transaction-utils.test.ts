import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { amountSign, categoryTypeFor, formatAmount, formatDate } from "./transaction-utils";

const tx = (type: string, account_id = "A", to_account_id: string | null = null) => ({
	type,
	account_id,
	to_account_id,
});

describe("amountSign — il segno dipende da chi guarda (20b)", () => {
	it.each([
		["entrata", "+"],
		["disinvestimento", "+"],
		["spesa", "−"],
		["abbonamento", "−"],
		["investimento", "−"],
		["risparmio", "−"],
	])("senza conto, %s → %s", (type, sign) => {
		expect(amountSign(tx(type))).toBe(sign);
	});

	it("un trasferimento senza conto non ha segno: è il diario di ciò che hai fatto", () => {
		expect(amountSign(tx("trasferimento", "A", "B"))).toBeNull();
		expect(amountSign(tx("trasferimento", "A", "B"), null)).toBeNull();
	});

	it("con un conto davanti è il suo estratto conto", () => {
		expect(amountSign(tx("trasferimento", "A", "B"), "A")).toBe("−");
		expect(amountSign(tx("trasferimento", "A", "B"), "B")).toBe("+");
	});

	it("la destinazione viene PRIMA del tipo: il Libretto non mostra − per denaro appena arrivato", () => {
		expect(amountSign(tx("risparmio", "A", "B"), "B")).toBe("+");
		expect(amountSign(tx("risparmio", "A", "B"), "A")).toBe("−");
		expect(amountSign(tx("investimento", "A", "B"), "B")).toBe("+");
	});

	it("un'entrata guardata dal suo conto resta +", () => {
		expect(amountSign(tx("entrata"), "A")).toBe("+");
	});
});

describe("categoryTypeFor (#52)", () => {
	it("una vendita usa le categorie degli investimenti", () => {
		expect(categoryTypeFor("disinvestimento")).toBe("investimento");
	});

	it.each(["entrata", "spesa", "investimento", "risparmio", "abbonamento"])("%s resta %s", (type) => {
		expect(categoryTypeFor(type)).toBe(type);
	});
});

describe("formatAmount", () => {
	it.each([
		[12345.5, "+", "it", "+ € 12.345,50"],
		// ⚠️ In italiano `Intl` non raggruppa sotto le cinque cifre (CLDR,
		// `minimumGroupingDigits: 2`): «€ 1234,50» è ciò che l'app scrive davvero.
		[1234.5, "+", "it", "+ € 1234,50"],
		[1234.5, "−", "en", "− € 1,234.50"],
		[100, null, "it", "€ 100,00"],
		// Il segno lo decide amountSign, non il segno del numero.
		[-12.5, "−", "it", "− € 12,50"],
	] as const)("%d %j %s → %j", (amount, sign, locale, text) => {
		expect(formatAmount(amount, sign, locale)).toBe(text);
	});

	it("il meno è tipografico (U+2212), non il trattino", () => {
		expect(formatAmount(1, "−", "it").charCodeAt(0)).toBe(0x2212);
	});
});

describe("formatDate delle liste", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date(2026, 8, 2, 0, 30));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("oggi e ieri li dice Intl, con la maiuscola", () => {
		expect(formatDate("2026-09-02", "it")).toBe("Oggi");
		expect(formatDate("2026-09-01", "it")).toBe("Ieri");
		expect(formatDate("2026-09-01", "en")).toBe("Yesterday");
	});

	it("oltre, la data", () => {
		expect(formatDate("2026-08-15", "it")).toBe("15 agosto");
	});
});
