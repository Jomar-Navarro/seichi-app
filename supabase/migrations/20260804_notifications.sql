-- ============================================================================
-- Fase 17b — Notifiche
-- ============================================================================
-- Esegui questo file nel SQL Editor di Supabase (una volta sola).
-- È idempotente: puoi rieseguirlo senza rompere nulla.
--
-- Cosa fa:
--   1. tabella notifications + vincoli
--   2. RLS (nessuna policy di INSERT: le notifiche non le scrive l'utente)
--   3. generate_notifications() — i quattro eventi, idempotenti per costruzione
--   4. purge_old_notifications() — pulizia delle lette oltre i 90 giorni
--   5. run_daily_jobs() + riaggancio del job pg_cron esistente
--   6. delete_current_user() — aggiornata con la tabella nuova
--
-- Progetto e motivazioni: CLAUDE.md → "Fase 17 — budget e notifiche", issue #41.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. TABELLA notifications
-- ----------------------------------------------------------------------------
-- `dedup_key` è ciò che rende le notifiche idempotenti PER COSTRUZIONE invece
-- che per attenzione di chi scrive il generatore: ogni evento compone una
-- stringa deterministica e l'insert usa ON CONFLICT DO NOTHING. Il job può
-- girare due volte, fallire a metà, essere rilanciato a mano — il risultato non
-- cambia. È l'equivalente di ciò che `next_run` fa per le ricorrenti, ottenuto
-- con un vincolo invece che con un puntatore.
--
-- ⚠️ Perché una colonna TEXT e non un vincolo composito tipizzato: gli eventi
-- hanno chiavi naturali DIVERSE. Budget = categoria + inizio periodo; rinnovo
-- abbonamento = recurring_rule_id + data. Una colonna `category_id` che
-- contiene l'id di una regola è un campo che mente sul proprio nome, e prima o
-- poi qualcuno ci fa una join sbagliata.
--
-- `destinazione` è una rotta dell'app: una notifica che non porta da nessuna
-- parte è un vicolo cieco. Va messa SUBITO — aggiungerla dopo richiederebbe il
-- backfill delle righe già spedite.

create table if not exists public.notifications (
	id           uuid primary key default gen_random_uuid(),
	user_id      uuid not null,
	type         text not null,
	title        text not null,
	body         text,          -- riga di dettaglio opzionale ("€ 612 su € 550")
	dedup_key    text not null,
	destinazione text not null,
	read         boolean not null default false,
	created_at   timestamptz not null default now()
);

alter table public.notifications drop constraint if exists notifications_user_id_fkey;
alter table public.notifications add  constraint notifications_user_id_fkey
	foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add  constraint notifications_type_check
	check (type in (
		'budget_soglia',
		'budget_sforato',
		'obiettivo_soglia',
		'abbonamento_rinnovo',
		'ricorrenti_generate'
	));

-- Qui NULLS NOT DISTINCT non serve: dedup_key è NOT NULL. Il vincolo è
-- l'intero meccanismo di idempotenza, non un'ottimizzazione.
alter table public.notifications drop constraint if exists notifications_dedup_key;
alter table public.notifications add  constraint notifications_dedup_key
	unique (user_id, dedup_key);

-- Il pannello legge "le mie notifiche, più recenti prima".
drop index if exists public.notifications_user_created_idx;
create index notifications_user_created_idx
	on public.notifications (user_id, created_at desc);

-- Il badge conta solo le non lette: indice parziale, molto più piccolo di uno
-- completo perché le lette (la maggioranza, col tempo) non ci entrano.
drop index if exists public.notifications_unread_idx;
create index notifications_unread_idx
	on public.notifications (user_id) where not read;


-- ----------------------------------------------------------------------------
-- 2. RLS
-- ----------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
	for select to authenticated
	using ((select auth.uid()) = user_id);

-- L'UPDATE serve solo a marcare come letta. Postgres non sa limitare una policy
-- a una singola COLONNA, quindi in teoria l'utente potrebbe riscriversi il
-- titolo di una propria notifica. È innocuo — sono dati suoi, che vede solo lui
-- — e l'alternativa (una funzione dedicata) aggiungerebbe un giro per niente.
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
	for update to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

-- ⚠️ NESSUNA policy di INSERT, deliberatamente. Le notifiche sono un registro
-- generato dal server, non contenuto dell'utente: se il client potesse
-- scriverle, "non letto" smetterebbe di significare qualcosa e la dedup_key
-- sarebbe aggirabile. Le crea solo generate_notifications(), che è
-- SECURITY DEFINER e quindi scavalca la RLS.
--
-- Nemmeno una policy di DELETE: la pulizia la fa il job, e l'eliminazione
-- account passa da delete_current_user(), anch'essa SECURITY DEFINER.


-- ----------------------------------------------------------------------------
-- 3. GENERAZIONE
-- ----------------------------------------------------------------------------
-- ⚠️ NOTA SUL FUSO. L'app calcola i periodi sul fuso del CLIENT (vedi
-- ClientClock in lib/dates.ts), ma un job non ha un client: gira una volta per
-- tutti, e deve usare un orologio solo. Usa quello del database (UTC).
-- Il job è schedulato alle 03:00 UTC apposta: per l'Europa continentale sono le
-- 04:00 o 05:00 dello STESSO giorno solare, quindi `current_date` coincide con
-- la data locale dell'utente. Per un fuso molto a ovest (UTC-8) le 03:00 UTC
-- sono le 19:00 del giorno prima, e le soglie verrebbero valutate su un giorno
-- di anticipo. Accettabile finché l'utenza è europea; la chiusura pulita è una
-- colonna `profiles.timezone` e un job che raggruppa per fuso.

