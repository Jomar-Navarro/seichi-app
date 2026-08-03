-- ============================================================================
-- Fase 17a — Budget per categoria (+ budget globale)
-- ============================================================================
-- Esegui questo file nel SQL Editor di Supabase (una volta sola).
-- È idempotente: puoi rieseguirlo senza rompere nulla.
--
-- ⚠️ Richiede PostgreSQL 15+ (per NULLS NOT DISTINCT). Supabase lo è.
--    Su una versione precedente il CREATE UNIQUE INDEX fallisce con un errore
--    di sintassi, non con un messaggio comprensibile: se succede, è questo.
--
-- Cosa fa:
--   1. budget_period_start() / budget_period_end() — i confini di periodo
--   2. tabella budgets + vincoli
--   3. RLS su budgets
--   4. budgets_at() — il budget applicabile a una data, per categoria
--   5. delete_current_user() — aggiornata con la tabella nuova
--
-- Progetto e motivazioni: CLAUDE.md → "Fase 17 — budget e notifiche".
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. CONFINI DI PERIODO
-- ----------------------------------------------------------------------------
-- Un budget è una finestra sul tempo CONDIVISO, non un evento che si ripete:
-- l'utente pensa "questa settimana", non "i 7 giorni da quando l'ho creato".
-- Quindi i periodi sono ancorati al calendario — settimana da lunedì (date_trunc
-- 'week' in Postgres parte da lunedì), mese dal 1°, anno solare.
--
-- È DIVERSO da recurring_rules, deliberatamente: lì l'ancoraggio è start_date
-- perché l'affitto esce il 5. Non c'è conflitto con addClampedMonths() di
-- lib/recurring.ts: qui i confini non si calcolano avanzando di un periodo, si
-- ottengono troncando una data. Nessun caso limite tipo "31 gennaio + 1 mese".
--
-- Definiti come funzioni, non copiati inline nei vari punti, perché servono in
-- tre posti: il CHECK sulla tabella, la lettura in budgets_at() e (via RPC) la
-- UI. Tre copie della stessa CASE sono tre occasioni di divergere.

create or replace function public.budget_period_start(p_period text, ref_date date)
returns date
language sql
immutable
set search_path = ''
as $$
	select (
		case p_period
			when 'settimanale' then date_trunc('week',  ref_date::timestamp)
			when 'mensile'     then date_trunc('month', ref_date::timestamp)
			when 'annuale'     then date_trunc('year',  ref_date::timestamp)
		end
	)::date;
$$;

-- Fine ESCLUSIVA: il primo giorno del periodo successivo. Serve per sommare le
-- transazioni con `date >= period_start and date < period_end`, che è l'unica
-- forma che non sbaglia sull'ultimo istante del periodo (un `<=` sulla data di
-- fine perderebbe o duplicherebbe le transazioni con orario).
create or replace function public.budget_period_end(p_period text, ref_date date)
returns date
language sql
immutable
set search_path = ''
as $$
	-- Il cast finale è esplicito di proposito: `date + interval` produce un
	-- timestamp, e affidarsi al cast implicito verso il tipo di ritorno rende la
	-- funzione dipendente da una coercizione che è meglio non dare per scontata.
	select (
		public.budget_period_start(p_period, ref_date) + (
			case p_period
				when 'settimanale' then interval '1 week'
				when 'mensile'     then interval '1 month'
				when 'annuale'     then interval '1 year'
			end
		)
	)::date;
$$;


-- ----------------------------------------------------------------------------
-- 2. TABELLA budgets
-- ----------------------------------------------------------------------------
-- Sei colonne, nessuno stato da mantenere, nessuna riga generata da un job.
--
-- NIENTE valid_to: è ridondante. La riga successiva chiude la precedente, e il
-- budget di un periodo è "la riga più recente con valid_from <= inizio periodo".
-- Sovrapposizioni impossibili per costruzione invece che per disciplina, e lo
-- storico esce gratis: se a marzo il budget era 300 e a giugno diventa 400,
-- marzo continua a valere 300 per sempre senza che nessuno abbia scritto niente
-- ad aprile e maggio.
--
-- Conseguenza voluta sul lato UI: correggere un errore di battitura e alzare il
-- budget sono la STESSA operazione nel codice. Scrivere nel periodo corrente
-- sovrascrive la riga esistente (stesso valid_from → upsert), scrivere in un
-- periodo futuro ne crea una nuova. L'intenzione si deduce dal periodo, quindi
-- all'utente non va mai chiesta.

