-- ============================================================================
-- Fase 17b — Notifiche
-- ============================================================================
-- Esegui questo file nel SQL Editor di Supabase. È idempotente.
--
-- ⚠️ RICREA LA TABELLA `notifications`. La prima versione, di poche ore prima,
-- salvava il testo già composto (`title`/`body`) invece di un payload, e usava
-- `destinazione` invece di `destination`. Migrare a colpi di ALTER avrebbe
-- comunque perso i testi, perché da una frase non si ricava il payload che
-- l'avrebbe generata. Contenendo solo notifiche di prova, si ricrea.
-- Su un database con notifiche vere questa parte va sostituita da ALTER espliciti.
--
-- Cosa fa:
--   1. tabella notifications + vincoli
--   2. RLS + grant di UPDATE ristretto alla sola colonna `read`
--   3. generate_notifications() — i quattro eventi, idempotenti per costruzione
--   4. seed dei traguardi già superati (evita il diluvio alla prima esecuzione)
--   5. run_daily_jobs() — passi ISOLATI — e riaggancio del job pg_cron
--   6. delete_current_user() aggiornata
--
-- Progetto e motivazioni: CLAUDE.md → "Fase 17 — budget e notifiche", issue #41.
-- ============================================================================

drop table if exists public.notifications cascade;


-- ----------------------------------------------------------------------------
-- 1. TABELLA notifications
-- ----------------------------------------------------------------------------
-- `dedup_key` rende le notifiche idempotenti PER COSTRUZIONE invece che per
-- attenzione di chi scrive il generatore: ogni evento compone una stringa
-- deterministica e l'insert usa ON CONFLICT DO NOTHING. Il job può girare due
-- volte o fallire a metà — il risultato non cambia.
--
-- ⚠️ Colonna TEXT e non vincolo composito tipizzato: gli eventi hanno chiavi
-- naturali DIVERSE (budget = categoria + inizio periodo; rinnovo abbonamento =
-- recurring_rule_id + data). Una colonna `category_id` che contiene l'id di una
-- regola è un campo che mente sul proprio nome.
--
-- ⚠️ `payload` e NON testo già composto. La prima versione salvava frasi
-- costruite in SQL con `'€ ' || round(x)`, il che significava: valuta cablata
-- ignorando `profiles.currency`, nessun separatore delle migliaia (mentre le
-- card accanto scrivono "€ 1.234" via Intl.NumberFormat), e soprattutto testo
-- COTTO nella riga — la Fase 19 non avrebbe mai potuto tradurre le notifiche
-- già salvate. Il DB registra i FATTI, la presentazione è di chi legge:
-- `lib/notifications.ts` compone la frase alla lettura, con la valuta corrente.

create table public.notifications (
	id          uuid primary key default gen_random_uuid(),
	user_id     uuid not null,
	type        text not null,
	payload     jsonb not null default '{}'::jsonb,
	dedup_key   text not null,
	destination text not null,   -- rotta dell'app: una notifica intoccabile è un vicolo cieco
	read        boolean not null default false,
	created_at  timestamptz not null default now()
);

alter table public.notifications add constraint notifications_user_id_fkey
	foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.notifications add constraint notifications_type_check
	check (type in (
		'budget_soglia',
		'budget_sforato',
		'obiettivo_soglia',
		'abbonamento_rinnovo',
		'ricorrenti_generate'
	));

alter table public.notifications add constraint notifications_dedup_key
	unique (user_id, dedup_key);

create index notifications_user_created_idx
	on public.notifications (user_id, created_at desc);

-- Indice parziale: il badge conta solo le non lette, e col tempo sono la minoranza.
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

-- ⚠️ La policy da sola NON basta, e la prima versione si fermava qui.
-- Una policy RLS non sa limitare le COLONNE: con il solo `for update` l'utente
-- poteva riscriversi `dedup_key` e `destination` sulle proprie righe. Non è un
-- danno estetico:
--   - forgiando una dedup_key futura (`budget_sforato:{cat}:2026-09-01`) si
--     ZITTISCE PER SEMPRE la notifica vera di settembre, perché il generatore
--     la troverebbe in conflitto e la salterebbe. L'idempotenza per costruzione
--     è proprio ciò che rende una chiave falsa un silenziatore permanente;
--   - `destination` finisce dritta in `router.push()`.
-- La chiusura è un GRANT a livello di colonna: la RLS decide QUALI righe, il
-- grant decide QUALI colonne. Servono entrambi.
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
	for update to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

