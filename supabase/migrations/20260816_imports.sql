-- ============================================================================
-- Fase 21 — import di transazioni da file (issue #35)
-- ============================================================================
-- ⚠️ ESEGUIRE DOPO `20260815_transfers.sql`.
--
-- Progetto e motivazioni: CLAUDE.md → "Fase 21 — import dati".
--
-- ----------------------------------------------------------------------------
-- Ordine di deploy: migration PRIMA del codice, come sempre
-- ----------------------------------------------------------------------------
--   · codice nuovo su database vecchio → `import_transactions()` non esiste,
--     la pagina di import risponde 404 sulla RPC. Nessun ripiego, di proposito:
--     un fallback silenzioso nasconderebbe una migration non eseguita.
--   · database nuovo su codice vecchio → non succede niente. Le due colonne
--     sono nullable e nessuno le scrive, la funzione non la chiama nessuno.
--
-- ----------------------------------------------------------------------------
-- Cosa fa, in ordine
-- ----------------------------------------------------------------------------
--   1. tabella `imports` — il LOTTO, che è ciò che rende l'import annullabile
--   2. `transactions.import_id` e `import_key` — appartenenza e idempotenza
--   3. `import_transactions()` — la scrittura, atomica e idempotente
--   4. `delete_current_user()` — aggiornata con `imports`
--   5. controprova
-- ============================================================================


-- ----------------------------------------------------------------------------
-- ⚠️ PRECONDIZIONE — questo file non si regge da solo
-- ----------------------------------------------------------------------------
-- `imports` ha una FK composita verso `accounts (id, user_id)`, che nasce nella
-- `20260814`, e il vincolo di unicità che la rende possibile viene ricostruito
-- dalla `20260815`. Eseguendo questo file su un database che non le ha, il
-- guasto arriva **a metà**: la tabella viene creata, e la FK fallisce dopo.
--
-- È lo stesso difetto che la 20b ha scoperto contro se stessa (`drop … if
-- exists` non è idempotenza) — un file che si ferma a metà lascia il database
-- in uno stato che nessuno ha progettato. Meglio non partire affatto.

do $$
begin
	if not exists (
		select 1 from information_schema.columns
		where table_schema = 'public'
		  and table_name   = 'transactions'
		  and column_name  = 'to_account_id'
	) then
		raise exception
			'20260816_imports.sql richiede 20260814_accounts.sql e 20260815_transfers.sql (transactions.to_account_id non esiste). Eseguire prima quelle.';
	end if;
end $$;


-- ----------------------------------------------------------------------------
-- 1. imports — il lotto
-- ----------------------------------------------------------------------------
-- Perché una tabella e non solo una colonna su `transactions`.
--
-- Un import scrive centinaia di righe in un colpo. Se il conto era sbagliato, o
-- la mappatura dei tipi lo era, disfare a mano dalla lista movimenti è una
-- punizione sproporzionata rispetto all'errore — e su duecento righe è anche una
-- fonte di errori nuovi, perché basta saltarne una per restare con un residuo
-- che nessuno saprà più spiegare.
--
-- ⚠️ La colonna si mette ADESSO anche se l'interfaccia di annullamento arrivasse
-- dopo. Vale il precedente di `notifications.destination` (Fase 17b):
-- aggiungerla in seguito richiederebbe il backfill delle righe già scritte, e
-- quel backfill sarebbe **impossibile** — nessun dato residuo direbbe quali
-- transazioni erano arrivate insieme.
--
-- ⚠️ NESSUNA colonna `row_count`, ed è la stessa decisione presa quattro volte in
-- questo progetto: niente `spent` sui budget, niente `saved_amount` sugli
-- obiettivi, niente `balance` sui conti. Un totale memorizzato ha punti di
-- scrittura da tenere allineati e diverge in silenzio; qui divergerebbe al primo
-- movimento importato che l'utente cancella a mano. Il conteggio si somma alla
-- lettura da `transactions`, dove sta la verità.
--
-- `source` non è decorativo: distingue il profilo che ha prodotto le righe, e
-- quindi il vocabolario da cui `import_key` è stata composta. Senza, due
-- sorgenti diverse potrebbero fabbricare la stessa chiave per movimenti diversi.

create table if not exists public.imports (
	id         uuid primary key default gen_random_uuid(),
	user_id    uuid not null references auth.users (id) on delete cascade,
	-- Il conto del FILE, cioè "di chi è questo estratto".
	--
	-- ⚠️ NON è il conto di ogni riga generata. Un trasferimento in entrata sul
	-- conto del file si scrive con `account_id` = conto di ORIGINE (l'altro) e
	-- `to_account_id` = questo. È la conseguenza diretta del modello a una riga
	-- della 20b, ed è controintuitiva abbastanza da meritare due righe di
	-- commento: importando l'estratto di Trade Republic, l'app scrive movimenti
	-- il cui `account_id` non è Trade Republic.
	account_id uuid not null,
	source     varchar(30) not null,
	filename   varchar(255) not null,
	created_at timestamptz not null default now()
);

alter table public.imports drop constraint if exists imports_source_check;

-- Igiene, non semantica — la stessa ragione del CHECK su `accounts.type`: la #47
-- è costata cinque settimane perché `recurring_rules.type` era testo libero
-- mentre le tabelle sorelle avevano un vincolo.
alter table public.imports add constraint imports_source_check
	check (source::text = any (array['trade_republic', 'generico']::text[]));

-- ⚠️ FK COMPOSITA, come quelle introdotte dalla 20b, e per lo stesso motivo:
-- nessuna policy RLS guarda `account_id`, quindi con una FK a una colonna sola
-- un utente potrebbe registrare un import sul conto di un altro. La 20b ha
-- chiuso questo buco su `transactions` e `recurring_rules`; aprirlo di nuovo su
-- una tabella nuova sarebbe il difetto reintrodotto da chi lo ha appena chiuso.
--
-- `on delete no action`: un conto che ha ricevuto un import non si cancella, si
-- archivia. Identico alla regola della 20a sui movimenti.
alter table public.imports drop constraint if exists imports_account_owner_fkey;

alter table public.imports add constraint imports_account_owner_fkey
	foreign key (account_id, user_id)
	references public.accounts (id, user_id)
	on delete no action;


alter table public.imports enable row level security;

-- ⚠️ TRE policy, non quattro: **niente UPDATE**, ed è deliberato.
--
-- Una riga di `imports` è il verbale di un evento accaduto — quale file, su
-- quale conto, quando. Non è contenuto dell'utente e non ha stati successivi:
-- se fosse modificabile, "questo movimento viene da quel file" smetterebbe di
-- essere un fatto e diventerebbe un'opinione riscrivibile. È lo stesso
-- ragionamento per cui `notifications` non ha una policy di INSERT.
--
-- Il DELETE invece serve, ed è il gesto di annullamento: la cascade della
-- sezione 2 porta via con sé le transazioni del lotto.
do $$
begin
	if not exists (select 1 from pg_policies
		where schemaname = 'public' and tablename = 'imports' and policyname = 'imports_select_own') then
		create policy imports_select_own on public.imports
			for select to authenticated using ((select auth.uid()) = user_id);
	end if;

	if not exists (select 1 from pg_policies
		where schemaname = 'public' and tablename = 'imports' and policyname = 'imports_insert_own') then
		create policy imports_insert_own on public.imports
			for insert to authenticated with check ((select auth.uid()) = user_id);
	end if;

	if not exists (select 1 from pg_policies
		where schemaname = 'public' and tablename = 'imports' and policyname = 'imports_delete_own') then
		create policy imports_delete_own on public.imports
			for delete to authenticated using ((select auth.uid()) = user_id);
	end if;
end $$;

create index if not exists imports_user_id_idx
	on public.imports (user_id, created_at desc);

-- Non serve alle SELECT ma al controllo della FK verso `accounts`: senza, ogni
-- tentativo di cancellare un conto scandisce l'intera tabella.
create index if not exists imports_account_id_idx
	on public.imports (account_id);


-- ----------------------------------------------------------------------------
-- 2. transactions.import_id e import_key
-- ----------------------------------------------------------------------------
-- ⚠️ `on delete cascade`, mentre `account_id` è `no action`. La differenza NON è
-- una svista, ed è la stessa asimmetria che regge fra `categories` (cascade,
-- perché serve a eliminare un obiettivo) e `accounts` (no action, perché
-- cancellare un conto cancellerebbe anni di movimenti reali).
--
-- Qui la cascade **è** l'operazione: annullare un import significa togliere le
-- righe che ha scritto, e con la cascade è una sola istruzione, atomica. Con
-- `set null` sarebbero due — cancella le transazioni, poi il lotto — e una
-- fallita a metà lascerebbe un lotto vuoto o, peggio, movimenti orfani che
-- nessuno riesce più a ricondurre all'import che li ha prodotti.
--
-- Il rischio speculare va detto: chi cancella una riga di `imports` cancella
-- movimenti veri, comprese le modifiche fatte a mano dopo l'import. È accettato
-- perché è esattamente ciò che l'utente chiede quando dice "annulla l'import" —
-- ma è il motivo per cui quel comando deve chiedere conferma, come `deleteGoal`.

alter table public.transactions add column if not exists import_id uuid;

alter table public.transactions drop constraint if exists transactions_import_id_fkey;

alter table public.transactions add constraint transactions_import_id_fkey
	foreign key (import_id) references public.imports (id) on delete cascade;

-- Serve alla cascade, non alle SELECT: senza, cancellare un lotto scandisce
-- l'intera `transactions`. Parziale perché la stragrande maggioranza delle righe
-- è inserita a mano e ha `import_id` NULL.
create index if not exists transactions_import_id_idx
	on public.transactions (import_id)
	where import_id is not null;


-- L'idempotenza dell'import, e il motivo per cui vive QUI e non nel codice.
--
-- Il precedente è `notifications.dedup_key`: chiave testuale, vincolo di
-- unicità, `on conflict do nothing`. Il risultato è che reimportare un file che
-- si sovrappone al precedente **non può** duplicare niente — per costruzione,
-- non per attenzione di chi scrive la query. Un controllo "leggi cosa c'è già,
-- poi scrivi il resto" sarebbe corretto quasi sempre e sbagliato esattamente
-- quando serve: due import lanciati insieme da due schede leggono entrambi
-- prima che l'altro abbia scritto.
--
-- ⚠️ **La chiave arriva dal FILE quando il file ce l'ha.** L'export di Trade
-- Republic porta un `transaction_id` univoco e stabile fra due esportazioni:
-- quella è la chiave naturale e non va fabbricata. Il caso interessante è il
-- contrario — l'importatore generico, dove una chiave naturale non c'è e va
-- composta da data, importo e descrizione. Là serve **anche un contatore di
-- occorrenza fra le righe identiche dello stesso file**, o due movimenti uguali
-- nello stesso giorno collassano in uno solo e il secondo sparisce senza che
-- nulla lo segnali. Non è un caso di scuola: l'estratto reale su cui questa fase
-- è stata progettata contiene due bonifici da 100,00 € in entrata lo stesso
-- giorno, a 42 secondi di distanza.
--
-- La regola generale che ne discende: **un duplicato si vede e si cancella, una
-- riga mai importata non si vede affatto.** A parità di dubbio, la deduplica
-- deve sbagliare per eccesso di righe.
--
-- ⚠️ I NULL restano DISTINTI, che è il default — e qui è il comportamento
-- giusto, all'opposto di `budgets`. Là serviva `nulls not distinct` perché NULL
-- significava "il budget globale", cioè **una cosa sola** di cui non possono
-- esistere due esemplari per periodo. Qui NULL significa "riga inserita a mano",
-- e ce ne sono migliaia: renderli non-distinti impedirebbe di scrivere la
-- seconda transazione manuale della vita dell'utente.
alter table public.transactions add column if not exists import_key text;

alter table public.transactions drop constraint if exists transactions_import_key_key;

alter table public.transactions add constraint transactions_import_key_key
	unique (user_id, import_key);


-- ----------------------------------------------------------------------------
-- 3. import_transactions() — la scrittura
-- ----------------------------------------------------------------------------
-- Perché una funzione e non una serie di insert dal client, come per
-- `set_budget()` della 17a: il lotto e le sue righe devono essere **atomici**.
-- Con due chiamate separate, un guasto in mezzo lascia un import senza
-- movimenti, o dei movimenti che dichiarano di appartenere a un lotto che non
-- esiste. Una funzione plpgsql gira in una transazione sola.
--
-- ⚠️ **`security invoker`, cioè il default — NON `definer`.** Le altre funzioni
-- di questo progetto sono `definer` perché devono fare qualcosa che il chiamante
-- non può (cancellare un utente, scrivere per tutti gli utenti dal cron). Qui
-- non serve alcun privilegio in più: l'utente sta scrivendo le proprie righe, e
-- lasciando la RLS attiva le policy di `transactions` e `imports` restano la
-- difesa. Marcarla `definer` per abitudine avrebbe disattivato quelle policy in
-- cambio di niente.
--
-- ⚠️ Ogni colonna ha un CAST ESPLICITO, e nella `jsonb_to_recordset` i tipi sono
-- quelli REALI del catalogo — `varchar` dove la colonna è `varchar`. È la
-- trappola pagata da `dashboard_totals()`: plpgsql pretende i tipi esatti e
-- fallisce solo a runtime, con un messaggio che non dice quale colonna.

drop function if exists public.import_transactions(uuid, text, text, jsonb);

create or replace function public.import_transactions(
	p_account_id uuid,
	p_source     text,
	p_filename   text,
	p_rows       jsonb
)
returns table (import_id uuid, inserted integer, submitted integer)
language plpgsql
set search_path = ''
as $$
declare
	uid       uuid := auth.uid();
	v_import  uuid;
	v_count   integer;
	v_total   integer;
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
$$;

revoke all     on function public.import_transactions(uuid, text, text, jsonb) from public, anon;
grant  execute on function public.import_transactions(uuid, text, text, jsonb) to authenticated;


-- ----------------------------------------------------------------------------
-- 4. delete_current_user() — con imports
-- ----------------------------------------------------------------------------
-- ⚠️ La funzione fa i DELETE ESPLICITI tabella per tabella, deliberatamente, e
-- il rovescio è che **dimenticare una tabella qui non produce errori**: lascia
-- dati personali di un utente cancellato. `imports` porta il nome di un file e
-- la data in cui è stato caricato, quindi è esattamente il genere di residuo che
-- non deve sopravvivere.
--
-- L'ordine resta vincolante: `transactions` prima di `imports` (la cascade
-- basterebbe, ma la funzione non si appoggia alle cascade per scelta), e
-- `imports` prima di `accounts`, verso cui ha una FK `no action`.

create or replace function public.delete_current_user(dry_run boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	uid uuid := auth.uid();
begin
	if uid is null then
		raise exception 'not authenticated' using errcode = '28000';
	end if;

	-- dry_run: prova a vuoto che deleteAccount() esegue PRIMA di cancellare i
	-- file dell'avatar, che è irreversibile.
	if dry_run then
		return;
	end if;

	-- I file dello Storage NON si cancellano da qui: Supabase blocca il DELETE
	-- diretto su storage.objects. Ci pensa deleteAccount() lato app.

	delete from public.notifications   where user_id = uid;
	delete from public.budgets         where user_id = uid;
	delete from public.transactions    where user_id = uid;
	delete from public.recurring_rules where user_id = uid;
	delete from public.imports         where user_id = uid;   -- dopo transactions
	delete from public.accounts        where user_id = uid;   -- dopo le tre sopra
	delete from public.categories      where user_id = uid;
	delete from public.profiles        where id      = uid;

	delete from auth.users where id = uid;
end;
$$;

revoke all     on function public.delete_current_user(boolean) from public, anon;
grant  execute on function public.delete_current_user(boolean) to authenticated;


-- ⚠️ Nessuna guardia NUOVA da aggiungere alla `20260814`, che è il file dove
-- vive la versione precedente di questa funzione — e vale la pena scrivere
-- perché, o alla prossima rilettura sembrerà una dimenticanza.
--
-- Quel file ha già una guardia, messa dalla 20b, che si rifiuta di partire non
-- appena `transactions.to_account_id` esiste. Siccome quella colonna c'è da
-- prima di questo file e non sparisce, la guardia copre **anche** il danno che
-- interesserebbe qui — il ripristino di una `delete_current_user()` che non
-- conosce `imports`, cioè dati personali lasciati in giro dopo la cancellazione
-- di un account, senza un errore e senza traccia.
--
-- La regola resta quella: il file più recente dev'essere autosufficiente. Quello
-- che cambia è che una guardia non va **per motivo**, va **per file**: una sola
-- basta a fermarlo, indipendentemente da quante ragioni si accumulino nel tempo
-- per non rieseguirlo.


-- ----------------------------------------------------------------------------
-- 5. CONTROPROVA
-- ----------------------------------------------------------------------------
-- ⚠️ Le prove che contano sono quelle che devono FALLIRE. Un elenco di righe
-- verdi non distingue "funziona" da "non ha guardato" — è la regola già scritta
-- per la #47 e ripetuta dal collaudo della 20b.
--
-- Da eseguire nel SQL Editor DOPO la migration.
--
-- ✅ ESEGUITA il 2026-08-13 con un ruolo di sola lettura: **tutti e nove i
--    controlli strutturali verdi** — tabella creata, tre policy (nessuna di
--    UPDATE), RLS attiva, FK **composita a due colonne**, UNIQUE su
--    `(user_id, import_key)` con i NULL **distinti**, `import_id` in cascade
--    (`confdeltype = 'c'`) e `import_transactions` con `prosecdef = false`.
--    Verificate insieme anche le fasi precedenti: i quattro CHECK dei
--    trasferimenti ci sono tutti, `account_balances` ha `security_invoker=true`,
--    e le 25 policy usano tutte `(select auth.uid())`.
--
-- a) Struttura — tutte devono dire `t`.
--
--   select
--     (select count(*) = 1 from information_schema.tables
--        where table_schema = 'public' and table_name = 'imports')            as tabella,
--     (select count(*) = 3 from pg_policies
--        where schemaname = 'public' and tablename = 'imports')               as tre_policy,
--     -- ⚠️ REGEX case-insensitive (`!~*`), non `not like`. Postgres non
--     -- conserva il testo che hai scritto: lo ri-stampa dall'albero sintattico,
--     -- e `(select auth.uid())` diventa `( SELECT auth.uid() AS uid)` —
--     -- maiuscolo e con un alias che non avevi messo. Un `like '%select
--     -- auth.uid()%'` non aggancia nulla, quindi il controllo dichiara NUDE
--     -- tutte le policy del database, comprese le 25 scritte correttamente.
--     -- Verificato il 2026-08-13: con la regex il conto è 0, con `like` era 25.
--     (select count(*) = 0 from pg_policies
--        where schemaname = 'public' and tablename = 'imports'
--          and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'auth\.uid\(\)'
--          and (coalesce(qual,'') || coalesce(with_check,'')) !~* 'select auth\.uid\(\)') as niente_uid_nudo,
--     (select relrowsecurity from pg_class
--        where oid = 'public.imports'::regclass)                              as rls_attiva,
--     (select count(*) = 1 from pg_constraint
--        where conname = 'imports_account_owner_fkey' and contype = 'f')      as fk_composita,
--     (select count(*) = 1 from pg_constraint
--        where conname = 'transactions_import_key_key' and contype = 'u')     as unique_chiave,
--     (select confdeltype = 'c' from pg_constraint
--        where conname = 'transactions_import_id_fkey')                       as cascade_sul_lotto;
--
-- b) Le prove di comportamento. Sostituire <CONTO> con un id di conto proprio.
--
--   -- b1) due volte la STESSA chiave → la seconda non scrive nulla.
--   --     inserted deve essere 1 la prima volta e 0 la seconda; l'import del
--   --     secondo giro deve tornare NULL, perché un lotto vuoto non si tiene.
--   select * from public.import_transactions(
--     '<CONTO>'::uuid, 'trade_republic', 'prova.csv',
--     jsonb_build_array(jsonb_build_object(
--       'account_id', '<CONTO>', 'to_account_id', null, 'type', 'spesa',
--       'amount', 1.23, 'date', '2026-08-13', 'notes', 'prova dedup',
--       'category_id', null, 'investment_type', null,
--       'import_key', 'trade_republic:prova-1'))
--   );
--   -- rilanciare identica → inserted 0, submitted 1, import_id NULL
--
--   -- b2) conto di un ALTRO utente → deve FALLIRE con 23503.
--   --     È la prova che vale di più: nessuna policy RLS guarda `account_id`,
--   --     quindi senza la FK composita questo insert passerebbe.
--   --     SALTATA se non c'è un secondo utente nel database — un test che si
--   --     autoesclude in silenzio è peggio di un test assente.
--
--   -- b3) annullamento: cancellare il lotto porta via le sue righe.
--   --   select count(*) from public.transactions where import_id = '<LOTTO>';  -- N
--   --   delete from public.imports where id = '<LOTTO>';
--   --   select count(*) from public.transactions where import_id = '<LOTTO>';  -- 0
--
--   -- b4) le transazioni scritte a mano NON sono toccate dal vincolo di
--   --     unicità: due righe con `import_key` NULL devono convivere.
--   --   insert into public.transactions (user_id, account_id, type, amount, date)
--   --   values (auth.uid(), '<CONTO>', 'spesa', 1, now()), (auth.uid(), '<CONTO>', 'spesa', 1, now());
--   --   → deve riuscire. Se fallisce, il vincolo è stato scritto
--   --     `nulls not distinct` e ha appena rotto l'inserimento manuale.
-- ============================================================================
