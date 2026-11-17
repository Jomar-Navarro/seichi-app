-- ============================================================================
-- 20261119 — limiti di frequenza per utente: ricevute, import, export, avatar
-- (issue #161)
-- ============================================================================
-- Caricare una ricevuta, importare un estratto, scaricare l'export e cambiare
-- l'avatar non avevano un tetto. Finché l'app è privata non conta; con le
-- registrazioni aperte un client può martellarli, e il costo lo pagano Storage,
-- funzioni e database. L'autenticazione ha già i limiti di GoTrue.
--
-- Deciso con Jomar il 2026-11-17, soglie strette:
--
--   azione    tetto   finestra   perché basta all'uso normale
--   receipt     30    1 ora      dieci scontrini di fila stanno sotto di tre volte
--   import      10    1 giorno   un estratto al mese; c'è posto per sbagliare,
--                                annullare e reimportare più volte
--   export      10    1 ora      si scarica un file, lo si guarda, al massimo si
--                                cambia filtro e si riscarica
--   avatar       5    1 ora      la foto del profilo si cambia di rado
--
-- La finestra SCORRE: un tetto «al giorno» vuol dire nelle ultime 24 ore, non
-- dalla mezzanotte, e il server in UTC non deve sapere il fuso di nessuno.
--
-- ----------------------------------------------------------------------------
-- Perché un registro di eventi e non il conteggio delle righe
-- ----------------------------------------------------------------------------
-- La 24c aveva progettato i suoi tetti «contati sulle righe» (i messaggi del
-- coach). Qui non basta: l'export e l'avatar non lasciano righe da contare, e
-- una ricevuta o un import annullati sparirebbero dal conteggio quando lo
-- Storage e il database li hanno già pagati — un ciclo carica-elimina non
-- avrebbe tetto. `rate_events` registra il TENTATIVO, e non si cancella con ciò
-- che ha prodotto.
--
-- Nel database e non nello stato di un componente, per la lezione della Fase
-- 21: un controllo che vive quanto una schermata non è un controllo.
--
-- ----------------------------------------------------------------------------
-- Il perimetro (deciso con Jomar)
-- ----------------------------------------------------------------------------
--   · ricevute e avatar: nelle server action, prima del caricamento;
--   · export: nella rotta, prima di leggere i movimenti;
--   · import: DENTRO `import_transactions()`, perché la funzione è eseguibile
--     da `authenticated` e una RPC diretta salterebbe la action.
--
-- ⚠️ Ciò che resta fuori, scritto perché non sembri coperto: le policy dello
-- Storage lasciano caricare nella propria cartella con il client dell'utente,
-- senza passare dalle action. Quel percorso lo limitano la cartella, la
-- dimensione massima del bucket e i limiti della piattaforma. Una policy che
-- contasse i file recenti l'avrebbe coperto solo in parte (un ciclo
-- carica-elimina la aggira) e avrebbe rallentato ogni upload: scartata.
--
-- ----------------------------------------------------------------------------
-- Cosa fa, in ordine
-- ----------------------------------------------------------------------------
--   1. `rate_events`: RLS accesa e ZERO policy, come `job_runs`. Nessun client
--      la legge né la scrive: la tocca solo `consume_rate_limit()`, che è
--      `security definer`. La FK verso `auth.users` è in cascata, quindi
--      `delete_current_user()` la svuota senza essere ridefinita.
--   2. `consume_rate_limit(azione)`: se c'è posto registra l'evento e
--      restituisce 0, altrimenti i secondi da aspettare. Un lock per utente e
--      azione serializza le chiamate simultanee, o due richieste insieme
--      leggerebbero entrambe «29» e passerebbero entrambe.
--   3. `import_transactions()` ridefinita per intero con il tetto in testa.
--      Corpo preso dal catalogo il 2026-11-17: identico in produzione e in
--      locale a parte i fine riga (CRLF in produzione, incollata dal SQL Editor
--      prima della #157), che questa ridefinizione allinea.
--
-- ⚠️ La `20260816` definisce `import_transactions()` senza il tetto e non ha una
-- guardia che riconosca questo file. Con `db push` un file già nella cronologia
-- non si riesegue; rieseguirla a mano toglierebbe il tetto all'import.
--
-- Rieseguibile: `create table if not exists`, policy assenti per costruzione,
-- `create or replace function`.
-- Ordine di deploy: migration PRIMA del codice. Il codice nuovo chiama
-- `consume_rate_limit()`, che sul database vecchio non esiste (404 della RPC):
-- ogni upload, export e cambio avatar fallirebbe. Il database nuovo con il
-- codice vecchio funziona: l'import riceve il rifiuto come un errore generico,
-- e solo all'undicesimo import della giornata.
-- La controprova è `supabase/tests/limiti.test.sql`.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Il registro
-- ----------------------------------------------------------------------------
create table if not exists public.rate_events (
	id         uuid        not null default gen_random_uuid(),
	user_id    uuid        not null references auth.users (id) on delete cascade,
	action     varchar(20) not null,
	created_at timestamptz not null default now(),
	constraint rate_events_pkey primary key (id),
	constraint rate_events_action_check
		check (action::text = any (array['receipt', 'import', 'export', 'avatar']::text[]))
);

-- Il conteggio cerca per utente, azione e tempo; l'indice serve anche la FK
-- verso `auth.users` (comincia con `user_id`).
create index if not exists rate_events_user_action_time_idx
	on public.rate_events (user_id, action, created_at desc);

-- ⚠️ RLS accesa e nessuna policy, DI PROPOSITO: è l'eccezione dichiarata di
-- CLAUDE.md («un registro che nessun client deve toccare»). Il revoke è la
-- seconda cintura: i default di `postgres` concedono le tabelle nuove ad
-- `authenticated`, e un giorno qualcuno potrebbe aggiungere una policy.
alter table public.rate_events enable row level security;
revoke all on table public.rate_events from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2. consume_rate_limit()
-- ----------------------------------------------------------------------------
-- Restituisce 0 se l'azione è concessa (e l'ha registrata), altrimenti i
-- secondi che mancano perché si liberi un posto, almeno 1.
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


