-- #154 — `anon` senza privilegi in `public`, anche sugli oggetti futuri (#157).
--
-- Erano le prove c1-c9 commentate in fondo alla `20260822`.
-- ⚠️ Si gira come `postgres`, che ha `BYPASSRLS` e i privilegi del
-- proprietario: da lì nessun rifiuto si vedrebbe mai. Le prove come `anon` e
-- `authenticated` cambiano ruolo DENTRO la stringa di `throws_ok`/`lives_ok`:
-- quando l'istruzione fallisce, la sottotransazione annulla anche il
-- `set local role`; quando riesce, il ruolo resta, e lo toglie il `reset role`
-- che segue.
--
-- Fuori dal locale resta una sola cosa: `rls_auto_enable()` e l'event trigger
-- `ensure_rls` sono della piattaforma, esistono solo in produzione, quindi la
-- parte di c7 «la tabella nuova nasce con la RLS accesa» qui non si prova.
-- Storia: docs/storia/issue-154-anon.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Le due query di c1 e c2, scritte UNA volta: c9 le rilegge dopo aver
-- iniettato un guasto, per dimostrare che vedono ciò che dicono di cercare.
create temporary view anon_relazioni as
	select string_agg(distinct c.relname::text, ', ' order by c.relname::text) as nomi
	from pg_class c
	join pg_namespace n on n.oid = c.relnamespace
	cross join lateral aclexplode(c.relacl) a
	-- l'oid da pg_roles: una costante `regrole` dentro una vista non è ammessa
	where n.nspname = 'public' and a.grantee in (0, (select oid from pg_roles where rolname = 'anon'));
create temporary view anon_funzioni as
	select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text) as nomi
	from pg_proc p
	join pg_namespace n on n.oid = p.pronamespace
	where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
	  -- L'unica eccezione dichiarata (#160, migration `20261124`): cinque fatti
	  -- globali sul job, per il controllo esterno che non ha sessione. c10 la
	  -- prova; qui si esclude PER NOME, così ogni altra funzione resta vista.
	  and p.oid <> 'public.daily_job_health()'::regprocedure;

select is((select nomi from anon_relazioni), null, 'c1 · nessuna relazione di public concessa ad anon o a PUBLIC');
select is((select nomi from anon_funzioni), null, 'c2 · nessuna funzione di public eseguibile da anon');

-- c3 · il gemello positivo: una revoca troppo larga passerebbe per riuscita.
select ok(
	has_table_privilege('authenticated', 'public.transactions', 'SELECT')
	and has_table_privilege('authenticated', 'public.transactions', 'INSERT')
	and has_table_privilege('authenticated', 'public.transactions', 'UPDATE')
	and has_table_privilege('authenticated', 'public.transactions', 'DELETE')
	and has_table_privilege('authenticated', 'public.account_balances', 'SELECT')
	and has_function_privilege('authenticated', 'public.budget_period_start(text, date)', 'EXECUTE')
	and has_function_privilege('authenticated', 'public.dashboard_totals(timestamptz[], uuid)', 'EXECUTE'),
	'c3 · authenticated conserva ciò che serve all''app'
);

-- c4, c5 · rifiutati dal GRANT («permission denied for table»), non filtrati
-- dalla RLS: la RLS dava già 42501 prima della #154, con un altro messaggio.
select throws_ok(
	$$ set local role anon; select 1 from public.transactions limit 1 $$,
	'42501', 'permission denied for table transactions',
	'c4 · anon che legge transactions è rifiutato dal grant'
);
reset role;
select throws_ok(
	$$ set local role anon;
	   insert into public.transactions (user_id, account_id, amount, type, date)
	   values (gen_random_uuid(), gen_random_uuid(), 1, 'spesa', now()) $$,
	'42501', 'permission denied for table transactions',
	'c5 · anon che scrive in transactions è rifiutato dal grant, non dalla RLS'
);
reset role;
select throws_ok(
	$$ set local role anon; select public.budget_warning_threshold() $$,
	'42501', 'permission denied for function budget_warning_threshold',
	'c6 · anon non esegue le funzioni dei budget'
);
reset role;

