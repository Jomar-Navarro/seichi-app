-- #161 — i limiti di frequenza (`20261119_rate_limits`): `consume_rate_limit()`,
-- il registro `rate_events` e il tetto dentro `import_transactions()`.
--
-- Le chiamate girano come `postgres` con le claims dell'utente: `auth.uid()`
-- legge `request.jwt.claims`, non il ruolo, e la funzione è `security definer`.
-- I privilegi si provano a parte, cambiando ruolo.
--
-- Resta fuori la concorrenza (il lock per utente e azione): vuole due sessioni
-- sovrapposte, come il lock del job nella #123.
-- Storia: docs/storia/issue-161-limiti.md.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
	('00000000-0000-4000-a000-000000000001', 'uno@pgtap.seichi.test'),
	('00000000-0000-4000-a000-000000000002', 'due@pgtap.seichi.test');
insert into public.accounts (id, user_id, name, archived) values
	('00000000-0000-4000-b000-0000000000a1', '00000000-0000-4000-a000-000000000001', 'Conto', false),
	('00000000-0000-4000-b000-0000000000a2', '00000000-0000-4000-a000-000000000001', 'Chiuso', true);

-- ---------------------------------------------------------------------------
-- Il registro non lo tocca nessun client
-- ---------------------------------------------------------------------------
select ok(
	(select relrowsecurity from pg_class where oid = 'public.rate_events'::regclass),
	'rate_events ha la RLS accesa'
);
select is(
	(select count(*) from pg_policies where schemaname = 'public' and tablename = 'rate_events'),
	0::bigint,
	'rate_events non ha policy: la scrive solo consume_rate_limit()'
);
select throws_ok(
	$$ set local role authenticated; select count(*) from public.rate_events $$,
	'42501', 'permission denied for table rate_events',
	'authenticated non legge il registro'
);
reset role;
select throws_ok(
	$$ set local role authenticated;
	   insert into public.rate_events (user_id, action) values ('00000000-0000-4000-a000-000000000001', 'avatar') $$,
	'42501', 'permission denied for table rate_events',
	'authenticated non scrive il registro: non si azzera il tetto da sé'
);
reset role;
select throws_ok(
	$$ set local role anon; select public.consume_rate_limit('avatar') $$,
	'42501', 'permission denied for function consume_rate_limit',
	'anon non chiama consume_rate_limit()'
);
reset role;

-- ---------------------------------------------------------------------------
-- Il tetto: avatar, 5 all'ora
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-000000000001", "role": "authenticated"}';

-- Il gemello che passa, dalla via vera: `authenticated` la esegue.
select lives_ok(
	$$ set local role authenticated; select public.consume_rate_limit('avatar') $$,
	'authenticated chiama consume_rate_limit()'
);
reset role;
do $$ begin perform public.consume_rate_limit('avatar') from generate_series(1, 3); end $$;

select is(public.consume_rate_limit('avatar'), 0, 'avatar · la quinta dell''ora è concessa');
select ok(
	public.consume_rate_limit('avatar') between 1 and 3600,
	'avatar · la sesta è rifiutata, con un''attesa entro l''ora'
);
select is(
	(select count(*) from public.rate_events
	 where user_id = '00000000-0000-4000-a000-000000000001' and action = 'avatar'),
	5::bigint,
	'avatar · il rifiuto non si registra: aspettare basta'
);
select is(public.consume_rate_limit('export'), 0, 'il tetto è per azione: l''export resta libero');

set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-000000000002", "role": "authenticated"}';
select is(public.consume_rate_limit('avatar'), 0, 'il tetto è per utente: l''utente due resta libero');

-- ---------------------------------------------------------------------------
-- I secondi da aspettare. Utente due, export: 2 eventi a −55 minuti, 5 a −50 e
-- 5 a −30 (12, oltre il tetto di 10). Si libera un posto quando scade il
-- DECIMO dal più recente, uno di quelli a −50: fra 10 minuti esatti. Contare
-- dal più vecchio direbbe 5 minuti, e lascerebbe passare un'azione di troppo.
-- (`now()` è fisso nella transazione: il numero è esatto.)
-- ---------------------------------------------------------------------------
insert into public.rate_events (user_id, action, created_at)
select '00000000-0000-4000-a000-000000000002', 'export', now() - make_interval(mins => m)
from unnest(array[55, 55, 50, 50, 50, 50, 50, 30, 30, 30, 30, 30]) as m;

select is(public.consume_rate_limit('export'), 600, 'export · riprova fra 600 secondi, non 300');

-- ---------------------------------------------------------------------------
-- La finestra scorre: 30 ricevute di 61 minuti fa non contano più, e il
-- registro le dimentica.
-- ---------------------------------------------------------------------------
insert into public.rate_events (user_id, action, created_at)
select '00000000-0000-4000-a000-000000000002', 'receipt', now() - interval '61 minutes'
from generate_series(1, 30);