revoke update on public.notifications from authenticated;
grant  update (read) on public.notifications to authenticated;

-- Nessuna policy di INSERT né di DELETE, deliberatamente: le notifiche sono un
-- registro generato dal server, non contenuto dell'utente. Le crea solo
-- generate_notifications(), che è SECURITY DEFINER e scavalca la RLS.


-- ----------------------------------------------------------------------------
-- 3. SOGLIA CONDIVISA
-- ----------------------------------------------------------------------------
-- ⚠️ Duplicazione cross-linguaggio nota e NON eliminabile senza generazione di
-- codice: la stessa soglia serve alla barra (TypeScript, a ogni render) e al
-- job notturno (SQL). Qui è isolata in una funzione invece di essere un `0.8`
-- sparso nella query, così i due punti da tenere allineati sono NOMINATI:
-- questa funzione e `BUDGET_WARNING_THRESHOLD` in `lib/budget.ts`.
-- Cambiarne uno solo farebbe diventare ambra la barra al 75% mentre la notifica
-- continua ad arrivare all'80%, senza alcun errore da nessuna parte.

create or replace function public.budget_warning_threshold()
returns numeric
language sql
immutable
set search_path = ''
as $$ select 0.8::numeric $$;


-- ----------------------------------------------------------------------------
-- 4. GENERAZIONE
-- ----------------------------------------------------------------------------
-- ⚠️ NOTA SUL FUSO. L'app calcola i periodi sul fuso del CLIENT (ClientClock in
-- lib/dates.ts), ma un job non ha un client: gira una volta per tutti e usa
-- l'orologio del database (UTC). È schedulato alle 03:00 UTC apposta, così per
-- l'Europa continentale `current_date` coincide con la data locale dell'utente.
-- Per un fuso molto a ovest le soglie verrebbero valutate con un giorno di
-- anticipo; la chiusura pulita è una colonna `profiles.timezone`.

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
	-- 4a. BUDGET — soglia e sforamento
	------------------------------------------------------------------
	-- Non si può riusare budgets_at(): filtra su auth.uid(), che dal cron è
	-- NULL. Stessa logica in forma insiemistica su tutti gli utenti. DISTINCT ON
	-- raggruppa i NULL, quindi il budget globale è trattato come una categoria
	-- a sé — che è ciò che serve.
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
			cb.user_id, cb.category_id, cb.amount, cb.p_start,
			coalesce(sum(t.amount), 0) as spent
		from current_budgets cb
		left join public.transactions t
			on  t.user_id = cb.user_id
			and t.type = 'spesa'
			and t.date >= cb.p_start
			and t.date <  cb.p_end
			and (cb.category_id is null or t.category_id = cb.category_id)
		where cb.amount is not null   -- le "lapidi" sono budget rimossi
		group by cb.user_id, cb.category_id, cb.amount, cb.p_start
	)
	insert into public.notifications (user_id, type, payload, dedup_key, destination)
	select
		s.user_id,
		case when s.spent >= s.amount then 'budget_sforato' else 'budget_soglia' end,
		jsonb_build_object(
			'category', c.name,      -- NULL per il budget globale: lo interpreta il client
			'spent',    s.spent,
			'amount',   s.amount
		),
		case when s.spent >= s.amount then 'budget_sforato:' else 'budget_soglia:' end
			|| coalesce(s.category_id::text, 'globale') || ':' || s.p_start::text,
		'/transazioni'
	from spending s
	left join public.categories c on c.id = s.category_id
	where s.spent >= s.amount * public.budget_warning_threshold()
	on conflict (user_id, dedup_key) do nothing;

	------------------------------------------------------------------
	-- 4b. OBIETTIVI — 50% e 100%
	------------------------------------------------------------------
	-- Gli obiettivi non hanno tabella propria: sono categorie type='risparmio'
	-- con target_amount, e il risparmiato si somma dalle transazioni (stessa
	-- logica di getGoals). Soglie 50 e 100 e non un avanzamento continuo: un
	-- obiettivo dura mesi, quindi sono due notifiche in tutto.
	with goals as (
		select
			c.user_id, c.id as category_id, c.name, c.target_amount,
			coalesce(sum(t.amount), 0) as saved
		from public.categories c
		left join public.transactions t
			on t.user_id = c.user_id and t.category_id = c.id and t.type = 'risparmio'
		where c.type = 'risparmio'
		  and c.target_amount is not null
		  and c.target_amount > 0
		group by c.user_id, c.id, c.name, c.target_amount
	)
	insert into public.notifications (user_id, type, payload, dedup_key, destination)
	select
		g.user_id,
		'obiettivo_soglia',
		jsonb_build_object(
			'goal',   g.name,
			'saved',  g.saved,
			'target', g.target_amount,
			'pct',    th.pct
		),
		-- Nessun periodo nella chiave: una soglia si attraversa una volta sola
		-- nella vita dell'obiettivo. ⚠️ Ed è proprio per questo che le
		-- notifiche NON si cancellano mai (vedi sezione 5): senza la riga, la
		-- chiave tornerebbe libera e il traguardo verrebbe rinotificato.
		'obiettivo_soglia:' || g.category_id::text || ':' || th.pct::text,
		'/risparmi'
	from goals g
	cross join (values (50), (100)) as th(pct)
	where g.saved >= g.target_amount * th.pct / 100.0
	on conflict (user_id, dedup_key) do nothing;

	------------------------------------------------------------------
	-- 4c. RINNOVO ABBONAMENTO — fino a 3 giorni di anticipo
	------------------------------------------------------------------
	-- Finestra `between today and today + 3` e non `= today + 3`: se il job
	-- salta un giorno l'avviso arriva comunque invece di perdersi, e la dedup lo
	-- tiene singolo.
	--
	-- NB: dal cron il caso `next_run = today` non si presenta, perché
	-- generate_recurring_transactions() ha appena avanzato ogni next_run scaduto.
	-- La finestra resta comunque inclusiva: così la funzione è corretta anche
	-- invocata da sola, senza dipendere in silenzio da chi l'ha preceduta.
	insert into public.notifications (user_id, type, payload, dedup_key, destination)
	select
		r.user_id,
		'abbonamento_rinnovo',
		jsonb_build_object(
			'name',   c.name,
			'amount', r.amount,
			'days',   (r.next_run - today)
		),
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
	-- 4d. CONFERMA GENERAZIONE RICORRENTI
	------------------------------------------------------------------
	-- Gira DOPO generate_recurring_transactions() nella stessa esecuzione,
	-- quindi le righe con created_at di oggi sono quelle appena inserite.
	-- Si filtra su `created_at` e NON su `date`: il ciclo di recupero può
	-- inserire occorrenze arretrate, che hanno data nel passato ma sono state
	-- create adesso.
	--
	-- ⚠️ Solo il CONTEGGIO, nessun totale. Gli importi sono senza segno e la
	-- direzione la porta `type`: sommare uno stipendio da 2000 e un affitto da
	-- 800 darebbe "€ 2800", un numero che non corrisponde a niente di trovabile
	-- nell'app.
	insert into public.notifications (user_id, type, payload, dedup_key, destination)
	select
		t.user_id,
		'ricorrenti_generate',
		jsonb_build_object('count', count(*)),
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
-- 5. NIENTE PULIZIA — e il motivo
-- ----------------------------------------------------------------------------
-- ⚠️ La prima versione cancellava le notifiche lette più vecchie di 90 giorni.
-- ERA UN BUG, non un'ottimizzazione: la riga NON è solo un messaggio, è anche
-- la prova che quell'evento è già stato emesso. Cancellandola si libera la
-- dedup_key, e al giro successivo il generatore rifà la notifica.
--   Obiettivo al 100% il 10 gennaio → letto → cancellato il 10 aprile →
--   l'11 aprile l'obiettivo è ancora al 100%, la chiave è libera, la notifica
--   RINASCE. Ogni 90 giorni, per sempre. Idem per i budget annuali, la cui
--   chiave resta valida 365 giorni contro una finestra di pulizia di 90.
--
-- Scartata l'alternativa di un registro eventi separato, mai cancellato, con le
-- notifiche cancellabili: sarebbe la separazione concettualmente corretta
-- ("evento emesso" e "messaggio in casella" sono fatti diversi), ma aggiunge
-- una tabella per rendere possibile la cancellazione di poche migliaia di righe
-- in dieci anni. Il costo che la pulizia evitava è ipotetico; il difetto che ha
-- introdotto era certo.
--
-- Se un domani il volume lo giustificasse, il registro separato è la strada.
drop function if exists public.purge_old_notifications();


