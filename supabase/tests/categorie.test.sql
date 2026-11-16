-- `categories`: le colonne che l'app scrive sempre sono NOT NULL (#157,
-- migration `20261116_categories_not_null`). Una prova per colonna, e il
-- gemello che passa.
-- Storia: docs/storia/issue-157-supabase-cli.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
	('00000000-0000-4000-a000-000000000001', 'uno@pgtap.seichi.test');

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

select * from finish();
rollback;