select is(public.consume_rate_limit('receipt'), 0, 'receipt · gli eventi usciti dalla finestra non contano');
select is(
	(select count(*) from public.rate_events
	 where user_id = '00000000-0000-4000-a000-000000000002' and action = 'receipt'),
	1::bigint,
	'receipt · e il registro li ha cancellati'
);

-- ---------------------------------------------------------------------------
-- L'archivio completo (#162, `20261120_rate_limit_archive`): 3 al giorno, con
-- un'azione propria. Utente due, dati propri: nessun evento `archive` prima.
-- ---------------------------------------------------------------------------
select lives_ok(
	$$ set local role authenticated; select public.consume_rate_limit('archive') $$,
	'archive · authenticated la chiama, e il vincolo di rate_events la accetta'
);
reset role;
select is(public.consume_rate_limit('archive') + public.consume_rate_limit('archive'), 0,
	'archive · la seconda e la terza della giornata sono concesse');
select ok(
	public.consume_rate_limit('archive') between 82800 and 86400,
	'archive · la quarta è rifiutata, con un''attesa entro le 24 ore e non entro l''ora'
);
select throws_ok(
	$$ insert into public.rate_events (user_id, action) values ('00000000-0000-4000-a000-000000000002', 'stampa') $$,
	'23514', 'new row for relation "rate_events" violates check constraint "rate_events_action_check"',
	'il vincolo allargato resta un vincolo: un''azione sconosciuta non entra'
);

-- ---------------------------------------------------------------------------
-- Gli errori
-- ---------------------------------------------------------------------------
select throws_ok(
	$$ select public.consume_rate_limit('stampa') $$,
	'22023', 'azione sconosciuta: stampa',
	'un''azione sconosciuta è un errore, non un tetto'
);
set local request.jwt.claims = '';
select throws_ok(
	$$ select public.consume_rate_limit('avatar') $$,
	'28000', 'not authenticated',
	'senza utente non si conta niente'
);

-- ---------------------------------------------------------------------------
-- L'import, dentro import_transactions(): 10 al giorno. L'utente uno ne ha 9
-- registrati nelle ultime 24 ore.
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-4000-a000-000000000001", "role": "authenticated"}';
insert into public.rate_events (user_id, action, created_at)
select '00000000-0000-4000-a000-000000000001', 'import', now() - interval '2 hours'
from generate_series(1, 9);

-- Un import rifiutato PRIMA del tetto (conto archiviato) non consuma.
select throws_ok(
	$$ select * from public.import_transactions('00000000-0000-4000-b000-0000000000a2', 'generico', 'a.csv',
	     '[{"account_id": "00000000-0000-4000-b000-0000000000a2", "type": "spesa", "amount": 1,
	        "date": "2026-11-01T00:00:00", "import_key": "k1"}]'::jsonb) $$,
	'23503', 'conto non valido per l''import',
	'import · su un conto archiviato è rifiutato prima del tetto'
);

-- Il decimo passa, dalla via vera.
select lives_ok(
	$$ set local role authenticated;
	   select * from public.import_transactions('00000000-0000-4000-b000-0000000000a1', 'generico', 'a.csv',
	     '[{"account_id": "00000000-0000-4000-b000-0000000000a1", "type": "spesa", "amount": 1,
	        "date": "2026-11-01T00:00:00", "import_key": "k1"}]'::jsonb) $$,
	'import · il decimo della giornata è accettato'
);
reset role;
select is(
	(select count(*) from public.rate_events
	 where user_id = '00000000-0000-4000-a000-000000000001' and action = 'import'),
	10::bigint,
	'import · registrato il decimo, non quello rifiutato sul conto archiviato'
);

-- L'undicesimo no, con il codice proprio e i secondi nel detail.
select throws_ok(
	$$ set local role authenticated;
	   select * from public.import_transactions('00000000-0000-4000-b000-0000000000a1', 'generico', 'b.csv',
	     '[{"account_id": "00000000-0000-4000-b000-0000000000a1", "type": "spesa", "amount": 2,
	        "date": "2026-11-02T00:00:00", "import_key": "k2"}]'::jsonb) $$,
	'SR429', 'troppi import',
	'import · l''undicesimo è rifiutato con SR429'
);
reset role;

-- ---------------------------------------------------------------------------
-- Eliminare l'account svuota il registro (FK in cascata).
-- ---------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-4000-a000-000000000002';
select is(
	(select count(*) from public.rate_events where user_id = '00000000-0000-4000-a000-000000000002'),
	0::bigint,
	'eliminato l''utente, i suoi eventi se ne vanno'
);

select * from finish();
rollback;