create or replace function public.generate_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	today date := current_date;
begin
	------------------------------------------------------------------
	-- 3a. BUDGET — soglia (80%) e sforamento (100%)
	------------------------------------------------------------------
	-- Non si può riusare budgets_at(): quella filtra su auth.uid(), che dal cron
	-- è NULL. Qui la stessa logica è espressa in forma insiemistica su tutti gli
	-- utenti. DISTINCT ON raggruppa i NULL insieme, quindi il budget globale
	-- (category_id NULL) viene trattato come una categoria a sé — che è ciò che
	-- serve.
	with current_budgets as (
		select distinct on (b.user_id, b.category_id)
			b.user_id,
			b.category_id,
			b.amount,
			public.budget_period_start(b.period, today) as p_start,
			public.budget_period_end(b.period, today)   as p_end
		from public.budgets b
		where b.valid_from <= today
		order by b.user_id, b.category_id, b.valid_from desc
	),
	spending as (
		select
			cb.user_id,
			cb.category_id,
			cb.amount,
			cb.p_start,
			coalesce(sum(t.amount), 0) as spent
		from current_budgets cb
		left join public.transactions t
			on  t.user_id = cb.user_id
			and t.type = 'spesa'
			and t.date >= cb.p_start
			and t.date <  cb.p_end
			and (cb.category_id is null or t.category_id = cb.category_id)
		-- Le "lapidi" (amount NULL) sono budget rimossi: niente da sorvegliare.
		where cb.amount is not null
		group by cb.user_id, cb.category_id, cb.amount, cb.p_start
	)
	insert into public.notifications (user_id, type, title, body, dedup_key, destinazione)
	select
		s.user_id,
		case when s.spent >= s.amount then 'budget_sforato' else 'budget_soglia' end,
		case
			when s.category_id is null and s.spent >= s.amount
				then 'Limite di spesa superato'
			when s.category_id is null
				then 'Limite di spesa quasi raggiunto'
			-- coalesce difensivo: con un name NULL la concatenazione darebbe un
			-- title NULL, il NOT NULL solleverebbe eccezione e farebbe fallire
			-- l'INTERO job notturno per tutti gli utenti. La FK in cascade rende
			-- il caso impossibile oggi, ma un job non sorvegliato non è il posto
			-- dove appoggiarsi a un'invariante altrui.
			when s.spent >= s.amount
				then 'Budget "' || coalesce(c.name, 'categoria') || '" superato'
			else 'Budget "' || coalesce(c.name, 'categoria') || '" quasi esaurito'
		end,
		'Hai speso € ' || round(s.spent)::text || ' su € ' || round(s.amount)::text,
		-- L'inizio periodo è già normalizzato a un confine dal CHECK sulla
		-- tabella budgets: due esecuzioni calcolano la stessa chiave, sempre.
		case when s.spent >= s.amount then 'budget_sforato:' else 'budget_soglia:' end
			|| coalesce(s.category_id::text, 'globale') || ':' || s.p_start::text,
		'/transazioni'
	from spending s
	left join public.categories c on c.id = s.category_id
	where s.spent >= s.amount * 0.8
	on conflict (user_id, dedup_key) do nothing;

	------------------------------------------------------------------
	-- 3b. OBIETTIVI — 50% e 100%
	------------------------------------------------------------------
	-- Gli obiettivi non hanno tabella propria: sono categorie type='risparmio'
	-- con target_amount, e il risparmiato si somma dalle transazioni (stessa
	-- logica di getGoals in app/(main)/risparmi/actions.ts).
	--
	-- Soglie 50 e 100 e non un avanzamento continuo: un obiettivo dura mesi,
	-- quindi sono due notifiche in tutto. Il mockup mostrava "al 58%", cioè un
	-- numero arbitrario — sarebbe rumore, e il rumore fa smettere di aprire il
	-- campanello.
	with goals as (
		select
			c.user_id,
			c.id as category_id,
			c.name,
			c.target_amount,
			coalesce(sum(t.amount), 0) as saved
		from public.categories c
		left join public.transactions t
			on  t.user_id = c.user_id
			and t.category_id = c.id
			and t.type = 'risparmio'
		where c.type = 'risparmio'
		  and c.target_amount is not null
		  and c.target_amount > 0
		group by c.user_id, c.id, c.name, c.target_amount
	)
	insert into public.notifications (user_id, type, title, body, dedup_key, destinazione)
	select
		g.user_id,
		'obiettivo_soglia',
		case
			when th.pct = 100 then 'Obiettivo "' || coalesce(g.name, 'senza nome') || '" raggiunto'
			else 'Obiettivo "' || coalesce(g.name, 'senza nome') || '" a metà strada'
		end,
		'Hai messo da parte € ' || round(g.saved)::text
			|| ' su € ' || round(g.target_amount)::text,
		-- Nessun periodo nella chiave: una soglia si attraversa una volta sola
		-- nella vita dell'obiettivo.
		'obiettivo_soglia:' || g.category_id::text || ':' || th.pct::text,
		'/risparmi'
	from goals g
	cross join (values (50), (100)) as th(pct)
	where g.saved >= g.target_amount * th.pct / 100.0
	on conflict (user_id, dedup_key) do nothing;

	------------------------------------------------------------------
	-- 3c. RINNOVO ABBONAMENTO — 3 giorni di anticipo
	------------------------------------------------------------------
	-- La finestra è `between today and today + 3` e non `= today + 3`: se il job
	-- salta un giorno, l'avviso arriva comunque il giorno dopo invece di andare
	-- perso per sempre. La dedup_key contiene la data di rinnovo, quindi nei
	-- giorni successivi l'insert trova il conflitto e non duplica.
	insert into public.notifications (user_id, type, title, body, dedup_key, destinazione)
	select
		r.user_id,
		'abbonamento_rinnovo',
		'Rinnovo "' || coalesce(c.name, 'abbonamento') || '" '
			|| case (r.next_run - today)
				when 0 then 'oggi'
				when 1 then 'domani'
				else 'fra ' || (r.next_run - today)::text || ' giorni'
			end,
		'Sono previsti € ' || round(r.amount)::text,
		'abbonamento_rinnovo:' || r.id::text || ':' || r.next_run::text,
		'/impostazioni/ricorrenti'
	from public.recurring_rules r
	left join public.categories c on c.id = r.category_id
	where r.active
	  and r.type = 'abbonamento'
	  and r.next_run between today and today + 3
	  and (r.end_date is null or r.end_date >= r.next_run)
	on conflict (user_id, dedup_key) do nothing;

	------------------------------------------------------------------
	-- 3d. CONFERMA GENERAZIONE RICORRENTI
	------------------------------------------------------------------
	-- L'app rende conto della propria automazione: sono movimenti comparsi
	-- mentre l'utente non guardava. Gira DOPO generate_recurring_transactions()
	-- nella stessa esecuzione (vedi run_daily_jobs), quindi le righe con
	-- created_at di oggi sono esattamente quelle appena inserite.
	insert into public.notifications (user_id, type, title, body, dedup_key, destinazione)
	select
		t.user_id,
		'ricorrenti_generate',
		case count(*)
			when 1 then 'Registrato 1 movimento ricorrente'
			else 'Registrati ' || count(*)::text || ' movimenti ricorrenti'
		end,
		'Totale € ' || round(sum(t.amount))::text,
		'ricorrenti_generate:' || today::text,
		'/transazioni'
	from public.transactions t
	where t.recurring_rule_id is not null
	  and t.created_at >= today
	  and t.created_at <  today + 1
	group by t.user_id
	on conflict (user_id, dedup_key) do nothing;
