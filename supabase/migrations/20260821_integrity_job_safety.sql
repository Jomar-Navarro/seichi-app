-- ============================================================================
-- 20260821 — Importi positivi, job sicuro in concorrenza, rinnovi con la data
-- (issue #123)
-- ============================================================================
-- ⚠️⚠️ ORDINE: PRIMA IL DEPLOY DEL CODICE, POI QUESTO FILE. È il contrario di
-- quasi tutte le migration precedenti, e la ragione è la sezione 5:
--
--   · database nuovo su codice VECCHIO → le notifiche di rinnovo non portano più
--     `days`. Il codice vecchio fa `relativeDayLabel(Number(p.days))`, cioè
--     `Intl.RelativeTimeFormat.format(NaN)`, che SOLLEVA: l'intero pannello
--     notifiche risponde con un errore, non la sola riga;
--   · codice NUOVO su database vecchio → le righe senza `date` dicono soltanto
--     `Rinnovo "Spotify"`, senza un tempo. Una frase vera, per i minuti fra il
--     deploy e questo file.
--
-- ⚠️ E PRIMA ANCORA la query di verifica della issue #123 (le righe che la
-- sezione 2 rifiuterebbe). Se dimenticata non succede niente di irreparabile:
-- la sezione 1 conta le stesse righe e si ferma con un messaggio, PRIMA di
-- scrivere qualunque cosa.
--
-- ----------------------------------------------------------------------------
-- Cosa fa, in ordine
-- ----------------------------------------------------------------------------
--   0. guardia: richiede la `20260814` (i conti), che la funzione del job usa
--   1. si rifiuta di partire se ci sono righe che i vincoli rifiuterebbero
--   2. `transactions.amount/type/date` NOT NULL, `amount > 0` su `transactions`
--      e su `recurring_rules`
--   3. `generate_recurring_transactions()` con `for update skip locked`
--   4. `generate_notifications()`: il rinnovo salva la DATA, e le join verso
--      `categories` confrontano il proprietario
--   5. le notifiche di rinnovo già scritte: `days` → `date`
--   6. controprova (COMMENTATA — si esegue a parte)
--
-- ⚠️ Nessuna guardia nuova da mettere QUI contro i predecessori, ma due file
-- precedenti ridefiniscono funzioni che questo sostituisce, ed è stato
-- verificato che siano già fermati:
--   · `generate_recurring_transactions()` — la `20260814` si rifiuta di partire
--     dopo la `20260815`; la `20260810` dopo la `20260814`; la `20260728` dopo
--     la `20260810`.
--   · `generate_notifications()` — definita SOLO nella `20260804`, che fino a
--     questa issue non aveva guardia. Ora ce l'ha (riconosce `job_runs`).
-- È la regola scritta nella Fase 22: *una guardia protegge dai successori che
-- esistevano quando è stata scritta* — chi allunga la catena guarda daccapo.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Guardia: servono i conti
-- ----------------------------------------------------------------------------
-- La sezione 3 copia `r.account_id` sulla transazione generata. Su un database
-- senza la `20260814` la funzione verrebbe creata lo stesso (plpgsql non
-- controlla le colonne alla creazione) e fallirebbe alle 3 di notte, regola per
-- regola, isolata e quindi silenziosa. Meglio non partire.

do $$
begin
	if not exists (
		select 1 from information_schema.columns
		where table_schema = 'public'
		  and table_name   = 'recurring_rules'
		  and column_name  = 'account_id'
	) then
		raise exception
			'20260821 richiede 20260814_accounts.sql (recurring_rules.account_id non esiste). Eseguire prima quella.';
	end if;
end $$;


-- ----------------------------------------------------------------------------
-- 1. Le righe che i vincoli rifiuterebbero — contate PRIMA di scrivere
-- ----------------------------------------------------------------------------
-- `set not null` e `add constraint … check` falliscono comunque su una riga che
-- li viola, ma con un messaggio che nomina UNA colonna e non dice quante righe
-- né quali. Contarle qui dà un referto completo, e lo dà prima che il file
-- abbia toccato qualcosa — stesso schema delle righe senza `user_id` nella
-- `20260815`.
--
-- ⚠️ Le righe non si correggono da qui, deliberatamente: un importo negativo
-- può essere un'entrata scritta come spesa col segno, o un errore di import, o
-- un test. Deciderlo è una lettura delle righe, non una regola.

