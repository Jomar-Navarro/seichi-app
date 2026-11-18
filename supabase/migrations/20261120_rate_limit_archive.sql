-- ============================================================================
-- 20261120 — il tetto dell'archivio completo (issue #162)
-- ============================================================================
-- L'archivio ZIP di `/impostazioni/esporta/archivio` legge ogni tabella
-- dell'utente e scarica dal bucket privato ogni sua ricevuta: costa circa
-- cento volte un export CSV. Deciso con Jomar il 2026-11-18, un'azione PROPRIA
-- e non il posto `export`:
--
--   azione    tetto   finestra   perché
--   archive     3     1 giorno   l'archivio si scarica di rado (un cambio di
--                                app, una richiesta di portabilità); tre lasciano
--                                posto a un download interrotto e a un secondo
--                                tentativo
--
-- Scartato il riuso di `export` (10 l'ora): dieci archivi l'ora non sono un
-- tetto per l'operazione più cara dell'app, e un'ora di CSV avrebbe bloccato
-- l'archivio — due azioni diverse che si rubano il posto a vicenda.
--
-- Cosa fa, in ordine:
--   1. allarga `rate_events_action_check` ad `archive`;
--   2. ridefinisce `consume_rate_limit()` PER INTERO con la riga nuova: il file
--      più recente basta da solo (`.claude/rules/database.md`, regola 2).
--
-- ⚠️ La `20261119` definisce la funzione e il vincolo SENZA `archive`, e non ha
-- una guardia che riconosca questo file. Con `db push` un file già nella
-- cronologia non si riesegue; rieseguirla a mano toglierebbe l'azione, e ogni
-- download dell'archivio risponderebbe 500 (`22023`, azione sconosciuta).
--
-- Rieseguibile: il vincolo si toglie e si rimette per nome (nessun
-- dipendente: è un CHECK), la funzione è `create or replace`.
-- Ordine di deploy: migration PRIMA del codice. Il codice nuovo chiama
-- `consume_rate_limit('archive')`, che sul database vecchio solleva `22023`:
-- l'archivio risponderebbe 500. Il database nuovo con il codice vecchio
-- funziona: nessuno chiama `archive`.
-- La controprova è `supabase/tests/limiti.test.sql`.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Il vincolo
-- ----------------------------------------------------------------------------
-- Si allarga e basta: nessuna riga esistente può violarlo, perché ogni valore
-- di prima resta ammesso.
alter table public.rate_events drop constraint if exists rate_events_action_check;
alter table public.rate_events
	add constraint rate_events_action_check
	check (action::text = any (array['receipt', 'import', 'export', 'avatar', 'archive']::text[]));


-- ----------------------------------------------------------------------------
-- 2. consume_rate_limit()
-- ----------------------------------------------------------------------------
-- Identica a quella della `20261119` più la riga `archive`. Restituisce 0 se
-- l'azione è concessa (e l'ha registrata), altrimenti i secondi che mancano
-- perché si liberi un posto, almeno 1.
--
-- ⚠️ Le soglie stanno QUI e in nessun altro posto: l'app non le conosce, legge
-- solo «quanto aspettare». Due copie divergerebbero.
create or replace function public.consume_rate_limit(p_action text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	uid       uuid := auth.uid();
	v_limit   integer;
	v_window  interval;
	v_count   integer;
	v_frees   timestamptz;
begin
	if uid is null then
		raise exception 'not authenticated' using errcode = '28000';
	end if;

	case p_action
		when 'receipt' then v_limit := 30; v_window := interval '1 hour';
		when 'import'  then v_limit := 10; v_window := interval '1 day';
		when 'export'  then v_limit := 10; v_window := interval '1 hour';
		when 'avatar'  then v_limit :=  5; v_window := interval '1 hour';
		when 'archive' then v_limit :=  3; v_window := interval '1 day';
		else
			raise exception 'azione sconosciuta: %', p_action using errcode = '22023';
	end case;

	-- Un lock per utente e azione, rilasciato alla fine della transazione.
	perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_action, 0));

	-- Gli eventi usciti dalla finestra non servono più a nessuno.
	delete from public.rate_events
	 where user_id = uid and action = p_action and created_at <= now() - v_window;

	select count(*) into v_count
	  from public.rate_events
	 where user_id = uid and action = p_action;

	if v_count >= v_limit then
		-- Si libera un posto quando scade l'evento in posizione `v_limit` dal più
		-- recente: con N eventi devono scaderne N − limite + 1. Vale anche se un
		-- giorno la soglia scende sotto gli eventi già registrati.
		select created_at into v_frees
		  from public.rate_events
		 where user_id = uid and action = p_action
		 order by created_at desc
		offset v_limit - 1
		 limit 1;

		return greatest(1, ceil(extract(epoch from (v_frees + v_window - now())))::integer);
	end if;

	insert into public.rate_events (user_id, action) values (uid, p_action);
	return 0;
end;
$$;

revoke all     on function public.consume_rate_limit(text) from public, anon;
grant  execute on function public.consume_rate_limit(text) to authenticated;
