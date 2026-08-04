-- ============================================================================
-- Fase 14 — Transazioni ricorrenti  ⚠️ FILE RICOSTRUITO A POSTERIORI
-- ============================================================================
-- Questa SQL è stata eseguita a mano su Supabase il 2026-07-28 e MAI committata:
-- fino al 2026-08-04 è esistita solo dentro il database. Il file è stato
-- ricostruito interrogando il catalogo — `information_schema.columns`,
-- `pg_constraint`, `pg_policies`, `pg_get_functiondef` — e NON a memoria dallo
-- schema documentato: una migration che indovina è peggio di una che manca.
--
-- La data nel nome è quella del merge della PR #38, così l'ordine dei file
-- rispetta le dipendenze reali (`20260729_account_security.sql` cancella da
-- `recurring_rules`, quindi deve venire dopo).
--
-- ⚠️ IL REPO NON È ANCORA AUTOSUFFICIENTE. Qui c'è `recurring_rules`, ma le
-- tabelle di base — `profiles`, `categories`, `transactions` — sono nate nella
-- Fase 3 e non sono mai state versionate: nessun file le crea. Anche la colonna
-- `transactions.recurring_rule_id`, aggiunta dalla Fase 14, vive solo nel
-- database. Ricostruire il progetto da zero oggi NON è possibile partendo dal
-- solo repository.
--
-- ⚠️ La schedulazione pg_cron di questa funzione è stata SOSTITUITA dalla
-- Fase 17b: il job `generate-recurring` non esiste più, al suo posto c'è
-- `seichi-daily` che invoca `run_daily_jobs()` (ricorrenti → notifiche →
-- pulizia). Vedi `20260804_notifications.sql`.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. TABELLA recurring_rules
-- ----------------------------------------------------------------------------
-- Una REGOLA, non le occorrenze materializzate: 120 transazioni future non
-- vengono create in anticipo, nascono quando il fatto accade davvero. `next_run`
-- è il puntatore che rende la generazione idempotente — è l'antenato della
-- `dedup_key` delle notifiche (Fase 17b), stessa proprietà ottenuta in altro modo.

create table if not exists public.recurring_rules (
	id          uuid primary key default gen_random_uuid(),
	user_id     uuid not null,
	amount      numeric(10,2) not null,
	type        text not null,
	category_id uuid,
	notes       text,
	frequency   text not null,
	start_date  date not null,
	next_run    date not null,
	end_date    date,
	active      boolean not null default true,
	created_at  timestamptz not null default now()
);

-- Vincoli con drop+add per rendere il file rieseguibile e allineare la
-- definizione anche su un database dove la tabella esiste già.

alter table public.recurring_rules drop constraint if exists recurring_rules_user_id_fkey;
alter table public.recurring_rules add  constraint recurring_rules_user_id_fkey
	foreign key (user_id) references auth.users (id) on delete cascade;

-- ON DELETE SET NULL e non CASCADE: cancellando una categoria la regola
-- sopravvive senza categoria, invece di sparire in silenzio insieme a lei.
alter table public.recurring_rules drop constraint if exists recurring_rules_category_id_fkey;
alter table public.recurring_rules add  constraint recurring_rules_category_id_fkey
	foreign key (category_id) references public.categories (id) on delete set null;

alter table public.recurring_rules drop constraint if exists recurring_rules_frequency_check;
alter table public.recurring_rules add  constraint recurring_rules_frequency_check
	check (frequency in ('settimanale', 'mensile', 'annuale'));

-- ⚠️ AGGIUNTO IL 2026-08-04, non faceva parte della Fase 14 originale.
-- La tabella è nata senza alcun vincolo su `type`: nel database era testo
-- libero, e a tenerlo onesto c'era solo l'app. Il difetto è emerso scrivendo la
-- notifica di rinnovo abbonamento (Fase 17b), che filtra su
-- `type = 'abbonamento'` e quindi si appoggiava a una disciplina applicativa
-- invece che a un vincolo. Allineato a `categories_type_check`.
alter table public.recurring_rules drop constraint if exists recurring_rules_type_check;
alter table public.recurring_rules add  constraint recurring_rules_type_check
	check (type in ('spesa', 'entrata', 'investimento', 'risparmio', 'abbonamento'));


-- ----------------------------------------------------------------------------
-- 2. RLS
-- ----------------------------------------------------------------------------
-- Riprodotta VERBATIM dal database: una policy sola `FOR ALL`, mentre dalla
-- Fase 16 in poi si scrivono quattro policy separate per comando. Le due forme
-- sono equivalenti in sicurezza.
--
-- ⚠️ Nota di prestazioni, non corretta qui apposta per non far divergere il file
-- dalla realtà: `auth.uid()` è NUDO, e in una policy RLS Postgres lo rivaluta
-- PER OGNI RIGA. Le policy di profiles/budgets/notifications usano
-- `(select auth.uid())`, che il planner tratta come InitPlan e calcola una volta
-- sola. Su una manciata di regole non si nota; da allineare quando si passa di qui.

alter table public.recurring_rules enable row level security;

drop policy if exists "recurring_rules_own" on public.recurring_rules;
create policy "recurring_rules_own" on public.recurring_rules
	for all to authenticated
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 3. generate_recurring_transactions()
-- ----------------------------------------------------------------------------
-- Per ogni regola attiva con next_run scaduto genera le occorrenze fino a oggi
-- e avanza next_run. Il ciclo interno recupera anche più occorrenze in una sola
-- esecuzione, quindi un giorno di cron saltato non perde movimenti — ed è il
-- motivo per cui la notifica "ricorrenti generate" della Fase 17b filtra su
-- `created_at` e non su `date`: quelle righe hanno data nel passato ma sono
-- state create oggi.
--
-- Lo SCOPING è la parte da non toccare: `v_uid := auth.uid()` è NULL quando la
-- funzione parte dal cron (nessun JWT nel contesto), e in quel caso il filtro
-- `(v_uid is null or user_id = v_uid)` la fa lavorare su TUTTI gli utenti.
-- Chiamata invece via RPC da un utente autenticato, auth.uid() ha un valore e
-- tocca solo le sue regole — ed è ciò che permette a createRecurringRule di
-- materializzare subito la prima occorrenza senza poter toccare dati altrui.
--
-- Da qui la sicurezza del wrapper `run_daily_jobs()` della Fase 17b: essendo
-- anch'esso invocato dal cron, auth.uid() resta NULL e il comportamento non cambia.
--
-- NB: usa `SET search_path TO 'public'` mentre le funzioni delle Fasi 16-17
-- usano `SET search_path = ''`. La seconda è più severa, ma qui ogni oggetto è
-- già qualificato con lo schema, quindi non c'è esposizione allo shadowing.

CREATE OR REPLACE FUNCTION public.generate_recurring_transactions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
	r public.recurring_rules%rowtype;
	v_uid uuid := auth.uid();
	v_next date;
begin
	for r in
		select * from public.recurring_rules
		where active = true
			and next_run <= current_date
			and (v_uid is null or user_id = v_uid)
	loop
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
	end loop;
end;
$function$;
