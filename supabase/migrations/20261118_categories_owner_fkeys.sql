-- ============================================================================
-- 20261118 — la categoria di un movimento, di un budget o di una regola è
-- dell'utente che li possiede (issue #158)
-- ============================================================================
-- Le tre FK verso `categories` erano a colonna singola: garantivano che la
-- categoria ESISTA, non che sia TUA. Le policy RLS filtrano su `user_id`, che lo
-- scrive il server, e nessuna guarda `category_id`: una POST costruita a mano
-- poteva attaccare un movimento, un budget o una regola alla categoria di un
-- altro utente. La `20260821` (#123) ne aveva chiuso la conseguenza visibile —
-- `generate_notifications()` copiava il nome della categoria altrui nella
-- notifica — non la causa.
--
-- È il buco che la 20b ha chiuso per i conti (`20260815`, sezione 4), e la cura
-- è la stessa: una FK composita `(category_id, user_id) → categories (id,
-- user_id)`, che rende lo stato illegale irrappresentabile invece che vietato
-- per attenzione.
--
-- ⚠️ Il prerequisito è `user_id` NOT NULL su tutte e quattro le tabelle: con
-- `MATCH SIMPLE` una colonna NULL disattiva l'intero vincolo. `transactions` e
-- `recurring_rules` lo sono dalla `20260815`, `budgets` dalla nascita
-- (`20260803`), `categories` dalla `20261116`. Un `category_id` NULL invece
-- resta legale, ed è giusto che il vincolo non lo verifichi: il budget globale,
-- il trasferimento, la regola rimasta senza categoria.
--
-- ⚠️ Scritta interrogando la PRODUZIONE il 2026-11-17 (`db query --remote
-- --read-only`), Postgres 17.6: zero riferimenti incrociati su 406 movimenti,
-- 6 budget e 6 regole; le tre FK come le hanno lasciate la baseline, la
-- `20260728` e la `20260803`; un indice che COMINCIA con `category_id` su
-- tutte e tre le tabelle (`transactions_category_idx`,
-- `budgets_category_id_idx`, `recurring_rules_category_id_idx`). Quell'indice
-- serve anche la ricerca sulla coppia che Postgres fa a ogni cancellazione di
-- una categoria: un indice su `(category_id, user_id)` sarebbe spazio sprecato,
-- come per i conti (`20260819`).
--
-- ----------------------------------------------------------------------------
-- Le tre azioni restano quelle di prima
-- ----------------------------------------------------------------------------
--   · `transactions`: `on delete cascade`. Eliminare una categoria elimina i
--     suoi movimenti, e ci poggia l'eliminazione di un obiettivo.
--   · `budgets`: `on delete cascade`.
--   · `recurring_rules`: `on delete set null (category_id)`. ⚠️ Non un
--     `set null` semplice: su una FK composita annullerebbe ENTRAMBE le
--     colonne, `user_id` compreso, che è NOT NULL — eliminare una categoria con
--     una regola fallirebbe con `23502`. La lista di colonne (Postgres 15+)
--     annulla solo la categoria. L'app oggi non ci arriva — `deleteCategory()`
--     rifiuta una categoria con regole, `deleteGoal()` le elimina prima (#117)
--     — ma il vincolo deve dire la verità anche per il prossimo chiamante.
--
-- I nomi seguono quelli dei conti (`*_account_owner_fkey`): `*_category_owner_fkey`
-- dice cosa garantisce. Nessun embed PostgREST li nomina (`categories!…`):
-- c'è una sola relazione verso `categories` per tabella, e la si trova da sé.
--
-- ⚠️ La `20260803` non ha guardia: rieseguita, ricreerebbe `budgets_category_id_fkey`
-- a colonna singola ACCANTO alla composita. Non indebolirebbe niente — la
-- composita resta, e le due azioni coincidono — e con `db push` un file già
-- nella cronologia non si riesegue. Lo stesso per la baseline e la `20260728`,
-- che una guardia ce l'hanno.
--
-- ----------------------------------------------------------------------------
-- Cosa fa, in ordine
-- ----------------------------------------------------------------------------
--   1. conta i riferimenti incrociati e gli `user_id` NULL, e si ferma PRIMA di
--      scrivere
--   2. `categories (id, user_id)` unica: il bersaglio delle FK composite
--   3. le tre FK composite al posto di quelle a colonna singola
--   4. verifica ESEGUITA: se una FK non è quella attesa, il file si annulla
--
-- Rieseguibile: i dipendenti della sezione 2 si tolgono per nome prima del
-- vincolo su cui poggiano (`drop … if exists` non è idempotenza, 20b), e la
-- seconda esecuzione ricrea le stesse cose.
-- Nessun ordine di deploy: nessun codice nomina questi vincoli, e nessuno
-- scrittore dell'app usa la categoria di un altro utente. Il vincolo rifiuta
-- solo una POST costruita a mano, con `23503`.
-- La controprova è `supabase/tests/categorie.test.sql`.
-- ============================================================================

-- 1. Ciò che il vincolo rifiuterebbe. L'`add constraint` fallirebbe comunque,
--    ma nominando una tabella sola; qui si vedono tutte, prima di scrivere.
do $$
declare
	v_tx int; v_budget int; v_rule int; v_null int;
begin
	select count(*) into v_tx
	  from public.transactions t join public.categories c on c.id = t.category_id
	 where c.user_id <> t.user_id;
	select count(*) into v_budget
	  from public.budgets b join public.categories c on c.id = b.category_id
	 where c.user_id <> b.user_id;
	select count(*) into v_rule
	  from public.recurring_rules r join public.categories c on c.id = r.category_id
	 where c.user_id <> r.user_id;

	-- Il prerequisito: un `user_id` NULL spegnerebbe il vincolo in silenzio, e
	-- `<>` qui sopra non vedrebbe quella riga.
	select (select count(*) from public.categories      where user_id is null)
	     + (select count(*) from public.transactions    where user_id is null)
	     + (select count(*) from public.budgets         where user_id is null)
	     + (select count(*) from public.recurring_rules where user_id is null)
	  into v_null;

	if v_tx + v_budget + v_rule + v_null > 0 then
		raise exception 'STOP: righe che puntano alla categoria di un altro utente — movimenti %, budget %, regole %; user_id NULL %. '
			'Vanno guardate a mano: non si sceglie al posto dell''utente a quale categoria appartenevano.',
			v_tx, v_budget, v_rule, v_null;
	end if;
end $$;

-- 2. Il bersaglio delle FK composite. Una FK si riferisce solo a colonne
--    coperte da un vincolo di unicità: `id` è la primary key, `(id, user_id)`
--    no. Ridondante in senso stretto, ed è la ridondanza che permette di dire
--    «questa categoria è di QUESTO utente» come vincolo.
--    ⚠️ Prima i dipendenti, per nome: alla seconda esecuzione le tre FK
--    poggiano su `categories_id_user_key`, e toglierlo da solo morirebbe con
--    `2BP01` a metà file. Mai `drop … cascade`.
alter table public.transactions    drop constraint if exists transactions_category_owner_fkey;
alter table public.budgets         drop constraint if exists budgets_category_owner_fkey;
alter table public.recurring_rules drop constraint if exists recurring_rules_category_owner_fkey;

alter table public.categories drop constraint if exists categories_id_user_key;
alter table public.categories add  constraint categories_id_user_key unique (id, user_id);

-- 3. Le FK composite. Ognuna sostituisce quella a colonna singola: «è tua»
--    implica «esiste», e tenerle entrambe sarebbe un controllo in più a ogni
--    scrittura per un fatto già garantito.
alter table public.transactions drop constraint if exists transactions_category_id_fkey;
alter table public.transactions add  constraint transactions_category_owner_fkey
	foreign key (category_id, user_id) references public.categories (id, user_id)
	on delete cascade;

alter table public.budgets drop constraint if exists budgets_category_id_fkey;
alter table public.budgets add  constraint budgets_category_owner_fkey
	foreign key (category_id, user_id) references public.categories (id, user_id)
	on delete cascade;

alter table public.recurring_rules drop constraint if exists recurring_rules_category_id_fkey;
alter table public.recurring_rules add  constraint recurring_rules_category_owner_fkey
	foreign key (category_id, user_id) references public.categories (id, user_id)
	on delete set null (category_id);

-- 4. Verifica. Le FK verso `categories` sono tre, una per tabella, ognuna
--    sulla coppia e con la sua azione: una FK a colonna singola rimasta, o un
--    `set null` che annulla anche `user_id`, annullano il file.
--    ⚠️ Si leggono le colonne del catalogo, non il testo di
--    `pg_get_constraintdef()`: quello scrive `categories(…)` o
--    `public.categories(…)` secondo il `search_path` della sessione, e una
--    verifica che dipende dalla sessione annullerebbe un file sano (review).
do $$
declare
	v_giuste int;
	v_tutte  int;
begin
	with fk as (
		select c.conrelid,
		       c.confdeltype,
		       array(select a.attname::text
		               from unnest(c.conkey) with ordinality k(attnum, pos)
		               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
		              order by k.pos) as cols,
		       array(select a.attname::text
		               from unnest(c.confkey) with ordinality k(attnum, pos)
		               join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum
		              order by k.pos) as refcols,
		       array(select a.attname::text
		               from unnest(c.confdelsetcols) k(attnum)
		               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as setcols
		  from pg_constraint c
		 where c.contype = 'f' and c.confrelid = 'public.categories'::regclass
	)
	select count(distinct conrelid) filter (
	           where cols = array['category_id', 'user_id'] and refcols = array['id', 'user_id']
	             and (   (conrelid in ('public.transactions'::regclass, 'public.budgets'::regclass)
	                      and confdeltype = 'c')
	                  or (conrelid = 'public.recurring_rules'::regclass
	                      and confdeltype = 'n' and setcols = array['category_id']))),
	       count(*)
	  into v_giuste, v_tutte
	  from fk;

	if v_giuste <> 3 or v_tutte <> 3 then
		raise exception 'FK verso categories inattese: % tabelle su 3 come previste, % FK in tutto. La migration si annulla.', v_giuste, v_tutte;
	end if;
end $$;
