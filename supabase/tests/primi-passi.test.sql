-- #163 — i primi passi (`20261121_first_steps`): la colonna della chiusura in
-- `profiles` e la funzione `first_steps()` che spunta le voci della card.
--
-- La funzione è `security invoker`: le prove che contano la chiamano da
-- `authenticated`, perché `postgres` ha BYPASSRLS e vedrebbe tutto anche se la
-- policy mancasse. Ogni voce ha il suo caso che NON la spunta (la lapide, il
-- saldo a zero, l'obiettivo senza traguardo) accanto a quello che la spunta.
--
-- Controprove dichiarate (mutazioni da applicare al database locale). Ognuna
-- fa cadere ESATTAMENTE le prove elencate, e nessun'altra:
--   m1 · `b.amount is not null` tolto
--        → «un account appena nato» e «la lapide da sola non è un budget»
--   m2 · `c.target_amount > 0` tolto
--        → «un account appena nato» e «un obiettivo senza traguardo non conta»
--   m3 · `a.initial_balance <> 0` tolto
--        → «un account appena nato» e «un saldo iniziale a zero non conta»
--   m4 · `security definer` e i filtri su user_id tolti (la funzione vede tutto)
--        → «l'utente due non vede i dati dell'uno» e «senza utente nelle claims»
--   m5 · `default now()` sulla colonna
--        → «la colonna non ha default», «un profilo nuovo nasce con la card
--          aperta», «… e la card dell'uno resta aperta» (il trigger crea il
--          profilo, e il default lo nasce già chiuso)
-- Storia: docs/storia/issue-163-primi-passi.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
	('00000000-0000-4000-a000-000000000001', 'uno@pgtap.seichi.test'),
	('00000000-0000-4000-a000-000000000002', 'due@pgtap.seichi.test');

-- ---------------------------------------------------------------------------
-- La colonna: NULL = «non ancora chiusa», e nessun default che lo neghi
-- ---------------------------------------------------------------------------
select has_column('public', 'profiles', 'first_steps_dismissed_at', 'profiles ha first_steps_dismissed_at');
select col_is_null('public', 'profiles', 'first_steps_dismissed_at', 'la colonna ammette NULL');
select col_hasnt_default('public', 'profiles', 'first_steps_dismissed_at', 'la colonna non ha default (#43)');
select is(
	(select first_steps_dismissed_at from public.profiles where id = '00000000-0000-4000-a000-000000000001'),
	null,
	'un profilo nuovo nasce con la card aperta'
);

-- La scrive solo il proprietario: l'utente due non chiude la card dell'uno.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select lives_ok(
	$$ set local role authenticated;
	   update public.profiles set first_steps_dismissed_at = now()
	   where id = '00000000-0000-4000-a000-000000000001' $$,
	'un update sul profilo altrui non solleva: la RLS lo riduce a zero righe'
);
reset role;
select is(
	(select first_steps_dismissed_at from public.profiles where id = '00000000-0000-4000-a000-000000000001'),
	null,
	'… e la card dell''uno resta aperta'
);

-- Il gemello che passa: il proprietario la chiude, con l'upsert dell'app.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-000000000001", "role": "authenticated"}';
select lives_ok(
	$$ set local role authenticated;
	   insert into public.profiles (id, first_steps_dismissed_at)
	   values ('00000000-0000-4000-a000-000000000001', now())
	   on conflict (id) do update set first_steps_dismissed_at = excluded.first_steps_dismissed_at $$,
	'il proprietario chiude la card con un upsert'
);
reset role;
select isnt(
	(select first_steps_dismissed_at from public.profiles where id = '00000000-0000-4000-a000-000000000001'),
	null,
	'… e la chiusura resta scritta'
);

-- ---------------------------------------------------------------------------
-- I privilegi della funzione
-- ---------------------------------------------------------------------------
select throws_ok(
	$$ set local role anon; select * from public.first_steps() $$,
	'42501', 'permission denied for function first_steps',
	'anon non chiama first_steps()'
);
reset role;

-- ---------------------------------------------------------------------------
-- Le voci. Utente uno, da authenticated: all'inizio niente è fatto, e i casi
-- «quasi» (saldo zero, lapide, obiettivo senza traguardo) non spuntano niente.
-- ---------------------------------------------------------------------------
insert into public.accounts (id, user_id, name, initial_balance) values
	('00000000-0000-4000-b000-0000000000a1', '00000000-0000-4000-a000-000000000001', 'Conto', 0);