-- ----------------------------------------------------------------------------
-- 6. SEED DEI TRAGUARDI GIÀ SUPERATI
-- ----------------------------------------------------------------------------
-- Senza questo, la PRIMA esecuzione dopo il deploy scoprirebbe tutti i traguardi
-- storici insieme: un utente con sei obiettivi, quattro già al 100%, si
-- ritroverebbe dieci notifiche non lette "adesso" per fatti di mesi fa. È
-- esattamente il rumore che questa fase esiste per evitare.
--
-- Le stesse righe vengono quindi scritte ora, GIÀ LETTE: occupano la dedup_key
-- e spengono il passato senza accendere il badge. I budget non ne hanno bisogno
-- — le loro chiavi sono legate al periodo corrente, quindi la prima esecuzione
-- notifica solo ciò che è vero adesso, che è corretto.
with goals as (
	select
		c.user_id, c.id as category_id, c.name, c.target_amount,
		coalesce(sum(t.amount), 0) as saved
	from public.categories c
	left join public.transactions t
		on t.user_id = c.user_id and t.category_id = c.id and t.type = 'risparmio'
	where c.type = 'risparmio' and c.target_amount is not null and c.target_amount > 0
	group by c.user_id, c.id, c.name, c.target_amount
)
insert into public.notifications (user_id, type, payload, dedup_key, destination, read)
select
	g.user_id,
	'obiettivo_soglia',
	jsonb_build_object('goal', g.name, 'saved', g.saved, 'target', g.target_amount, 'pct', th.pct),
	'obiettivo_soglia:' || g.category_id::text || ':' || th.pct::text,
	'/risparmi',
	true
