import { describe, expect, it } from "vitest";
import { DAILY_JOB_STALE_HOURS, judgeDailyJob, pingFor, type DailyJobHealthRow } from "@/lib/job-health";

/*
 * Il verdetto sul job (#47) e il segnale per il controllo esterno (#160).
 * Ogni caso è uno dei difetti raccontati in docs/storia/issue-047-job-giornaliero.
 */

const NOW = Date.parse("2026-11-24T06:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const row = (over: Partial<DailyJobHealthRow> = {}): DailyJobHealthRow => ({
	last_run_at: hoursAgo(3),
	last_ok_at: hoursAgo(3),
	had_error: false,
	failed_steps: [],
	watching_since: hoursAgo(24 * 100),
	...over,
});

describe("judgeDailyJob", () => {
	it("un giro riuscito stanotte è sano", () => {
		const h = judgeDailyJob(row(), NOW);
		expect(h.stale).toBe(false);
		expect(h.overdue).toBe(false);
	});

	it("la soglia è esclusiva: 36 ore esatte non sono ancora un guasto, un minuto dopo sì", () => {
		expect(judgeDailyJob(row({ last_ok_at: hoursAgo(DAILY_JOB_STALE_HOURS) }), NOW).stale).toBe(false);
		const late = new Date(NOW - DAILY_JOB_STALE_HOURS * 3_600_000 - 60_000).toISOString();
		expect(judgeDailyJob(row({ last_ok_at: late }), NOW).overdue).toBe(true);
	});

	it("un errore accertato conta subito, senza aspettare che la riuscita invecchi", () => {
		const h = judgeDailyJob(row({ had_error: true, failed_steps: ["recurring"], last_ok_at: hoursAgo(27) }), NOW);
		expect(h.overdue).toBe(false);
		expect(h.stale).toBe(true);
	});

	it("il seme fa partire il cronometro: un database appena migrato non è fermo", () => {
		const h = judgeDailyJob(row({ last_run_at: null, last_ok_at: null, watching_since: hoursAgo(1) }), NOW);
		expect(h.stale).toBe(false);
	});

	it("nessuna traccia è il caso peggiore, non il migliore", () => {
		const h = judgeDailyJob(
			{ last_run_at: null, last_ok_at: null, had_error: null, failed_steps: null, watching_since: null },
			NOW,
		);
		expect(h.stale).toBe(true);
		expect(h.failedSteps).toEqual([]);
	});

	it("fallite le sole notifiche, l'ambito resta alle notifiche", () => {
		const h = judgeDailyJob(row({ had_error: true, failed_steps: ["notifications"] }), NOW);
		expect(h.scope).toBe("notifications");
	});

	it("un job fermo ferma le ricorrenti, anche se l'ultimo passo fallito era delle notifiche", () => {
		const h = judgeDailyJob(row({ had_error: true, failed_steps: ["notifications"], last_ok_at: hoursAgo(50) }), NOW);
		expect(h.scope).toBe("recurring");
	});
});

describe("pingFor", () => {
	it("sano → ok", () => {
		expect(pingFor({ health: judgeDailyJob(row(), NOW) }, NOW).status).toBe("ok");
	});

	it("passo fallito → fail, e dice quale passo e dove guardare", () => {
		const p = pingFor({ health: judgeDailyJob(row({ had_error: true, failed_steps: ["recurring"] }), NOW) }, NOW);
		expect(p.status).toBe("fail");
		expect(p.body).toContain("passi falliti: recurring");
		expect(p.body).toContain("job_runs.details");
		expect(p.body).not.toContain("Nessun giro riuscito");
	});

	it("job fermo → fail con le ore, e non parla di passi falliti", () => {
		const p = pingFor({ health: judgeDailyJob(row({ last_ok_at: hoursAgo(51) }), NOW) }, NOW);
		expect(p.status).toBe("fail");
		expect(p.body).toContain("Nessun giro riuscito da 51 ore");
		expect(p.body).not.toContain("passi falliti");
	});

	it("una lettura fallita è un fail con la sua frase, non un verdetto sul job", () => {
		const p = pingFor({ readFailure: "42501 permission denied for function daily_job_health" }, NOW);
		expect(p.status).toBe("fail");
		expect(p.body).toMatch(/^Lo stato del job non è leggibile: 42501/);
	});
});
