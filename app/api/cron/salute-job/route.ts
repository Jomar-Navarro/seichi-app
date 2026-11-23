import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { pingFor } from "@/lib/job-health";
import { readDailyJobHealth } from "@/lib/jobs";
import type { AppDatabase } from "@/types/database-app";

/**
 * Il controllo esterno del job notturno (#160).
 *
 * Il job gira alle 03:00 UTC dentro Supabase (pg_cron). Il suo stato si vede
 * in `/impostazioni` — ma solo se qualcuno le apre, ed è così che un guasto è
 * rimasto invisibile per cinque settimane fra luglio e agosto 2026 (#47).
 * Questa route la chiama un Vercel Cron alle 06:00 UTC (`vercel.json`): legge
 * `daily_job_health()`, pronuncia lo stesso verdetto dell'app
 * (`judgeDailyJob()`) e lo manda al servizio di sorveglianza, che spedisce
 * l'email.
 *
 * ⚠️ **Il servizio esterno è un «dead man's switch», non una casella di posta.**
 * Avvisa in due casi: quando riceve `fail`, e quando non riceve NIENTE entro
 * l'orario atteso. Il secondo copre ciò che questa route non può dire di sé:
 * un cron di Vercel che smette di partire, una variabile d'ambiente sparita, un
 * deploy rotto. È la regola della #47 portata un livello più su — chi sorveglia
 * non deve guastarsi insieme a ciò che sorveglia — e per questo un guasto della
 * route stessa (configurazione mancante, ping che non parte) finisce in una
 * risposta d'errore SENZA ping: il silenzio è l'allarme. Una lettura fallita
 * dello stato invece è un `fail` esplicito, con la sua frase: lì la route
 * funziona, ed è il database a non rispondere.
 * Non serve l'SMTP di Seichi, che ancora non c'è (#40).
 *
 * ⚠️ **Nessuna chiave segreta di Supabase.** Il cron legge come `anon`, con la
 * chiave pubblicabile, e la migration `20261124` gli concede la sola
 * `daily_job_health()`: cinque fatti globali, nessun dato di un utente.
 *
 * Il proxy non passa di qui (`proxy.ts`, matcher): la route si autentica da
 * sé, con `CRON_SECRET`, che Vercel manda come `Authorization: Bearer …`.
 */

/** Quanto aspettare Supabase e il servizio: un cron appeso non deve durare minuti. */
const TIMEOUT_MS = 10_000;

/**
 * Il segreto si confronta a tempo costante, sugli hash così le lunghezze
 * coincidono sempre. ⚠️ Senza `CRON_SECRET` si rifiuta TUTTO: il confronto
 * ingenuo con `Bearer ${process.env.CRON_SECRET}` accetterebbe la stringa
 * letterale «Bearer undefined».
 */
function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const digest = (s: string) => createHash("sha256").update(s).digest();
	return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}

export async function GET(request: Request) {
	if (!process.env.CRON_SECRET) {
		console.error("[salute-job] CRON_SECRET mancante: la route rifiuta ogni chiamata");
		return Response.json({ error: "non configurata" }, { status: 500 });
	}
	if (!authorized(request)) return Response.json({ error: "non autorizzato" }, { status: 401 });

	const pingUrl = process.env.HEALTHCHECKS_PING_URL;
	if (!pingUrl) {
		// Nessun ping: il servizio non riceve niente e avvisa da sé.
		console.error("[salute-job] HEALTHCHECKS_PING_URL mancante");
		return Response.json({ error: "non configurata" }, { status: 500 });
	}

	// Un client senza sessione: il cron è `anon`, e nessun cookie deve cambiarlo.
	const supabase = createClient<AppDatabase>(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
			global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }) },
		},
	);

	let result: Awaited<ReturnType<typeof readDailyJobHealth>>;
	try {
		result = await readDailyJobHealth(supabase);
	} catch (e) {
		result = { reason: e instanceof Error ? e.message : String(e) };
	}

	const ping = pingFor("reason" in result ? { readFailure: result.reason } : result, Date.now());
	if (ping.status === "fail") console.error("[salute-job]", ping.body);

	try {
		const res = await fetch(ping.status === "ok" ? pingUrl : `${pingUrl.replace(/\/+$/, "")}/fail`, {
			method: "POST",
			headers: { "content-type": "text/plain; charset=utf-8" },
			body: ping.body,
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
	} catch (e) {
		// Il ping non è partito: il servizio, non sentendo nulla, avviserà da sé.
		console.error("[salute-job] ping non consegnato:", e instanceof Error ? e.message : e);
		return Response.json({ ping: ping.status, delivered: false }, { status: 502 });
	}

	return Response.json({ ping: ping.status, delivered: true });
}