create table if not exists public.budgets (
	id          uuid primary key default gen_random_uuid(),
	user_id     uuid not null,
	category_id uuid,           -- NULL = budget GLOBALE (vedi sotto)
	period      text not null,
	amount      numeric(10,2),  -- NULL = "lapide" (vedi sotto)
	valid_from  date not null,
	created_at  timestamptz not null default now()
);

-- FK ricreate con drop+add invece che inline: rende il file rieseguibile e
-- allinea la definizione anche su un database dove la tabella esiste già.
alter table public.budgets drop constraint if exists budgets_user_id_fkey;
alter table public.budgets add  constraint budgets_user_id_fkey
	foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.budgets drop constraint if exists budgets_category_id_fkey;
alter table public.budgets add  constraint budgets_category_id_fkey
	foreign key (category_id) references public.categories (id) on delete cascade;

alter table public.budgets drop constraint if exists budgets_period_check;
alter table public.budgets add  constraint budgets_period_check
	check (period in ('settimanale', 'mensile', 'annuale'));

-- amount NULL = "da questo periodo, nessun budget" (la lapide che sostituisce
-- il valid_to per la cancellazione).
--
-- ⚠️ NON si usa 0 per cancellare: zero è un budget LEGITTIMO e significativo
-- ("in questa categoria non voglio spendere niente"). Sovraccaricarlo
-- distruggerebbe un'informazione vera che l'utente ha il diritto di esprimere.
alter table public.budgets drop constraint if exists budgets_amount_check;
alter table public.budgets add  constraint budgets_amount_check
	check (amount is null or amount > 0);

-- Il budget globale è ancorato allo stipendio, che è mensile. Renderlo
-- configurabile creerebbe annidamenti non interpretabili (un budget settimanale
-- dentro un globale annuale non si somma a niente: un mese non contiene un
-- numero intero di settimane). Per le CATEGORIE invece i periodi misti sono
-- voluti — la spesa alimentare ha davvero un ritmo settimanale, i viaggi annuale.
alter table public.budgets drop constraint if exists budgets_global_is_monthly_check;
alter table public.budgets add  constraint budgets_global_is_monthly_check
	check (category_id is not null or period = 'mensile');

-- valid_from è SEMPRE un confine di periodo, e lo impone il database.
-- Non è una convenzione che l'app deve ricordarsi: una riga scritta a mano dal
-- SQL Editor con una data a metà mese viene rifiutata. È anche ciò che rende
-- deterministica la chiave di idempotenza delle notifiche (Fase 17b): due
-- esecuzioni del cron calcolano lo stesso inizio periodo, sempre.
--
-- ⚠️ Caveat Postgres: un CHECK che chiama una funzione non viene rivalidato se
-- la funzione cambia. Se un domani si tocca budget_period_start(), le righe
-- già scritte NON vengono ricontrollate — va fatto a mano.
alter table public.budgets drop constraint if exists budgets_valid_from_is_period_start_check;
alter table public.budgets add  constraint budgets_valid_from_is_period_start_check
	check (valid_from = public.budget_period_start(period, valid_from));

-- ⚠️ NULLS NOT DISTINCT è la clausola che tiene in piedi il budget globale.
-- Di default, in un vincolo di unicità Postgres considera ogni NULL DIVERSO da
-- ogni altro NULL: senza questa clausola, due budget globali (category_id NULL)
-- per lo stesso periodo passerebbero entrambi, senza errore, e la barra di
-- progresso mostrerebbe un totale a caso tra i due.
drop index if exists public.budgets_user_category_period_key;
create unique index budgets_user_category_period_key
	on public.budgets (user_id, category_id, valid_from) nulls not distinct;

-- La lettura è sempre "l'ultima riga con valid_from <= X, per categoria":
-- questo indice la risolve senza ordinamenti aggiuntivi.
drop index if exists public.budgets_lookup_idx;
create index budgets_lookup_idx
	on public.budgets (user_id, category_id, valid_from desc);

