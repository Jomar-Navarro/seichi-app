-- #123 — importi positivi, lock del job, categorie altrui nelle notifiche (#157).
--
-- Erano le prove a1, b1-b4, c2-c4 commentate in fondo alla `20260821`.
-- Restano fuori:
--   - c1 («nessun rinnovo con `days`»), che guarda i DATI della produzione: su
--     un database vuoto passerebbe senza aver visto niente;
--   - la concorrenza del job, che vuole due sessioni sovrapposte;
--   - dalla #158, il rinnovo e il budget sulla categoria di un ALTRO utente:
--     le FK composite non lasciano più costruire quella riga. Il rifiuto lo
--     provano `categorie.test.sql` (23503) e, sul testo delle join, le c2.
-- Storia: docs/storia/issue-123-database-integrita.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
	('00000000-0000-4000-a000-000000000001', 'uno@pgtap.seichi.test');
insert into public.accounts (id, user_id, name) values
	('00000000-0000-4000-b000-0000000000a1', '00000000-0000-4000-a000-000000000001', 'Conto');
insert into public.categories (id, user_id, name, icon, color, type) values
	('00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001', 'Netflix', 'Tv', 'murasaki', 'abbonamento'),
	('00000000-0000-4000-c000-0000000000a2', '00000000-0000-4000-a000-000000000001', 'Collaudo 123', 'ShoppingCart', 'aka', 'spesa');

-- a1 · il gemello positivo: un importo valido si scrive, quindi i rifiuti qui
-- sotto vengono dal vincolo e non da un insert sbagliato in sé.
select lives_ok(
	$$ insert into public.transactions (user_id, account_id, amount, type, date)
	   values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1', 1, 'spesa', now()) $$,
	'a1 · un importo di 1 è accettato'
);

select throws_ok(
	$$ insert into public.transactions (user_id, account_id, amount, type, date)
	   values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1', 0, 'spesa', now()) $$,
	'23514', 'new row for relation "transactions" violates check constraint "transactions_amount_check"',
	'b1 · un importo zero è rifiutato'
);

-- il caso che faceva SALIRE il saldo di una spesa
select throws_ok(
	$$ insert into public.transactions (user_id, account_id, amount, type, date)
	   values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1', -50, 'spesa', now()) $$,
	'23514', 'new row for relation "transactions" violates check constraint "transactions_amount_check"',
	'b2 · un importo negativo è rifiutato'
);

select throws_ok(
	$$ insert into public.transactions (user_id, account_id, amount, type, date)
	   values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1', 1, null, now()) $$,
	'23502', 'null value in column "type" of relation "transactions" violates not-null constraint',
	'b3 · un movimento senza tipo è rifiutato'
);

select throws_ok(
	$$ insert into public.recurring_rules (user_id, account_id, amount, type, frequency, start_date, next_run)
	   values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1', 0, 'spesa',
	           'mensile', current_date, current_date + 30) $$,
	'23514', 'new row for relation "recurring_rules" violates check constraint "recurring_rules_amount_check"',
	'b4 · una regola ricorrente da zero è rifiutata'
);

-- c2 · le due funzioni sono quelle della `20260821`: una migration futura che
-- le riscrive dimenticando il lock o il proprietario fa diventare rosso questo.
select ok(
	pg_get_functiondef('public.generate_recurring_transactions()'::regprocedure) ~* 'for\s+no\s+key\s+update',
	'c2 · il cursore delle ricorrenti prende il lock «for no key update»'
);
select ok(
	pg_get_functiondef('public.generate_notifications()'::regprocedure) ~* 'c\.user_id\s*=\s*r\.user_id',
	'c2 · la join dei rinnovi verso categories confronta il proprietario'
);
select ok(
	pg_get_functiondef('public.generate_notifications()'::regprocedure) ~* 'c\.user_id\s*=\s*s\.user_id',
	'c2 · la join dei budget verso categories confronta il proprietario'
);

-- c3 · un rinnovo fra due giorni su una regola con la propria categoria: la
-- notifica porta il nome e la DATA. (Il caso della categoria altrui, che
-- doveva uscire senza nome, dalla #158 non si può più costruire.)
insert into public.recurring_rules (id, user_id, account_id, amount, type, category_id, frequency, start_date, next_run) values
	('00000000-0000-4000-d000-0000000000a1', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1',
	 12.99, 'abbonamento', '00000000-0000-4000-c000-0000000000a1', 'mensile', current_date + 2, current_date + 2);

-- c4 · un budget sforato sulla propria categoria.
insert into public.budgets (user_id, category_id, period, amount, valid_from) values
	('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-0000000000a2', 'mensile', 1,
	 public.budget_period_start('mensile', current_date));
insert into public.transactions (user_id, account_id, amount, type, category_id, date) values
	('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1', 5, 'spesa',
	 '00000000-0000-4000-c000-0000000000a2', now());

-- genera per TUTTI gli utenti: il rollback finale lo annulla
select public.generate_notifications();

select is(
	(select payload ->> 'name' from public.notifications
	 where dedup_key = 'abbonamento_rinnovo:00000000-0000-4000-d000-0000000000a1:' || (current_date + 2)),
	'Netflix',
	'c3 · il rinnovo sulla categoria propria porta il suo nome'
);
select ok(
	(select payload ->> 'date' = (current_date + 2)::text and not payload ? 'days' from public.notifications
	 where dedup_key = 'abbonamento_rinnovo:00000000-0000-4000-d000-0000000000a1:' || (current_date + 2)),
	'c3 · il payload porta la DATA del rinnovo, non la distanza'
);

select is(
	(select count(*) from public.notifications
	 where user_id = '00000000-0000-4000-a000-000000000001'
	   and dedup_key like 'budget_sforato:00000000-0000-4000-c000-0000000000a2:%'
	   and payload ->> 'category' = 'Collaudo 123'),
	1::bigint,
	'c4 · il budget sforato sulla categoria propria è notificato'
);
-- ⚠️ Con il nome NULL il client leggerebbe la riga come il budget GLOBALE
-- («Limite sulle spese variabili superato»): l'utente uno non ha un budget
-- globale, quindi nessuna notifica di budget può avere la categoria vuota.
select is(
	(select count(*) from public.notifications
	 where user_id = '00000000-0000-4000-a000-000000000001'
	   and type like 'budget\_%' and payload ->> 'category' is null),
	0::bigint,
	'c4 · nessuna notifica di budget senza categoria, cioè finta «globale»'
);

select * from finish();
rollback;