do $$
declare
	v_tx    int;
	v_rules int;
begin
	select count(*) into v_tx
	from public.transactions
	where amount is null or amount <= 0 or type is null or date is null;

	select count(*) into v_rules
	from public.recurring_rules
	where amount <= 0;

	if v_tx > 0 or v_rules > 0 then
		raise exception
			'STOP prima di scrivere: % movimenti con importo nullo/non positivo o tipo/data mancanti, % regole ricorrenti con importo non positivo. Vanno corretti o rimossi a mano (la query di verifica della issue #123 li elenca), poi rieseguire.',
			v_tx, v_rules
			using errcode = 'check_violation';
	end if;
end $$;


-- ----------------------------------------------------------------------------
-- 2. Importi positivi, e le tre colonne che non possono mancare
-- ----------------------------------------------------------------------------
-- ⚠️ Gli importi sono SENZA SEGNO in tutto lo schema: la direzione la porta
-- `type`, e `account_balances` sottrae tutto ciò che non è `entrata` o
-- `disinvestimento`. Un importo negativo quindi non è "un'uscita scritta in un
-- altro modo": è il segno ROVESCIATO. Una POST diretta con `-50` e tipo `spesa`
-- faceva SALIRE il saldo del conto di 50, e nessun vincolo lo fermava.
--
-- `budgets` (`budgets_amount_check`) e `attachments` (`size_bytes > 0`) il loro
-- CHECK l'avevano già; mancava sulla tabella più importante. Le server action
-- lo controllano dalla #119 (`isStorableAmount`), e resta giusto così — danno
-- una frase invece di una violazione — ma il codice applicativo lo scavalca un
-- insert dal SQL Editor, un import o la prossima action che se ne dimentica.
--
-- Zero escluso come nei budget: un movimento da € 0 non sposta denaro, e
-- l'import lo tratta già come "nessun movimento di cassa".
--
-- `type` e `date` NOT NULL perché ogni consumatore li dà per presenti: una riga
-- senza `type` è invisibile a ogni totale (nessuno somma "tutto ciò che c'è") e
-- una senza `date` a ogni periodo. `date` ha già `default now()`.

alter table public.transactions
	alter column amount set not null,
	alter column type   set not null,
	alter column date   set not null;

alter table public.transactions drop constraint if exists transactions_amount_check;
alter table public.transactions add  constraint transactions_amount_check
	check (amount > 0);

-- `recurring_rules.amount` è già NOT NULL dalla 20260728. Senza il CHECK, una
-- regola da -50 replicherebbe il segno rovesciato ogni mese, dal job notturno.
alter table public.recurring_rules drop constraint if exists recurring_rules_amount_check;
alter table public.recurring_rules add  constraint recurring_rules_amount_check
	check (amount > 0);


-- ----------------------------------------------------------------------------
-- 3. generate_recurring_transactions() — sicura in concorrenza
-- ----------------------------------------------------------------------------
-- ⚠️ Il ciclo non prendeva lock. Due esecuzioni sovrapposte — il cron delle
-- 03:00 e una `createRecurringRule` (che via RPC processa TUTTE le regole
-- scadute dell'utente), oppure due `createRecurringRule` ravvicinate (doppio
-- invio, due schede) — leggevano la stessa regola con lo stesso `next_run` e
-- inserivano entrambe l'occorrenza: l'affitto registrato due volte. Il secondo
-- `update … set next_run` aspettava il lock del primo e poi scriveva lo stesso
-- valore, quindi nessun errore e nessuna traccia.
--
-- `for update skip locked` sul cursore: una regola che un'altra esecuzione sta
-- già elaborando si salta. E se quell'altra ha già finito e fatto commit,
-- Postgres rilegge la riga aggiornata prima di bloccarla (in READ COMMITTED,
-- come sempre per `for update`): il `next_run` nuovo è nel futuro, la riga non
-- soddisfa più il `where` ed esce dal ciclo. In nessuno dei due casi la stessa
-- occorrenza si scrive due volte.
--
-- `skip locked` e non un `for update` che aspetta: qui saltare è giusto per
-- costruzione — chi tiene il lock sta generando proprio quella regola — e non
-- fa attendere `createRecurringRule` dietro al job notturno.
--
-- ⚠️ SCARTATO l'indice unico parziale su `(recurring_rule_id, date)`, l'altra
-- strada proposta dalla issue. Vincolerebbe anche i DATI dell'utente: un
-- movimento generato si può modificare, data compresa, e conserva il proprio
-- `recurring_rule_id`. L'affitto di settembre pagato in ritardo e spostato al 5
-- ottobre occuperebbe la chiave dell'occorrenza di ottobre, che il job — con
-- `on conflict do nothing` — salterebbe in silenzio. Un vincolo che protegge da
-- una corsa al prezzo di un movimento perso non è una difesa.
--
-- Il resto è parola per parola la versione della 20260814 (isolamento per
-- regola, ritorno `integer` con le regole saltate, `order by next_run, id`),
-- con una sola altra differenza: `search_path = ''` come ogni altra funzione
-- del progetto, invece di `'public'`. Era un debito dichiarato in CLAUDE.md, e
-- il corpo qualificava già ogni oggetto con `public.`.