-- NB: "solo le categorie di tipo 'spesa' possono avere un budget" NON è imposto
-- qui. Non è esprimibile con una FK, e servirebbe una colonna `type`
-- denormalizzata o un trigger. Lo stato illegale che preverrebbe è innocuo — un
-- budget su una categoria risparmio non troverebbe transazioni da sommare e
-- mostrerebbe 0 — quindi il controllo sta nella server action. Denormalizzare
-- per prevenire un difetto cosmetico costa più di quanto rende.


-- ----------------------------------------------------------------------------
-- 3. RLS
-- ----------------------------------------------------------------------------
alter table public.budgets enable row level security;

drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own" on public.budgets
	for select to authenticated
	using ((select auth.uid()) = user_id);

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own" on public.budgets
	for insert to authenticated
	with check ((select auth.uid()) = user_id);

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own" on public.budgets
	for update to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

-- DELETE consentito: serve a disfare una riga creata per sbaglio. La rimozione
-- NORMALE di un budget non passa da qui — è la lapide (amount NULL), che
-- preserva lo storico dei periodi passati.
drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own" on public.budgets
	for delete to authenticated
	using ((select auth.uid()) = user_id);


-- ----------------------------------------------------------------------------
-- 4. LETTURA — budgets_at()
-- ----------------------------------------------------------------------------
-- Il budget applicabile a una data, una riga per categoria (più l'eventuale
-- globale, con category_id NULL).
--
-- Perché una FUNZIONE con la data come parametro e non una vista con
-- current_date: current_date usa il fuso del database, che su Supabase è UTC.
-- Fra mezzanotte e le 2 ora italiana, "oggi" in UTC è ancora ieri — e una
-- transazione inserita a mezzanotte e mezza finirebbe nel periodo sbagliato.
-- È lo stesso problema che TransactionForm già evita usando
-- toLocaleDateString("sv-SE") invece di toISOString(). Passando la data locale
-- calcolata dal client, l'ambiguità sparisce del tutto.
--
-- (Una vista avrebbe richiesto security_invoker = true per non scavalcare la
-- RLS. Le funzioni SQL sono SECURITY INVOKER di default, quindi la RLS di
-- budgets si applica normalmente — ma il filtro su auth.uid() resta esplicito.)
--
-- DISTINCT ON prende la prima riga di ogni gruppo secondo l'ORDER BY, cioè il
-- valid_from più recente non successivo a ref_date. NB: a differenza dei
-- vincoli di unicità, DISTINCT ON raggruppa i NULL insieme — quindi il budget
-- globale viene trattato come una categoria a sé, che è quello che serve.

create or replace function public.budgets_at(ref_date date default current_date)
returns table (
	budget_id    uuid,
	category_id  uuid,
	period       text,
	amount       numeric(10,2),
	valid_from   date,
	period_start date,
	period_end   date
)
language sql
stable
set search_path = ''
as $$
	select distinct on (b.category_id)
		b.id,
		b.category_id,
		b.period,
		b.amount,
		b.valid_from,
		public.budget_period_start(b.period, ref_date),
		public.budget_period_end(b.period, ref_date)
	from public.budgets b
	where b.user_id = (select auth.uid())
	  and b.valid_from <= ref_date
	order by b.category_id, b.valid_from desc;
$$;

revoke all     on function public.budgets_at(date) from public, anon;
grant  execute on function public.budgets_at(date) to authenticated;

-- Le righe con amount NULL (lapidi) vengono restituite di proposito: chi legge
-- deve poter distinguere "budget rimosso a partire da questo periodo" da
-- "budget mai impostato" (categoria assente dal risultato). Filtrarle qui
-- renderebbe i due casi indistinguibili.


-- ----------------------------------------------------------------------------
-- 4b. SCRITTURA — set_budget()
-- ----------------------------------------------------------------------------
-- Impostare, modificare o rimuovere (p_amount NULL) un budget.
--
-- Passa da qui e non da un insert del client per tre motivi:
--   1. valid_from lo calcola il DATABASE con budget_period_start(), la stessa
--      funzione usata dal CHECK. Se lo calcolasse l'app, la stessa aritmetica
--      esisterebbe in due linguaggi e prima o poi divergerebbe.
--   2. L'upsert è atomico (ON CONFLICT sull'indice unico): niente
--      leggi-poi-scrivi, niente race fra due tab aperte.
--   3. I controlli che il DB non può esprimere con un vincolo (categoria di tipo
--      'spesa', globale sempre mensile) danno un messaggio comprensibile invece
--      di una violazione di CHECK.
--
-- p_today è la data LOCALE del client: il server gira in UTC e fra mezzanotte e
-- le 2 ora italiana sbaglierebbe periodo.

