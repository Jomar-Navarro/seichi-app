-- ============================================================================
-- job_runs — il battito cardiaco del job giornaliero (issue #47)
-- ============================================================================
-- ⚠️ ESEGUIRE PRIMA di pubblicare il codice che la usa: `daily_job_health()` è
-- chiamata dalle pagine impostazioni, e senza la funzione la RPC risponde 404.
--
-- ----------------------------------------------------------------------------
-- Il problema che chiude
-- ----------------------------------------------------------------------------
-- `seichi-daily` si è fermato e NULLA l'ha segnalato: il guasto è emerso guardando
-- a occhio una data nella lista delle ricorrenti, dopo settimane. Per un'app che
-- registra movimenti finanziari "l'affitto non è stato registrato per cinque
-- settimane, in silenzio" è la conseguenza peggiore possibile di
-- un'architettura a job notturno.
--
-- La Fase 17b aveva previsto METÀ del problema: i passi di `run_daily_jobs()`
-- hanno un blocco `exception` ciascuno, così un guasto nelle notifiche non fa
-- rollback degli insert finanziari. Ma il motivo finiva solo in `raise warning`,
-- cioè nei log di Postgres, che nessuno legge.
--
-- ----------------------------------------------------------------------------
-- ⚠️ Perché l'allarme NON può essere una notifica, né un secondo cron
-- ----------------------------------------------------------------------------
-- Una notifica non può segnalare che il job è morto: **le notifiche le genera il
-- job**. E un secondo cron di sorveglianza sarebbe soggetto allo stesso guasto —
-- se pg_cron non gira, non gira nemmeno lui.
--
-- L'unica posizione sana è **alla lettura**, lato app, su una traccia che il job
-- lascia dietro di sé. Da qui questa tabella: non è un log per gli umani, è il
-- dato su cui l'app decide se dire qualcosa.


-- ----------------------------------------------------------------------------
-- 1. La tabella
-- ----------------------------------------------------------------------------
-- `run_at` è l'istante di inizio dell'INVOCAZIONE, identico per tutti i passi
-- della stessa esecuzione: è ciò che permette di raggrupparli e dire "l'ultima
-- esecuzione è andata bene per intero", che è la domanda che conta. Con il solo
-- istante per passo non si potrebbe distinguere una notte in cui un passo ha
-- fallito da due notti diverse.

create table if not exists public.job_runs (
	id       bigint generated always as identity primary key,
	job_name text        not null,
	run_at   timestamptz not null,
	step     text        not null,
	status   text        not null check (status in ('ok', 'error')),
	/** sqlerrm + sqlstate del passo fallito. NON esce mai verso il client: vedi 3. */
	details  text,
	logged_at timestamptz not null default now()
);

create index if not exists job_runs_recent_idx
	on public.job_runs (job_name, run_at desc);

-- ⚠️ RLS abilitata e NESSUNA POLICY, deliberatamente: nessun ruolo del client
-- può leggere né scrivere questa tabella. Non è una dimenticanza —
--   · in scrittura è un registro generato dal server, come `notifications`;
--   · in lettura è un dato GLOBALE, non per-utente: un messaggio d'errore
--     prodotto dai dati di un utente sarebbe visibile a tutti gli altri.
-- L'accesso passa solo da `daily_job_health()`, che restituisce un verdetto e
-- non il registro.
alter table public.job_runs enable row level security;

-- La crescita è di due righe al giorno, ~730 all'anno: nessuna pulizia
-- programmata. Aggiungerla sarebbe un job in più da sorvegliare, cioè
-- esattamente il problema che questo file esiste per chiudere.

-- ⚠️ Un seme, per non gridare al lupo il primo giorno.
--
-- Senza alcuna riga `last_run_at` è NULL, e l'app deve trattare "mai girato" come
-- il caso peggiore — è giusto, ma appena eseguita questa migration il job non ha
-- ANCORA avuto occasione di girare (il prossimo giro è alle 03:00), quindi
-- l'avviso comparirebbe subito e a torto per qualche ora.
--
-- Questa riga fa partire il cronometro dell'obsolescenza da adesso. Il passo si
-- chiama `installed` e non `recurring`, così resta leggibile che NON è
-- l'esecuzione di un lavoro: è la dichiarazione "da qui in poi mi aspetto un
-- giro al giorno". Trentasei ore dopo, se il cron non ha girato, l'avviso
-- compare — che è il comportamento corretto.
--
-- `on conflict` non serve: `if not exists` sulla tabella protegge dal doppio
-- inserimento solo alla creazione, quindi si controlla a mano per restare
-- rieseguibili.
insert into public.job_runs (job_name, run_at, step, status, details)
select 'seichi-daily', now(), 'installed', 'ok', 'seme della migration 20260809: avvio del cronometro'
where not exists (
	select 1 from public.job_runs where job_name = 'seichi-daily'
);


-- ----------------------------------------------------------------------------
-- 2. run_daily_jobs() — invariata nella sostanza, ora lascia traccia
-- ----------------------------------------------------------------------------
-- ⚠️ L'ORDINE dei passi non è negoziabile: le notifiche devono vedere le
-- transazioni appena generate, altrimenti mancherebbero proprio lo sforamento
-- causato dall'affitto delle 3 di notte.
--
-- ⚠️ Gli `insert` nei rami `exception` PERSISTONO. `begin … exception … end`
-- apre una sottotransazione: al solleva­mento quella viene annullata, ma il
-- gestore gira nella transazione esterna, quindi la riga di errore resta scritta
-- anche quando il passo è stato annullato. È il motivo per cui questo schema
-- funziona come registro.
--
-- ⚠️ pg_cron esegue il comando come UNA transazione. Se `run_daily_jobs()`
-- arriva alla fine, le righe di `job_runs` sono committate con tutto il resto.
-- Se il job non parte affatto — non schedulato, database fermo — non c'è alcuna
-- riga, ed è esattamente il segnale che serve: l'assenza È l'allarme.
--
-- NB: i passi sono DUE. Il commento della 17b parlava di tre (ricorrenti →
-- notifiche → pulizia) ma la pulizia a 90 giorni è stata scartata perché
-- cancellare una notifica libera la sua `dedup_key` e la fa rigenerare.

create or replace function public.run_daily_jobs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	-- `clock_timestamp()` e non `now()`: quest'ultimo è l'istante di inizio della
	-- TRANSAZIONE e sarebbe identico per esecuzioni diverse solo per caso. Qui
	-- serve un valore stabile dentro l'esecuzione e distinto fra esecuzioni.
	v_run_at timestamptz := clock_timestamp();
begin
	begin
		perform public.generate_recurring_transactions();
		insert into public.job_runs (job_name, run_at, step, status)
		values ('seichi-daily', v_run_at, 'recurring', 'ok');
	exception when others then
		raise warning 'generate_recurring_transactions fallita: % (%)', sqlerrm, sqlstate;
		insert into public.job_runs (job_name, run_at, step, status, details)
		values ('seichi-daily', v_run_at, 'recurring', 'error', sqlerrm || ' [' || sqlstate || ']');
	end;

	begin
		perform public.generate_notifications();
		insert into public.job_runs (job_name, run_at, step, status)
		values ('seichi-daily', v_run_at, 'notifications', 'ok');
	exception when others then
		raise warning 'generate_notifications fallita: % (%)', sqlerrm, sqlstate;
		insert into public.job_runs (job_name, run_at, step, status, details)
		values ('seichi-daily', v_run_at, 'notifications', 'error', sqlerrm || ' [' || sqlstate || ']');
	end;
end;
$$;

revoke all on function public.run_daily_jobs() from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3. daily_job_health() — il verdetto, non il registro
-- ----------------------------------------------------------------------------
-- ⚠️ Restituisce TRE fatti e nessun testo d'errore. `details` resta nella
-- tabella per chi ha accesso al database: esporlo al client significherebbe
-- mostrare a un utente un messaggio prodotto dai dati di un altro.
--
-- ⚠️ `language sql` e non plpgsql, di proposito: `RETURN QUERY` di plpgsql
-- pretende i tipi ESATTI e fallisce a runtime con "structure of query does not
-- match function result type" (già costato un guasto in produzione con
-- `dashboard_totals`). I cast espliciti ci sono comunque — cintura e bretelle.
--
-- La SOGLIA di obsolescenza non sta qui ma in TypeScript
-- (`DAILY_JOB_STALE_HOURS`): è una decisione di prodotto, e cambiarla non deve
-- richiedere una migration.

