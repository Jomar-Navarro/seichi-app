-- ============================================================================
-- 20261117 — via il ruolo `seichi_ro` (issue #157)
-- ============================================================================
-- `seichi_ro` è un ruolo con LOGIN creato a mano in produzione, quasi certamente
-- per la verifica del catalogo del 2026-08-13 («con un ruolo di sola lettura»,
-- `docs/storia/issue-043-ricostruzione-schema.md`). Nessun file lo crea: l'ha
-- trovato `supabase db diff --remote` il 2026-11-16, ed è l'unica differenza fra
-- repo e produzione che non era della piattaforma né dei fine riga.
--
-- Oggi è innocuo — non ha `BYPASSRLS`, e ogni policy è `to authenticated`,
-- quindi non vede righe — ma è un ruolo che può entrare in produzione, che
-- nessun file descrive, e che riceve DA SOLO la lettura di ogni tabella nuova
-- (un default di `postgres`). Jomar ha confermato che non serve più.
--
-- ⚠️ Scritta interrogando la PRODUZIONE il 2026-11-16 (`pg_shdepend`, in sola
-- lettura). Ciò che lo lega al database:
--
--   · `SELECT` su 11 relazioni di `public` (le 10 tabelle e `account_balances`);
--   · `USAGE` sullo schema `public` (concesso da `pg_database_owner`);
--   · `CONNECT` sul database `postgres`;
--   · un default di `postgres` su `public`: `SELECT` sulle tabelle future;
--   · nessun oggetto posseduto, nessuna appartenenza a un altro ruolo;
--     `postgres` ne è membro, cioè lo amministra e può eliminarlo.
--
-- Le revoche sono ESPLICITE, una per ciò che il catalogo ha mostrato, fatte da
-- chi le aveva concesse. ⚠️ Non `drop owned by seichi_ro`, la prima stesura:
-- vuole i PRIVILEGI del ruolo, non basta amministrarlo — da Postgres 16 chi crea
-- un ruolo ne riceve l'ADMIN, non l'ereditarietà — e la prova in locale si è
-- fermata su «Only roles with privileges of role "seichi_ro" may drop objects
-- owned by it». Se la produzione avesse una dipendenza che il catalogo del
-- 2026-11-16 non mostrava, `drop role` fallirebbe e annullerebbe l'intero file:
-- niente resta a metà.
--
-- ----------------------------------------------------------------------------
-- Cosa fa, in ordine
-- ----------------------------------------------------------------------------
--   1. se il ruolo non c'è (il database locale, la CI, una seconda esecuzione)
--      non fa niente; se possiede oggetti si ferma PRIMA di scrivere, con un
--      messaggio che dice perché (`drop role` fallirebbe comunque, peggio)
--   2. le revoche (tabelle e viste, schema, database, default) e `drop role`
--   3. verifica ESEGUITA: se il ruolo esiste ancora, il file si annulla
--
-- Rieseguibile. Nessun ordine di deploy: l'app non usa questo ruolo.
-- Provata in locale su una copia del ruolo con gli stessi privilegi della
-- produzione (vedi la storia della #157): il ruolo sparisce, e la seconda
-- esecuzione non fa niente.
-- ============================================================================

do $$
declare
	v_role  oid := (select oid from pg_roles where rolname = 'seichi_ro');
	v_owned int;
begin
	-- 1. Il ruolo esiste solo in produzione.
	if v_role is null then
		raise notice 'seichi_ro non esiste: niente da fare.';
		return;
	end if;

	select count(*) into v_owned
	from pg_shdepend
	where refclassid = 'pg_authid'::regclass and refobjid = v_role and deptype = 'o';
	if v_owned > 0 then
		raise exception 'STOP: seichi_ro possiede % oggetti. Vanno guardati a mano prima di eliminarlo.', v_owned;
	end if;

	-- 2. Ciò che il catalogo ha mostrato, poi il ruolo. `all tables` comprende
	--    le viste (`account_balances`).
	revoke all on all tables in schema public from seichi_ro;
	revoke all on schema public from seichi_ro;
	execute format('revoke all on database %I from seichi_ro', current_database());
	alter default privileges for role postgres in schema public revoke all on tables from seichi_ro;
	drop role seichi_ro;
end $$;

-- 3. Verifica.
do $$
begin
	if exists (select 1 from pg_roles where rolname = 'seichi_ro') then
		raise exception 'seichi_ro esiste ancora: la migration si annulla.';
	end if;
	if exists (select 1 from pg_default_acl where defaclacl::text like '%seichi_ro%') then
		raise exception 'un default nomina ancora seichi_ro: la migration si annulla.';
	end if;
end $$;
