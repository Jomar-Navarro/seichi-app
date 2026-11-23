import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { localSql } from "./support/db";
import { E2E_CRON_SECRET, E2E_PING_PORT } from "./support/env";

/**
 * Il controllo esterno del job notturno (#160): la route che il cron di Vercel
 * chiama alle 06:00 avvisa il servizio di sorveglianza con lo stesso verdetto
 * dell'app.
 *
 * ⚠️ Il difetto che custodisce è quello della #47: un job fermo per cinque
 * settimane senza che nessuno lo sapesse, perché il suo stato si vedeva solo
 * aprendo `/impostazioni`. E con esso i modi in cui la sorveglianza stessa
 * tacerebbe: un ping «ok» su un passo fallito, il redirect del proxy a
 * /welcome (un 307 che il cron prende per riuscito), un segreto non
 * controllato.
 *
 * Il servizio vero (healthchecks.io) qui è un server HTTP locale sulla porta
 * `E2E_PING_PORT`, a cui punta `HEALTHCHECKS_PING_URL` nell'ambiente di
 * `e2e.mjs serve`. Lo scenario è seriale: un solo server, un solo worker.
 *
 * Lo stato del job lo prepara il test in `job_runs`, con un giro datato fra
 * un'ora — così è l'ultimo, qualunque cosa ci sia già — e marcato in
 * `details`, da cui il `finally` lo toglie. ⚠️ `job_runs` è GLOBALE: per il
 * secondo in cui il giro fallito esiste, l'avviso «Automazioni ferme»
 * comparirebbe nelle impostazioni di qualunque scenario parallelo. Nessuno
 * oggi lo guarda; uno che lo facesse andrebbe messo in serie con questo.
 *
 * Controprova:
 *   - in `pingFor()` restituire sempre `status: "ok"`: cade «un passo fallito
 *     manda fail»;
 *   - togliere `api/cron` dal matcher di `proxy.ts`: cade «senza segreto»,
 *     che riceve 307 invece di 401;
 *   - in `authorized()` restituire `true`: cade «senza segreto».
 */

type Ping = { path: string; body: string };

const MARK = "e2e-160";
let server: Server;
let pings: Ping[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
	server = createServer((req, res) => {
		let body = "";
		req.on("data", (c) => (body += c));
		req.on("end", () => {
			pings.push({ path: req.url ?? "", body });
			res.writeHead(200).end("OK");
		});
	});
	await new Promise<void>((resolve) => server.listen(E2E_PING_PORT, "localhost", resolve));
});

test.afterAll(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.beforeEach(() => {
	pings = [];
});

/** Un giro fra un'ora, con l'esito di ciascun passo. */
function seedRun(steps: { recurring: "ok" | "error"; notifications: "ok" | "error" }) {
	const runAt = new Date(Date.now() + 3_600_000).toISOString();
	localSql(`
		insert into public.job_runs (job_name, run_at, step, status, details) values
			('seichi-daily', '${runAt}', 'recurring', '${steps.recurring}', '${MARK}'),
			('seichi-daily', '${runAt}', 'notifications', '${steps.notifications}', '${MARK}');
	`);
}

function cleanRuns() {
	localSql(`delete from public.job_runs where details = '${MARK}';`);
}

const auth = { authorization: `Bearer ${E2E_CRON_SECRET}` };

test("senza segreto, o con quello sbagliato: 401 e nessun ping", async ({ request }) => {
	const none = await request.get("/api/cron/salute-job", { maxRedirects: 0 });
	expect(none.status()).toBe(401);

	const wrong = await request.get("/api/cron/salute-job", {
		maxRedirects: 0,
		headers: { authorization: "Bearer undefined" },
	});
	expect(wrong.status()).toBe(401);

	expect(pings).toEqual([]);
});

test("un giro riuscito manda ok", async ({ request }) => {
	seedRun({ recurring: "ok", notifications: "ok" });
	try {
		const res = await request.get("/api/cron/salute-job", { maxRedirects: 0, headers: auth });
		expect(res.status()).toBe(200);
		expect(await res.json()).toEqual({ ping: "ok", delivered: true });
	} finally {
		cleanRuns();
	}
	expect(pings).toHaveLength(1);
	expect(pings[0].path).toBe("/ping/e2e");
	expect(pings[0].body).toMatch(/^Job giornaliero sano\./);
});

test("un passo fallito manda fail, e dice quale", async ({ request }) => {
	seedRun({ recurring: "error", notifications: "ok" });
	try {
		const res = await request.get("/api/cron/salute-job", { maxRedirects: 0, headers: auth });
		expect(res.status()).toBe(200);
		expect(await res.json()).toEqual({ ping: "fail", delivered: true });
	} finally {
		cleanRuns();
	}
	expect(pings).toHaveLength(1);
	expect(pings[0].path).toBe("/ping/e2e/fail");
	expect(pings[0].body).toContain("passi falliti: recurring");
	// Il marcatore sta in `details`, che non deve uscire dal database.
	expect(pings[0].body).not.toContain(MARK);
});