create or replace function public.daily_job_health()
returns table (
	last_run_at timestamptz,  -- ultima esecuzione, riuscita o no. NULL = mai girato
	last_ok_at  timestamptz,  -- ultima in cui OGNI passo è andato bene
	had_error   boolean       -- l'ultima esecuzione ha avuto almeno un passo fallito
)
language sql
stable
security definer
set search_path = ''
as $$
	with per_run as (
		select
			run_at,
			count(*) filter (where status = 'error') = 0 as ok
		from public.job_runs
		where job_name = 'seichi-daily'
		group by run_at
	)
	select
		(select max(run_at) from per_run)::timestamptz,
		(select max(run_at) from per_run where ok)::timestamptz,
		coalesce((select not ok from per_run order by run_at desc limit 1), false)::boolean;
$$;

revoke all     on function public.daily_job_health() from public, anon;
grant  execute on function public.daily_job_health() to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Il job — riagganciato
-- ----------------------------------------------------------------------------
-- `cron.schedule()` con un nome esistente lo SOSTITUISCE: rieseguire non crea
-- duplicati. La riga sta qui e non solo in `20260804_notifications.sql` perché
-- l'ipotesi più probabile di questa issue è che lo schedule non sia mai stato
-- eseguito: ripeterlo rende il file autosufficiente.
--
-- ⚠️ Se pg_cron non è abilitato sul progetto questa riga FALLISCE, e va abilitato
-- dalla dashboard Supabase (Database → Extensions → pg_cron). Il fallimento è
-- rumoroso ed è giusto così: uno `if exists` che salta in silenzio lascerebbe il
-- database senza job e senza che nessuno lo sappia — di nuovo il difetto di
-- questa issue.
--
-- 03:00 UTC: scelto perché per l'Europa continentale `current_date` lato
-- database coincide con la data locale. Vedi la nota sul fuso nella 17b.

select cron.schedule('seichi-daily', '0 3 * * *', $job$select public.run_daily_jobs();$job$);


-- ----------------------------------------------------------------------------
-- 5. Controprova
-- ----------------------------------------------------------------------------
--   -- Il job è schedulato?
--   select jobid, jobname, schedule, active from cron.job;
--
--   -- Esegui a mano e verifica che lasci traccia:
--   select public.run_daily_jobs();
--   select * from public.job_runs order by run_at desc, step;
--
--   -- Il verdetto che vedrà l'app:
--   select * from public.daily_job_health();
--
--   -- Le ultime esecuzioni secondo pg_cron (fonte indipendente):
--   select jobid, status, return_message, start_time
--   from cron.job_run_details order by start_time desc limit 20;
