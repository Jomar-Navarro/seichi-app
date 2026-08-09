-- ============================================================================
-- L'avviso non deve affermare più di quanto sa (issue #47, code-review)
-- ============================================================================
-- ⚠️ ESEGUIRE DOPO `20260809_job_runs.sql` e `20260810_recurring_fixes.sql`.
--
-- Le due migration precedenti hanno chiuso il guasto — le ricorrenti generano e
-- il job lascia traccia — ma la SORVEGLIANZA costruita per sorvegliarle diceva
-- il falso in tre casi diversi. Sono lo stesso difetto in tre travestimenti, ed
-- è la classe che il documento di progetto eleva a regola nella Fase 18:
-- **un lampo di colore era messo in conto, una dichiarazione falsa no.**
--
--   1. Il seme `installed` era scritto `status = 'ok'`, quindi finiva dentro
--      `last_ok_at`: l'app diceva "ultimo controllo riuscito: 3 giorni fa" per
--      un job che non aveva mai eseguito un solo passo. E siccome la tabella non
--      è mai vuota, il caso "non risulta alcuna esecuzione" era **irraggiungibile**
--      — l'unico messaggio che descriveva davvero quello stato era codice morto.
--
--   2. Il verdetto schiacciava i due passi in un booleano e buttava via `step`.
--      Un guasto nelle sole notifiche faceva scrivere all'app "i movimenti
--      ricorrenti non vengono registrati" mentre erano stati registrati: la
--      tabella sapeva quale passo era fallito, la funzione lo perdeva.
--
--   3. `job_runs` è GLOBALE. Una regola saltata di un utente marcava il passo
--      `recurring` come `error` per l'intera esecuzione, e l'allarme compariva
--      sulle impostazioni di tutti gli altri — le cui ricorrenti erano state
--      generate perfettamente.
--
-- ⚠️ Il punto 3 non si chiude rendendo `job_runs` per-utente: è deliberatamente
-- globale, e per la stessa ragione per cui `details` non esce mai verso il
-- client. Si chiude **abbassando la pretesa dell'affermazione** al livello di
-- ciò che il dato può sostenere.


