-- #173 — la regola ricorrente saltata: gli id in `details`, la notifica al suo
-- proprietario e a nessun altro, e la RPC del form che la riconosce.
-- Storia: docs/storia/issue-173-ricorrenti-esito.md.
--
-- Il guasto è INIETTATO: un CHECK su `transactions` che rifiuta le note
-- «guasto 173», aggiunto dentro questa transazione e tolto prima della fine.
-- Non una nota oltre i 255 caratteri, che fino alla #220 faceva fallire una
-- regola davvero (`recurring_rules.notes` era `text`, `transactions.notes` è
-- `varchar(255)`): la #220 l'ha chiuso, e questa prova non ha perso il guasto.
--
-- Tre utenti, ognuno col suo ruolo:
--   · uno — R1 guasta e R2 sana, entrambe scadute: la regola guasta non ferma
--           la sana, e la notifica va a uno per R1 soltanto;
--   · due — R3 sana: nessuna notifica, il movimento generato;
--   · tre — R4 guasta, provata SOLO dalla RPC (il percorso del form): la
--           funzione la restituisce, e nessuna notifica nasce da lì.
--
-- `run_daily_jobs()` lavora per TUTTI gli utenti del database (dal cron
-- `auth.uid()` è NULL): il rollback finale lo annulla.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values
	('00000000-0000-4000-a000-000000000731', 'uno@pgtap.seichi.test'),
	('00000000-0000-4000-a000-000000000732', 'due@pgtap.seichi.test'),
	('00000000-0000-4000-a000-000000000733', 'tre@pgtap.seichi.test');
insert into public.accounts (id, user_id, name) values
	('00000000-0000-4000-b000-000000000731', '00000000-0000-4000-a000-000000000731', 'Conto uno'),
	('00000000-0000-4000-b000-000000000732', '00000000-0000-4000-a000-000000000732', 'Conto due'),
	('00000000-0000-4000-b000-000000000733', '00000000-0000-4000-a000-000000000733', 'Conto tre');
insert into public.categories (id, user_id, name, icon, color, type) values
	('00000000-0000-4000-c000-000000000731', '00000000-0000-4000-a000-000000000731', 'Affitto', 'Home', 'murasaki', 'abbonamento'),
	('00000000-0000-4000-c000-000000000732', '00000000-0000-4000-a000-000000000731', 'Palestra', 'Dumbbell', 'murasaki', 'abbonamento'),
	('00000000-0000-4000-c000-000000000733', '00000000-0000-4000-a000-000000000732', 'Spotify', 'Music', 'murasaki', 'abbonamento'),
	('00000000-0000-4000-c000-000000000734', '00000000-0000-4000-a000-000000000733', 'Netflix', 'Tv', 'murasaki', 'abbonamento');

-- Tutte scadute IERI: una sola occorrenza a testa da generare.
insert into public.recurring_rules (id, user_id, account_id, amount, type, category_id, notes, frequency, start_date, next_run) values
	('00000000-0000-4000-d000-000000000731', '00000000-0000-4000-a000-000000000731', '00000000-0000-4000-b000-000000000731',
	 750, 'abbonamento', '00000000-0000-4000-c000-000000000731', 'guasto 173', 'mensile', current_date - 1, current_date - 1),
	('00000000-0000-4000-d000-000000000732', '00000000-0000-4000-a000-000000000731', '00000000-0000-4000-b000-000000000731',
	 39.90, 'abbonamento', '00000000-0000-4000-c000-000000000732', null, 'mensile', current_date - 1, current_date - 1),
	('00000000-0000-4000-d000-000000000733', '00000000-0000-4000-a000-000000000732', '00000000-0000-4000-b000-000000000732',
	 12, 'abbonamento', '00000000-0000-4000-c000-000000000733', null, 'mensile', current_date - 1, current_date - 1),
	('00000000-0000-4000-d000-000000000734', '00000000-0000-4000-a000-000000000733', '00000000-0000-4000-b000-000000000733',
	 15.99, 'abbonamento', '00000000-0000-4000-c000-000000000734', 'guasto 173', 'mensile', current_date - 1, current_date - 1);

alter table public.transactions add constraint pgtap_guasto_173
	check (notes is distinct from 'guasto 173');

-- Il cron lavora per TUTTI gli utenti, e qui si contano le sue notifiche e si
-- legge il suo `job_runs`: una regola scaduta di qualcun altro (un account e2e
-- rimasto, in locale) cambierebbe quei numeri e farebbe cadere le prove per la
-- ragione sbagliata (test.md, regola 4). Le regole degli altri si spengono
-- dentro questa transazione, e il rollback le riaccende.
update public.recurring_rules set active = false
where user_id not in ('00000000-0000-4000-a000-000000000731',
                      '00000000-0000-4000-a000-000000000732',
                      '00000000-0000-4000-a000-000000000733');

-- a · la firma che il form legge.
select is(
	pg_get_function_result('public.generate_recurring_transactions()'::regprocedure),
	'uuid[]',
	'a1 · generate_recurring_transactions() restituisce gli id delle regole saltate'
);
select ok(
	pg_get_constraintdef((select oid from pg_constraint where conname = 'notifications_type_check'))
		~ 'ricorrente_saltata',
	'a2 · notifications_type_check ammette ricorrente_saltata'
);
select throws_ok(
	$$ insert into public.notifications (user_id, type, dedup_key, destination)
	   values ('00000000-0000-4000-a000-000000000731', 'inventato_173', 'x:173', '/') $$,
	'23514', 'new row for relation "notifications" violates check constraint "notifications_type_check"',
	'a3 · un tipo che il CHECK non conosce è rifiutato'
);

