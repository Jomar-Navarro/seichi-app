import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	FREQUENCIES,
	RULE_PARAM,
	advanceDate,
	canRepeat,
	firstRunForNewRule,
	firstRunFrom,
	generationMissed,
	isDueNow,
	recurringRuleHref,
	rollForwardPastToday,
	ruleFromParam,
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

describe("generationMissed — l'esito della RPC alla creazione di una regola (#173)", () => {
	const ruleId = "00000000-0000-4000-d000-000000000173";
	const altra = "00000000-0000-4000-d000-000000000999";

	it("regola dovuta e saltata dalla RPC: mancato", () => {
		expect(generationMissed({ ruleId, dueNow: true, rpcFailed: false, skipped: [ruleId] })).toBe(true);
	});

	// Il gemello che passa: la RPC riuscita senza la regola fra le saltate.
	it("regola dovuta e generata: niente da dire", () => {
		expect(generationMissed({ ruleId, dueNow: true, rpcFailed: false, skipped: [] })).toBe(false);
	});

	// La RPC lavora su tutte le regole scadute dell'utente: una sua regola
	// vecchia rotta non dice niente di quella appena salvata.
	it("saltata un'ALTRA regola dell'utente: non riguarda questa", () => {
		expect(generationMissed({ ruleId, dueNow: true, rpcFailed: false, skipped: [altra] })).toBe(false);
	});

	it("RPC fallita su una regola dovuta: mancato", () => {
		expect(generationMissed({ ruleId, dueNow: true, rpcFailed: true, skipped: null })).toBe(true);
	});

	// Con una partenza futura non c'era niente da generare: dirlo mancato
	// sarebbe falso, anche se la RPC è caduta.
	it("RPC fallita su una regola che parte nel futuro: niente da dire", () => {
		expect(generationMissed({ ruleId, dueNow: false, rpcFailed: true, skipped: null })).toBe(false);
	});

	// Il database di prima della 20261122 restituisce un numero.
	it.each([
		[1, true],
		[0, false],
	])("database vecchio, %i regole saltate: %s", (n, atteso) => {
		expect(generationMissed({ ruleId, dueNow: true, rpcFailed: false, skipped: n })).toBe(atteso);
	});
});

describe("isDueNow — con lo stesso orologio di firstRunForNewRule", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date(2026, 10, 22, 10, 0));
	});
	afterEach(() => vi.useRealTimers());

	it.each([
		["2026-11-21", true],
		["2026-11-22", true],
		["2026-11-23", false],
	])("%s → %s", (nextRun, atteso) => {
		expect(isDueNow(nextRun)).toBe(atteso);
	});

	// Il caso che lega le due funzioni: la regola che firstRunForNewRule fa
	// partire OGGI è dovuta adesso, quella che fa partire domani no.
	it("coerente con firstRunForNewRule", () => {
		expect(isDueNow(firstRunForNewRule("2026-10-22", "mensile"))).toBe(true);
		expect(isDueNow(firstRunForNewRule("2026-11-23", "mensile"))).toBe(false);
	});
});

describe("ruleFromParam — l'istruzione dell'URL che apre una regola (#222)", () => {
	const a = { id: "00000000-0000-4000-d000-000000000222" };
	const b = { id: "00000000-0000-4000-d000-000000000223" };
	const rules = [a, b];

	it("apre la regola dell'utente indicata", () => {
		expect(ruleFromParam(b.id, rules)).toBe(b);
	});

	// Il gemello che non apre: un uuid valido che non è fra le regole lette
	// (eliminata nel frattempo, o di un altro utente: la RLS non l'ha data).
	it("un uuid che non è fra le regole non apre niente", () => {
		expect(ruleFromParam("00000000-0000-4000-d000-000000000999", rules)).toBeNull();
	});

	it.each([
		["assente", undefined],
		["vuoto", ""],
		["non un uuid", "affitto"],
		["ripetuto (Next dà un array)", [a.id, b.id]],
		["un'iniezione", `${a.id},id.neq.0`],
	])("%s: niente", (_, param) => {
		expect(ruleFromParam(param, rules)).toBeNull();
	});

	it("il collegamento produce un parametro che si rilegge", () => {
		const url = new URL(recurringRuleHref(a.id), "https://seichi.test");
		expect(url.pathname).toBe("/impostazioni/ricorrenti");
		expect(ruleFromParam(url.searchParams.get(RULE_PARAM), rules)).toBe(a);
	});
});
