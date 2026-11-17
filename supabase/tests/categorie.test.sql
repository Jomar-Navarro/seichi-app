-- `categories`:
--   - le colonne che l'app scrive sempre sono NOT NULL (#157, migration
--     `20261116_categories_not_null`): una prova per colonna, e il gemello;
--   - la categoria di un movimento, di un budget o di una regola è del loro
--     proprietario (#158, `20261118_categories_owner_fkeys`), e le tre
--     cancellazioni fanno ancora ciò che facevano.
-- Storia: docs/storia/issue-157-supabase-cli.md, issue-158-categorie-proprietario.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Due utenti VERI: una categoria con un `user_id` inventato fallirebbe sulla FK
-- verso `auth.users`, e il rifiuto passerebbe per il motivo sbagliato.
insert into auth.users (id, email) values
	('00000000-0000-4000-a000-000000000001', 'uno@pgtap.seichi.test'),
	('00000000-0000-4000-a000-000000000002', 'due@pgtap.seichi.test');

-- Il gemello: con tutte le colonne la riga passa, quindi i rifiuti qui sotto
-- vengono dal vincolo e non da un insert sbagliato in sé.
select lives_ok(
	$$ insert into public.categories (user_id, name, icon, color, type)
	   values ('00000000-0000-4000-a000-000000000001', 'Spesa', 'ShoppingCart', 'aka', 'spesa') $$,
	'una categoria completa è accettata'
);

-- Ogni prova lascia NULL una colonna sola: il messaggio esatto nomina quella.
select throws_ok(
	$$ insert into public.categories (name, icon, color, type)
	   values ('Spesa', 'ShoppingCart', 'aka', 'spesa') $$,
	'23502', 'null value in column "user_id" of relation "categories" violates not-null constraint',
	'una categoria senza utente è rifiutata'
);
select throws_ok(
	$$ insert into public.categories (user_id, icon, color, type)
	   values ('00000000-0000-4000-a000-000000000001', 'ShoppingCart', 'aka', 'spesa') $$,
	'23502', 'null value in column "name" of relation "categories" violates not-null constraint',
	'una categoria senza nome è rifiutata'
);
select throws_ok(
	$$ insert into public.categories (user_id, name, color, type)
	   values ('00000000-0000-4000-a000-000000000001', 'Spesa', 'aka', 'spesa') $$,
	'23502', 'null value in column "icon" of relation "categories" violates not-null constraint',
	'una categoria senza icona è rifiutata'
);
select throws_ok(
	$$ insert into public.categories (user_id, name, icon, type)
	   values ('00000000-0000-4000-a000-000000000001', 'Spesa', 'ShoppingCart', 'spesa') $$,
	'23502', 'null value in column "color" of relation "categories" violates not-null constraint',
	'una categoria senza colore è rifiutata'
);
-- ⚠️ Il CHECK sul tipo non bastava: un CHECK con NULL dà NULL, e NULL passa.
select throws_ok(
	$$ insert into public.categories (user_id, name, icon, color)
	   values ('00000000-0000-4000-a000-000000000001', 'Spesa', 'ShoppingCart', 'aka') $$,
	'23502', 'null value in column "type" of relation "categories" violates not-null constraint',
	'una categoria senza tipo è rifiutata'
);
select throws_ok(
	$$ update public.categories set created_at = null where user_id = '00000000-0000-4000-a000-000000000001' $$,
	'23502', 'null value in column "created_at" of relation "categories" violates not-null constraint',
	'la data di creazione non si azzera'
);

-- I traguardi restano facoltativi: NULL vuol dire «nessun traguardo».
select lives_ok(
	$$ insert into public.categories (user_id, name, icon, color, type, target_amount, target_date)
	   values ('00000000-0000-4000-a000-000000000001', 'Vacanze', 'Plane', 'kin', 'risparmio', null, null) $$,
	'un obiettivo senza traguardo è accettato'
);

-- ---------------------------------------------------------------------------
-- #158 · la categoria è del proprietario della riga
-- ---------------------------------------------------------------------------
-- Dati propri, separati per prova: un rifiuto rotto lascia la sua riga sulla
-- categoria ALTRUI (f9), mai su f1 o f2, quindi non sposta i conteggi delle
-- cancellazioni qui sotto.
--   f1 · spesa dell'utente uno: movimento, budget e regola, poi eliminata
--   f2 · obiettivo dell'utente uno con un versamento, poi eliminato
--   f3 · spesa dell'utente uno, per la prova dell'update
--   f9 · spesa dell'utente DUE: il bersaglio dei rifiuti
insert into public.accounts (id, user_id, name) values
	('00000000-0000-4000-b000-0000000000f1', '00000000-0000-4000-a000-000000000001', 'Conto');
insert into public.categories (id, user_id, name, icon, color, type) values
	('00000000-0000-4000-c000-0000000000f1', '00000000-0000-4000-a000-000000000001', 'Spesa', 'ShoppingCart', 'aka', 'spesa'),
	('00000000-0000-4000-c000-0000000000f2', '00000000-0000-4000-a000-000000000001', 'Vacanza', 'Plane', 'kin', 'risparmio'),
	('00000000-0000-4000-c000-0000000000f3', '00000000-0000-4000-a000-000000000001', 'Casa', 'Home', 'aka', 'spesa'),
	('00000000-0000-4000-c000-0000000000f9', '00000000-0000-4000-a000-000000000002', 'Segreta', 'Lock', 'aka', 'spesa');
insert into public.transactions (id, user_id, account_id, amount, type, category_id, date) values
	('00000000-0000-4000-e000-0000000000f2', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000f1',
	 200, 'risparmio', '00000000-0000-4000-c000-0000000000f2', now()),
	('00000000-0000-4000-e000-0000000000f3', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000f1',
	 30, 'spesa', '00000000-0000-4000-c000-0000000000f3', now());

-- Movimenti: il gemello, il rifiuto, e lo stesso rifiuto dalla via vera — una
-- POST all'API, sotto RLS. La policy di insert guarda solo `user_id`, che qui è
-- giusto: lo ferma la FK, e il messaggio esatto dice che è lei e non la RLS.
select lives_ok(
	$$ insert into public.transactions (id, user_id, account_id, amount, type, category_id, date)
	   values ('00000000-0000-4000-e000-0000000000f1', '00000000-0000-4000-a000-000000000001',
	           '00000000-0000-4000-b000-0000000000f1', 12, 'spesa', '00000000-0000-4000-c000-0000000000f1', now()) $$,
	'#158 · un movimento sulla propria categoria è accettato'
);
select throws_ok(
	$$ insert into public.transactions (user_id, account_id, amount, type, category_id, date)
	   values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000f1',
	           12, 'spesa', '00000000-0000-4000-c000-0000000000f9', now()) $$,
	'23503', 'insert or update on table "transactions" violates foreign key constraint "transactions_category_owner_fkey"',
	'#158 · un movimento sulla categoria di un altro utente è rifiutato'
);
select throws_ok(
	$$ set local role authenticated;
	   set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-000000000001", "role": "authenticated"}';
	   insert into public.transactions (user_id, account_id, amount, type, category_id, date)
	   values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000f1',
	           12, 'spesa', '00000000-0000-4000-c000-0000000000f9', now()) $$,
	'23503', 'insert or update on table "transactions" violates foreign key constraint "transactions_category_owner_fkey"',
	'#158 · anche dall''API, con la RLS accesa'
);
reset role;
-- L'update è la seconda porta: un movimento proprio spostato sulla categoria altrui.
select throws_ok(
	$$ update public.transactions set category_id = '00000000-0000-4000-c000-0000000000f9'
	   where id = '00000000-0000-4000-e000-0000000000f3' $$,
	'23503', 'insert or update on table "transactions" violates foreign key constraint "transactions_category_owner_fkey"',
	'#158 · un movimento non si sposta sulla categoria di un altro utente'
);

