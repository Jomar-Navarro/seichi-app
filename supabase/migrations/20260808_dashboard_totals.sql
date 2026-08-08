-- ============================================================================
-- dashboard_totals() — le somme della home le calcola Postgres
-- ============================================================================
-- Eseguita a mano nel SQL Editor di Supabase il 2026-08-08.
--
-- ⚠️⚠️ **VA RIESEGUITA**: dopo la prima esecuzione la funzione è stata riscritta
-- per aggiungere il tetto su `p_bounds` (vedi sotto) ed è passata da `language
-- sql` a `plpgsql`. È un `create or replace`, quindi rilanciare l'intero file è
-- sicuro e idempotente — ma finché non lo fai, il database contiene la versione
-- SENZA il limite.
--
-- ⚠️ QUESTA MIGRATION VA ESEGUITA PRIMA DI PUBBLICARE IL CODICE CHE LA USA.
-- `getDashboardTotals()` chiama questa funzione e basta: se manca, la RPC
-- risponde 404 e la home mostra il messaggio d'errore. Non c'è ripiego sulla
-- vecchia strada, ed è voluto — un fallback silenzioso nasconderebbe una
-- migration non eseguita, e l'app girerebbe per mesi sulla via lenta senza che
-- nessuno se ne accorga.
--
-- ----------------------------------------------------------------------------
-- Il problema
-- ----------------------------------------------------------------------------
-- `getDashboardTotals()` scaricava OGNI transazione dell'utente — `amount`,
-- `type`, `date` di tutta la storia dell'account — per poi sommarle in
-- JavaScript. Il costo cresce con lo storico e si paga a ogni vista della home,
-- a ogni `router.refresh()` e dopo ogni `revalidatePath("/", "layout")`, cioè
-- dopo ogni singola transazione salvata. Per produrre, alla fine, meno di
-- quaranta numeri.
--
-- ----------------------------------------------------------------------------
-- I confini arrivano dall'APP, non da date_trunc()
-- ----------------------------------------------------------------------------
-- Questa funzione NON decide quali sono i mesi: li riceve già calcolati.
--
-- È deliberato. Usare `date_trunc('month', ...)` avrebbe spostato la scelta del
-- fuso dentro il database (UTC), mentre oggi i confini nascono in TypeScript da
-- `new Date(y, m, 1)`, cioè nel fuso del processo che rende la pagina. I due
-- valori coincidono su Vercel — che gira in UTC — ma NON coincidono in sviluppo
-- locale, dove il processo è in ora italiana. Spostare il calcolo qui avrebbe
-- cambiato in silenzio i totali della dashboard sulla macchina di chi sviluppa:
-- una differenza che si manifesta solo nelle prime ore del mese, cioè il momento
-- peggiore per accorgersene.
--
-- La chiusura pulita del fuso è `ClientClock` (vedi `lib/dates.ts` e la Fase
-- 17a), ma la home è un server component e non può conoscere il fuso dell'utente
-- senza diventare client — un giro in più per un difetto che questa migration
-- non ha introdotto. Qui si preserva il comportamento esistente, esattamente.
--
-- ----------------------------------------------------------------------------
-- Un array di confini, non due finestre separate
-- ----------------------------------------------------------------------------
-- Il mese corrente È l'ultimo bucket del trend a 6 mesi: `new Date(y, m-5+i, 1)`
-- con i=5 dà proprio l'inizio del mese corrente. Chiedere separatamente "il mese"
-- e "il trend" avrebbe fatto sommare due volte le stesse righe.
--
-- Quindi: 7 confini → 6 bucket consecutivi, e il mese corrente è il bucket 5.
--
-- ----------------------------------------------------------------------------
-- Il tipo di `transactions.date`
-- ----------------------------------------------------------------------------
-- ⚠️ La colonna non è versionata nel repo (issue #43), quindi non se ne può
-- leggere la definizione da qui. Il parametro è `timestamptz[]` e la cosa regge
-- in entrambi i casi: se la colonna è `timestamptz` il confronto è diretto, se è
-- `timestamp` Postgres la converte usando il TimeZone della sessione — che su
-- Supabase è UTC, il che riproduce esattamente ciò che accade oggi quando
-- PostgREST riceve la stringa di `toISOString()`. Se un giorno la sessione non
-- fosse più in UTC, questo è il punto da rileggere.


-- ----------------------------------------------------------------------------
-- La funzione
-- ----------------------------------------------------------------------------
-- SECURITY INVOKER (il default per le funzioni SQL): la RLS di `transactions` si
-- applica normalmente, quindi un utente non può leggere i totali di un altro
-- nemmeno passando confini arbitrari. Il filtro esplicito su auth.uid() resta
-- comunque, come in `budgets_at()`: serve al planner per usare l'indice su
-- (user_id), non alla sicurezza.
--
-- `(select auth.uid())` e non `auth.uid()` nudo: l'idioma Supabase che promuove
-- la chiamata a InitPlan, valutata una volta invece che per riga.
--
-- Il tipo di ritorno di `total` è `numeric` senza precisione, NON
-- `numeric(10,2)` come la colonna: una somma può superare il limite di dieci
-- cifre anche se nessun singolo importo lo fa, e il cast la farebbe fallire.

-- ⚠️ **Il numero di finestre è limitato, e non è pedanteria.** La funzione è
-- `grant execute to authenticated` e PostgREST passa l'array così com'è: senza
-- tetto, un utente qualsiasi può POSTare 50.000 confini e far produrre al CTE
-- 49.999 finestre da incrociare con le proprie transazioni — quattro ordini di
-- grandezza di lavoro in più su un Postgres condiviso. La RLS non protegge da
-- questo: l'abuso è contro le PROPRIE righe, quindi le policy sono soddisfatte.
-- L'app ne manda sempre 7; 13 lascia margine (un anno di trend) e chiude il buco.
--
-- ⚠️ Il corpo si apre con `#variable_conflict use_column`, che DEVE essere il
-- primo elemento — per questo la spiegazione sta qui e non lì dentro. I
-- parametri OUT (`bucket_index`, `type`, `total`) sono anche nomi di colonna, e
-- in plpgsql un riferimento ambiguo è un errore che si manifesta solo
-- all'ESECUZIONE: la migration passerebbe senza un lamento e la home si
-- romperebbe dopo. Nel corpo ogni riferimento è già qualificato (`t.type`,
-- `b.bucket_index`), quindi l'ambiguità non c'è; la direttiva la rende
-- impossibile a prescindere, risolvendo sempre verso la colonna.

create or replace function public.dashboard_totals(p_bounds timestamptz[])
returns table (
	bucket_index int,     -- 0..N-1 = i bucket, NULL = totale di sempre
	type         text,
	total        numeric
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
	if array_length(p_bounds, 1) > 13 then
		raise exception 'dashboard_totals: troppi confini (%). Massimo 13.', array_length(p_bounds, 1)
			using errcode = 'invalid_parameter_value';
	end if;

	return query
	with bounds as (
		select
			i - 1           as bucket_index,
			p_bounds[i]     as starts,
			p_bounds[i + 1] as ends
		from generate_subscripts(p_bounds, 1) as i
		-- L'ultimo elemento è solo la chiusura del bucket precedente, non
		-- l'inizio di uno nuovo: N confini danno N-1 bucket.
		where i < array_length(p_bounds, 1)
	)
	select b.bucket_index, t.type, sum(t.amount)
	from public.transactions t
	join bounds b
	  on t.date >= b.starts
	 and t.date <  b.ends
	where t.user_id = (select auth.uid())
	group by b.bucket_index, t.type

	union all

	-- Il saldo totale non ha finestra: è tutta la storia dell'account.
	--
	-- ⚠️ Sì, questo `union all` scansiona `transactions` DUE volte, e la seconda è
	-- quella cara (nessun limite di data). È noto e lasciato così di proposito.
	--
	-- La riscrittura ovvia — `left join bounds` + `group by grouping sets
	-- ((b.bucket_index, t.type), (t.type))` — è SBAGLIATA senza un accorgimento
	-- in più: con la left join le righe fuori da ogni finestra escono con
	-- `bucket_index` NULL, e quel gruppo COLLIDE con le righe del totale di
	-- sempre, che hanno anch'esse NULL. Due righe con la stessa chiave e
	-- significato diverso: `find()` lato TypeScript ne prenderebbe una a caso e
	-- il saldo sarebbe sbagliato in modo plausibile. Servirebbe una colonna
	-- `grouping()` per distinguerle, quindi cambia anche la forma del risultato.
	--
	-- Fattibile, ma è un'ottimizzazione su una funzione che restituisce ~35 righe
	-- e ha già sostituito lo scaricamento dell'intero archivio. Va fatta da chi
	-- può ESEGUIRE la query e confrontare i totali prima e dopo: qui un errore
	-- non si vede: produce numeri credibili.
	select null::int, t.type, sum(t.amount)
	from public.transactions t
	where t.user_id = (select auth.uid())
	group by t.type;
end;
$$;

revoke all     on function public.dashboard_totals(timestamptz[]) from public, anon;
grant  execute on function public.dashboard_totals(timestamptz[]) to authenticated;


-- ----------------------------------------------------------------------------
-- Controprova
-- ----------------------------------------------------------------------------
-- Da eseguire con una sessione autenticata (SQL Editor → "Run as" un utente, o
-- dalla app). Confronta il vecchio calcolo con il nuovo: devono coincidere.
--
--   with b as (
--     select array[
--       date_trunc('month', now()) - interval '5 months',
--       date_trunc('month', now()) - interval '4 months',
--       date_trunc('month', now()) - interval '3 months',
--       date_trunc('month', now()) - interval '2 months',
--       date_trunc('month', now()) - interval '1 month',
--       date_trunc('month', now()),
--       date_trunc('month', now()) + interval '1 month'
--     ]::timestamptz[] as bounds
--   )
--   select * from b, lateral public.dashboard_totals(b.bounds)
--   order by bucket_index nulls last, type;
--
-- E il tetto, che deve fallire con "troppi confini (14)":
--
--   select * from public.dashboard_totals(
--     (select array_agg(now() + (n || ' days')::interval)
--      from generate_series(1, 14) n)::timestamptz[]
--   );