create or replace function public.generate_recurring_transactions()
returns integer          -- quante regole sono state SALTATE per un errore
language plpgsql
security definer
set search_path = ''
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
		for update skip locked
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
			-- regola né il suo next_run sono stati scritti. Ritenterà. Il lock
			-- sulla riga invece resta: lo ha preso il cursore, fuori dal blocco.
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
-- 4. generate_notifications() — la data del rinnovo, e il proprietario
-- ----------------------------------------------------------------------------
-- Due correzioni, entrambe dentro una funzione che finora esisteva solo nella
-- `20260804`.
--
-- ⚠️ a) IL RINNOVO SALVA LA DATA, NON LA DISTANZA. Il payload portava
-- `days = next_run − oggi`, cioè un numero RELATIVO al giorno in cui il job
-- girava, e `lib/notifications.ts` lo ripresentava come relativo a oggi. Siccome
-- le notifiche non si cancellano mai, settimane dopo la riga diceva ancora
-- "Rinnovo Spotify fra 3 giorni". È la regola della 17b — *il payload porta
-- FATTI, la frase si compone alla lettura* — violata da un campo che sembrava un
-- fatto: "3" era vero solo il giorno in cui è stato scritto. Ora `date`, e la
-- distanza la calcola l'app con la data del CLIENTE.
--
-- ⚠️ b) LE JOIN VERSO `categories` CONFRONTANO IL PROPRIETARIO. Le FK su
-- `category_id` sono a colonna singola e nessuna policy RLS guarda quella
-- colonna: una riga di `budgets` o `recurring_rules` può puntare alla categoria
-- di un ALTRO utente, e questa funzione — SECURITY DEFINER, quindi senza RLS —
-- ne copiava il NOME nel payload della notifica. Impatto basso (serve un UUID
-- altrui, che nessuna schermata espone), ma è la classe che la 20b ha chiuso
-- per i conti.
--   · Per i budget una categoria altrui NON deve diventare "il globale": il
--     client legge `category` NULL come budget globale ("spese variabili"), e
--     una frase falsa su un altro limite è peggio di nessuna. La riga si salta.
--   · Per i rinnovi resta la notifica senza nome ("abbonamento"), come per una
--     regola la cui categoria è stata cancellata (`on delete set null`).
-- La chiusura a regime sono FK composite `(category_id, user_id)`, come per i
-- conti — e richiedono di chiudere prima il debito `categories.user_id`
-- nullable. Resta aperto, dichiarato in CLAUDE.md.
--
-- Il resto è parola per parola la versione della 20260804.