-- ----------------------------------------------------------------------------
-- 1. Un terzo stato: `partial`
-- ----------------------------------------------------------------------------
-- `ok` e `error` non bastavano a dire due cose diverse:
--
--   · il passo è ESPLOSO      → riguarda tutti, l'allarme globale è giustificato
--   · alcune regole sono state SALTATE → riguarda gli utenti proprietari di
--     quelle regole, e da qui non sappiamo quali siano
--
-- Con un solo `error` per entrambi, il secondo caso gridava al lupo a nome di
-- tutti. `partial` resta **registrato** — l'isolamento senza registrazione è la
-- lezione di questa issue — ma non alza l'allarme che dichiarerebbe il falso.
--
-- ⚠️ Il buco che questo lascia aperto, dichiarato invece che nascosto: l'utente
-- la cui regola viene saltata non riceve alcun segnale. Chiuderlo richiede una
-- dimensione per-utente, e per un guasto della SINGOLA regola una notifica
-- sarebbe la sede giusta (il job è vivo, quindi può generarla — a differenza
-- dell'allarme "job morto", che per costruzione non può essere una notifica).
-- Fuori dallo scopo di questa correzione.

alter table public.job_runs drop constraint if exists job_runs_status_check;

alter table public.job_runs add constraint job_runs_status_check
	check (status in ('ok', 'partial', 'error'));


-- ----------------------------------------------------------------------------
-- 2. run_daily_jobs() — le regole saltate diventano `partial`
-- ----------------------------------------------------------------------------
-- Unica differenza rispetto alla `20260810`: `v_failed > 0` scrive `partial` e
-- non `error`. Il ramo `exception` resta `error`, ed è corretto — là la funzione
-- è esplosa per intero e nessun utente ha avuto le sue ricorrenti.

create or replace function public.run_daily_jobs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_run_at timestamptz := clock_timestamp();
	v_failed int;
begin
	begin
		v_failed := public.generate_recurring_transactions();
		if coalesce(v_failed, 0) > 0 then
			insert into public.job_runs (job_name, run_at, step, status, details)
			values ('seichi-daily', v_run_at, 'recurring', 'partial',
				v_failed || ' regole saltate — il motivo di ciascuna è nei WARNING dei log di Postgres');
		else
			insert into public.job_runs (job_name, run_at, step, status)
			values ('seichi-daily', v_run_at, 'recurring', 'ok');
		end if;
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
-- 3. daily_job_health() — dice QUALE passo, e non conta il seme come riuscita
-- ----------------------------------------------------------------------------
-- ⚠️ `drop` e non `create or replace`: cambia il tipo di ritorno, e
-- `create or replace` lo rifiuta. Stessa ragione per cui la `20260810` ha dovuto
-- ricreare `generate_recurring_transactions()`.
--
-- Due colonne nuove, e ciascuna esiste per rendere DICIBILE una cosa vera:
--
--   · `failed_steps` — quali passi sono esplosi nell'ultima esecuzione. Senza,
--     l'app doveva scegliere una frase sola per due guasti diversi, e la
--     sceglieva sbagliata nella metà dei casi.
--   · `watching_since` — da quando ci si aspetta un giro al giorno, cioè il
--     seme. È ciò che permette di togliere `installed` da `last_ok_at` SENZA
--     far scattare l'allarme il giorno dell'installazione: il cronometro parte
--     comunque, ma non lo si spaccia più per un'esecuzione riuscita.
--
-- ⚠️ È qui il punto delicato della correzione. Escludere il seme da `last_ok_at`
-- e basta avrebbe reso `last_ok_at` NULL su un database appena migrato, e in
-- TypeScript `lastOkAt === null` significa `stale` — cioè l'avviso a torto dal
-- primo minuto, che è esattamente ciò che il seme era stato scritto per
-- impedire. Il seme serve ancora, ma come **inizio del cronometro**, non come
-- riuscita: sono due fatti diversi e ora hanno due colonne diverse.
--
-- `partial` NON toglie l'`ok` alla riga: vedi il punto 1: l'esecuzione, dal
-- punto di vista globale, è andata.

drop function if exists public.daily_job_health();

create function public.daily_job_health()
returns table (
	last_run_at    timestamptz,  -- ultima esecuzione VERA, riuscita o no. NULL = mai girato
	last_ok_at     timestamptz,  -- ultima in cui nessun passo è esploso
	had_error      boolean,      -- l'ultima esecuzione ha almeno un passo `error`
	failed_steps   text[],       -- quali. Mai NULL: array vuoto se nessuno
	watching_since timestamptz   -- da quando ci si aspetta un giro al giorno (il seme)
)
language sql
stable
security definer
set search_path = ''
as $$
	with runs as (
		select
			run_at,
			array_agg(step order by step) filter (where status = 'error') as failed
		from public.job_runs
		where job_name = 'seichi-daily'
		  -- ⚠️ Il seme non è un'esecuzione: dichiara solo che da lì in poi ne
		  -- aspettiamo una al giorno. Contarlo qui era il difetto n.1.
		  and step <> 'installed'
		group by run_at
	),
	last_run as (
		select run_at, failed from runs order by run_at desc limit 1
	)
	select
		(select max(run_at) from runs)::timestamptz,
		(select max(run_at) from runs where failed is null)::timestamptz,
		coalesce((select failed is not null from last_run), false)::boolean,
		coalesce((select failed from last_run), '{}')::text[],
		(select min(run_at) from public.job_runs where job_name = 'seichi-daily')::timestamptz;
$$;

revoke all     on function public.daily_job_health() from public, anon;
grant  execute on function public.daily_job_health() to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Il cron, riagganciato — e perché la riga sta ANCHE qui
-- ----------------------------------------------------------------------------
-- ⚠️ Finora `cron.schedule` esisteva solo in `20260809_job_runs.sql`, e questo
-- era un invito a rieseguire quel file per riagganciare il job. Ma la `20260809`
-- contiene anche la propria versione di `run_daily_jobs()` — quella che scarta
-- il conteggio delle regole saltate — quindi rieseguirla DOPO la `20260810`
-- riportava indietro la rilevazione dei fallimenti parziali **senza un errore e
-- senza lasciare traccia**: il difetto originale, restaurato in silenzio.
--
-- La regola che ne esce: **il file più recente dev'essere autosufficiente**, così
-- non c'è mai motivo di tornare indietro. La `20260809` ha in più una guardia
-- che si rifiuta di girare fuori ordine.
--
-- `cron.schedule()` con un nome esistente lo SOSTITUISCE: rieseguire non duplica.

select cron.schedule('seichi-daily', '0 3 * * *', $job$select public.run_daily_jobs();$job$);


-- ----------------------------------------------------------------------------
-- 5. Controprova
-- ----------------------------------------------------------------------------
--   -- Il seme non conta più come riuscita, e i passi falliti sono nominati:
--   select * from public.daily_job_health();
--
--   -- Su questo database `last_ok_at` deve restare valorizzato (ci sono giri
--   -- veri del 08/08 e del 09/08) e `failed_steps` deve essere vuoto.
--
--   -- Il vincolo accetta il terzo stato:
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'job_runs_status_check';
--
--   -- Il job è ancora agganciato una volta sola:
--   select jobid, jobname, schedule, active from cron.job;
