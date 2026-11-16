-- Fase 20b — i vincoli dei trasferimenti e la proprietà dei conti (#157).
--
-- Erano le prove b1-b6 e «c», commentate in fondo alla `20260815`, da copiare
-- a mano nel SQL Editor. Qui girano a ogni PR (`npx supabase test db`) su un
-- database ricostruito dalle migration, e il secondo utente lo crea il test:
-- b5 e b6, le prove che valgono più delle altre, non dicono più «SALTATA».
-- Storia: docs/storia/fase-20b-trasferimenti.md.
--
-- Ogni rifiuto si controlla con il codice d'errore E il nome del vincolo:
-- un insert che fallisce per un altro motivo (una colonna sbagliata nella
-- prova) non deve passare per il vincolo che si voleva provare.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Due utenti. Il primo ha due conti per i rifiuti (A, B) e due per il saldo
-- (C, D): se un rifiuto smette di funzionare, il suo insert resta, e su conti
-- condivisi farebbe diventare rosse anche le prove del saldo, mandando a
-- cercare il guasto nella vista (visto nella controprova). I saldi iniziali di
-- C e D sono scelti perché ogni formula sbagliata dia un numero diverso.
insert into auth.users (id, email) values
	('00000000-0000-4000-a000-000000000001', 'uno@pgtap.seichi.test'),
	('00000000-0000-4000-a000-000000000002', 'due@pgtap.seichi.test');
insert into public.accounts (id, user_id, name, initial_balance) values
	('00000000-0000-4000-b000-0000000000a1', '00000000-0000-4000-a000-000000000001', 'A', 0),
	('00000000-0000-4000-b000-0000000000a2', '00000000-0000-4000-a000-000000000001', 'B', 0),
	('00000000-0000-4000-b000-0000000000c1', '00000000-0000-4000-a000-000000000001', 'C', 1000),
	('00000000-0000-4000-b000-0000000000c2', '00000000-0000-4000-a000-000000000001', 'D', 250),
	('00000000-0000-4000-b000-0000000000b1', '00000000-0000-4000-a000-000000000002', 'Altrui', 0);
insert into public.categories (id, user_id, name, icon, color, type) values
	('00000000-0000-4000-c000-0000000000c1', '00000000-0000-4000-a000-000000000001', 'Risparmi', 'PiggyBank', 'kin', 'risparmio');

select throws_ok(
	$$ insert into public.transactions (user_id, amount, type, date, account_id, to_account_id)
	   values ('00000000-0000-4000-a000-000000000001', 10, 'trasferimento', now(),
	           '00000000-0000-4000-b000-0000000000a1', '00000000-0000-4000-b000-0000000000a1') $$,
	'23514', 'new row for relation "transactions" violates check constraint "transactions_dest_distinct_check"',
	'b1 · un trasferimento verso lo stesso conto è rifiutato'
);

select throws_ok(
	$$ insert into public.transactions (user_id, amount, type, date, account_id)
	   values ('00000000-0000-4000-a000-000000000001', 10, 'trasferimento', now(),
	           '00000000-0000-4000-b000-0000000000a1') $$,
	'23514', 'new row for relation "transactions" violates check constraint "transactions_transfer_dest_check"',
	'b2 · un trasferimento senza destinazione è rifiutato'
);

select throws_ok(
	$$ insert into public.transactions (user_id, amount, type, date, account_id, to_account_id, category_id)
	   values ('00000000-0000-4000-a000-000000000001', 10, 'trasferimento', now(),
	           '00000000-0000-4000-b000-0000000000a1', '00000000-0000-4000-b000-0000000000a2',
	           '00000000-0000-4000-c000-0000000000c1') $$,
	'23514', 'new row for relation "transactions" violates check constraint "transactions_transfer_category_check"',
	'b3 · un trasferimento con una categoria è rifiutato'
);

select throws_ok(
	$$ insert into public.transactions (user_id, amount, type, date, account_id, to_account_id)
	   values ('00000000-0000-4000-a000-000000000001', 10, 'spesa', now(),
	           '00000000-0000-4000-b000-0000000000a1', '00000000-0000-4000-b000-0000000000a2') $$,
	'23514', 'new row for relation "transactions" violates check constraint "transactions_dest_type_check"',
	'b4 · una spesa con una destinazione è rifiutata'
);

-- ⚠️ b5 e b6: prima delle FK composite questi insert PASSAVANO. Nessuna policy
-- RLS guarda `account_id`, e la difesa viveva solo nel codice dell'app.
select throws_ok(
	$$ insert into public.transactions (user_id, amount, type, date, account_id, to_account_id)
	   values ('00000000-0000-4000-a000-000000000001', 10, 'trasferimento', now(),
	           '00000000-0000-4000-b000-0000000000a1', '00000000-0000-4000-b000-0000000000b1') $$,
	'23503', 'insert or update on table "transactions" violates foreign key constraint "transactions_to_account_owner_fkey"',
	'b5 · un trasferimento verso il conto di un altro utente è rifiutato'
);

select throws_ok(
	$$ insert into public.transactions (user_id, amount, type, date, account_id)
	   values ('00000000-0000-4000-a000-000000000001', 10, 'spesa', now(),
	           '00000000-0000-4000-b000-0000000000b1') $$,
	'23503', 'insert or update on table "transactions" violates foreign key constraint "transactions_account_owner_fkey"',
	'b6 · un movimento sul conto di un altro utente è rifiutato'
);

-- c · il saldo si sposta, il totale no. Le TRE cifre insieme: un solo saldo
-- giusto è compatibile con una vista che conta il ramo in uscita e ignora
-- quello in entrata, il difetto che questa prova esiste per escludere.
select is(
	(select sum(balance) from public.account_balances
	 where id in ('00000000-0000-4000-b000-0000000000c1', '00000000-0000-4000-b000-0000000000c2')),
	1250::numeric,
	'c · prima del trasferimento C + D fa 1250'
);

-- Il gemello positivo dei rifiuti: un trasferimento legale passa. Senza,
-- b1-b6 sarebbero verdi anche con una tabella che rifiuta tutto.
select lives_ok(
	$$ insert into public.transactions (user_id, amount, type, date, account_id, to_account_id)
	   values ('00000000-0000-4000-a000-000000000001', 100, 'trasferimento', now(),
	           '00000000-0000-4000-b000-0000000000c1', '00000000-0000-4000-b000-0000000000c2') $$,
	'c · un trasferimento fra due conti propri è accettato'
);

select is(
	(select balance from public.account_balances where id = '00000000-0000-4000-b000-0000000000c1'),
	900::numeric,
	'c · il conto di partenza scende di 100'
);

select is(
	(select balance from public.account_balances where id = '00000000-0000-4000-b000-0000000000c2'),
	350::numeric,
	'c · il conto di arrivo sale di 100'
);

select is(
	(select sum(balance) from public.account_balances
	 where id in ('00000000-0000-4000-b000-0000000000c1', '00000000-0000-4000-b000-0000000000c2')),
	1250::numeric,
	'c · il totale dei due conti non si muove'
);

select * from finish();
rollback;
