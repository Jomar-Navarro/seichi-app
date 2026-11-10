import { describe, expect, it } from "vitest";

import {
	daysBetweenISO,
	dbInstant,
	endOfDayInMonth,
	isISODate,
	localMidnightInstant,
	monthBoundsOf,
	parseLocalDate,
	toLocalISODate,
} from "./dates";

describe("il fuso dei test", () => {
	// ⚠️ Senza questo controllo, un fuso che non cambia ora (UTC, quello della
	// CI) farebbe passare i test sull'ora legale senza averla mai attraversata.
	it("è quello di Roma, ora legale compresa (vitest.config.mts)", () => {
		expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(-60);
		expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(-120);
	});
});

describe("parseLocalDate / toLocalISODate", () => {
	it("mezzanotte LOCALE, non UTC: il primo del mese resta il primo", () => {
		const d = parseLocalDate("2026-08-01");
		expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 7, 1, 0]);
	});

	it.each(["2026-01-01", "2026-03-29", "2026-10-25", "2024-02-29", "2026-12-31"])(
		"%s si rilegge identica, anche nei giorni del cambio d'ora",
		(iso) => {
			expect(toLocalISODate(parseLocalDate(iso))).toBe(iso);
		},
	);
});

describe("isISODate", () => {
	it.each(["2026-02-28", "2024-02-29", "2026-12-31", "2026-01-01"])("%s esiste", (v) => {
		expect(isISODate(v)).toBe(true);
	});

	// `2026-02-31` passerebbe una regex, e `Date.UTC` lo sposterebbe al 3 marzo.
	it.each(["2026-02-29", "2026-02-31", "2026-13-01", "2026-00-10", "2026-1-01", "2026-01-01T00:00", "", 20260101, null])(
		"%j no",
		(v) => {
			expect(isISODate(v)).toBe(false);
		},
	);
});

describe("daysBetweenISO", () => {
	it.each([
		["2026-03-01", "2026-03-01", 0],
		// Attraverso il cambio dell'ora: in ora locale un giorno dura 23 ore.
		["2026-03-28", "2026-03-30", 2],
		["2026-10-24", "2026-10-26", 2],
		["2026-01-10", "2026-01-01", -9],
		["2025-12-31", "2026-01-01", 1],
		["2024-02-28", "2024-03-01", 2],
	])("%s → %s = %d", (from, to, days) => {
		expect(daysBetweenISO(from, to)).toBe(days);
	});
});

describe("localMidnightInstant", () => {
	it.each([
		// Roma d'estate (-120) e d'inverno (-60): la mezzanotte è il giorno prima in UTC.
		["2026-08-01", -120, "2026-07-31T22:00:00.000Z"],
		["2026-01-15", -60, "2026-01-14T23:00:00.000Z"],
		["2026-01-15", 0, "2026-01-15T00:00:00.000Z"],
		// Un fuso a ovest.
		["2026-01-15", 300, "2026-01-15T05:00:00.000Z"],
	])("%s con scostamento %d → %s", (iso, offset, instant) => {
		expect(localMidnightInstant(iso, offset)).toBe(instant);
	});
});

describe("dbInstant (#121)", () => {
	it("una colonna senza fuso si legge come UTC, come la legge il database", () => {
		expect(dbInstant("2026-10-01T00:00:00")).toBe(Date.parse("2026-10-01T00:00:00.000Z"));
		expect(dbInstant("2026-10-01T12:30:00.5")).toBe(Date.parse("2026-10-01T12:30:00.500Z"));
	});

	it("un fuso esplicito si rispetta", () => {
		expect(dbInstant("2026-10-01T02:00:00+02:00")).toBe(Date.parse("2026-10-01T00:00:00Z"));
		expect(dbInstant("2026-10-01T00:00:00Z")).toBe(Date.parse("2026-10-01T00:00:00Z"));
		expect(dbInstant("2026-10-01T00:00:00z")).toBe(Date.parse("2026-10-01T00:00:00Z"));
	});

	it("una spesa esattamente al confine del periodo ci sta dentro", () => {
		const column = "2026-10-01T00:00:00";
		const bound = localMidnightInstant("2026-10-01", 0);
		// Il difetto della #121: come STRINGHE la colonna è "minore" del confine.
		expect(column < bound).toBe(true);
		expect(dbInstant(column) >= Date.parse(bound)).toBe(true);
	});
});

describe("endOfDayInMonth (#121)", () => {
	const local = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

	it.each([
		// Un giorno qualunque: la mezzanotte del giorno dopo.
		[2026, 9, 12, local(2026, 9, 13)],
		// Il 31 marzo confrontato con febbraio: tutto febbraio, non un giorno di marzo.
		[2026, 1, 31, local(2026, 2, 1)],
		// Il 29 febbraio di un bisestile confrontato con l'anno prima: fino al 28.
		[2023, 1, 29, local(2023, 2, 1)],
		[2024, 1, 28, local(2024, 1, 29)],
		[2024, 1, 29, local(2024, 2, 1)],
		[2026, 2, 31, local(2026, 3, 1)],
		// Il giorno del cambio d'ora.
		[2026, 2, 28, local(2026, 2, 29)],
	])("%d-%d-%d", (y, m, d, end) => {
		expect(endOfDayInMonth(y, m, d).getTime()).toBe(end);
	});
});

describe("monthBoundsOf", () => {
	it.each([
		["2026-08-15", { start: "2026-08-01", end: "2026-09-01" }],
		["2026-12-31", { start: "2026-12-01", end: "2027-01-01" }],
		["2026-02-28", { start: "2026-02-01", end: "2026-03-01" }],
		["2026-01-01", { start: "2026-01-01", end: "2026-02-01" }],
	])("%s", (iso, bounds) => {
		expect(monthBoundsOf(iso)).toEqual(bounds);
	});
});
