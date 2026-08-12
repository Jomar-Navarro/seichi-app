-- ============================================================================
-- Fase 20a — conti multipli (issue #34)
-- ============================================================================
-- ⚠️ ESEGUIRE DOPO `20260813_schema_cleanup.sql`, che consolida le policy delle
-- tabelle di base e crea gli indici su cui questo file si appoggia.
--
-- Progetto e motivazioni: CLAUDE.md → "Fase 20 — conti multipli e trasferimenti".
-- `to_account_id` e il tipo `trasferimento` NON sono qui: sono la 20b (#49).
--
-- ----------------------------------------------------------------------------
-- ⚠️ L'ORDINE DI DEPLOY È IN CONFLITTO CON SE STESSO — leggere prima di eseguire
-- ----------------------------------------------------------------------------
-- Questo file contiene due modifiche che vorrebbero ordini OPPOSTI rispetto al
-- codice, ed è bene saperlo prima invece di scoprirlo con l'app rotta:
--
--   · `dashboard_totals()` cambia firma  → migration PRIMA del codice,
--     altrimenti la home chiama una funzione che non esiste più (404 sulla RPC).
--   · `transactions.account_id` NOT NULL → codice PRIMA della migration,
--     altrimenti il `TransactionForm` attuale — che il conto non lo manda —
--     non riesce più a inserire nulla.
--
-- Non esiste un ordine che soddisfi entrambe. Le vie d'uscita sarebbero un
-- trigger di compatibilità che riempie `account_id` quando è NULL, oppure due
-- migration separate con la colonna nullable in mezzo. **Nessuna delle due è
-- stata scritta, deliberatamente**: le registrazioni non sono ancora aperte
-- (#40) e l'unico utente è chi sviluppa, quindi migration e deploy sono un
-- gesto solo e la finestra di rottura dura quanto un `git push`.
--
-- ⚠️ Questa nota va riletta il giorno in cui l'app avrà utenti veri: allora la
-- risposta giusta diventa la colonna nullable in due tempi, e questo commento è
-- il posto in cui la decisione è registrata invece di essere riscoperta.
--
-- ----------------------------------------------------------------------------
-- Cosa fa, in ordine
-- ----------------------------------------------------------------------------
--   1. tabella `accounts` + RLS + indici
--   2. backfill: un conto per ogni utente esistente
--   3. `transactions.account_id` NOT NULL + FK
--   4. `recurring_rules.account_id` NOT NULL + FK
--   5. `generate_recurring_transactions()` copia il conto sulla generata
--   6. `delete_current_user()` aggiornata con `accounts`
--   7. `recurring_rules_own` → `(select auth.uid())`  — residuo della #43
--   8. `dashboard_totals()` con parametro conto, senza il bucket `null`
--   9. vista `account_balances` — il saldo calcolato
--  10. controprova
-- ============================================================================


-- ----------------------------------------------------------------------------
-- ⚠️ GUARDIA — questo file NON va più rieseguito
-- ----------------------------------------------------------------------------
-- La `20260815_transfers.sql` lo supera in due punti, e rieseguirlo non darebbe
-- un errore: farebbe il danno in silenzio.
--
--   · la sezione 9 rifà `create or replace view account_balances` nella versione
--     SENZA il termine `+ Σ amount dove to_account_id = X`. I saldi tornerebbero
--     a ignorare tutto il denaro ricevuto per trasferimento, e la vista
--     continuerebbe a rispondere senza lamentarsi.
--   · la sezione 3 ricrea `transactions_account_id_fkey`, la FK a una sola
--     colonna che la 20b sostituisce con quella composita `(account_id,
--     user_id)`. Il vincolo di PROPRIETÀ sparirebbe, lasciando in piedi solo
--     quello di esistenza.
--
-- Riconosce il successore da un fatto del catalogo, non da una convenzione sui
-- nomi dei file: la colonna `to_account_id`. È la stessa forma delle guardie in
-- testa alla `20260727`, `20260728`, `20260808` e `20260809`, e discende dalla
-- regola che le genera — **il file più recente dev'essere autosufficiente**, così
-- non c'è mai motivo di tornare indietro; e se qualcuno ci torna comunque, viene
-- fermato invece di rompere senza traccia.

do $$
begin
	if exists (
		select 1 from information_schema.columns
		where table_schema = 'public'
		  and table_name   = 'transactions'
		  and column_name  = 'to_account_id'
	) then
		raise exception
			'20260814_accounts.sql è SUPERATA da 20260815_transfers.sql (transactions.to_account_id esiste già). Rieseguirla riporterebbe account_balances alla formula senza trasferimenti e sostituirebbe la FK composita con quella a una colonna. Non eseguire.';
	end if;
end $$;


-- ----------------------------------------------------------------------------
-- 1. TABELLA accounts
-- ----------------------------------------------------------------------------
-- ⚠️ `type` è DECORATIVO: sceglie icona ed etichetta, e NIENT'ALTRO. La natura
-- di un movimento la decide sempre e solo `transactions.type`.
--
-- Non è una sfumatura di stile. Se `accounts.type` decidesse qualcosa — "i
-- movimenti su un conto investimento sono investimenti", o "il saldo del conto
-- entra nel totale investito" — la domanda *"questo movimento è un
-- investimento?"* avrebbe DUE risposte, e questo progetto ha già pagato tre
-- volte quella classe di difetto: `hasPasswordIdentity` derivato in due punti
-- (account impossibile da eliminare), `getAccountContext()` che serviva due
-- bisogni con freschezze diverse, `currency default 'EUR'` che affermava
-- "onboarding finito". Vale la regola già scritta in CLAUDE.md: **un campo che
-- serve a disegnare e un campo che serve a decidere hanno bisogni diversi anche
-- quando contengono la stessa stringa.**
--
-- Il CHECK c'è comunque, ed è igiene, non semantica: la #47 è costata cinque
-- settimane proprio perché `recurring_rules.type` era testo libero mentre le
-- tabelle sorelle avevano un vincolo. Allargare l'elenco è una riga qui più una
-- voce nel dizionario — nessun comportamento da rivedere, appunto perché non ne
-- dipende nessuno.
--
-- ⚠️ `initial_balance` è una COLONNA, non una transazione di apertura. Quando si
-- aggiunge "Conto corrente" ci sono già 2.400 € dentro e l'app non ha quella
-- storia: modellarli come `entrata` li farebbe comparire fra i redditi del mese
-- e gonfierebbe ogni grafico. Una colonna dice "il conto parte da qui" senza
-- affermare che quei soldi siano un reddito.
--
-- Nessun CHECK sul segno: una carta di credito ha giacenza negativa, ed è uno
-- stato legittimo.
--
-- `archived` e non `deleted`: vedi la sezione 3 per il perché un conto non si
-- cancella. Un conto archiviato sparisce dai selettori ma resta nei filtri e
-- nello storico, o i suoi movimenti diventano illeggibili.
--
-- Nessun UNIQUE su `(user_id, name)`: due conti omonimi sono confusi ma non
-- illegali, e il rimedio è rinominarli. Vietarlo sarebbe un vincolo che il
-- progetto non ha chiesto.

create table if not exists public.accounts (
	id              uuid primary key default gen_random_uuid(),
	user_id         uuid not null references auth.users (id) on delete cascade,
	name            varchar(50) not null,
	type            varchar(20),
	icon            varchar(50),
	color           text,
	initial_balance numeric(10,2) not null default 0,
	archived        boolean not null default false,
	created_at      timestamptz not null default now()
);

alter table public.accounts drop constraint if exists accounts_type_check;

alter table public.accounts add constraint accounts_type_check
	check (
		type is null
		or type::text = any (
			array['corrente', 'contanti', 'risparmio', 'investimento']::text[]
		)
	);


-- RLS — una policy per operazione, nella forma `(select auth.uid())`.
--
-- Il sotto-select non è cosmesi: `auth.uid()` nudo viene rivalutato PER OGNI
-- RIGA, mentre avvolto in un select il planner lo tratta come InitPlan e lo
-- calcola una volta sola. È la forma fissata dalla #43 per tutte le tabelle.

alter table public.accounts enable row level security;

do $$
begin
	if not exists (select 1 from pg_policies
		where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_select_own') then
		create policy accounts_select_own on public.accounts
			for select to authenticated using ((select auth.uid()) = user_id);
	end if;

	if not exists (select 1 from pg_policies
		where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_insert_own') then
		create policy accounts_insert_own on public.accounts
			for insert to authenticated with check ((select auth.uid()) = user_id);
	end if;

	if not exists (select 1 from pg_policies
		where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_update_own') then
		create policy accounts_update_own on public.accounts
			for update to authenticated
			using ((select auth.uid()) = user_id)
			with check ((select auth.uid()) = user_id);
	end if;

	-- ⚠️ La policy di DELETE esiste, ma è la FK della sezione 3 a impedire di
	-- cancellare un conto con movimenti. Le due difese dicono cose diverse: la
	-- policy dice "solo i tuoi", il vincolo dice "solo se è vuoto".
	if not exists (select 1 from pg_policies
		where schemaname = 'public' and tablename = 'accounts' and policyname = 'accounts_delete_own') then
		create policy accounts_delete_own on public.accounts
			for delete to authenticated using ((select auth.uid()) = user_id);
	end if;
end $$;


-- Indici. Quello su `user_id` serve alla RLS, che filtra su quella colonna in
-- OGNI query. Gli altri due — sezioni 3 e 4 — non servono alle SELECT ma al
-- controllo della FK: senza, ogni tentativo di cancellare un conto scandisce
-- l'intera `transactions`.

create index if not exists accounts_user_id_idx
	on public.accounts (user_id);


-- ----------------------------------------------------------------------------
-- 2. BACKFILL — un conto per ogni utente esistente
-- ----------------------------------------------------------------------------
-- `account_id` è NOT NULL per decisione (sezione 3), quindi ogni riga esistente
-- deve avere un conto a cui appartenere prima che il vincolo esista.
--
-- ⚠️ Il NOME è tradotto alla SCRITTURA, non alla lettura, ed è la stessa regola
-- delle categorie di default nella Fase 19: una volta scritto in `accounts.name`
-- non è più una stringa dell'app ma un DATO DELL'UTENTE, rinominabile. Tradurlo
-- al render richiederebbe una colonna `preset_key`, una regola "se è valorizzata
-- ignora `name`", e l'azzeramento al primo rename.
--
-- `profiles.language` può essere NULL (= non ancora scelta, vedi #43): in quel
-- caso si ripiega sull'italiano, che è la lingua di default dell'app. Qui non
-- c'è un `Accept-Language` da negoziare — una migration non ha una richiesta
-- HTTP da cui dedurlo.
--
-- Il `not exists` rende la sezione rieseguibile senza creare doppioni.

insert into public.accounts (user_id, name, type)
select
	u.id,
	case when p.language = 'en' then 'Main account' else 'Conto principale' end,
	'corrente'
from auth.users u
left join public.profiles p on p.id = u.id
where not exists (
	select 1 from public.accounts a where a.user_id = u.id
);


-- ----------------------------------------------------------------------------
-- 3. transactions.account_id
-- ----------------------------------------------------------------------------
-- ⚠️ `on delete NO ACTION`, non `cascade` e non `restrict`.
--
-- Non `cascade`: la cascade su `categories` è deliberata — serve a eliminare un
-- obiettivo — ma qui cancellare un conto cancellerebbe anni di movimenti reali.
-- Un conto chiuso in banca non fa sparire ciò che ci hai speso. Da qui
-- `archived`: si archivia, non si elimina.
--
-- Non `restrict`, e la differenza è sottile ma reale: entrambi rifiutano di
-- cancellare un conto che ha movimenti, ma `restrict` è controllato SUBITO
-- mentre `no action` è differibile a fine statement. Un `delete from auth.users`
-- cascata su `transactions` E su `accounts` nello stesso comando, in un ordine
-- che Postgres non garantisce: con `restrict`, se tocca prima `accounts` il
-- vincolo scatta anche se quelle transazioni stanno per sparire nello stesso
-- comando. `delete_current_user()` è al sicuro comunque (fa i DELETE espliciti
-- in sequenza, vedi sezione 6), ma la cancellazione di un utente dal pannello
-- Supabase passa dalla cascade nuda e fallirebbe. `no action` dà la stessa
-- protezione contro gli orfani senza lo spigolo.

alter table public.transactions add column if not exists account_id uuid;

-- Il conto più vecchio dell'utente, deterministicamente. Su un database appena
-- migrato ce n'è uno solo; l'ordinamento serve a rendere la riesecuzione
-- prevedibile invece che dipendente dal piano.
update public.transactions t
set account_id = (
	select a.id
	from public.accounts a
	where a.user_id = t.user_id
	order by a.created_at, a.id
	limit 1
)
where t.account_id is null;

-- ⚠️ Fallire QUI, con un messaggio che dice cosa fare, invece di lasciare che
-- sia il NOT NULL a esplodere due righe sotto con "column contains null values"
-- — che è vero ma non dice quali righe né perché.
--
-- Il caso che lo produce è noto ed è un debito già dichiarato in CLAUDE.md:
-- `transactions.user_id` è NULLABLE, quindi una riga senza utente non ha un
-- conto a cui appartenere. Oggi è impossibile (ogni insert passa da una server
-- action), ma il database non lo impedisce, e una migration non è il posto dove
-- appoggiarsi all'invarianza altrui.
do $$
declare
	v_orfane int;
begin
	select count(*) into v_orfane from public.transactions where account_id is null;
	if v_orfane > 0 then
		raise exception
			'% transazioni senza conto: hanno user_id NULL e nessun conto a cui appartenere. Assegnare un user_id o rimuoverle, poi rieseguire.',
			v_orfane
			using errcode = 'not_null_violation';
	end if;
end $$;

alter table public.transactions alter column account_id set not null;

alter table public.transactions drop constraint if exists transactions_account_id_fkey;

alter table public.transactions add constraint transactions_account_id_fkey
	foreign key (account_id) references public.accounts (id) on delete no action;

create index if not exists transactions_account_id_idx
	on public.transactions (account_id);


-- ----------------------------------------------------------------------------
-- 4. recurring_rules.account_id
-- ----------------------------------------------------------------------------
-- ⚠️ Serve anche qui, e dimenticarlo NON darebbe un errore leggibile: la regola
-- resterebbe senza conto, `generate_recurring_transactions()` (sezione 5)
-- inserirebbe una transazione con `account_id` NULL, il NOT NULL della sezione 3
-- la rifiuterebbe, e il job notturno registrerebbe una regola saltata. Per
-- utente, grazie all'isolamento della #47 — ma comunque in silenzio fino a
-- quando qualcuno non guarda `job_runs`.

alter table public.recurring_rules add column if not exists account_id uuid;

update public.recurring_rules r
set account_id = (
	select a.id
	from public.accounts a
	where a.user_id = r.user_id
	order by a.created_at, a.id
	limit 1
)
where r.account_id is null;

do $$
declare
	v_orfane int;
begin
	select count(*) into v_orfane from public.recurring_rules where account_id is null;
	if v_orfane > 0 then
		raise exception
			'% regole ricorrenti senza conto: hanno user_id NULL. Assegnare un user_id o rimuoverle, poi rieseguire.',
			v_orfane
			using errcode = 'not_null_violation';
	end if;
end $$;

alter table public.recurring_rules alter column account_id set not null;

alter table public.recurring_rules drop constraint if exists recurring_rules_account_id_fkey;

alter table public.recurring_rules add constraint recurring_rules_account_id_fkey
	foreign key (account_id) references public.accounts (id) on delete no action;

create index if not exists recurring_rules_account_id_idx
	on public.recurring_rules (account_id);


-- ----------------------------------------------------------------------------
-- 5. generate_recurring_transactions() — copia il conto sulla generata
-- ----------------------------------------------------------------------------
-- ⚠️ Questa versione è AUTOSUFFICIENTE rispetto alla `20260810_recurring_fixes`,
-- ed è una regola del progetto, non una precauzione: il file più recente deve
-- contenere tutto, così non c'è mai motivo di tornare indietro a rieseguire un
-- file superato. Sono conservate parola per parola le tre correzioni della #47:
--
--   · l'isolamento per singola regola (`begin … exception … end` DENTRO il
--     ciclo): senza, la prima regola guasta abortisce tutte le altre — e dal
--     cron `auth.uid()` è NULL, quindi i dati di un utente fermerebbero le
--     ricorrenti di TUTTI;
--   · il ritorno `integer` col numero di regole saltate, perché **isolare un
--     guasto senza registrarlo lo rende invisibile**, che è il difetto costato
--     cinque settimane di silenzio;
--   · l'ordine `order by next_run, id`, che rende deterministico quale regola
--     si incontra per prima.
--
-- Lo SCOPING resta intatto: `v_uid := auth.uid()` è NULL dal cron (nessun JWT) e
-- il filtro copre tutti gli utenti; via RPC da un utente autenticato tocca solo
-- le sue regole, ed è ciò che permette a `createRecurringRule` di materializzare
-- subito la prima occorrenza senza poter toccare dati altrui.
--
-- L'UNICA differenza rispetto alla 20260810 è `account_id` nell'insert.
--
-- `create or replace` e non `drop`: il tipo di ritorno non cambia (era già
-- `integer` dalla 20260810), quindi non serve ricrearla — e non ricrearla evita
-- di dover ristabilire i grant.

create or replace function public.generate_recurring_transactions()
returns integer          -- quante regole sono state SALTATE per un errore
language plpgsql
security definer
set search_path to 'public'
as $$
declare
	r public.recurring_rules%rowtype;
	v_uid uuid := auth.uid();
	v_next date;
	v_failed int := 0;
begin
	for r in
		select * from public.recurring_rules
		where active = true
			and next_run <= current_date
			and (v_uid is null or user_id = v_uid)
		order by next_run, id
	loop
		begin
			v_next := r.next_run;
			while v_next <= current_date and (r.end_date is null or v_next <= r.end_date) loop
				insert into public.transactions (
					user_id, amount, type, category_id, notes, date, recurring_rule_id, account_id
				)
				values (
					r.user_id, r.amount, r.type, r.category_id, r.notes, v_next, r.id, r.account_id
				);

				v_next := case r.frequency
					when 'settimanale' then v_next + interval '1 week'
					when 'mensile'     then v_next + interval '1 month'
					when 'annuale'     then v_next + interval '1 year'
				end;
			end loop;

			update public.recurring_rules
			set next_run = v_next,
				active = case when r.end_date is not null and v_next > r.end_date then false else active end
			where id = r.id;
		exception when others then
			-- La sottotransazione è già annullata: né le transazioni di questa
			-- regola né il suo next_run sono stati scritti. Ritenterà.
			v_failed := v_failed + 1;
			raise warning 'regola ricorrente % saltata: % (%)', r.id, sqlerrm, sqlstate;
		end;
	end loop;

	return v_failed;
end;
$$;

revoke all     on function public.generate_recurring_transactions() from public, anon;
grant  execute on function public.generate_recurring_transactions() to authenticated;


-- ----------------------------------------------------------------------------
-- 6. delete_current_user() — con accounts, DOPO le tabelle che la referenziano
-- ----------------------------------------------------------------------------
-- ⚠️ L'ordine dei DELETE non è decorativo. `transactions` e `recurring_rules`
-- hanno una FK verso `accounts` (`no action`): cancellare i conti per primi
-- lascerebbe righe orfane e il vincolo rifiuterebbe l'operazione. `accounts` va
-- dopo entrambe, e prima di `auth.users`.
--
-- La funzione fa i DELETE ESPLICITI tabella per tabella, deliberatamente: resta
-- corretta anche se un domani una FK venisse ricreata senza cascade. Il rovescio
-- è che **dimenticare una tabella qui non produce errori** — lascia dati
-- personali di un utente cancellato.

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
	delete from public.accounts        where user_id = uid;   -- dopo le due sopra
	delete from public.categories      where user_id = uid;
	delete from public.profiles        where id      = uid;

	delete from auth.users where id = uid;
end;
$$;

revoke all     on function public.delete_current_user(boolean) from public, anon;
grant  execute on function public.delete_current_user(boolean) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. recurring_rules_own — residuo della issue #43
-- ----------------------------------------------------------------------------
-- La policy usava `auth.uid()` NUDO, unica rimasta dopo la `20260813`. Il file
-- `20260728_recurring.sql` lo dichiarava apertamente — *"non corretta qui apposta
-- per non far divergere il file dalla realtà … da allineare quando si passa di
-- qui"* — e questo file ci passa, perché aggiunge `account_id` a quella tabella.
--
-- ⚠️ `alter policy` e NON `drop` + `create`. Fra il drop e il create la tabella
-- resterebbe con RLS attiva e ZERO policy, cioè una finestra di nego-tutto: la
-- `20260813` dichiara quella finestra inaccettabile e la evita con la forma
-- condizionale. `alter policy` non ha né la finestra né il fallimento in
-- riesecuzione — riscrive l'espressione sul posto.

alter policy recurring_rules_own on public.recurring_rules
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);


-- ----------------------------------------------------------------------------
-- 8. dashboard_totals() — parametro conto, e via il bucket `null`
-- ----------------------------------------------------------------------------
-- Due modifiche, e la seconda è una rimozione.
--
-- ⚠️ **Il vecchio `dashboard_totals(timestamptz[])` va CANCELLATO, non
-- sostituito.** Aggiungere un parametro crea una funzione DIVERSA: le due
-- convivrebbero come overload, e una chiamata a un argomento diventerebbe
-- ambigua ("function is not unique") oppure — peggio — continuerebbe a
-- risolversi sulla vecchia, lasciando la home a girare sulla versione senza
-- filtro senza che nulla lo segnali.
--
-- ⚠️ E `p_account_id` NON ha un default, di proposito. Con un default, il codice
-- non ancora aggiornato continuerebbe a compilare e a girare, ma leggerebbe un
-- risultato che non contiene più il bucket `null` — cioè un saldo totale
-- silenziosamente sbagliato invece di un errore. Senza default la chiamata
-- vecchia fallisce subito e rumorosamente, che è la scelta già fatta quando si è
-- rifiutato un fallback sulla vecchia strada.
--
-- **Il bucket `null` era l'aggregazione su TUTTA la storia**, e serviva solo a
-- `saldoTotale` in home. La 20a toglie quel numero — "Saldo totale" diventa
-- "Flusso · <mese>", perché con i conti due schermate rispondevano diversamente
-- a "quanto ho" — quindi il bucket resta senza consumatori. Tenerlo significa
-- una scansione dell'intero archivio a ogni vista della home per un valore che
-- nessuno mostra: è anche la seconda scansione di `transactions` che il commento
-- della `20260808` dichiarava nota e accettata.
--
-- ⚠️ **Ma il conto totale non è un risparmio netto, e dirlo sarebbe falso.** La
-- vista `account_balances` della sezione 9 aggrega anch'essa tutto l'archivio
-- senza filtro di data, e la home la interroga per il selettore: la scansione
-- non sparisce, cambia consumatore. Il guadagno vero è un altro, ed è
-- qualitativo — prima quel giro serviva un numero che nessuno mostrava, ora
-- serve i saldi che l'utente legge. Un costo uguale per qualcosa di utile
-- invece che per niente.
--
-- ⚠️ I CAST ESPLICITI su ogni colonna restano, e non sono ridondanza. `RETURN
-- QUERY` di plpgsql pretende i tipi ESATTI e fallisce **solo a esecuzione**, con
-- `structure of query does not match function result type` — un messaggio che
-- non dice quale colonna, mentre `create or replace` passa senza un lamento.
-- Da quando `transactions` è versionata (#43) si vede che l'assunzione era
-- giusta: `type` è davvero `character varying`, non `text`.
--
-- ⚠️ `#variable_conflict use_column` DEVE essere il primo elemento del corpo, per
-- questo la spiegazione sta qui: i parametri OUT (`bucket_index`, `type`,
-- `total`) sono anche nomi di colonna, e in plpgsql un riferimento ambiguo è un
-- errore che si manifesta solo all'esecuzione.
--
-- Il filtro per conto agisce su `account_id`, cioè l'ORIGINE del movimento: un
-- `risparmio` fatto dal corrente verso il Fondo è un atto compiuto dal corrente.
-- Con `p_account_id` NULL la funzione somma tutti i conti.

drop function if exists public.dashboard_totals(timestamptz[]);

create or replace function public.dashboard_totals(
	p_bounds     timestamptz[],
	p_account_id uuid
)
returns table (
	bucket_index int,
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
	select (b.bucket_index)::int, (t.type)::text, sum(t.amount)::numeric
	from public.transactions t
	join bounds b
	  on t.date >= b.starts
	 and t.date <  b.ends
	where t.user_id = (select auth.uid())
	  and (p_account_id is null or t.account_id = p_account_id)
	group by b.bucket_index, t.type;
end;
$$;

revoke all     on function public.dashboard_totals(timestamptz[], uuid) from public, anon;
grant  execute on function public.dashboard_totals(timestamptz[], uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 9. account_balances — il saldo si CALCOLA, e lo calcola Postgres
-- ----------------------------------------------------------------------------
-- Nessuna colonna `balance` sulla tabella, per la stessa ragione di `spent` sui
-- budget e di `saved_amount` sugli obiettivi: avrebbe quattro punti di scrittura
-- da tenere allineati, inclusi gli insert di pg_cron.
--
-- Ma nemmeno il calcolo lato app. Sommare in TypeScript significa scaricare
-- tutte le transazioni di ogni conto a ogni vista della pagina — esattamente ciò
-- che la `20260808` ha appena smesso di fare per la home, dove costava
-- l'intero archivio per una trentina di numeri.
--
-- ⚠️ `security_invoker = true` NON è opzionale. Una vista normale gira con i
-- privilegi del PROPRIETARIO e scavalca la RLS della tabella sottostante: senza
-- questa opzione ogni utente vedrebbe i saldi di tutti. È la trappola già
-- documentata in CLAUDE.md, e non dà alcun errore — la pagina funziona, mostra
-- solo i dati sbagliati a chiunque.
--
-- ⚠️ **Una VISTA qui, mentre i budget usano una FUNZIONE** (`budgets_at()`), ed è
-- una divergenza deliberata: la `20260803` scelse la funzione perché la lettura
-- dei budget riceve la data LOCALE del client come parametro — senza, fra
-- mezzanotte e le 2 il server in UTC sbaglierebbe periodo. Il saldo di un conto
-- non dipende da alcun parametro: è la somma di tutto, senza finestra temporale
-- e senza fuso.
--
-- Restando senza parametri, la vista è la forma migliore perché PostgREST ci
-- compone sopra i propri filtri (`?archived=eq.false`, `order`, `select`) senza
-- che ogni variante debba diventare un argomento della funzione. E le funzioni
-- SQL sono SECURITY INVOKER di default — sono le VISTE a non esserlo, ed è
-- precisamente perché qui si usa una vista che quell'opzione va scritta a mano.
--
-- La formula della 20a è quella del progetto, meno l'ultimo termine:
--
--   saldo(X) = initial_balance(X)
--            + Σ amount dove type='entrata'  e account_id = X
--            − Σ amount dove type<>'entrata' e account_id = X
--            [ + Σ amount dove to_account_id = X ]   ← arriva con la 20b (#49)
--
-- Il `left join` è ciò che fa comparire un conto appena creato con saldo pari al
-- solo `initial_balance`: con una join interna sparirebbe finché non ha almeno
-- un movimento — un conto che esiste e non si vede.
--
-- ⚠️ `archived` è esposto ma NON filtrato qui. La vista descrive i conti, non
-- decide quali mostrare: l'intestazione "Saldo · N conti attivi" esclude gli
-- archiviati, la sezione "Archiviati" li include, e sono due domande diverse
-- sulla stessa riga. Filtrare nella vista costringerebbe a una seconda vista per
-- l'altra metà della pagina.

create or replace view public.account_balances
with (security_invoker = true)
as
select
	a.id,
	a.user_id,
	a.name,
	a.type,
	a.icon,
	a.color,
	a.initial_balance,
	a.archived,
	a.created_at,
	(
		a.initial_balance
		+ coalesce(sum(case when t.type = 'entrata' then t.amount else -t.amount end), 0)
	)::numeric(12,2) as balance
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

-- ⚠️ `numeric(12,2)` e non `(10,2)` come la colonna: una somma può superare le
-- dieci cifre anche quando nessun importo singolo lo fa, e il cast la farebbe
-- fallire. È la stessa ragione per cui `dashboard_totals.total` è `numeric`
-- senza precisione.

revoke all    on public.account_balances from public, anon;
grant  select on public.account_balances to authenticated;


-- ----------------------------------------------------------------------------
-- 10. CONTROPROVA
-- ----------------------------------------------------------------------------
-- Da eseguire dopo la migration. Le prime tre non hanno bisogno di una sessione
-- autenticata; le ultime due sì (SQL Editor → "Run as" un utente, oppure dalla
-- app), perché passano dalla RLS.
--
--   -- a) Ogni utente ha esattamente un conto, e nessuna riga è senza conto.
--   --    Atteso: tre zeri.
--   select
--     (select count(*) from auth.users u
--      where not exists (select 1 from public.accounts a where a.user_id = u.id))
--       as utenti_senza_conto,
--     (select count(*) from public.transactions    where account_id is null) as tx_senza_conto,
--     (select count(*) from public.recurring_rules where account_id is null) as regole_senza_conto;
--
--   -- b) Le FK sono `NO ACTION`, non `RESTRICT` né `CASCADE`.
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conname in ('transactions_account_id_fkey', 'recurring_rules_account_id_fkey');
--
--   -- c) Nessuna policy con auth.uid() nudo è rimasta. Atteso: zero righe.
--   select tablename, policyname, qual
--   from pg_policies
--   where schemaname = 'public'
--     and qual like '%auth.uid()%'
--     and qual not like '%( SELECT auth.uid()%';
--
--   -- d) Un conto con movimenti NON si cancella. Atteso: errore di FK.
--   --    (girare dentro una transazione e fare rollback)
--   begin;
--     delete from public.accounts where id = (select account_id from public.transactions limit 1);
--   rollback;
--
--   -- e) dashboard_totals: la vecchia firma non esiste più, la nuova filtra.
--   --    La prima deve FALLIRE con "function ... does not exist".
--   select * from public.dashboard_totals(array[now() - interval '1 month', now()]::timestamptz[]);
--
--   with b as (select array[date_trunc('month', now()), date_trunc('month', now()) + interval '1 month']::timestamptz[] as bounds)
--   select * from b, lateral public.dashboard_totals(b.bounds, null) order by type;
--
--   -- …e filtrata su un conto: la somma dev'essere ≤ quella non filtrata.
--   with b as (select array[date_trunc('month', now()), date_trunc('month', now()) + interval '1 month']::timestamptz[] as bounds)
--   select * from b, lateral public.dashboard_totals(b.bounds, (select id from public.accounts limit 1)) order by type;
--
--   -- f) Il job notturno regge e copia il conto. Atteso: 'ok' su entrambi i passi.
--   select public.run_daily_jobs();
--   select run_at, step, status, details from public.job_runs order by run_at desc, step limit 4;
--
--   -- g) La vista non scavalca la RLS. Da una sessione autenticata deve
--   --    restituire SOLO i propri conti; da una sessione senza JWT, zero righe.
--   --    Se ne mostra di altri utenti, manca `security_invoker`.
--   select id, name, initial_balance, balance from public.account_balances order by created_at;
--
--   select relname, reloptions from pg_class
--   where relname = 'account_balances';   -- atteso: {security_invoker=true}
--
--   -- h) Il saldo torna: initial_balance + entrate − tutto il resto.
--   select
--     a.name,
--     a.initial_balance,
--     coalesce(sum(case when t.type = 'entrata' then t.amount else -t.amount end), 0) as movimenti,
--     v.balance
--   from public.accounts a
--   left join public.transactions t on t.account_id = a.id
--   join public.account_balances v on v.id = a.id
--   group by a.id, a.name, a.initial_balance, v.balance;