-- ----------------------------------------------------------------------------
-- 3. import_transactions() con il tetto
-- ----------------------------------------------------------------------------
-- Uguale a quella della `20260816`, più il blocco segnato «#161».
--
-- Il rifiuto è un'eccezione con un codice PROPRIO, `SR429`, e i secondi
-- nel `detail`: un codice standard (`54000`, «program limit exceeded») lo
-- confonderebbe con un guasto vero, e l'app direbbe «riprova fra 3 ore» a un
-- errore che riprovare non risolve. Due cause, due messaggi.
--
-- ⚠️ L'evento si registra nella transazione dell'import: se l'import fallisce
-- dopo, il rollback annulla anche l'evento, e un tentativo fallito non consuma
-- il tetto. Uno che non scrive niente perché le righe c'erano già (tutte
-- duplicate) invece sì: il lavoro l'ha fatto.
create or replace function public.import_transactions(
	p_account_id uuid,
	p_source     text,
	p_filename   text,
	p_rows       jsonb
)
returns table (import_id uuid, inserted integer, submitted integer)
language plpgsql
set search_path = ''
as $function$
declare
	uid       uuid := auth.uid();
	v_import  uuid;
	v_count   integer;
	v_total   integer;
	v_wait    integer;
begin
	if uid is null then
		raise exception 'not authenticated' using errcode = '28000';
	end if;

	v_total := coalesce(jsonb_array_length(p_rows), 0);

	if v_total = 0 then
		raise exception 'nessuna riga da importare' using errcode = '22023';
	end if;

	-- Il conto del file dev'essere dell'utente E non archiviato. La FK composita
	-- garantisce già la proprietà; questo controllo esiste per il MESSAGGIO —
	-- una violazione di chiave esterna manderebbe a cercare il guasto altrove.
	-- È la lezione della review della 20b: due cause diverse non possono avere
	-- lo stesso messaggio solo perché arrivano dalla stessa catch.
	if not exists (
		select 1 from public.accounts
		where id = p_account_id and user_id = uid and not archived
	) then
		raise exception 'conto non valido per l''import' using errcode = '23503';
	end if;

	-- #161 · il tetto, dopo i controlli che non costano niente e prima della
	-- prima scrittura: un import rifiutato per un conto sbagliato non consuma.
	v_wait := public.consume_rate_limit('import');
	if v_wait > 0 then
		raise exception 'troppi import' using errcode = 'SR429', detail = v_wait::text;
	end if;

	insert into public.imports (user_id, account_id, source, filename)
	values (uid, p_account_id, p_source::varchar(30), left(p_filename, 255)::varchar(255))
	returning id into v_import;

	-- `on conflict do nothing` sulla chiave di import: le righe già presenti da
	-- un'esecuzione precedente vengono saltate senza far fallire il lotto.
	--
	-- ⚠️ `left(notes, 255)`: la colonna è `varchar(255)` e le descrizioni di un
	-- estratto bancario possono superarla. Troncare qui e non solo nel parser è
	-- una difesa che non può essere dimenticata da un secondo profilo di import
	-- scritto in futuro.
	with dati as (
		select *
		from jsonb_to_recordset(p_rows) as r (
			account_id      uuid,
			to_account_id   uuid,
			type            text,
			amount          numeric,
			date            timestamp,
			notes           text,
			category_id     uuid,
			investment_type text,
			import_key      text
		)
	)
	insert into public.transactions (
		user_id, account_id, to_account_id, type, amount, date,
		notes, category_id, investment_type, import_id, import_key
	)
	select
		uid,
		d.account_id,
		d.to_account_id,
		d.type::varchar(20),
		d.amount::numeric(10,2),
		d.date,
		left(d.notes, 255)::varchar(255),
		d.category_id,
		d.investment_type::varchar(50),
		v_import,
		d.import_key
	from dati d
	on conflict (user_id, import_key) do nothing;

	get diagnostics v_count = row_count;

	-- ⚠️ Un lotto che non ha scritto NIENTE non si tiene. Non è pulizia
	-- estetica: una riga di `imports` senza transazioni comparirebbe nello
	-- storico come un import avvenuto, e sarebbe indistinguibile da uno le cui
	-- righe sono state cancellate a mano dopo. Meglio nessun verbale che un
	-- verbale falso.
	if v_count = 0 then
		delete from public.imports where id = v_import;
		v_import := null;
	end if;

	return query select v_import, v_count, v_total;
end;
$function$;

-- I privilegi di prima, ridetti: `create or replace` li conserva, ma il file
-- più recente dice tutto da solo.
revoke all     on function public.import_transactions(uuid, text, text, jsonb) from public, anon;
grant  execute on function public.import_transactions(uuid, text, text, jsonb) to authenticated;
