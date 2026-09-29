-- ============================================================================
-- 20260820 — La chiave di deduplica del profilo generico acquisisce il conto
--            del file (issue #118)
-- ============================================================================
--
-- La chiave generica era `generico:<data>|<importo>|<descrizione>#<occorrenza>`:
-- descrive una RIGA, non un evento. Due conti della stessa banca hanno righe
-- identiche — il bollo trimestrale, il canone del mese — e con
-- `unique (user_id, import_key)` il secondo estratto veniva saltato da
-- `on conflict do nothing` e contato fra i "già presenti", mentre su quel conto
-- non c'era. Il saldo restava sbagliato per sempre.
--
-- Da questa issue il codice scrive `generico:<conto del file>:<data>|…`
-- (`importKeyFor()` in `lib/import/index.ts`). Questo file porta allo stesso
-- formato le righe importate PRIMA: senza, reimportare uno di quei file sullo
-- stesso conto produrrebbe chiavi nuove e duplicherebbe tutto.
--
-- ⚠️ Il conto è quello del FILE, cioè `imports.account_id`, NON
-- `transactions.account_id`. Su un trasferimento in entrata l'origine della riga
-- è l'ALTRO conto (modello a una riga della 20b), quindi leggere la colonna della
-- transazione darebbe a metà dei trasferimenti una chiave che il codice non
-- produrrà mai.
--
-- ⚠️ Le chiavi di Trade Republic (`trade_republic:<id>`) NON si toccano: sono
-- l'id del movimento nel file, un evento che appartiene a un conto solo. Vedi il
-- commento di `importKeyFor()`.
--
-- ⚠️ ORDINE: eseguirlo DUE volte, PRIMA e DOPO il deploy del codice della #118.
-- Le due finestre sbagliano in versi opposti, e una sola esecuzione ne chiude
-- una sola:
--   · solo dopo — fra il deploy e lo script, reimportare un file generico già
--     importato produce chiavi col conto che non combaciano con quelle vecchie:
--     ogni riga entra di nuovo, e il saldo la conta due volte;
--   · solo prima — fra lo script e il deploy, un import generico fatto dal codice
--     vecchio scrive ancora chiavi senza conto, che lo script non ha visto.
-- Rieseguirlo è un no-op sulle righe già allineate (vedi sotto), quindi due
-- esecuzioni non costano niente.
--
-- ⚠️ NESSUNA GUARDIA in testa, ed è deliberato: il file non ridefinisce né
-- funzioni né strutture, riscrive solo le chiavi nel formato VECCHIO, che il
-- filtro riconosce dal carattere dopo `generico:` — una data nel formato vecchio,
-- un uuid in quello nuovo. Rieseguirlo è un no-op.
--
-- ⚠️ `not exists`: se una riga col formato nuovo ESISTE GIÀ per lo stesso
-- evento — il codice nuovo è stato messo in produzione e lo stesso file
-- reimportato prima di questo script — la riga vecchia è un doppione vero, e
-- riscriverne la chiave violerebbe `unique (user_id, import_key)` facendo
-- fallire l'intero script. Si lascia com'è: la controprova la conta, e un
-- doppione si vede nella lista e si cancella.
--
-- Prima di eseguire, per sapere se c'è qualcosa da fare:
--
--   select count(*) from public.transactions
--    where import_key ~ '^generico:\d{4}-\d{2}-\d{2}\|';
--
-- Zero significa che nessun import generico è mai stato fatto: il file è un
-- no-op, e va eseguito lo stesso per lasciare il database allineato al repo.
-- ============================================================================

update public.transactions t
   set import_key = 'generico:' || i.account_id || ':' || substr(t.import_key, 10)
  from public.imports i
 where t.import_id = i.id
   and t.import_key ~ '^generico:\d{4}-\d{2}-\d{2}\|'
   and not exists (
		select 1
		  from public.transactions d
		 where d.user_id = t.user_id
		   and d.import_key = 'generico:' || i.account_id || ':' || substr(t.import_key, 10)
	);

-- ============================================================================
-- CONTROPROVA — da eseguire A PARTE, in una query nuova, togliendo i `--`.
-- ============================================================================
--
-- ⚠️⚠️ RESTA COMMENTATA: termina con un `raise exception` deliberato (l'unico
-- modo di far vedere il referto), e l'editor esegue lo script come UNA
-- transazione — lasciarla eseguibile qui annullerebbe l'update qui sopra
-- stampando il messaggio di successo. È l'errore della 21b del 2026-08-20.
--
-- do $$
-- declare
-- 	v_vecchie   int;
-- 	v_doppioni  int;
-- 	v_nuove     int;
-- 	v_estranee  int;
-- begin
-- 	-- 1 · chiavi generiche ancora nel formato vecchio
-- 	select count(*) into v_vecchie
-- 	  from public.transactions
-- 	 where import_key ~ '^generico:\d{4}-\d{2}-\d{2}\|';
--
-- 	-- 2 · di quelle, quante sono doppioni di una riga già nel formato nuovo
-- 	select count(*) into v_doppioni
-- 	  from public.transactions t
-- 	  join public.imports i on i.id = t.import_id
-- 	 where t.import_key ~ '^generico:\d{4}-\d{2}-\d{2}\|'
-- 	   and exists (
-- 			select 1 from public.transactions d
-- 			 where d.user_id = t.user_id
-- 			   and d.import_key = 'generico:' || i.account_id || ':' || substr(t.import_key, 10)
-- 		);
--
-- 	-- 3 · chiavi nel formato nuovo, e quante portano un conto DIVERSO da
-- 	--     quello del proprio lotto (devono essere zero: è il punto del file)
-- 	select count(*) into v_nuove
-- 	  from public.transactions
-- 	 where import_key ~ '^generico:[0-9a-f-]{36}:';
--
-- 	select count(*) into v_estranee
-- 	  from public.transactions t
-- 	  join public.imports i on i.id = t.import_id
-- 	 where t.import_key ~ '^generico:[0-9a-f-]{36}:'
-- 	   and substr(t.import_key, 10, 36) <> i.account_id::text;
--
-- 	if v_estranee > 0 then
-- 		raise exception 'CHIAVI CON IL CONTO SBAGLIATO: %', v_estranee;
-- 	end if;
--
-- 	raise exception 'REFERTO — formato nuovo: %, formato vecchio rimasto: % (di cui doppioni da cancellare a mano: %), conto sbagliato: 0.',
-- 		v_nuove, v_vecchie, v_doppioni;
-- end $$;
