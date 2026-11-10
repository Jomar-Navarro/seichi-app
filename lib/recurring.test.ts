import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	FREQUENCIES,
	advanceDate,
	canRepeat,
	firstRunForNewRule,
	firstRunFrom,
	rollForwardPastToday,
} from "./recurring";
import { parseLocalDate, toLocalISODate } from "./dates";

const iso = (d: Date) => toLocalISODate(d);
const step = (from: string, frequency: (typeof FREQUENCIES)[number]) =>
	iso(advanceDate(parseLocalDate(from), frequency));

describe("canRepeat — lo specchio di recurring_rules_type_check", () => {
	it.each(["entrata", "spesa", "investimento", "risparmio", "abbonamento"])("%s sì", (type) => {
		expect(canRepeat(type)).toBe(true);
	});

	// Un trasferimento non ha categoria, un piano di decumulo non è esprimibile.
	it.each(["trasferimento", "disinvestimento", "", "altro"])("%j no", (type) => {
		expect(canRepeat(type)).toBe(false);
	});
});

describe("advanceDate — come `+ interval` di Postgres", () => {
	it.each([
		["2026-01-31", "mensile", "2026-02-28"],
		["2024-01-31", "mensile", "2024-02-29"],
		["2026-08-31", "mensile", "2026-09-30"],
		["2026-12-31", "mensile", "2027-01-31"],
		["2026-08-05", "mensile", "2026-09-05"],
		["2024-02-29", "annuale", "2025-02-28"],
		["2026-08-31", "annuale", "2027-08-31"],
		["2026-08-27", "settimanale", "2026-09-03"],
		// Attraverso il cambio dell'ora: sempre sette giorni di calendario.
		["2026-10-22", "settimanale", "2026-10-29"],
		["2026-03-26", "settimanale", "2026-04-02"],
	] as const)("%s + %s = %s", (from, frequency, to) => {
		expect(step(from, frequency)).toBe(to);
	});

	it("un passo alla volta, come il job: dal 31 gennaio si scivola al 28", () => {
		// '2026-01-31'::date + interval '1 month' = 2026-02-28, e da lì + 1 month
		// = 2026-03-28: il job avanza da `next_run`, non dalla data di partenza.
		expect(step(step("2026-01-31", "mensile"), "mensile")).toBe("2026-03-28");
	});
});

describe("prima esecuzione e ripresa (#117)", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		// Il 2 settembre 2026, a metà mattina: il caso della issue.
		vi.setSystemTime(new Date(2026, 8, 2, 10, 30));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it.each([
		// L'affitto del 31 agosto registrato il 2 settembre: esce il 31 agosto,
		// non il 2 settembre — e da lì l'ultimo giorno di ogni mese.
		["2026-08-31", "mensile", "2026-08-31"],
		["2026-09-02", "mensile", "2026-09-02"],
		["2026-09-10", "mensile", "2026-09-10"],
		// Residuo dichiarato: con una partenza lontana si genera solo l'ultima.
		["2026-01-15", "mensile", "2026-08-15"],
		["2026-01-31", "mensile", "2026-08-28"],
		["2026-08-20", "settimanale", "2026-08-27"],
		["2026-08-26", "settimanale", "2026-09-02"],
		["2025-09-01", "annuale", "2026-09-01"],
		["2024-02-29", "annuale", "2026-02-28"],
		["2025-09-03", "annuale", "2025-09-03"],
	] as const)("regola nuova dal %s, %s → prima esecuzione %s", (start, frequency, first) => {
		expect(firstRunForNewRule(start, frequency)).toBe(first);
	});

	it("al più un movimento retroattivo, mai una raffica", () => {
		for (const frequency of FREQUENCIES) {
			for (const start of ["2020-01-01", "2025-06-15", "2026-08-31"]) {
				const first = firstRunForNewRule(start, frequency);
				expect(first <= "2026-09-02", `${start} ${frequency}`).toBe(true);
				// Il passo successivo è già nel futuro.
				expect(step(first, frequency) > "2026-09-02", `${start} ${frequency}`).toBe(true);
			}
		}
	});

	it.each([
		["2026-08-15", "mensile", "2026-09-15"],
		// Oggi resta oggi: l'occorrenza di oggi si genera.
		["2026-09-02", "mensile", "2026-09-02"],
		["2026-07-31", "mensile", "2026-09-30"],
		["2026-09-10", "mensile", "2026-09-10"],
		["2026-08-01", "settimanale", "2026-09-05"],
	] as const)("ripresa dal %s, %s → %s", (nextRun, frequency, resumed) => {
		expect(rollForwardPastToday(nextRun, frequency)).toBe(resumed);
	});

	it("firstRunFrom: mai prima di oggi", () => {
		expect(firstRunFrom("2026-08-01")).toBe("2026-09-02");
		expect(firstRunFrom("2026-09-20")).toBe("2026-09-20");
	});
});
