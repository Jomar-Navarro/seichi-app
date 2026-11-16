-- #123 — importi positivi, lock del job, categorie altrui nelle notifiche (#157).
--
-- Erano le prove a1, b1-b4, c2-c4 commentate in fondo alla `20260821`. Qui il
-- secondo utente lo crea il test, quindi c3 e c4 non dicono più «SALTATA».
-- Restano fuori:
--   - c1 («nessun rinnovo con `days`»), che guarda i DATI della produzione: su
--     un database vuoto passerebbe senza aver visto niente;
--   - la concorrenza del job, che vuole due sessioni sovrapposte.
-- Storia: docs/storia/issue-123-database-integrita.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
	('00000000-0000-4000-a000-000000000001', 'uno@pgtap.seichi.test'),
	('00000000-0000-4000-a000-000000000002', 'due@pgtap.seichi.test');
insert into public.accounts (id, user_id, name) values
	('00000000-0000-4000-b000-0000000000a1', '00000000-0000-4000-a000-000000000001', 'Conto');
insert into public.categories (id, user_id, name, icon, color, type) values
	-- la categoria di un ALTRO utente: le FK verso `categories` sono a colonna
	-- singola, quindi una riga dell'utente uno può puntarci (debito della #158)
	('00000000-0000-4000-c000-0000000000b1', '00000000-0000-4000-a000-000000000002', 'Segreta', 'Lock', 'aka', 'spesa'),
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

-- c3 · un rinnovo fra due giorni su una regola con la categoria ALTRUI, e il
-- gemello con una categoria propria: senza il gemello, «niente nome» passerebbe
-- anche se la funzione non copiasse mai il nome di nessuno.
insert into public.recurring_rules (id, user_id, account_id, amount, type, category_id, frequency, start_date, next_run) values
	('00000000-0000-4000-d000-0000000000b1', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1',
	 9.99, 'abbonamento', '00000000-0000-4000-c000-0000000000b1', 'mensile', current_date + 2, current_date + 2),
	('00000000-0000-4000-d000-0000000000a1', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1',
	 12.99, 'abbonamento', '00000000-0000-4000-c000-0000000000a1', 'mensile', current_date + 2, current_date + 2);

-- c4 · un budget sforato sulla categoria altrui, e il gemello sulla propria.
insert into public.budgets (user_id, category_id, period, amount, valid_from) values
	('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-0000000000b1', 'mensile', 1,
	 public.budget_period_start('mensile', current_date)),
	('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-0000000000a2', 'mensile', 1,
	 public.budget_period_start('mensile', current_date));
insert into public.transactions (user_id, account_id, amount, type, category_id, date) values
	('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1', 5, 'spesa',
	 '00000000-0000-4000-c000-0000000000b1', now()),
	('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000a1', 5, 'spesa',
	 '00000000-0000-4000-c000-0000000000a2', now());

-- genera per TUTTI gli utenti: il rollback finale lo annulla
select public.generate_notifications();

select is(
	(select count(*) from public.notifications
	 where dedup_key = 'abbonamento_rinnovo:00000000-0000-4000-d000-0000000000b1:' || (current_date + 2)),
	1::bigint,
	'c3 · il rinnovo sulla categoria altrui genera la notifica'
);
-- coalesce: confrontato con NULL, «niente riga» e «riga senza nome» darebbero
-- lo stesso verde. Così senza la riga la prova cade da sola.
select is(
	(select coalesce(payload ->> 'name', '(senza nome)') from public.notifications
	 where dedup_key = 'abbonamento_rinnovo:00000000-0000-4000-d000-0000000000b1:' || (current_date + 2)),
	'(senza nome)',
	'c3 · e non copia il nome della categoria altrui'
);
select ok(
	(select payload ->> 'date' = (current_date + 2)::text and not payload ? 'days' from public.notifications
	 where dedup_key = 'abbonamento_rinnovo:00000000-0000-4000-d000-0000000000b1:' || (current_date + 2)),
	'c3 · il payload porta la DATA del rinnovo, non la distanza'
);
select is(
	(select payload ->> 'name' from public.notifications
	 where dedup_key = 'abbonamento_rinnovo:00000000-0000-4000-d000-0000000000a1:' || (current_date + 2)),
	'Netflix',
	'c3 · gemello: sulla categoria propria il nome c''è'
);

select is(
	(select count(*) from public.notifications
	 where user_id = '00000000-0000-4000-a000-000000000001'
	   and dedup_key like 'budget\_%:00000000-0000-4000-c000-0000000000b1:%'),
	0::bigint,
	'c4 · il budget sulla categoria altrui non produce notifiche'
);
select is(
	(select count(*) from public.notifications
	 where user_id = '00000000-0000-4000-a000-000000000001'
	   and dedup_key like 'budget_sforato:00000000-0000-4000-c000-0000000000a2:%'
	   and payload ->> 'category' = 'Collaudo 123'),
	1::bigint,
	'c4 · gemello: il budget sforato sulla categoria propria è notificato'
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