end;
$$;

revoke all on function public.generate_notifications() from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 4. PULIZIA
-- ----------------------------------------------------------------------------
-- Solo le LETTE: una non letta di quattro mesi fa è comunque una cosa che
-- l'utente non ha mai visto, e cancellarla sarebbe perdere l'unica informazione
-- che il pannello porta. Senza questa pulizia la tabella cresce per sempre, e
-- nessuno la svuota a mano.

create or replace function public.purge_old_notifications()
returns void
language sql
security definer
set search_path = ''
as $$
	delete from public.notifications
	where read and created_at < now() - interval '90 days';
$$;

revoke all on function public.purge_old_notifications() from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 5. JOB GIORNALIERO
-- ----------------------------------------------------------------------------
-- ⚠️ L'ORDINE È LA CORRETTEZZA, non un'ottimizzazione. Le notifiche vanno
-- generate DOPO le ricorrenti: al contrario valuterebbero lo stato di ieri e
-- mancherebbero proprio lo sforamento causato dalla ricorrente appena inserita
-- — l'affitto delle 3 di notte, che è il caso per cui esistono.
--
-- Per questo il job non diventa un secondo cron a un orario più tardi (sperare
-- che il primo abbia finito non è una garanzia): è una funzione sola che le
-- chiama in sequenza, e il job esistente viene riagganciato a lei.