-- Budget.
select lives_ok(
	$$ insert into public.budgets (user_id, category_id, period, amount, valid_from)
	   values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-0000000000f1', 'mensile', 100,
	           public.budget_period_start('mensile', current_date)) $$,
	'#158 · un budget sulla propria categoria è accettato'
);
select throws_ok(
	$$ insert into public.budgets (user_id, category_id, period, amount, valid_from)
	   values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-0000000000f9', 'mensile', 100,
	           public.budget_period_start('mensile', current_date)) $$,
	'23503', 'insert or update on table "budgets" violates foreign key constraint "budgets_category_owner_fkey"',
	'#158 · un budget sulla categoria di un altro utente è rifiutato'
);

-- Regole ricorrenti.
select lives_ok(
	$$ insert into public.recurring_rules (id, user_id, account_id, amount, type, category_id, frequency, start_date, next_run)
	   values ('00000000-0000-4000-d000-0000000000f1', '00000000-0000-4000-a000-000000000001',
	           '00000000-0000-4000-b000-0000000000f1', 12, 'spesa', '00000000-0000-4000-c000-0000000000f1',
	           'mensile', current_date, current_date + 30) $$,
	'#158 · una regola sulla propria categoria è accettata'
);
select throws_ok(
	$$ insert into public.recurring_rules (user_id, account_id, amount, type, category_id, frequency, start_date, next_run)
	   values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-b000-0000000000f1',
	           12, 'spesa', '00000000-0000-4000-c000-0000000000f9', 'mensile', current_date, current_date + 30) $$,
	'23503', 'insert or update on table "recurring_rules" violates foreign key constraint "recurring_rules_category_owner_fkey"',
	'#158 · una regola sulla categoria di un altro utente è rifiutata'
);