-- c7 · gli oggetti NUOVI nascono senza anon e con authenticated, dai default
-- che la `20260822` ha cambiato per `postgres`.
create table public._prova_154 (x int);
create function public._prova_154_f() returns int language sql as 'select 1';
select ok(
	not exists (select 1 from pg_class c cross join lateral aclexplode(c.relacl) a
	            where c.oid = 'public._prova_154'::regclass and a.grantee in (0, 'anon'::regrole::oid)),
	'c7 · una tabella nuova nasce senza anon'
);
select ok(has_table_privilege('authenticated', 'public._prova_154', 'INSERT'),
	'c7 · una tabella nuova nasce con authenticated');
select ok(not has_function_privilege('anon', 'public._prova_154_f()', 'EXECUTE'),
	'c7 · una funzione nuova non è eseguibile da anon');
select ok(has_function_privilege('authenticated', 'public._prova_154_f()', 'EXECUTE'),
	'c7 · una funzione nuova è eseguibile da authenticated');

-- c8 · un trigger scatta anche se chi scrive NON ha execute sulla funzione: è
-- ciò su cui conta handle_new_user() da quando ha perso l'execute di PUBLIC.
create function public._prova_154_trg() returns trigger language plpgsql
	as $f$ begin new.x := 42; return new; end $f$;
revoke all on function public._prova_154_trg() from public, anon, authenticated;
create trigger _prova_154_t before insert on public._prova_154
	for each row execute function public._prova_154_trg();
select ok(not has_function_privilege('authenticated', 'public._prova_154_trg()', 'EXECUTE'),
	'c8 · premessa: authenticated non ha execute sulla funzione del trigger');
select lives_ok(
	$$ set local role authenticated; insert into public._prova_154 values (1) $$,
	'c8 · authenticated scrive nella tabella, e il trigger non lo ferma'
);
reset role;
select is((select x from public._prova_154), 42, 'c8 · il trigger è scattato');

-- c10 · l'eccezione della #160: anon esegue `daily_job_health()` e riceve una
-- riga, ma la tabella da cui la funzione legge gli resta chiusa. Il gemello
-- (anon che NON esegue un'altra funzione) è c6; c9 fa cadere c2 se l'eccezione
-- si allarga. ⚠️ Sta PRIMA di c9, che concede proprio `job_runs` ad anon per
-- vedere se c1 se ne accorge: dopo, l'ultima prova qui sarebbe falsa.
select ok(has_function_privilege('anon', 'public.daily_job_health()', 'EXECUTE'),
	'c10 · anon esegue daily_job_health()');
select lives_ok(
	$$ set local role anon; select * from public.daily_job_health() $$,
	'c10 · e la chiamata come anon riesce (security definer: legge job_runs da proprietario)'
);
reset role;
select is(
	(select count(*) from public.daily_job_health()),
	1::bigint,
	'c10 · una riga sola, quella che il cron legge'
);
select throws_ok(
	$$ set local role anon; select 1 from public.job_runs limit 1 $$,
	'42501', 'permission denied for table job_runs',
	'c10 · ma anon non legge job_runs, da cui stanno details e gli id delle regole'
);
reset role;

-- c9 · le query di c1 e c2 VEDONO un guasto: un grant ad anon su una tabella,
-- uno a PUBLIC su una funzione. Senza, una verifica che non guarda niente
-- passerebbe come una che funziona. Il rollback finale toglie entrambi.
grant select on public.job_runs to anon;
grant execute on function public.budget_warning_threshold() to public;
select is((select nomi from anon_relazioni), 'job_runs', 'c9 · c1 vede un grant ad anon iniettato');
select ok((select nomi from anon_funzioni) like '%budget_warning_threshold%', 'c9 · c2 vede un execute a PUBLIC iniettato');

-- handle_new_user() nella registrazione vera: un utente nuovo ha il profilo.
-- È il caso che c8 descrive in astratto, sulla funzione che conta.
insert into auth.users (id, email) values ('00000000-0000-4000-a000-000000000154', 'anon@pgtap.seichi.test');
select is(
	(select count(*) from public.profiles where id = '00000000-0000-4000-a000-000000000154'),
	1::bigint,
	'c8 · la registrazione crea il profilo con handle_new_user()'
);
select ok(
	not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'),
	'c8 · e anon non può chiamare handle_new_user() da sé'
);

select * from finish();
rollback;