create or replace function public.run_daily_jobs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	perform public.generate_recurring_transactions();
	perform public.generate_notifications();
	perform public.purge_old_notifications();
end;
$$;

revoke all on function public.run_daily_jobs() from public, anon, authenticated;

-- Il job della Fase 14 si chiamava 'generate-recurring' e invocava direttamente
-- generate_recurring_transactions(). Ora il nome mentirebbe sul contenuto,
-- quindi si smonta e si ricrea con un nome onesto. Il blocco è condizionale
-- perché cron.unschedule() solleva un errore se il job non esiste, e questo
-- file deve restare rieseguibile.
do $$
begin
	if exists (select 1 from cron.job where jobname = 'generate-recurring') then
		perform cron.unschedule('generate-recurring');
	end if;
end;
$$;

-- cron.schedule() con un nome già esistente lo sostituisce: rieseguire non
-- crea job duplicati. Stesso orario di prima (03:00 UTC) — vedi la nota sul
-- fuso in cima alla sezione 3.
select cron.schedule('seichi-daily', '0 3 * * *', $job$select public.run_daily_jobs();$job$);


-- ----------------------------------------------------------------------------
-- 6. ELIMINAZIONE ACCOUNT — aggiornata
-- ----------------------------------------------------------------------------
-- notifications ha già la FK ON DELETE CASCADE, ma delete_current_user() fa i
-- DELETE ESPLICITI tabella per tabella, deliberatamente: resta corretta anche se
-- un domani una FK venisse ricreata senza cascade. Dimenticare una tabella qui
-- non produce alcun errore — lascia solo dati personali di un utente
-- cancellato, che è il problema GDPR che quel blocco previene.

create or replace function public.delete_current_user(dry_run boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	uid uuid := auth.uid();
begin
	if uid is null then
		raise exception 'not authenticated' using errcode = '28000';
	end if;

	-- dry_run: prova a vuoto che deleteAccount() esegue PRIMA di cancellare i
	-- file dell'avatar, che è irreversibile.
	if dry_run then
		return;
	end if;

	-- I file dello Storage NON si cancellano da qui: Supabase blocca il DELETE
	-- diretto su storage.objects. Ci pensa deleteAccount() lato app.

	delete from public.notifications   where user_id = uid;
	delete from public.budgets         where user_id = uid;
	delete from public.transactions    where user_id = uid;
	delete from public.recurring_rules where user_id = uid;
	delete from public.categories      where user_id = uid;
	delete from public.profiles        where id      = uid;

	delete from auth.users where id = uid;
end;
$$;

revoke all     on function public.delete_current_user(boolean) from public, anon;
grant  execute on function public.delete_current_user(boolean) to authenticated;
