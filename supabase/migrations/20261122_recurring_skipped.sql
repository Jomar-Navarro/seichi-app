-- ============================================================================
-- 20261122 — la regola ricorrente saltata si fa sentire (issue #173)
-- ============================================================================
-- Il buco dichiarato dalla #47 (`20260811`, sezione 1): quando il job notturno
-- salta la regola di un utente, `job_runs` dice `partial` e giustamente non alza
-- l'allarme globale — non parlerebbe a nome degli altri — ma l'utente di quella
-- regola non riceve alcun segnale. E `details` porta il NUMERO delle regole
-- saltate, non quali: per trovarle si va a tentativi.
-- Storia: docs/storia/issue-173-ricorrenti-esito.md.
--
-- Cosa fa, in ordine:
--
--   0. guardia: serve la `20260821` (il cursore `for no key update`, gli
--      importi positivi), di cui questo file riscrive la funzione del job.
--
--   1. `notifications_type_check` ammette `ricorrente_saltata`.
--
--   2. `generate_recurring_transactions()` restituisce GLI ID delle regole
--      saltate (`uuid[]`), non più il loro numero. Il conteggio è
--      `cardinality()` dell'array, quindi non si perde niente; e la action
--      che crea una regola sa se è stata saltata proprio LA SUA, invece di un
--      numero che conta anche le altre regole scadute dell'utente.
--
--   3. `run_daily_jobs()`:
--      · `details` elenca gli id;
--      · una notifica `ricorrente_saltata` per ogni regola saltata, al suo
--        proprietario e a nessun altro, con destinazione
--        `/impostazioni/ricorrenti`.
--
--   4. il cron, riagganciato: il file più recente è autosufficiente.
--
-- ⚠️ La dedup è per REGOLA e OCCORRENZA (`ricorrente_saltata:{regola}:
-- {next_run}`), non per regola e giorno come proponeva la issue. Una regola
-- guasta resta guasta finché qualcuno non la corregge, e il suo `next_run` non
-- avanza (la sottotransazione è annullata): con la chiave del giorno sarebbe
-- una notifica ogni notte, il rumore che fa smettere di aprire il campanello
-- (Fase 17). Con l'occorrenza è una sola; se la regola, corretta, si rompe di
-- nuovo più avanti, l'occorrenza è un'altra e la notifica pure. Deciso con
-- Jomar il 2026-11-22.
--
-- ⚠️ La notifica nasce nel passo `notifications`, NON nel blocco delle
-- ricorrenti. Lì un insert fallito farebbe scattare l'`exception` di quel
-- blocco, che annulla la sua sottotransazione: con la notifica se ne
-- andrebbero anche i movimenti appena generati per tutti gli utenti. È la
-- ragione per cui i passi hanno blocchi separati (17b).
--
-- ⚠️ Nasce solo dal cron. `generate_recurring_transactions()` la chiama anche
-- la action che crea una regola, via RPC: quella risponde nel form (#173),
-- mentre l'utente guarda — una notifica tre secondi dopo sarebbe rumore, ed è
-- la regola della 17b («le notifiche servono per ciò che accade mentre non
-- guardi»).
--
-- Ordine di deploy: QUESTO FILE PRIMA del codice. Il codice di oggi chiama la
-- RPC e scarta il risultato, quindi regge qualunque tipo di ritorno; il codice
-- nuovo legge un array, e sul database vecchio riceverebbe un numero.
--
-- Rieseguibile: `drop function if exists` + `create`, il CHECK si toglie e si
-- rimette, `cron.schedule` con lo stesso nome sostituisce.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Guardia: serve la 20260821
-- ----------------------------------------------------------------------------
-- La riconosce dal CHECK sugli importi delle regole, che nasce lì. Senza, il
-- corpo qui sotto si creerebbe lo stesso (plpgsql non controlla le colonne alla
-- creazione) e fallirebbe alle 3 di notte, isolato e quindi muto.

do $$
begin
	if not exists (
		select 1 from pg_constraint
		where conrelid = 'public.recurring_rules'::regclass
		  and conname  = 'recurring_rules_amount_check'
	) then
		raise exception
			'20261122 richiede 20260821_integrity_job_safety.sql (recurring_rules_amount_check non esiste). Eseguire prima quella.';
	end if;
end $$;


-- ----------------------------------------------------------------------------
-- 1. Il tipo nuovo
-- ----------------------------------------------------------------------------
-- Il CHECK si allarga, quindi nessuna riga esistente può violarlo.
-- `lib/notifications.ts` ha un ripiego per i tipi che non conosce: anche con il
-- codice vecchio, la riga direbbe «Notifica» invece di rompere il pannello.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add  constraint notifications_type_check
	check (type in (
		'budget_soglia',
		'budget_sforato',
		'obiettivo_soglia',
		'abbonamento_rinnovo',
		'ricorrenti_generate',
		'ricorrente_saltata'
	));


-- ----------------------------------------------------------------------------
-- 2. generate_recurring_transactions() — gli id delle regole saltate
-- ----------------------------------------------------------------------------
-- ⚠️ `drop` e non `create or replace`: cambia il tipo di ritorno, e
-- `create or replace` lo rifiuta. Il drop porta via i grant, che si rimettono
-- sotto. `run_daily_jobs()` la chiama da plpgsql, che non registra dipendenze:
-- il drop non tocca nient'altro, e la sezione 3 la riscrive comunque.
--
-- Il resto è parola per parola la versione della `20260821`: isolamento per
-- regola, `for no key update` sul cursore, `order by next_run, id`,
-- `search_path = ''`.

drop function if exists public.generate_recurring_transactions();

create function public.generate_recurring_transactions()
returns uuid[]           -- le regole SALTATE per un errore; vuoto, mai NULL, se nessuna
language plpgsql
security definer
set search_path = ''
as $$
declare
	r public.recurring_rules%rowtype;
	v_uid uuid := auth.uid();
	v_next date;
	v_skipped uuid[] := '{}';
begin
	for r in
		select * from public.recurring_rules
		where active = true
			and next_run <= current_date
			and (v_uid is null or user_id = v_uid)
		order by next_run, id
		for no key update
	loop
		begin
			v_next := r.next_run;
			while v_next <= current_date and (r.end_date is null or v_next <= r.end_date) loop
				insert into public.transactions (
					user_id, amount, type, category_id, notes, date, recurring_rule_id, account_id
				)
				values (
					r.user_id, r.amount, r.type, r.category_id, r.notes, v_next, r.id, r.account_id
				);

				v_next := case r.frequency
					when 'settimanale' then v_next + interval '1 week'
					when 'mensile'     then v_next + interval '1 month'
					when 'annuale'     then v_next + interval '1 year'
				end;
			end loop;

			update public.recurring_rules
			set next_run = v_next,
				active = case when r.end_date is not null and v_next > r.end_date then false else active end
			where id = r.id;
		exception when others then
			-- La sottotransazione è già annullata: né le transazioni di questa
			-- regola né il suo next_run sono stati scritti. Ritenterà. Il lock
			-- sulla riga invece resta: lo ha preso il cursore, fuori dal blocco.
			-- Le variabili plpgsql non sono dati e non tornano indietro: l'id
			-- aggiunto qui resta nell'array.
			v_skipped := v_skipped || r.id;
			raise warning 'regola ricorrente % saltata: % (%)', r.id, sqlerrm, sqlstate;
		end;
	end loop;

	return v_skipped;
end;
$$;

revoke all     on function public.generate_recurring_transactions() from public, anon;
grant  execute on function public.generate_recurring_transactions() to authenticated;


-- ----------------------------------------------------------------------------
-- 3. run_daily_jobs() — gli id in `details`, la notifica al proprietario
-- ----------------------------------------------------------------------------
-- Rispetto alla `20260811`:
--   · `details` di `partial` elenca gli id. Il motivo di ciascuna resta nei
--     WARNING dei log di Postgres: è testo del database, e `details` non esce
--     comunque mai verso il client (`daily_job_health()` restituisce fatti).
--   · nel passo `notifications`, una riga per regola saltata.
--
-- `v_skipped` parte vuoto: se `generate_recurring_transactions()` solleva,
-- resta vuoto e nessuno riceve la notifica della singola regola. Quel caso lo
-- dice già l'avviso globale (passo `recurring` in errore), ed è quello giusto:
-- il guasto non è della regola di nessuno. Se invece la funzione ha risposto e
-- cade l'insert in `job_runs` subito dopo, gli id restano (le variabili non
-- tornano indietro) e la notifica parte lo stesso: è ancora vera, quelle
-- regole non hanno scritto niente — come nessun'altra, in quel giro.
--
-- Il payload porta FATTI (17b): il nome della categoria (NULL se la regola l'ha
-- persa: l'app usa un ripiego), l'importo e la DATA dell'occorrenza bloccata.
-- La frase la compone `lib/notifications.ts`, nella lingua e nella valuta di
-- chi legge.

create or replace function public.run_daily_jobs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_run_at  timestamptz := clock_timestamp();
	v_skipped uuid[] := '{}';
begin
	begin
		v_skipped := coalesce(public.generate_recurring_transactions(), '{}');
		if cardinality(v_skipped) > 0 then
			insert into public.job_runs (job_name, run_at, step, status, details)
			values ('seichi-daily', v_run_at, 'recurring', 'partial',
				cardinality(v_skipped) || ' regole saltate: ' || array_to_string(v_skipped, ', ')
				|| ' — il motivo di ciascuna è nei WARNING dei log di Postgres');
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

		-- #173 — la regola saltata, al suo proprietario. La join verso
		-- `categories` confronta anche `user_id` come tutte le altre del job
		-- (regola 8 di database.md).
		insert into public.notifications (user_id, type, payload, dedup_key, destination)
		select
			r.user_id,
			'ricorrente_saltata',
			jsonb_build_object(
				'name',   c.name,
				'amount', r.amount,
				'date',   r.next_run
			),
			'ricorrente_saltata:' || r.id::text || ':' || r.next_run::text,
			'/impostazioni/ricorrenti'
		from public.recurring_rules r
		left join public.categories c on c.id = r.category_id and c.user_id = r.user_id
		where r.id = any (v_skipped)
		on conflict (user_id, dedup_key) do nothing;

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
-- 4. Il cron, riagganciato
-- ----------------------------------------------------------------------------
-- Il file più recente è autosufficiente (database.md, regola 2): per
-- riagganciare il job si esegue questo, mai uno dei precedenti, che
-- riporterebbero `run_daily_jobs()` a una versione superata. Le guardie della
-- `20260804`, della `20260809` e della `20260811` lo rimandano qui; quelle
-- della `20260811` e della `20260821` (aggiunte con la #173) riconoscono
-- questo file dal tipo di ritorno `uuid[]`.

select cron.schedule('seichi-daily', '0 3 * * *', $job$select public.run_daily_jobs();$job$);


-- ----------------------------------------------------------------------------
-- 5. Controprova
-- ----------------------------------------------------------------------------
-- In `supabase/tests/ricorrenti-saltate.test.sql`, a ogni PR. Dopo il rilascio,
-- in sola lettura (`db query --remote --read-only`):
--
--   select pg_get_function_result('public.generate_recurring_transactions()'::regprocedure);
--   -- uuid[]
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'notifications_type_check';
--   -- … 'ricorrente_saltata' …
--   select jobname, schedule, active from cron.job;
--   -- seichi-daily, 0 3 * * *, true — una riga sola
