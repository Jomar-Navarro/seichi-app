import type { SupabaseClient } from "@supabase/supabase-js";
import { judgeDailyJob, type DailyJobHealth, type DailyJobHealthRow } from "@/lib/job-health";
import { createClient } from "@/lib/supabase/server";
import type { AppDatabase } from "@/types/database-app";
import { logServerError } from "@/lib/errors";

export { DAILY_JOB_STALE_HOURS, type DailyJobHealth, type DailyJobScope } from "@/lib/job-health";

/**
 * Legge `daily_job_health()` con il client che riceve e ne trae il verdetto.
 *
 * Il client arriva da fuori perché le due voci che lo chiedono non hanno la
 * stessa identità: le pagine delle impostazioni leggono come l'utente
 * (`getDailyJobHealth()` qui sotto), il controllo esterno delle 06:00 come
 * `anon`, senza sessione (#160). Il verdetto è lo stesso, `judgeDailyJob()`.
 *
 * ⚠️ Una lettura fallita e una riga mancante restituiscono `reason`, non un
 * verdetto: «non lo so» non è «tutto bene» né «fermo», e ciascun chiamante
 * decide che cosa farne.
 */
export async function readDailyJobHealth(
	supabase: SupabaseClient<AppDatabase>,
): Promise<{ health: DailyJobHealth } | { reason: string }> {
	const { data, error } = await supabase.rpc("daily_job_health");

	if (error) return { reason: [error.code, error.message].filter(Boolean).join(" ") };

	// `returns table` con una riga sola: PostgREST consegna comunque un array.
	const row = (Array.isArray(data) ? data[0] : data) as DailyJobHealthRow | undefined;
	if (!row) return { reason: "daily_job_health() senza righe" };

	return { health: judgeDailyJob(row, Date.now()) };
}

/**
 * Lo stato del job giornaliero per le pagine delle impostazioni (issue #47).
 *
 * ⚠️ **Non è un log, è un verdetto.** `daily_job_health()` restituisce tre fatti
 * e nessun messaggio d'errore: `job_runs.details` resta nel database, perché è
 * un dato globale e un errore prodotto dai dati di un utente non deve comparire
 * sullo schermo di un altro.
 *
 * ⚠️ Su fallimento della RPC restituisce `null` invece di sollevare: un
 * controllo di salute rotto non deve portarsi dietro la pagina che lo ospita.
 * Il motivo però finisce nei log del server — se sparisse in silenzio, questa
 * funzione avrebbe lo stesso difetto che esiste per chiudere.
 */
export async function getDailyJobHealth(): Promise<DailyJobHealth | null> {
	const result = await readDailyJobHealth(await createClient());
	if ("reason" in result) {
		logServerError("[jobs] daily_job_health:", result.reason);
		return null;
	}
	return result.health;
}
