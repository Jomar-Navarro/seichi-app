-- ============================================================================
-- Le ricorrenti `abbonamento` non sono MAI state generabili (issue #47)
-- ============================================================================
-- ⚠️ ESEGUIRE DOPO `20260809_job_runs.sql`: quel file crea `job_runs` e la
-- versione di `run_daily_jobs()` che questa sostituisce.
--
-- ⚠️ E NON RIESEGUIRE se la `20260814_accounts.sql` è già passata.
--
-- Quella ridichiara `generate_recurring_transactions()` aggiungendo `account_id`
-- all'insert. Questo file la riporterebbe alla versione senza, e da quella notte
-- ogni regola violerebbe il NOT NULL di `transactions.account_id`: il gestore
-- per-regola cattura l'eccezione, `run_daily_jobs()` registra l'errore in
-- `job_runs` e **nessuna ricorrente viene più generata**, senza un solo segnale
-- rivolto all'utente. Lo stesso silenzio durato cinque settimane che questo file
-- esisteva per rompere.
--
-- La guardia riconosce il successore da un fatto del catalogo — la colonna
-- `account_id` su `recurring_rules` — come le guardie di `20260727`, `20260728`
-- e `20260809`. Vale la regola già scritta in CLAUDE.md: il file più recente
-- dev'essere autosufficiente, così non c'è mai motivo di tornare indietro, e chi
-- ci torna comunque viene fermato invece di rompere in silenzio.

do $$
begin
	if exists (
		select 1 from information_schema.columns
		where table_schema = 'public'
			and table_name = 'recurring_rules'
			and column_name = 'account_id'
	) then
		raise exception
			'20260810 già superata da 20260814_accounts.sql: rieseguirla toglierebbe account_id dall''insert delle ricorrenti e fermerebbe il job notturno in silenzio.';
	end if;
end $$;
--
-- ----------------------------------------------------------------------------
-- Cosa diceva il database
-- ----------------------------------------------------------------------------
-- `cron.job_run_details` mostrava, ogni notte dal 3 luglio:
--
--   ERROR: new row for relation "transactions" violates check constraint
--          "transactions_type_check"
--   DETAIL: Failing row contains (…, 39.90, abbonamento, …, Orange palestra, …)
--
-- E `pg_get_constraintdef()` ha confermato il perché — i tre vincoli non erano
-- allineati:
--
--   categories_type_check       entrata, spesa, investimento, risparmio, abbonamento
--   recurring_rules_type_check  entrata, spesa, investimento, risparmio, abbonamento
--   transactions_type_check     entrata, spesa, investimento, risparmio        ← manca
--
-- Una categoria può essere `abbonamento`, una regola ricorrente può essere
-- `abbonamento`, ma la transazione che ne deriva **non può esistere**. Nessun
-- abbonamento ricorrente ha mai potuto materializzarsi: non è una regressione,
-- è un difetto presente da quando il tipo `abbonamento` è stato introdotto, e
-- confermato dal fatto che in `transactions` non c'è una sola riga di quel tipo
-- (per questo `getFixedOutflows` sommava solo le occorrenze FUTURE).
--
-- ⚠️ È il difetto che la issue #43 rende invisibile: nessun file del repo
-- descrive questi vincoli, quindi la divergenza fra due tabelle sorelle non era
-- leggibile da nessuna parte.


-- ----------------------------------------------------------------------------
-- 1. Il vincolo, allineato
-- ----------------------------------------------------------------------------
-- ⚠️ `type` è `character varying`, non `text` — lo si vede dai cast a
-- `character varying` nella definizione originale. Vale la pena registrarlo:
-- **è la conferma retroattiva** che i cast espliciti in `dashboard_totals()`
-- non erano una precauzione ma una necessità, perché `RETURN QUERY` di plpgsql
-- pretende i tipi esatti e `varchar` non è `text`.
--
-- Il `::text` nel CHECK ricopia la forma di `categories_type_check`, per non
-- introdurre una terza convenzione fra tabelle che dicono la stessa cosa.

alter table public.transactions drop constraint if exists transactions_type_check;

alter table public.transactions add constraint transactions_type_check
	check (
		type::text = any (
			array['entrata', 'spesa', 'investimento', 'risparmio', 'abbonamento']::text[]
		)
	);


-- ----------------------------------------------------------------------------
-- 2. Una regola guasta non deve più fermare le altre
-- ----------------------------------------------------------------------------
-- ⚠️ Il difetto peggiore dei tre, e non era quello cercato. `for r in … loop`
-- non aveva alcuna gestione dell'eccezione per singola regola: la prima che
-- fallisce fa abortire l'INTERA funzione. Ecco perché non è stato generato
-- nulla — nemmeno l'ETF, che è `investimento` e sarebbe passato.
--
-- E siccome dal cron `auth.uid()` è NULL e la funzione lavora su TUTTI gli
-- utenti, i dati di un utente potevano fermare le ricorrenti di chiunque altro.
--
-- Ora ogni regola ha la propria sottotransazione: se fallisce, si annullano i
-- suoi insert **e** l'avanzamento del suo `next_run` — quindi ritenta la notte
-- dopo invece di perdere le occorrenze — e il ciclo prosegue con le altre.
--
-- ⚠️ **Isolare un guasto senza registrarlo lo rende invisibile**: è la lezione di
-- questa issue, dove l'`exception` di `run_daily_jobs()` faceva riportare
-- `succeeded` a pg_cron mentre nulla funzionava. Per questo la funzione ora
-- RESTITUISCE il numero di regole saltate invece di `void`, e il chiamante lo
-- scrive in `job_runs` (vedi 3). Senza quel valore di ritorno, l'isolamento
-- per-regola avrebbe ricreato lo stesso silenzio un livello più in basso.
--
-- ⚠️ `drop` e non `create or replace`: cambiare il tipo di ritorno di una
-- funzione richiede di ricrearla, `create or replace` lo rifiuta.
--
-- Lo SCOPING resta intatto e non va toccato: `v_uid := auth.uid()` è NULL dal
-- cron (nessun JWT) e in quel caso il filtro `(v_uid is null or user_id = v_uid)`
-- copre tutti gli utenti; via RPC da un utente autenticato tocca solo le sue
-- regole, ed è ciò che permette a `createRecurringRule` di materializzare subito
-- la prima occorrenza senza poter toccare dati altrui.

drop function if exists public.generate_recurring_transactions();

create function public.generate_recurring_transactions()
returns integer          -- quante regole sono state SALTATE per un errore
language plpgsql
security definer
set search_path to 'public'
as $$
declare
	r public.recurring_rules%rowtype;
	v_uid uuid := auth.uid();
	v_next date;
	v_failed int := 0;
begin
	for r in
		select * from public.recurring_rules
		where active = true
			and next_run <= current_date
			and (v_uid is null or user_id = v_uid)
		-- L'ordine non era specificato: con un guasto significava che *quale*
		-- regola bloccava il giro dipendeva dal piano di esecuzione. Ora è
		-- deterministico, quindi riproducibile.
		order by next_run, id
	loop
		begin
			v_next := r.next_run;
			while v_next <= current_date and (r.end_date is null or v_next <= r.end_date) loop
				insert into public.transactions (user_id, amount, type, category_id, notes, date, recurring_rule_id)
				values (r.user_id, r.amount, r.type, r.category_id, r.notes, v_next, r.id);

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
			-- regola né il suo next_run sono stati scritti. Ritenterà.
			v_failed := v_failed + 1;
			raise warning 'regola ricorrente % saltata: % (%)', r.id, sqlerrm, sqlstate;
		end;
	end loop;

	return v_failed;
end;
$$;

-- ⚠️ Grant ESPLICITI, che prima mancavano. La Fase 14 si affidava al grant di
-- default che Postgres dà a PUBLIC su ogni funzione nuova — e `anon` è membro di
-- PUBLIC, quindi chiunque con la sola chiave pubblicabile poteva invocare una
-- funzione SECURITY DEFINER che, con `auth.uid()` NULL, scrive per TUTTI gli
-- utenti. Non espone dati (il ritorno è un contatore) e l'effetto è idempotente,
-- ma è un privilegio che non ha ragione di esistere. Tutte le funzioni delle
-- Fasi 16-17 hanno già questa coppia; questa era l'unica rimasta scoperta.
revoke all     on function public.generate_recurring_transactions() from public, anon;
grant  execute on function public.generate_recurring_transactions() to authenticated;


-- ----------------------------------------------------------------------------
-- 3. run_daily_jobs() — i fallimenti parziali diventano visibili
-- ----------------------------------------------------------------------------
-- Unica differenza rispetto alla 20260809: il passo `recurring` viene segnato
-- `error` anche quando la funzione **ritorna** senza sollevare ma con regole
-- saltate. È la condizione in cui si trovava questo database da cinque
-- settimane, e che nessuna spia mostrava.

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
			values ('seichi-daily', v_run_at, 'recurring', 'error',
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
-- ⚠️ NON toccato, ma da sapere: `transactions.frequency`
-- ----------------------------------------------------------------------------
-- `pg_get_constraintdef()` ha rivelato anche questo:
--
--   transactions_frequency_check  CHECK (frequency IN ('weekly','monthly','yearly'))
--
-- Una colonna `frequency` su `transactions` che **CLAUDE.md non documenta**, con
-- vocabolario INGLESE mentre `recurring_rules.frequency` usa
-- `settimanale/mensile/annuale`. È un residuo di quando le ricorrenze vivevano
-- sulla transazione, prima che la Fase 14 introducesse `recurring_rules`.
--
-- Non la si tocca qui: eliminare una colonna è irreversibile e va fatto dopo
-- aver verificato che sia davvero vuota, con una migration dedicata. Va aggiunta
-- alla issue #43 — è un altro pezzo di schema che esiste solo dentro Supabase.
--
-- La riga di DETAIL nell'errore del cron mostra 13 valori dove CLAUDE.md
-- documenta 10 colonne: ce ne sono altre due oltre a questa, ancora da mappare.


-- ----------------------------------------------------------------------------
-- 4. Recupero e controprova
-- ----------------------------------------------------------------------------
--   -- Il vincolo ora ammette abbonamento?
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'transactions_type_check';
--
--   -- Recupera l'arretrato. Atteso: ETF 10, Musica 12, Palestra 39,90 × 2
--   -- (3 luglio e 3 agosto) → il saldo totale scende di ~101.
--   select public.run_daily_jobs();
--
--   -- Deve dire 'ok' su entrambi i passi:
--   select run_at, step, status, details from public.job_runs order by run_at desc, step;
--
--   -- E il verdetto che vede l'app:
--   select * from public.daily_job_health();