create or replace function public.generate_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	today date := current_date;
begin
	------------------------------------------------------------------
	-- 4a. BUDGET — soglia e sforamento
	------------------------------------------------------------------
	-- Non si può riusare budgets_at(): filtra su auth.uid(), che dal cron è
	-- NULL. Stessa logica in forma insiemistica su tutti gli utenti. DISTINCT ON
	-- raggruppa i NULL, quindi il budget globale è trattato come una categoria
	-- a sé — che è ciò che serve.
	with current_budgets as (
		select distinct on (b.user_id, b.category_id)
			b.user_id,
			b.category_id,
			b.amount,
			public.budget_period_start(b.period, today) as p_start,
			public.budget_period_end(b.period, today)   as p_end
		from public.budgets b
		where b.valid_from <= today
		order by b.user_id, b.category_id, b.valid_from desc
	),
	spending as (
		select
			cb.user_id, cb.category_id, cb.amount, cb.p_start,
			coalesce(sum(t.amount), 0) as spent
		from current_budgets cb
		left join public.transactions t
			on  t.user_id = cb.user_id
			and t.type = 'spesa'
			and t.date >= cb.p_start
			and t.date <  cb.p_end
			and (cb.category_id is null or t.category_id = cb.category_id)
		where cb.amount is not null   -- le "lapidi" sono budget rimossi
		group by cb.user_id, cb.category_id, cb.amount, cb.p_start
	)
	insert into public.notifications (user_id, type, payload, dedup_key, destination)
	select
		s.user_id,
		case when s.spent >= s.amount then 'budget_sforato' else 'budget_soglia' end,
		jsonb_build_object(
			'category', c.name,      -- NULL per il budget globale: lo interpreta il client
			'spent',    s.spent,
			'amount',   s.amount
		),
		case when s.spent >= s.amount then 'budget_sforato:' else 'budget_soglia:' end
			|| coalesce(s.category_id::text, 'globale') || ':' || s.p_start::text,
		'/transazioni'
	from spending s
	-- ⚠️ b) il proprietario: vedi la nota in testa alla sezione.
	left join public.categories c on c.id = s.category_id and c.user_id = s.user_id
	where s.spent >= s.amount * public.budget_warning_threshold()
	  -- una categoria che non è dell'utente non diventa "il globale"
	  and (s.category_id is null or c.id is not null)
	on conflict (user_id, dedup_key) do nothing;

	------------------------------------------------------------------
	-- 4b. OBIETTIVI — 50% e 100%
	------------------------------------------------------------------
	-- Gli obiettivi non hanno tabella propria: sono categorie type='risparmio'
	-- con target_amount, e il risparmiato si somma dalle transazioni (stessa
	-- logica di getGoals). Soglie 50 e 100 e non un avanzamento continuo: un
	-- obiettivo dura mesi, quindi sono due notifiche in tutto. Qui il
	-- proprietario c'è già: si parte dalla categoria e le transazioni si
	-- legano con `t.user_id = c.user_id`.
	with goals as (
		select
			c.user_id, c.id as category_id, c.name, c.target_amount,
			coalesce(sum(t.amount), 0) as saved
		from public.categories c
		left join public.transactions t
			on t.user_id = c.user_id and t.category_id = c.id and t.type = 'risparmio'
		where c.type = 'risparmio'
		  and c.target_amount is not null
		  and c.target_amount > 0
		group by c.user_id, c.id, c.name, c.target_amount
	)
	insert into public.notifications (user_id, type, payload, dedup_key, destination)
	select
		g.user_id,
		'obiettivo_soglia',
		jsonb_build_object(
			'goal',   g.name,
			'saved',  g.saved,
			'target', g.target_amount,
			'pct',    th.pct
		),
		-- Nessun periodo nella chiave: una soglia si attraversa una volta sola
		-- nella vita dell'obiettivo. ⚠️ Ed è proprio per questo che le
		-- notifiche NON si cancellano mai: senza la riga, la chiave tornerebbe
		-- libera e il traguardo verrebbe rinotificato.
		'obiettivo_soglia:' || g.category_id::text || ':' || th.pct::text,
		'/risparmi'
	from goals g
	cross join (values (50), (100)) as th(pct)
	where g.saved >= g.target_amount * th.pct / 100.0
	on conflict (user_id, dedup_key) do nothing;

	------------------------------------------------------------------
	-- 4c. RINNOVO ABBONAMENTO — fino a 3 giorni di anticipo
	------------------------------------------------------------------
	-- Finestra `between today and today + 3` e non `= today + 3`: se il job
	-- salta un giorno l'avviso arriva comunque invece di perdersi, e la dedup lo
	-- tiene singolo.
	--
	-- NB: dal cron il caso `next_run = today` non si presenta, perché
	-- generate_recurring_transactions() ha appena avanzato ogni next_run scaduto.
	-- La finestra resta comunque inclusiva: così la funzione è corretta anche
	-- invocata da sola, senza dipendere in silenzio da chi l'ha preceduta.
	insert into public.notifications (user_id, type, payload, dedup_key, destination)
	select
		r.user_id,
		'abbonamento_rinnovo',
		jsonb_build_object(
			'name',   c.name,
			'amount', r.amount,
			-- ⚠️ a) la DATA del rinnovo, non `next_run − today`: vedi la nota
			-- in testa alla sezione. È la stessa data che sta nella dedup_key.
			'date',   r.next_run
		),
		'abbonamento_rinnovo:' || r.id::text || ':' || r.next_run::text,
		'/impostazioni/ricorrenti'
	from public.recurring_rules r
	-- ⚠️ b) il proprietario: una categoria altrui lascia il nome NULL.
	left join public.categories c on c.id = r.category_id and c.user_id = r.user_id
	where r.active
	  and r.type = 'abbonamento'
	  and r.next_run between today and today + 3
	  and (r.end_date is null or r.end_date >= r.next_run)
	on conflict (user_id, dedup_key) do nothing;

	------------------------------------------------------------------
	-- 4d. CONFERMA GENERAZIONE RICORRENTI
	------------------------------------------------------------------
	-- Gira DOPO generate_recurring_transactions() nella stessa esecuzione,
	-- quindi le righe con created_at di oggi sono quelle appena inserite.
	-- Si filtra su `created_at` e NON su `date`: il ciclo di recupero può
	-- inserire occorrenze arretrate, che hanno data nel passato ma sono state
	-- create adesso.
	--
	-- ⚠️ Solo il CONTEGGIO, nessun totale. Gli importi sono senza segno e la
	-- direzione la porta `type`: sommare uno stipendio da 2000 e un affitto da
	-- 800 darebbe "€ 2800", un numero che non corrisponde a niente di trovabile
	-- nell'app.
	insert into public.notifications (user_id, type, payload, dedup_key, destination)
	select
		t.user_id,
		'ricorrenti_generate',
		jsonb_build_object('count', count(*)),
		'ricorrenti_generate:' || today::text,
		'/transazioni'
	from public.transactions t
	where t.recurring_rule_id is not null
	  and t.created_at >= today
	  and t.created_at <  today + 1
	group by t.user_id
	on conflict (user_id, dedup_key) do nothing;