create or replace function public.set_budget(
	p_category_id uuid,
	p_period      text,
	p_amount      numeric(10,2),
	p_today       date default current_date
)
returns void
language plpgsql
set search_path = ''
as $$
declare
	uid    uuid := (select auth.uid());
	v_from date;
	v_last date;
begin
	if uid is null then
		raise exception 'not authenticated' using errcode = '28000';
	end if;

	if p_period not in ('settimanale', 'mensile', 'annuale') then
		raise exception 'periodo non valido: %', p_period using errcode = '22023';
	end if;

	if p_category_id is null and p_period <> 'mensile' then
		raise exception 'il budget globale è sempre mensile' using errcode = '22023';
	end if;

	if p_category_id is not null and not exists (
		select 1 from public.categories c
		where c.id = p_category_id and c.user_id = uid and c.type = 'spesa'
	) then
		raise exception 'categoria inesistente o non di tipo spesa' using errcode = '22023';
	end if;

	v_from := public.budget_period_start(p_period, p_today);

	-- ⚠️ Caso limite del versionamento a solo valid_from: CAMBIARE PERIODO può
	-- produrre un inizio ANTERIORE all'ultima riga esistente, e la modifica
	-- sparirebbe in silenzio.
	--   Esempio: venerdì 1 agosto c'è un budget mensile (valid_from = 1 ago).
	--   L'utente passa a settimanale: la settimana corrente è iniziata lunedì
	--   27 luglio, quindi la riga nuova avrebbe valid_from = 27 lug — PRIMA
	--   della mensile. budgets_at() prende il valid_from più recente, cioè
	--   continuerebbe a restituire la mensile, e l'utente vedrebbe il vecchio
	--   budget dopo averlo cambiato.
	-- Soluzione: se l'inizio calcolato precede l'ultima riga, si avanza al
	-- confine successivo del periodo NUOVO — il cambio decorre dal prossimo
	-- periodo. Avanzare di un confine alla volta (invece di usare greatest())
	-- garantisce che valid_from resti allineato, quindi il CHECK regge sempre.
	select max(b.valid_from) into v_last
	from public.budgets b
	where b.user_id = uid
	  and b.category_id is not distinct from p_category_id;

	while v_last is not null and v_from < v_last loop
		v_from := public.budget_period_end(p_period, v_from);
	end loop;

	insert into public.budgets (user_id, category_id, period, amount, valid_from)
	values (uid, p_category_id, p_period, p_amount, v_from)
	on conflict (user_id, category_id, valid_from) do update
		set amount = excluded.amount,
		    period = excluded.period;
end;
$$;

revoke all     on function public.set_budget(uuid, text, numeric, date) from public, anon;
grant  execute on function public.set_budget(uuid, text, numeric, date) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. ELIMINAZIONE ACCOUNT — aggiornata
-- ----------------------------------------------------------------------------
-- budgets ha già la FK ON DELETE CASCADE verso auth.users, ma delete_current_user()
-- fa i DELETE ESPLICITI tabella per tabella, deliberatamente: così resta corretta
-- anche se un domani una FK venisse ricreata senza cascade. Aggiungere una tabella
-- e dimenticarla qui non produce alcun errore — lascia solo dati personali di un
-- utente cancellato, che è esattamente il problema GDPR che quel blocco previene.
--
-- Il corpo è identico a 20260729_account_security.sql tranne la riga budgets.
-- Quando arriverà la Fase 17b, aggiungere allo stesso modo `notifications`.

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
	-- file dell'avatar. Quella cancellazione è irreversibile e deve precedere la
	-- RPC, quindi senza una verifica preliminare una funzione mai installata, un
	-- grant sbagliato o una sessione scaduta lascerebbero l'account vivo e la
	-- foto distrutta.
	if dry_run then
		return;
	end if;

	-- I file dello Storage NON si cancellano da qui: Supabase blocca il DELETE
	-- diretto su storage.objects. Ci pensa deleteAccount() lato app con l'API
	-- storage, prima di invocare questa funzione.

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
