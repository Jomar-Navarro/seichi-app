/**
 * Il verdetto sul job giornaliero (issue #47), come funzione pura.
 *
 * Vive qui, senza Supabase, perché lo pronunciano due voci che non devono
 * poter divergere (#160): l'avviso dell'app in `/impostazioni` (via
 * `lib/jobs.ts`) e il controllo esterno delle 06:00
 * (`app/api/cron/salute-job/route.ts`). Se l'app dicesse «tutto bene» mentre
 * l'email dice «fermo», una delle due sarebbe falsa, e non si saprebbe quale.
 */

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
	/** Da quando si aspetta un giro al giorno (il seme `installed`). */
	watchingSince: Date | null;
	/** Il job non ha un giro riuscito da più di `DAILY_JOB_STALE_HOURS`. */
	overdue: boolean;
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

/** La riga di `daily_job_health()`, come la consegna PostgREST. */
export type DailyJobHealthRow = {
	last_run_at: string | null;
	last_ok_at: string | null;
	had_error: boolean | null;
	failed_steps: string[] | null;
	watching_since: string | null;
};

/**
 * Dai fatti della funzione SQL al verdetto. `now` in millisecondi, come
 * `Date.now()`: passato da fuori, così il test fissa l'istante.
 */
export function judgeDailyJob(row: DailyJobHealthRow, now: number): DailyJobHealth {
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
	const overdue = since === null || now - since.getTime() > staleAfter;
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

	return { lastOkAt, lastRunAt, hadError, failedSteps, watchingSince, overdue, scope, stale };
}

/** Il segnale per il controllo esterno: `ok` o `fail`, e una riga per chi legge l'email. */
export type JobPing = { status: "ok" | "fail"; body: string };

/**
 * Che cosa dire al servizio di sorveglianza (#160). Il testo finisce
 * nell'email a Jomar, non sullo schermo di un utente: per questo non sta nei
 * dizionari, come i log.
 *
 * ⚠️ **Due cause, due frasi** (lezione 8 di CLAUDE.md). «Fallito un passo» e
 * «nessun giro da N ore» mandano a guardare posti diversi — `job_runs.details`
 * nel primo caso, `cron.job_run_details` e lo stato di pg_cron nel secondo — e
 * una frase sola per entrambi ne manderebbe uno a controllare la cosa sana.
 * Lo stesso vale per una lettura fallita (`readFailure`), che non dice niente
 * del job: dice che chi sorveglia non vede.
 *
 * Nessun dato di un utente: `daily_job_health()` restituisce solo date e nomi
 * di passi, e qui non entra altro.
 */
export function pingFor(result: { health: DailyJobHealth } | { readFailure: string }, now: number): JobPing {
	if ("readFailure" in result) {
		return { status: "fail", body: `Lo stato del job non è leggibile: ${result.readFailure}` };
	}

	const h = result.health;
	const iso = (d: Date | null) => (d ? d.toISOString() : "mai");
	const facts = `ultimo giro: ${iso(h.lastRunAt)} · ultimo riuscito: ${iso(h.lastOkAt)} · sorvegliato da: ${iso(h.watchingSince)}`;

	if (!h.stale) return { status: "ok", body: `Job giornaliero sano. ${facts}` };

	const lines: string[] = [];
	if (h.hadError) {
		lines.push(`L'ultimo giro ha passi falliti: ${h.failedSteps.join(", ") || "(nessun nome)"}. Il motivo sta in job_runs.details.`);
	}
	if (h.overdue) {
		const since = h.lastOkAt ?? h.watchingSince;
		const hours = since ? Math.floor((now - since.getTime()) / 3_600_000) : null;
		lines.push(
			hours === null
				? "Il job non ha mai girato e non c'è un seme da cui contare: controlla cron.job e cron.job_run_details."
				: `Nessun giro riuscito da ${hours} ore (soglia ${DAILY_JOB_STALE_HOURS}): controlla cron.job e cron.job_run_details.`,
		);
	}
	return { status: "fail", body: `${lines.join(" ")} ${facts}` };
}