end;
$$;

revoke all on function public.generate_notifications() from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 5. Le notifiche di rinnovo già scritte: `days` → `date`
-- ----------------------------------------------------------------------------
-- La data non va ricostruita da `created_at + days`: è già scritta, nella
-- `dedup_key` (`abbonamento_rinnovo:<regola>:<YYYY-MM-DD>`, un uuid non contiene
-- `:`). Si legge da lì, e `days` si toglie — tenerlo lascerebbe nel payload
-- proprio il numero che mentiva, a disposizione del prossimo che lo legge.
--
-- Rieseguibile: tocca solo le righe che non hanno ancora `date`. Una chiave
-- che non finisce con una data (non dovrebbe esisterne nessuna) resta com'è, e
-- l'app la mostra senza un tempo invece di inventarne uno.
--
-- ⚠️ `notifications` concede ad `authenticated` l'UPDATE della sola colonna
-- `read` (17b): questo update lo può fare solo il ruolo del SQL Editor, ed è
-- giusto così.

update public.notifications
set payload = (payload - 'days') || jsonb_build_object('date', split_part(dedup_key, ':', 3))
where type = 'abbonamento_rinnovo'
  and not (payload ? 'date')
  and split_part(dedup_key, ':', 3) ~ '^\d{4}-\d{2}-\d{2}$';