-- Le cancellazioni. Prima il conteggio: senza, «zero righe dopo» sarebbe verde
-- anche se le righe non fossero mai nate.
select is(
	(select (select count(*) from public.transactions    where category_id = '00000000-0000-4000-c000-0000000000f1')
	      + (select count(*) from public.budgets         where category_id = '00000000-0000-4000-c000-0000000000f1')
	      + (select count(*) from public.recurring_rules where category_id = '00000000-0000-4000-c000-0000000000f1')),
	3::bigint,
	'#158 · prima: la categoria ha un movimento, un budget e una regola'
);
-- ⚠️ Con un `on delete set null` semplice sulla FK composita, questa riga
-- fallirebbe con 23502: annullerebbe anche `user_id` della regola.
select lives_ok(
	$$ delete from public.categories where id = '00000000-0000-4000-c000-0000000000f1' $$,
	'#158 · una categoria con movimenti, budget e regole si elimina'
);
select is(
	(select (select count(*) from public.transactions where category_id = '00000000-0000-4000-c000-0000000000f1')
	      + (select count(*) from public.budgets      where category_id = '00000000-0000-4000-c000-0000000000f1')),
	0::bigint,
	'#158 · e porta con sé i suoi movimenti e i suoi budget'
);
-- Senza la riga (o con la categoria ancora lì) la sottoquery dà NULL, e `is()`
-- cade: NULL non coincide con l'utente atteso.
select is(
	(select user_id from public.recurring_rules
	 where id = '00000000-0000-4000-d000-0000000000f1' and category_id is null),
	'00000000-0000-4000-a000-000000000001'::uuid,
	'#158 · la sua regola resta, senza categoria e con il suo proprietario'
);

-- L'obiettivo: `deleteGoal()` poggia sulla cascata per togliere i versamenti.
select lives_ok(
	$$ delete from public.categories where id = '00000000-0000-4000-c000-0000000000f2' $$,
	'#158 · un obiettivo con un versamento si elimina'
);
select is(
	(select count(*) from public.transactions where id = '00000000-0000-4000-e000-0000000000f2'),
	0::bigint,
	'#158 · e il versamento se ne va con lui'
);

select * from finish();
rollback;