-- b · il percorso del FORM: la RPC dell'utente tre, col suo JWT. Il risultato
-- passa da una tabella temporanea perché `lives_ok` non restituisce valori.
create temp table rpc_tre as select null::uuid[] as skipped;
grant all on rpc_tre to authenticated;
select lives_ok(
	$$ set local role authenticated;
	   set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-000000000733", "role": "authenticated"}';
	   update rpc_tre set skipped = public.generate_recurring_transactions() $$,
	'b1 · l''utente tre chiama la RPC come farebbe la action'
);
reset role;
select is(
	(select skipped from rpc_tre),
	array['00000000-0000-4000-d000-000000000734']::uuid[],
	'b2 · la RPC restituisce la regola guasta di tre, e solo quella (le altre non sono sue)'
);
select is(
	(select count(*) from public.notifications where type = 'ricorrente_saltata'),
	0::bigint,
	'b3 · dalla RPC non nasce nessuna notifica: risponde il form, mentre l''utente guarda'
);
select is(
	(select next_run from public.recurring_rules where id = '00000000-0000-4000-d000-000000000732'),
	current_date - 1,
	'b4 · la RPC di tre non tocca le regole di uno'
);

-- c · il CRON.
-- ⚠️ `reset role` non toglie le claims: il `set local` della b1 vale fino alla
-- fine della transazione, e `auth.uid()` resterebbe tre — `run_daily_jobs()`
-- lavorerebbe solo sulle sue regole. Successo alla prima stesura: c5, c6 e c8
-- rossi per la ragione sbagliata. Dal cron non c'è JWT, e qui lo si rifà.
set local request.jwt.claims = '';
select is(auth.uid(), null, 'c0 · (preparazione) come dal cron: nessun utente nella sessione');
select public.run_daily_jobs();

select is(
	(select status from public.job_runs where step = 'recurring' order by run_at desc limit 1),
	'partial',
	'c1 · il passo delle ricorrenti è partial: una regola saltata non è un guasto del job'
);
select ok(
	(select details from public.job_runs where step = 'recurring' order by run_at desc limit 1)
		~ '00000000-0000-4000-d000-000000000731',
	'c2 · details elenca l''id della regola saltata di uno'
);
select ok(
	(select details from public.job_runs where step = 'recurring' order by run_at desc limit 1)
		!~ '00000000-0000-4000-d000-00000000073[23]',
	'c3 · details non elenca le regole generate'
);
select is(
	(select status from public.job_runs where step = 'notifications' order by run_at desc limit 1),
	'ok',
	'c4 · il passo delle notifiche è ok'
);

select is(
	(select count(*) from public.transactions where recurring_rule_id = '00000000-0000-4000-d000-000000000732'),
	1::bigint,
	'c5 · la regola sana di uno è generata: la guasta non l''ha fermata'
);
select is(
	(select count(*) from public.transactions where recurring_rule_id = '00000000-0000-4000-d000-000000000733'),
	1::bigint,
	'c6 · la regola di due è generata'
);
select ok(
	(select next_run = current_date - 1 from public.recurring_rules where id = '00000000-0000-4000-d000-000000000731')
	and not exists (select 1 from public.transactions where recurring_rule_id = '00000000-0000-4000-d000-000000000731'),
	'c7 · la regola guasta non ha scritto niente e resta ferma: ritenterà'
);

select is(
	(select payload from public.notifications
	 where user_id = '00000000-0000-4000-a000-000000000731'
	   and type = 'ricorrente_saltata'
	   and destination = '/impostazioni/ricorrenti'
	   and dedup_key = 'ricorrente_saltata:00000000-0000-4000-d000-000000000731:' || (current_date - 1)),
	jsonb_build_object('name', 'Affitto', 'amount', 750.00, 'date', current_date - 1),
	'c8 · uno riceve la notifica della sua regola: nome, importo e data dell''occorrenza bloccata'
);
-- ⚠️ Il cron salta ANCHE R4 di tre (è guasta, e il cron lavora per tutti):
-- tre deve ricevere la SUA notifica, e due nessuna. La prova conta per utente.
select is(
	(select array_agg(distinct user_id order by user_id) from public.notifications where type = 'ricorrente_saltata'),
	array['00000000-0000-4000-a000-000000000731', '00000000-0000-4000-a000-000000000733']::uuid[],
	'c9 · le notifiche di regola saltata vanno ai proprietari delle regole saltate, uno e tre, e a nessun altro'
);
select is(
	(select count(*) from public.notifications where type = 'ricorrente_saltata' and user_id = '00000000-0000-4000-a000-000000000731'),
	1::bigint,
	'c10 · uno ne riceve una sola: la sua regola sana non c''entra'
);

-- d · il giro dopo, con la regola ancora guasta: nessun duplicato.
select public.run_daily_jobs();
select is(
	(select count(*) from public.notifications where type = 'ricorrente_saltata'),
	2::bigint,
	'd1 · rieseguito il job, la stessa occorrenza bloccata non si rinotifica'
);

-- e · il gemello: corretta la causa, la regola riparte e `details` torna vuoto.
alter table public.transactions drop constraint pgtap_guasto_173;
select public.run_daily_jobs();
select ok(
	(select status = 'ok' and details is null from public.job_runs where step = 'recurring' order by run_at desc limit 1),
	'e1 · senza guasti il passo è ok e details è vuoto'
);
select is(
	(select count(*) from public.transactions where recurring_rule_id = '00000000-0000-4000-d000-000000000731'),
	1::bigint,
	'e2 · la regola corretta genera la sua occorrenza al giro dopo'
);

select * from finish();
rollback;