-- ============================================================================
-- 6. CONTROPROVA — COMMENTATA DI PROPOSITO, si esegue A PARTE
-- ============================================================================
-- ⚠️⚠️ NON togliere i commenti dentro questo file. Il blocco termina con un
-- `raise exception` deliberato, e il SQL Editor di Supabase esegue lo script
-- come UNA SOLA TRANSAZIONE: lasciato eseguibile qui, quell'eccezione fa
-- rollback anche delle sezioni 1-5, cioè della migration stessa — stampando il
-- messaggio di successo previsto (successo il 2026-08-20 con la `20260817`).
--
-- Si copia in una query NUOVA, si tolgono i `--`, si esegue. Le prove scrivono
-- dentro un blocco che finisce in rollback: niente resta nel database.
--
-- do $$
-- declare
-- 	v_user    uuid;
-- 	v_account uuid;
-- 	v_ok      boolean;
-- 	v_n       int;
-- 	v_cat     uuid;
-- 	v_own     uuid;
-- 	v_rule    uuid;
-- 	v_payload jsonb;
-- 	r         text := '';
-- begin
-- 	select a.user_id, a.id into v_user, v_account
-- 	from public.accounts a order by a.created_at limit 1;
-- 	if v_user is null then
-- 		raise exception 'COLLAUDO #123 — SALTATO: nessun conto nel database.';
-- 	end if;
--
-- 	-- a1 · un importo valido si scrive (la prova che le altre falliscono per
-- 	--      il vincolo e non per un insert sbagliato in sé)
-- 	insert into public.transactions (user_id, account_id, amount, type, date)
-- 	values (v_user, v_account, 1, 'spesa', now());
-- 	r := r || E'\n  a1 OK  — importo 1 accettato';
--
-- 	-- b1 · importo zero rifiutato
-- 	v_ok := false;
-- 	begin
-- 		insert into public.transactions (user_id, account_id, amount, type, date)
-- 		values (v_user, v_account, 0, 'spesa', now());
-- 	exception when check_violation then v_ok := true;
-- 	end;
-- 	if v_ok then r := r || E'\n  b1 OK  — importo 0 RIFIUTATO';
-- 	else raise exception 'COLLAUDO #123 — b1 FALLITA: accettato un importo 0.%', r;
-- 	end if;
--
-- 	-- b2 · importo negativo rifiutato — il caso che faceva salire il saldo
-- 	v_ok := false;
-- 	begin
-- 		insert into public.transactions (user_id, account_id, amount, type, date)
-- 		values (v_user, v_account, -50, 'spesa', now());
-- 	exception when check_violation then v_ok := true;
-- 	end;
-- 	if v_ok then r := r || E'\n  b2 OK  — importo -50 RIFIUTATO';
-- 	else raise exception 'COLLAUDO #123 — b2 FALLITA: accettato un importo negativo.%', r;
-- 	end if;
--
-- 	-- b3 · tipo mancante rifiutato
-- 	v_ok := false;
-- 	begin
-- 		insert into public.transactions (user_id, account_id, amount, type, date)
-- 		values (v_user, v_account, 1, null, now());
-- 	exception when not_null_violation then v_ok := true;
-- 	end;
-- 	if v_ok then r := r || E'\n  b3 OK  — tipo NULL RIFIUTATO';
-- 	else raise exception 'COLLAUDO #123 — b3 FALLITA: accettato un tipo NULL.%', r;
-- 	end if;
--
-- 	-- b4 · regola ricorrente da importo zero rifiutata
-- 	v_ok := false;
-- 	begin
-- 		insert into public.recurring_rules
-- 			(user_id, account_id, amount, type, frequency, start_date, next_run)
-- 		values (v_user, v_account, 0, 'spesa', 'mensile', current_date, current_date + 30);
-- 	exception when check_violation then v_ok := true;
-- 	end;
-- 	if v_ok then r := r || E'\n  b4 OK  — regola da 0 RIFIUTATA';
-- 	else raise exception 'COLLAUDO #123 — b4 FALLITA: accettata una regola da 0.%', r;
-- 	end if;
--
-- 	-- c1 · nessuna notifica di rinnovo è rimasta con `days` o senza `date`
-- 	select count(*) into v_n from public.notifications
-- 	where type = 'abbonamento_rinnovo' and (payload ? 'days' or not payload ? 'date');
-- 	if v_n = 0 then r := r || E'\n  c1 OK  — ogni rinnovo porta la data, nessuno la distanza';
-- 	else raise exception 'COLLAUDO #123 — c1 FALLITA: % rinnovi ancora con days o senza date.%', v_n, r;
-- 	end if;
--
-- 	-- c2 · le due funzioni sono quelle nuove
-- 	if pg_get_functiondef('public.generate_recurring_transactions()'::regprocedure) ~* 'skip\s+locked'
-- 	   and pg_get_functiondef('public.generate_notifications()'::regprocedure) ~* 'c\.user_id\s*=\s*r\.user_id'
-- 	then r := r || E'\n  c2 OK  — skip locked nel job, proprietario nelle join';
-- 	else raise exception 'COLLAUDO #123 — c2 FALLITA: le funzioni non sono quelle della 20260821.%', r;
-- 	end if;
--
-- 	-- c3 + c4 · la categoria di un ALTRO utente. ⚠️ Sono le prove che contano
-- 	-- per la sezione 4b: le FK su `category_id` sono a colonna singola, quindi
-- 	-- questi insert PASSANO, ed è il job a dover non fidarsi. Servono due utenti:
-- 	-- senza, dicono SALTATA invece di tacere.
-- 	select c.id into v_cat from public.categories c
-- 	where c.user_id is not null and c.user_id <> v_user limit 1;
-- 	if v_cat is null then
-- 		r := r || E'\n  c3 SALTATA — serve una categoria di un SECONDO utente';
-- 		r := r || E'\n  c4 SALTATA — idem';
-- 	else
-- 		-- c3 · rinnovo fra due giorni su una regola con la categoria altrui:
-- 		--      la notifica nasce, con la DATA e senza il nome dell'altro
-- 		insert into public.recurring_rules
-- 			(user_id, account_id, amount, type, category_id, frequency, start_date, next_run)
-- 		values (v_user, v_account, 9.99, 'abbonamento', v_cat, 'mensile', current_date + 2, current_date + 2)
-- 		returning id into v_rule;
--
-- 		-- c4 · budget sforato sulla categoria altrui: niente notifica, e
-- 		--      soprattutto niente "Limite sulle spese variabili superato"
-- 		insert into public.budgets (user_id, category_id, period, amount, valid_from)
-- 		values (v_user, v_cat, 'mensile', 1, public.budget_period_start('mensile', current_date));
-- 		insert into public.transactions (user_id, account_id, amount, type, category_id, date)
-- 		values (v_user, v_account, 5, 'spesa', v_cat, now());
--
-- 		-- Il gemello su una categoria PROPRIA, che la notifica la deve produrre:
-- 		-- senza, c4 passerebbe anche se il ramo dei budget non scattasse affatto.
-- 		insert into public.categories (user_id, name, icon, color, type)
-- 		values (v_user, 'Collaudo 123', 'ShoppingCart', 'aka', 'spesa')
-- 		returning id into v_own;
-- 		insert into public.budgets (user_id, category_id, period, amount, valid_from)
-- 		values (v_user, v_own, 'mensile', 1, public.budget_period_start('mensile', current_date));
-- 		insert into public.transactions (user_id, account_id, amount, type, category_id, date)
-- 		values (v_user, v_account, 5, 'spesa', v_own, now());
--
-- 		-- ⚠️ genera per TUTTI gli utenti: il rollback finale lo annulla
-- 		perform public.generate_notifications();
--
-- 		select payload into v_payload from public.notifications
-- 		where user_id = v_user
-- 		  and dedup_key = 'abbonamento_rinnovo:' || v_rule || ':' || (current_date + 2);
-- 		if v_payload is null then
-- 			raise exception 'COLLAUDO #123 — c3 FALLITA: nessuna notifica di rinnovo generata.%', r;
-- 		elsif v_payload ->> 'name' is not null then
-- 			raise exception 'COLLAUDO #123 — c3 FALLITA: copiato il nome di una categoria altrui (%).%', v_payload ->> 'name', r;
-- 		elsif v_payload ->> 'date' is distinct from (current_date + 2)::text or v_payload ? 'days' then
-- 			raise exception 'COLLAUDO #123 — c3 FALLITA: payload %.%', v_payload, r;
-- 		end if;
-- 		r := r || E'\n  c3 OK  — rinnovo con la data, senza il nome della categoria altrui';
--
-- 		select count(*) into v_n from public.notifications
-- 		where user_id = v_user and dedup_key like 'budget_sforato:' || v_own || ':%'
-- 		  and payload ->> 'category' = 'Collaudo 123';
-- 		if v_n <> 1 then
-- 			raise exception 'COLLAUDO #123 — c4 NON DIMOSTRATIVA: il budget sulla categoria propria non ha prodotto la notifica (%).%', v_n, r;
-- 		end if;
--
-- 		select count(*) into v_n from public.notifications
-- 		where user_id = v_user and dedup_key like 'budget_%:' || v_cat || ':%';
-- 		if v_n = 0 then r := r || E'\n  c4 OK  — budget altrui ignorato, il gemello proprio notificato';
-- 		else raise exception 'COLLAUDO #123 — c4 FALLITA: % notifiche sul budget altrui.%', v_n, r;
-- 		end if;
-- 	end if;
--
-- 	raise exception 'COLLAUDO #123 — TUTTE LE PROVE SUPERATE, niente è stato scritto.%', r;
-- end $$;
--
-- ⚠️ La concorrenza del job (sezione 3) NON si prova da qui: servono due
-- sessioni che si sovrappongano, e il SQL Editor ne ha una. Si prova dall'app,
-- con due chiamate RPC in parallelo su una regola con molti arretrati.
