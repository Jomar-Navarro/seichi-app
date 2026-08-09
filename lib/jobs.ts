import { createClient } from "@/lib/supabase/server";

/**
 * Da quante ore senza un'esecuzione riuscita il job si considera fermo.
 *
 * Il cron gira alle 03:00 UTC, quindi 24 ore sono il ritmo atteso: 36 lascia
 * margine per un singolo ritardo — un giro lento, un riavvio del database —
 * senza perdere sensibilità a un guasto vero, che dopo un giorno e mezzo è
 * ormai un guasto e non un'incertezza.
 *
 * ⚠️ Vive in TypeScript e non nella funzione SQL di proposito: è una decisione
 * di prodotto, e cambiarla non deve richiedere una migration.
 */
export const DAILY_JOB_STALE_HOURS = 36;

/**
 * Che cosa è compromesso, e quindi che cosa si può onestamente affermare.
 *
 * ⚠️ Non è una sfumatura estetica, è la differenza fra una frase vera e una
 * falsa. Se fallisce il solo passo delle notifiche, i movimenti ricorrenti
 * SONO stati registrati: dirlo comunque — come faceva la prima versione, che
 * schiacciava i due passi in un booleano — è una dichiarazione falsa sullo
 * stato dei dati finanziari dell'utente, cioè il difetto peggiore che questa
 * pagina possa contenere.
 */
export type DailyJobScope = "recurring" | "notifications";

export type DailyJobHealth = {
	/** Ultima esecuzione in cui nessun passo è esploso. `null` = nessuna. */
	lastOkAt: Date | null;
	/** Ultima esecuzione VERA, riuscita o no. `null` = il job non ha mai girato. */
	lastRunAt: Date | null;
	/** L'ultima esecuzione ha avuto almeno un passo fallito. */
	hadError: boolean;
	/** Quali passi sono esplosi nell'ultima esecuzione. Vuoto se nessuno. */
	failedSteps: string[];
	/** Su cosa è lecito fare affermazioni. Vedi `DailyJobScope`. */
	scope: DailyJobScope;
	/**
	 * L'unica domanda che la UI deve porsi: c'è qualcosa che non va?
	 *
	 * Vero in tre casi, e i primi due sono ovvi: mai girato, oppure l'ultima
	 * riuscita è troppo vecchia. "Non è mai riuscito" non è meglio di "non riesce
	 * da giorni".
	 *
	 * ⚠️ Il terzo è `hadError`, e all'inizio mancava. Con un passo che falliva
	 * ogni notte, `hadError` era vero subito ma la riuscita più recente restava
	 * indietro: per 36 ore l'avviso non sarebbe comparso **pur sapendo già** che
	 * qualcosa era rotto. Un errore accertato non ha bisogno di invecchiare per
	 * contare — è il caso reale che ha rivelato il buco (le ricorrenti fallivano
	 * dal 3 luglio mentre pg_cron riportava `succeeded`).
	 */
	stale: boolean;
};

/**
 * Lo stato del job giornaliero (issue #47).
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
	const supabase = await createClient();
	const { data, error } = await supabase.rpc("daily_job_health");

	if (error) {
		console.error("[jobs] daily_job_health:", error.message);
		return null;
	}

	// `returns table` con una riga sola: PostgREST consegna comunque un array.
	const row = (Array.isArray(data) ? data[0] : data) as
		| {
				last_run_at: string | null;
				last_ok_at: string | null;
				had_error: boolean;
				failed_steps: string[] | null;
				watching_since: string | null;
		  }
		| undefined;

	if (!row) return null;

	const lastOkAt = row.last_ok_at ? new Date(row.last_ok_at) : null;
	const lastRunAt = row.last_run_at ? new Date(row.last_run_at) : null;
	const watchingSince = row.watching_since ? new Date(row.watching_since) : null;
	const hadError = row.had_error === true;
	const failedSteps = row.failed_steps ?? [];

	/**
	 * ⚠️ Il ripiego su `watchingSince` non è una comodità: senza, un database
	 * appena migrato avrebbe `lastOkAt === null` — perché il seme `installed` non
	 * conta più come riuscita — e l'avviso comparirebbe dal primo minuto, cioè
	 * proprio ciò che il seme esiste per impedire. Il seme dichiara "da qui mi
	 * aspetto un giro al giorno": è l'inizio del cronometro, non un lavoro svolto.
	 * Nessuna delle due righe è disponibile → non c'è alcuna traccia, e "nessuna
	 * traccia" è il caso peggiore, non il migliore.
	 */
	const since = lastOkAt ?? watchingSince;
	const staleAfter = DAILY_JOB_STALE_HOURS * 60 * 60 * 1000;
	const overdue = since === null || Date.now() - since.getTime() > staleAfter;
	const stale = hadError || overdue;

	/**
	 * ⚠️ L'affermazione forte — "i movimenti ricorrenti non vengono registrati" —
	 * è lecita solo se il passo `recurring` è esploso, **oppure** se il job non
	 * gira più affatto: in quel caso nessun passo viene eseguito, quindi le
	 * ricorrenti sono ferme per definizione. Se invece il job è fresco e a
	 * fallire sono state le sole notifiche, i movimenti ci sono e va detto.
	 */
	const scope: DailyJobScope =
		overdue || failedSteps.includes("recurring") ? "recurring" : "notifications";

	return { lastOkAt, lastRunAt, hadError, failedSteps, scope, stale };
}
