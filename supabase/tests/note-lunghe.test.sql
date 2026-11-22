-- #220 — la nota di una regola ricorrente entra nel movimento che genera.
--
-- `recurring_rules.notes` era `text` e `transactions.notes` è `varchar(255)`:
-- una regola con una nota più lunga si salvava e poi falliva a ogni
-- generazione. Ora il CHECK `recurring_rules_notes_length_check` ha lo stesso
-- limite, contato allo stesso modo: per caratteri (code point), non per byte né
-- per unità UTF-16 — ed è ciò che contano anche `lib/notes.ts`, il form e le
-- action.
-- Storia: docs/storia/issue-220-note-lunghe.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
	('00000000-0000-4000-a000-000000000220', 'note@pgtap.seichi.test');
insert into public.accounts (id, user_id, name) values
	('00000000-0000-4000-b000-000000000220', '00000000-0000-4000-a000-000000000220', 'Conto');

-- Le regole partono nel futuro: il cron non le tocca, e la prova g sotto
-- genera solo quella che fa partire lei.
select lives_ok(
	$$ insert into public.recurring_rules (user_id, account_id, amount, type, notes, frequency, start_date, next_run)
	   values ('00000000-0000-4000-a000-000000000220', '00000000-0000-4000-b000-000000000220', 5, 'spesa',
	           repeat('a', 255), 'mensile', current_date + 30, current_date + 30) $$,
	'a1 · una nota di 255 caratteri è accettata'
);
select throws_ok(
	$$ insert into public.recurring_rules (user_id, account_id, amount, type, notes, frequency, start_date, next_run)
	   values ('00000000-0000-4000-a000-000000000220', '00000000-0000-4000-b000-000000000220', 5, 'spesa',
	           repeat('a', 256), 'mensile', current_date + 30, current_date + 30) $$,
	'23514', 'new row for relation "recurring_rules" violates check constraint "recurring_rules_notes_length_check"',
	'a2 · una nota di 256 caratteri è rifiutata'
);

-- Il conteggio è per CARATTERI: 255 emoji sono 1020 byte e 510 unità UTF-16,
-- e passano. Se il vincolo contasse i byte (`octet_length`) cadrebbe b1.
select lives_ok(
	$$ insert into public.recurring_rules (user_id, account_id, amount, type, notes, frequency, start_date, next_run)
	   values ('00000000-0000-4000-a000-000000000220', '00000000-0000-4000-b000-000000000220', 5, 'spesa',
	           repeat('🏠', 255), 'mensile', current_date + 30, current_date + 30) $$,
	'b1 · 255 emoji sono 255 caratteri, e passano'
);
select throws_ok(
	$$ insert into public.recurring_rules (user_id, account_id, amount, type, notes, frequency, start_date, next_run)
	   values ('00000000-0000-4000-a000-000000000220', '00000000-0000-4000-b000-000000000220', 5, 'spesa',
	           repeat('🏠', 256), 'mensile', current_date + 30, current_date + 30) $$,
	'23514', 'new row for relation "recurring_rules" violates check constraint "recurring_rules_notes_length_check"',
	'b2 · 256 emoji no'
);

-- La seconda porta: l'update di una regola esistente.
select throws_ok(
	$$ update public.recurring_rules set notes = repeat('a', 256)
	   where user_id = '00000000-0000-4000-a000-000000000220' and notes = repeat('a', 255) $$,
	'23514', 'new row for relation "recurring_rules" violates check constraint "recurring_rules_notes_length_check"',
	'c1 · una regola non si allunga oltre il limite con un update'
);

-- Anche dall'API, con la RLS accesa: il vincolo non dipende dal ruolo.
select throws_ok(
	$$ set local role authenticated;
	   set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-000000000220", "role": "authenticated"}';
	   insert into public.recurring_rules (user_id, account_id, amount, type, notes, frequency, start_date, next_run)
	   values ('00000000-0000-4000-a000-000000000220', '00000000-0000-4000-b000-000000000220', 5, 'spesa',
	           repeat('a', 256), 'mensile', current_date + 30, current_date + 30) $$,
	'23514', 'new row for relation "recurring_rules" violates check constraint "recurring_rules_notes_length_check"',
	'c2 · dall''API la nota lunga è rifiutata'
);
reset role;
set local request.jwt.claims = '';

-- g · il punto della issue: ciò che la regola accetta, il movimento lo
-- accetta. Una regola dovuta con la nota più lunga possibile (in emoji, il caso
-- peggiore) genera il suo movimento invece di essere saltata.
insert into public.recurring_rules (id, user_id, account_id, amount, type, notes, frequency, start_date, next_run) values
	('00000000-0000-4000-d000-000000000220', '00000000-0000-4000-a000-000000000220', '00000000-0000-4000-b000-000000000220',
	 5, 'spesa', repeat('🏠', 255), 'mensile', current_date, current_date);

select ok(
	not ('00000000-0000-4000-d000-000000000220'::uuid = any (public.generate_recurring_transactions())),
	'g1 · la regola con la nota al limite non è fra le saltate'
);
select is(
	(select notes from public.transactions where recurring_rule_id = '00000000-0000-4000-d000-000000000220'),
	repeat('🏠', 255)::varchar(255),
	'g2 · il movimento generato porta la nota intera'
);

select * from finish();
rollback;
