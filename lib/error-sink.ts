import { after } from "next/server";
import { buildEvent, newEventId, parseDsn, toEnvelope, type ErrorReport } from "@/lib/error-report";

/**
 * La spedizione a Sentry (#160). Solo server: il DSN non arriva al browser, e
 * Sentry vede l'IP di Vercel, non quello di chi usa l'app. Gli errori del
 * client passano da `/api/errori`.
 *
 * ⚠️ **Spedire non deve mai rompere niente.** Senza `SENTRY_DSN` (in locale,
 * in CI) non fa nulla; un invio fallito si scrive nel log e basta, senza
 * passare di nuovo da qui (un guasto di Sentry non deve generare eventi per
 * Sentry); un errore nel costruire l'evento si inghiotte.
 */

const TIMEOUT_MS = 5_000;

/**
 * Un tetto per istanza: 30 eventi al minuto. Un guasto dentro un ciclo — una
 * lettura che fallisce per ogni riga — manderebbe centinaia di eventi uguali,
 * e la quota gratuita di Sentry finirebbe in un pomeriggio. I primi 30 bastano
 * a capire; il tetto lo dice nel log, una volta per finestra.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
let windowStart = 0;
let sentInWindow = 0;
let warnedInWindow = false;

function allow(now: number): boolean {
	if (now - windowStart > WINDOW_MS) {
		windowStart = now;
		sentInWindow = 0;
		warnedInWindow = false;
	}
	if (sentInWindow < MAX_PER_WINDOW) {
		sentInWindow++;
		return true;
	}
	if (!warnedInWindow) {
		warnedInWindow = true;
		console.error(`[errori] oltre ${MAX_PER_WINDOW} eventi in un minuto: i successivi non vanno a Sentry`);
	}
	return false;
}

/** Spedisce subito, e aspetta: per `onRequestError`, che la documentazione vuole attesa. */
export async function sendReport(report: ErrorReport): Promise<void> {
	const dsn = process.env.SENTRY_DSN;
	if (!dsn) return;
	const target = parseDsn(dsn);
	if (!target) {
		console.error("[errori] SENTRY_DSN non è un DSN valido");
		return;
	}
	const now = Date.now();
	if (!allow(now)) return;

	try {
		const event = buildEvent(report, {
			now,
			eventId: newEventId(),
			release: process.env.VERCEL_GIT_COMMIT_SHA,
			environment: process.env.VERCEL_ENV,
		});
		const res = await fetch(target.endpoint, {
			method: "POST",
			headers: {
				"content-type": "application/x-sentry-envelope",
				"x-sentry-auth": `Sentry sentry_version=7, sentry_key=${target.publicKey}, sentry_client=seichi/1`,
			},
			body: toEnvelope(event, dsn, new Date(now)),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!res.ok) console.error(`[errori] Sentry ha risposto ${res.status}`);
	} catch (e) {
		console.error("[errori] invio a Sentry fallito:", e instanceof Error ? e.message : e);
	}
}

/**
 * Spedisce DOPO la risposta, con `after()`: l'utente non aspetta Sentry, e su
 * Vercel la funzione resta viva finché l'invio non finisce (una promise
 * lasciata a sé verrebbe troncata quando la risposta parte).
 *
 * Fuori da una richiesta `after()` solleva: lì si spedisce e basta.
 */
export function queueReport(report: ErrorReport): void {
	if (!process.env.SENTRY_DSN) return;
	try {
		after(() => sendReport(report));
	} catch {
		void sendReport(report);
	}
}