from goals g
cross join (values (50), (100)) as th(pct)
where g.saved >= g.target_amount * th.pct / 100.0
on conflict (user_id, dedup_key) do nothing;


-- ----------------------------------------------------------------------------
-- 7. JOB GIORNALIERO — passi ISOLATI
-- ----------------------------------------------------------------------------
-- ⚠️ pg_cron esegue il comando come UNA transazione. Nella prima versione i tre
-- passi erano `perform` nudi in sequenza: un'eccezione qualsiasi nella
-- generazione notifiche — un timeout, un lock, un vincolo — avrebbe fatto
-- rollback anche degli INSERT FINANZIARI appena eseguiti dalle ricorrenti.
-- Nel caso benigno si autoripara (torna indietro anche `next_run`, la notte
-- dopo si rigenera), ma un errore PERSISTENTE significa affitto e abbonamenti
-- mai registrati, in silenzio, per settimane.
--
-- Ogni passo ha ora il proprio blocco `exception`: le ricorrenti restano
-- scritte anche se le notifiche falliscono, e il motivo finisce nei log invece
-- di sparire. L'ORDINE resta quello e non è negoziabile — le notifiche devono
-- vedere le transazioni appena generate, altrimenti mancherebbero proprio lo
-- sforamento causato dall'affitto delle 3 di notte.

create or replace function public.run_daily_jobs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	begin
		perform public.generate_recurring_transactions();
	exception when others then
		raise warning 'generate_recurring_transactions fallita: % (%)', sqlerrm, sqlstate;
	end;

	begin
		perform public.generate_notifications();
	exception when others then
		raise warning 'generate_notifications fallita: % (%)', sqlerrm, sqlstate;
	end;
end;
$$;

revoke all on function public.run_daily_jobs() from public, anon, authenticated;

-- Il job della Fase 14 si chiamava 'generate-recurring' e invocava direttamente
-- generate_recurring_transactions(). Ora il nome mentirebbe sul contenuto.
-- Il blocco è condizionale perché cron.unschedule() solleva un errore se il job
-- non esiste, e questo file deve restare rieseguibile.
do $$
begin
	if exists (select 1 from cron.job where jobname = 'generate-recurring') then
		perform cron.unschedule('generate-recurring');
	end if;
end;
$$;

-- cron.schedule() con un nome già esistente lo sostituisce: rieseguire non crea
-- job duplicati. 03:00 UTC — vedi la nota sul fuso nella sezione 4.
select cron.schedule('seichi-daily', '0 3 * * *', $job$select public.run_daily_jobs();$job$);


-- ----------------------------------------------------------------------------
-- 8. ELIMINAZIONE ACCOUNT — aggiornata
-- ----------------------------------------------------------------------------
-- notifications ha già la FK ON DELETE CASCADE, ma delete_current_user() fa i
-- DELETE ESPLICITI tabella per tabella, deliberatamente: resta corretta anche se
-- un domani una FK venisse ricreata senza cascade. Dimenticare una tabella qui
-- non produce errori — lascia dati personali di un utente cancellato.

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