insert into public.categories (id, user_id, name, icon, color, type, target_amount) values
	('00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001', 'Vacanze', 'Plane', 'kin', 'risparmio', null),
	('00000000-0000-4000-c000-0000000000a2', '00000000-0000-4000-a000-000000000001', 'Spesa', 'ShoppingCart', 'aka', 'spesa', null);
insert into public.budgets (user_id, category_id, period, amount, valid_from) values
	('00000000-0000-4000-a000-000000000001', null, 'mensile', null, date_trunc('month', current_date)::date);

-- Gli esiti si raccolgono DA authenticated in una tabella temporanea e si
-- confrontano da postgres: le funzioni di pgTAP scrivono nelle loro tabelle
-- temporanee, che authenticated non può toccare.
create temp table esito (k text primary key, v text) on commit drop;
grant all on esito to authenticated;

set local role authenticated;
insert into esito select 'inizio', row(has_balance, has_transaction, has_budget, has_goal, has_import)::text from public.first_steps();
reset role;
select is((select v from esito where k = 'inizio'), '(f,f,f,f,f)',
	'un account appena nato: nessuna voce fatta, nessun import');
-- Le tre righe qui sotto leggono la stessa riga per colonna: se una sola voce
-- si spuntasse per errore, il rosso dice QUALE.
select is(split_part(trim(both '()' from (select v from esito where k = 'inizio')), ',', 1), 'f',
	'un saldo iniziale a zero non conta');
select is(split_part(trim(both '()' from (select v from esito where k = 'inizio')), ',', 3), 'f',
	'la lapide da sola non è un budget');
select is(split_part(trim(both '()' from (select v from esito where k = 'inizio')), ',', 4), 'f',
	'un obiettivo senza traguardo non conta');

-- Ora ogni voce si fa davvero (i dati li scrive postgres: qui si prova la
-- lettura, la scrittura sotto RLS la provano le suite delle sue tabelle).
update public.accounts set initial_balance = 250 where id = '00000000-0000-4000-b000-0000000000a1';
update public.categories set target_amount = 1000 where id = '00000000-0000-4000-c000-0000000000a1';
insert into public.budgets (user_id, category_id, period, amount, valid_from) values
	('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-0000000000a2', 'mensile', 300, date_trunc('month', current_date)::date);
insert into public.transactions (user_id, account_id, category_id, amount, type, date) values
	('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1', '00000000-0000-4000-c000-0000000000a2', 12.5, 'spesa', now());

set local role authenticated;
insert into esito select 'fatto', row(has_balance, has_transaction, has_budget, has_goal, has_import)::text from public.first_steps();
reset role;
select is((select v from esito where k = 'fatto'), '(t,t,t,t,f)',
	'saldo, transazione, budget e traguardo fatti; senza un lotto, il link dell''import resta');

insert into public.imports (user_id, account_id, source, filename) values
	('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1', 'generico', 'estratto.csv');
set local role authenticated;
insert into esito select 'import', row(has_balance, has_transaction, has_budget, has_goal, has_import)::text from public.first_steps();
insert into esito select 'righe', count(*)::text from public.first_steps();
reset role;
select is((select v from esito where k = 'import'), '(t,t,t,t,t)', 'con un lotto importato, has_import è vero');
-- Una riga sola, sempre: la home la legge con `.single()`.
select is((select v from esito where k = 'righe'), '1', 'first_steps() restituisce una riga');

-- ---------------------------------------------------------------------------
-- L'utente due non vede niente dell'uno: invoker + RLS
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
set local role authenticated;
insert into esito select 'due', row(has_balance, has_transaction, has_budget, has_goal, has_import)::text from public.first_steps();
reset role;
select is((select v from esito where k = 'due'), '(f,f,f,f,f)', 'l''utente due non vede i dati dell''uno');

-- Senza utente nelle claims (`auth.uid()` NULL) non si spunta niente.
set local request.jwt.claims = '{"role": "authenticated"}';
set local role authenticated;
insert into esito select 'anonimo', row(has_balance, has_transaction, has_budget, has_goal, has_import)::text from public.first_steps();
reset role;
select is((select v from esito where k = 'anonimo'), '(f,f,f,f,f)', 'senza utente nelle claims, nessuna voce');

select * from finish();
rollback;
