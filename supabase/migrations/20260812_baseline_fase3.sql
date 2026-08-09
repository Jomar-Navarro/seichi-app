-- ============================================================================
-- Baseline: profiles, categories, transactions (issue #43)
-- ============================================================================
-- Le tre tabelle fondanti sono nate nella Fase 3 dal pannello di Supabase e non
-- sono MAI state versionate. Il repo, fino a questo file, non era in grado di
-- ricostruire il proprio database: mancavano le tabelle su cui poggia tutto il
-- resto. Le migration successive (`20260729`, `20260807`, `20260810`) le
-- alteravano dando per scontata una definizione che nessun file conteneva.
--
-- ⚠️ **Questo file è stato scritto INTERROGANDO IL CATALOGO, non a memoria.**
-- `information_schema.columns`, `pg_constraint`, `pg_policies`, `pg_indexes`,
-- `information_schema.role_table_grants`. È la stessa tecnica usata per
-- ricostruire `recurring_rules` in `20260728_recurring.sql`, e il motivo è
-- identico: **una migration che indovina è peggio di una che manca**, perché
-- sembra affidabile. Solo scrivendo i tipi VERI si scopre che `type` è
-- `character varying(20)` e non `text`, che `notes` è limitata a 255 caratteri,
-- e che `transactions` ha 13 colonne dove il documento di progetto ne elencava 10.
--
-- ----------------------------------------------------------------------------
-- Cosa registra questo file, e cosa NON fa
-- ----------------------------------------------------------------------------
-- Registra lo stato **reale al 2026-08-12**, difetti compresi: colonne residue
-- mai usate, policy duplicate, un default che viola il proprio CHECK. Non
-- corregge nulla — le correzioni sono in `20260813_schema_cleanup.sql`, e la
-- separazione è deliberata:
--
--   · questo file è la FOTOGRAFIA, e deve poter essere confrontato con il
--     database senza differenze. Su un database esistente è un no-op completo;
--   · quello dopo è la DECISIONE, e si legge come tale.
--
-- Fondendoli, la fotografia descriverebbe uno stato che non è mai esistito, e
-- chi confrontasse repo e database troverebbe scarti senza sapere se sono
-- voluti. È lo stesso schema `20260728` (ricostruzione) → `20260810`
-- (correzione) già usato per le ricorrenti.
--
-- ⚠️ Eseguire PRIMA di `20260813_schema_cleanup.sql`.


-- ----------------------------------------------------------------------------
-- 1. profiles
-- ----------------------------------------------------------------------------
-- ⚠️ Quattro colonne che il documento di progetto non nominava:
--
--   · `theme`   — la Fase 18 la dà per "rimandata", ma la colonna esiste già,
--                 con `default 'dark'`. Nessun codice la scrive né la legge.
--   · `name`, `surname` — precedenti alla Fase 16, soppiantate da `full_name`.
--                 L'app scrive nome e cognome in `raw_user_meta_data`, non qui.
--   · `created_at` — mai usata, innocua.
--
-- ⚠️ `language` è `character varying` SENZA lunghezza, a differenza di ogni
-- altra colonna testuale qui (che sono `varchar(50)`): è stata aggiunta in un
-- momento diverso. Il suo `default 'IT'` **viola `profiles_language_check`**,
-- che pretende minuscolo o NULL — vedi la 20260813, dove viene rimosso.

create table if not exists public.profiles (
	id         uuid not null,
	currency   varchar(50) default 'EUR'::character varying,
	theme      varchar(50) default 'dark'::character varying,
	created_at timestamp without time zone default now(),
	name       varchar(50),
	surname    varchar(50),
	language   character varying default 'IT'::character varying,
	full_name  text,
	avatar_url text,
	constraint profiles_pkey primary key (id)
);

-- Idempotenza su un database dove la tabella esiste già ma è nata a pezzi:
-- `create table if not exists` non aggiunge le colonne mancanti.
alter table public.profiles add column if not exists currency   varchar(50) default 'EUR'::character varying;
alter table public.profiles add column if not exists theme      varchar(50) default 'dark'::character varying;
alter table public.profiles add column if not exists created_at timestamp without time zone default now();
alter table public.profiles add column if not exists name       varchar(50);
alter table public.profiles add column if not exists surname    varchar(50);
alter table public.profiles add column if not exists language   character varying default 'IT'::character varying;
alter table public.profiles add column if not exists full_name  text;
alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add  constraint profiles_id_fkey
	foreign key (id) references auth.users(id) on delete cascade;

alter table public.profiles drop constraint if exists profiles_language_check;
alter table public.profiles add  constraint profiles_language_check
	check (language is null or (language)::text = any ((array['it'::character varying, 'en'::character varying])::text[]));

alter table public.profiles enable row level security;


-- ----------------------------------------------------------------------------
-- 2. categories
-- ----------------------------------------------------------------------------
-- Gli OBIETTIVI di risparmio vivono qui: sono categorie `type='risparmio'` con
-- `target_amount`/`target_date`. Nessuna tabella dedicata — decisione confermata
-- nel documento di progetto.
--
-- ⚠️ `user_id` è NULLABLE, e le policy filtrano su `user_id = auth.uid()`: una
-- riga con `user_id` NULL non sarebbe visibile a nessuno e nessuno potrebbe
-- cancellarla. Non è un problema oggi (ogni insert passa dalla server action,
-- che lo valorizza) ma è uno stato illegale che il DB non impedisce. Registrato
-- qui, non corretto: aggiungere `not null` richiede di verificare prima che
-- nessuna riga lo violi, ed è una decisione separata da questa ricostruzione.

create table if not exists public.categories (
	id            uuid not null default gen_random_uuid(),
	user_id       uuid,
	name          varchar(50),
	icon          varchar(50),
	color         text,
	type          varchar(20),
	created_at    timestamp without time zone default now(),
	target_amount numeric(10,2),
	target_date   date,
	constraint categories_pkey primary key (id)
);

alter table public.categories add column if not exists target_amount numeric(10,2);
alter table public.categories add column if not exists target_date   date;

alter table public.categories drop constraint if exists categories_user_id_fkey;
alter table public.categories add  constraint categories_user_id_fkey
	foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.categories drop constraint if exists categories_type_check;
alter table public.categories add  constraint categories_type_check
	check ((type)::text = any ((array[
		'entrata'::character varying,
		'spesa'::character varying,
		'investimento'::character varying,
		'risparmio'::character varying,
		'abbonamento'::character varying
	])::text[]));

alter table public.categories enable row level security;


-- ----------------------------------------------------------------------------
-- 3. transactions
-- ----------------------------------------------------------------------------
-- ⚠️ TREDICI colonne, non dieci. Le tre in più sono residui precedenti alla
-- Fase 14, quando le ricorrenti sono passate a `recurring_rules` + pg_cron:
--
--   · `is_ricurrent` — con il refuso nel nome, mai rinominata
--   · `frequency`    — con un CHECK in INGLESE (`weekly/monthly/yearly`) mentre
--                      `recurring_rules.frequency` usa l'italiano: due
--                      vocabolari per lo stesso concetto nella stessa base dati
--   · `parent_id`    — senza alcuna FK, quindi non è nemmeno un riferimento
--
-- Verificato prima di scrivere: **tutte e tre sono NULL su tutte le 19 righe**.
-- Vengono rimosse dalla 20260813; qui sono registrate perché esistono.
--
-- ⚠️ `date` e `created_at` sono `timestamp WITHOUT time zone`. Il documento di
-- progetto descrive `transactions.date` come "un istante assoluto", ma senza
-- fuso **non lo è**: `dashboard_totals(p_bounds timestamptz[])` confronta bound
-- `timestamptz` con questa colonna, e Postgres interpreta la colonna nel
-- `TimeZone` della sessione. Funziona perché su Supabase è UTC — è
-- un'assunzione taciuta, della stessa famiglia delle trappole di fuso già
-- pagate due volte. Non si tocca qui: cambiare il tipo cambia il significato
-- dei dati esistenti ed è una decisione a sé.
--
-- ⚠️ `transactions_category_id_fkey` è `on delete cascade`: eliminare una
-- categoria elimina le sue transazioni. È il comportamento su cui poggia
-- l'eliminazione di un obiettivo di risparmio.

create table if not exists public.transactions (
	id                uuid not null default gen_random_uuid(),
	user_id           uuid,
	amount            numeric(10,2),
	type              varchar(20),
	category_id       uuid,
	investment_type   varchar(50),
	date              timestamp without time zone default now(),
	notes             varchar(255),
	is_ricurrent      boolean,
	frequency         varchar(20),
	parent_id         uuid,
	created_at        timestamp without time zone default now(),
	recurring_rule_id uuid,
	constraint transactions_pkey primary key (id)
);

alter table public.transactions add column if not exists investment_type   varchar(50);
alter table public.transactions add column if not exists recurring_rule_id uuid;

alter table public.transactions drop constraint if exists transactions_user_id_fkey;
alter table public.transactions add  constraint transactions_user_id_fkey
	foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.transactions drop constraint if exists transactions_category_id_fkey;
alter table public.transactions add  constraint transactions_category_id_fkey
	foreign key (category_id) references public.categories(id) on delete cascade;

alter table public.transactions drop constraint if exists transactions_recurring_rule_id_fkey;
alter table public.transactions add  constraint transactions_recurring_rule_id_fkey
	foreign key (recurring_rule_id) references public.recurring_rules(id) on delete set null;

-- Registrato ma destinato a sparire con la colonna: vedi 20260813.
alter table public.transactions drop constraint if exists transactions_frequency_check;
alter table public.transactions add  constraint transactions_frequency_check
	check ((frequency)::text = any ((array[
		'weekly'::character varying,
		'monthly'::character varying,
		'yearly'::character varying
	])::text[]));

-- Allineato a `categories_type_check` dalla 20260810: prima non ammetteva
-- `abbonamento`, e nessun abbonamento ricorrente poteva materializzarsi.
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add  constraint transactions_type_check
	check ((type)::text = any (array[
		'entrata'::text, 'spesa'::text, 'investimento'::text,
		'risparmio'::text, 'abbonamento'::text
	]));

alter table public.transactions enable row level security;


-- ----------------------------------------------------------------------------
-- 4. Le policy, così come sono — duplicati compresi
-- ----------------------------------------------------------------------------
-- ⚠️ **Venti policy per undici operazioni.** `categories` ne ha otto per quattro
-- operazioni, `profiles` otto per tre. La `20260729` ha creato `profiles_*_own`
-- senza rimuovere le precedenti, e su `categories` esistono due serie complete
-- con nomi quasi identici ("… own categories" e "… on their own categories").
--
-- ⚠️ **Le policy si sommano in OR**, quindi oggi i duplicati sono innocui: dicono
-- tutti la stessa cosa. Il pericolo è nel futuro — per RESTRINGERE un accesso
-- bisogna rimuoverle TUTTE, e chi domani stringesse `profiles_select_own`
-- lascerebbe aperta `Users can view own profile` senza che nulla lo segnali.
-- Un permesso concesso da una policy dimenticata non produce alcun errore.
--
-- Vengono deduplicate dalla 20260813. Qui sono scritte per intero perché
-- esistono, e perché il conteggio è esso stesso il difetto da documentare.
--
-- `drop policy if exists` prima di ogni `create`: non esiste
-- `create policy if not exists`, e il file dev'essere rieseguibile.

-- profiles
drop policy if exists "Users can view own profile"            on public.profiles;
drop policy if exists "Users can insert own profile"          on public.profiles;
drop policy if exists "Users can insert on their own profile" on public.profiles;
drop policy if exists "Users can update own profile"          on public.profiles;
drop policy if exists "Users can update on their own profile" on public.profiles;
drop policy if exists "profiles_select_own"                   on public.profiles;
drop policy if exists "profiles_insert_own"                   on public.profiles;
drop policy if exists "profiles_update_own"                   on public.profiles;

create policy "Users can view own profile"            on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users can insert own profile"          on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "Users can insert on their own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "Users can update own profile"          on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Users can update on their own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ⚠️ La forma `(select auth.uid())` NON è uno stile diverso: il sotto-select è
-- valutato UNA volta come initplan invece che per ogni riga. È la forma
-- raccomandata da Supabase per le policy, ed è quella introdotta dalla 20260729.
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- categories
drop policy if exists "Users can view own categories"              on public.categories;
drop policy if exists "Users can view on their own categories"     on public.categories;
drop policy if exists "Users can insert own categories"            on public.categories;
drop policy if exists "Users can insert on their own categories"   on public.categories;
drop policy if exists "Users can update own categories"            on public.categories;
drop policy if exists "Users can update on their own categories"   on public.categories;
drop policy if exists "Users can delete own categories"            on public.categories;
drop policy if exists "Users can delete on their own categories"   on public.categories;

create policy "Users can view own categories"            on public.categories for select to authenticated using (user_id = auth.uid());
create policy "Users can view on their own categories"   on public.categories for select to authenticated using (user_id = auth.uid());
create policy "Users can insert own categories"          on public.categories for insert to authenticated with check (user_id = auth.uid());
create policy "Users can insert on their own categories" on public.categories for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own categories"          on public.categories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can update on their own categories" on public.categories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can delete own categories"          on public.categories for delete to authenticated using (user_id = auth.uid());
create policy "Users can delete on their own categories" on public.categories for delete to authenticated using (user_id = auth.uid());

-- transactions — l'unica delle tre senza duplicati
drop policy if exists "Users can view own transactions"   on public.transactions;
drop policy if exists "Users can insert own transactions" on public.transactions;
drop policy if exists "Users can update own transactions" on public.transactions;
drop policy if exists "Users can delete own transactions" on public.transactions;

create policy "Users can view own transactions"   on public.transactions for select to authenticated using (user_id = auth.uid());
create policy "Users can insert own transactions" on public.transactions for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own transactions" on public.transactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can delete own transactions" on public.transactions for delete to authenticated using (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 5. Grant — registrati, non modificati
-- ----------------------------------------------------------------------------
-- Le tre tabelle hanno `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE,
-- UPDATE` concessi a `anon`, `authenticated`, `postgres` e `service_role`. È il
-- default di Supabase sullo schema `public`, non una scelta di questo progetto.
--
-- ⚠️ Che `anon` possa scrivere è innocuo **solo grazie alla RLS**: ogni policy è
-- `to authenticated`, quindi per `anon` non esiste alcuna policy e ogni riga è
-- negata. È difesa singola, non doppia. Un `revoke` su `anon` sarebbe difesa in
-- profondità, ma toccare i grant di default di Supabase può rompere cose in modi
-- difficili da attribuire: la decisione è registrata qui e non presa.
--
-- Nessuno dei ruoli può comunque scavalcare la RLS: `TRUNCATE` la ignorerebbe,
-- ma PostgREST non espone alcun endpoint che lo esegua.


-- ----------------------------------------------------------------------------
-- 6. Controprova
-- ----------------------------------------------------------------------------
-- Rieseguire questo file su un database già allineato non deve cambiare NULLA.
-- Per verificarlo, confronta prima e dopo:
--
--   select table_name, column_name, data_type, column_default
--   from information_schema.columns
--   where table_schema='public'
--     and table_name in ('profiles','categories','transactions')
--   order by table_name, ordinal_position;
--
--   select count(*) from pg_policies
--   where schemaname='public'
--     and tablename in ('profiles','categories','transactions');   -- 20
