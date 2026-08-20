-- ============================================================================
-- Disinvestimento — vendere diventa esprimibile (issue #52)
-- ============================================================================
-- ⚠️ ESEGUIRE PRIMA di pubblicare il codice, e l'asimmetria è pulita:
--
--   · codice nuovo su database vecchio → il form manda `type='disinvestimento'`,
--     `transactions_type_check` lo rifiuta, e ogni vendita fallisce.
--   · database nuovo su codice vecchio → **non succede niente**. Nessuno scrive
--     quel tipo, quindi il nuovo ramo di `account_balances` somma zero righe e
--     il CHECK allargato non cambia il comportamento di alcuna riga esistente.
--
-- Un ordine solo, nessuna nota da rileggere il giorno in cui l'app avrà utenti
-- veri. È la stessa asimmetria della `20260815`.
--
-- ----------------------------------------------------------------------------
-- Il difetto
-- ----------------------------------------------------------------------------
-- `investimento` è a senso unico: toglie denaro dal conto e alimenta il totale
-- di `/investimenti`. Il movimento inverso non esiste, quindi chi vende un ETF
-- non ha modo di dirlo — il saldo del conto resta più basso del reale per
-- sempre, e il capitale versato **cresce e non cala mai**.
--
-- Misurato sui dati veri dell'import Trade Republic (Fase 21): versato
-- € 3.578,50, vendite € 881,31. Senza questo tipo l'app dichiara 3.578,50 di
-- capitale versato per un portafoglio da cui ne sono già usciti 881,31.
--
-- ⚠️ L'import non ha creato il buco, lo ha reso visibile — stesso schema della
-- issue #43, dove scrivere la fotografia dello schema ha reso leggibile una
-- registrazione rotta da cinque settimane.
--
-- ----------------------------------------------------------------------------
-- L'audit dei consumatori, che è ciò che rende sicuro un settimo tipo
-- ----------------------------------------------------------------------------
-- Rifatto per intero prima di scrivere una riga, come per la 20a e la 20b.
-- Sedici consumatori di `transactions`; NESSUNO somma "tutto ciò che c'è":
--
--   invisibili per costruzione (filtrano per nomi espliciti)
--     · sommaUscite()          spesa, abbonamento      → il Flusso non si muove
--     · entrate del Flusso     entrata
--     · dashboard_totals()     raggruppa, l'app legge per nome
--     · trend /analisi         .in su cinque nomi
--     · torta spese, budget    spesa
--     · uscite fisse           abbonamento
--     · getGoals ×3            risparmio
--     · generate_notifications budget / obiettivo / abbonamento
--     · deleteCategory         per category_id
--
--   da cambiare, e sono esattamente quelli che DEVONO cambiare
--     · account_balances       ← questa migration, sezione 2
--     · getInvestments         ← codice
--     · amountSign()           ← codice
--     · TransactionForm        ← codice (categoria presa in prestito)
--
-- ⚠️ **Il disinvestimento NON entra nel Flusso**, ed è la stessa premessa per
-- cui non ci entra l'investimento: "Flusso" è entrate − uscite, cioè quanto è
-- entrato e uscito dal PATRIMONIO. Vendere un ETF non è guadagnare, è riportare
-- a casa capitale proprio. Se entrasse, l'app affermerebbe un guadagno per un
-- gesto che non lo è — e sarebbe la trappola già evitata scartando `entrata`
-- come scorciatoia nella Fase 21.
--
-- ----------------------------------------------------------------------------
-- Cosa fa, in ordine
-- ----------------------------------------------------------------------------
--   1. `disinvestimento` in transactions_type_check
--   2. `account_balances` — il disinvestimento AUMENTA il saldo
--   3. perché NON serve un CHECK nuovo su to_account_id
--   4. perché `recurring_rules` resta fuori
--   5. controprova
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. `disinvestimento` in transactions_type_check
-- ----------------------------------------------------------------------------
-- ⚠️ Le tre tabelle con un vocabolario di tipi restano DELIBERATAMENTE
-- disallineate, e vale la pena scriverlo o alla prossima rilettura sembrerà una
-- dimenticanza — che è precisamente il difetto della #47, dove
-- `transactions_type_check` non ammetteva `abbonamento` mentre le sorelle sì:
--
--   · transactions      + disinvestimento   (un movimento reale)
--   · categories        NIENTE              (vedi sotto)
--   · recurring_rules   NIENTE              (sezione 4)
--
-- Una CATEGORIA `disinvestimento` non deve esistere: una vendita usa la
-- categoria dell'INVESTIMENTO che liquida — vendi "ETF", non "disinvestimento
-- ETF" — o le due righe non si compenserebbero sulla stessa posizione. È il
-- punto in cui si rompe l'accoppiamento 1:1 fra tipo di movimento e tipo di
-- categoria, e si rompe nel verso OPPOSTO al trasferimento: quello la categoria
-- non ce l'ha affatto, questo la prende in prestito da un altro tipo.

alter table public.transactions drop constraint if exists transactions_type_check;

alter table public.transactions add constraint transactions_type_check
	check (
		type::text = any (
			array[
				'entrata', 'spesa', 'investimento', 'disinvestimento',
				'risparmio', 'abbonamento', 'trasferimento'
			]::text[]
		)
	);


-- ----------------------------------------------------------------------------
-- 2. account_balances — il disinvestimento AUMENTA il saldo
-- ----------------------------------------------------------------------------
-- ⚠️ **È la modifica più consequenziale dell'intera issue.** La vista sottrae
-- tutto ciò che non è `entrata`: senza toccarla, registrare una vendita
-- ABBASSEREBBE il conto invece di alzarlo — il difetto opposto a quello che
-- questa migration esiste per chiudere, e per giunta silenzioso, perché nessun
-- vincolo lo segnalerebbe.
--
-- Perché il saldo sale, e non è ovvio: nel modello di Seichi il denaro investito
-- ESCE dal conto (la Fase 20 lo ha deciso in chiaro — il saldo di un conto
-- titoli è la sua *liquidità non investita*, il capitale versato vive solo in
-- `/investimenti`, e sono due dimensioni che possono divergere senza che una
-- delle due sia sbagliata). Vendere è il ritorno di quel denaro nella
-- liquidità: il conto sale, il capitale versato scende.
--
-- ⚠️ Da qui anche perché una vendita **non** ha `to_account_id`: vedi sezione 3.

create or replace view public.account_balances
with (security_invoker = true)
as
with movimenti as (
	-- ciò che ESCE dal conto di origine — o vi ENTRA, se è denaro che rientra.
	--
	-- ⚠️ `disinvestimento` sta accanto a `entrata` e non è un'assimilazione
	-- concettuale: le due cose restano diverse ovunque altro (una è reddito ed
	-- entra nel Flusso, l'altra è capitale proprio che torna e non ci entra).
	-- Qui coincidono solo perché la domanda è una sola — *questo denaro si
	-- aggiunge alla giacenza del conto?* — e la risposta è sì per entrambe.
	select
		t.account_id as acct,
		case
			when t.type::text in ('entrata', 'disinvestimento') then t.amount
			else -t.amount
		end as delta
	from public.transactions t

	union all

	-- ciò che ENTRA nel conto di destinazione
	select
		t.to_account_id as acct,
		t.amount as delta
	from public.transactions t
	where t.to_account_id is not null
)
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
	(a.initial_balance + coalesce(sum(m.delta), 0))::numeric(12,2) as balance
from public.accounts a
left join movimenti m on m.acct = a.id
group by a.id;

-- ⚠️ `numeric(12,2)` e non `(10,2)` come la colonna: una somma può superare le
-- dieci cifre anche quando nessun importo singolo lo fa, e il cast la farebbe
-- fallire.

revoke all    on public.account_balances from public, anon;
grant  select on public.account_balances to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Nessun CHECK nuovo su to_account_id — ed è già garantito
-- ----------------------------------------------------------------------------
-- `transactions_dest_type_check` (20260815) dice:
--
--     to_account_id is null
--     or type in ('trasferimento', 'risparmio', 'investimento')
--
-- `disinvestimento` non è in quella lista, quindi una destinazione su una
-- vendita è **già rifiutata dal database** senza aggiungere nulla. Il vincolo
-- scritto per altri motivi copre questo caso da sé, e la controprova (b1) lo
-- verifica invece di darlo per buono.
--
-- Perché è la forma GIUSTA e non solo quella comoda: su un `investimento`
-- `account_id` è il conto da cui il denaro ESCE, e `to_account_id` è dove
-- eventualmente si posa. Su una vendita il denaro ARRIVA, quindi `account_id`
-- è già la destinazione: un secondo conto sarebbe un terzo soggetto senza
-- significato.
--
-- ⚠️ E la destinazione facoltativa su `risparmio`/`investimento` esiste per
-- impedire un DOPPIO CONTEGGIO — lo stesso atto esprimibile in due modi, con
-- chi li facesse entrambi che vede uscire il doppio. Qui quella collisione non
-- esiste: vendere su Trade Republic e portare il contante sul Corrente sono due
-- eventi reali e SEQUENZIALI, non due modi alternativi di dire la stessa cosa.
-- Si scrivono come `disinvestimento` + `trasferimento`, e il saldo torna.


-- ----------------------------------------------------------------------------
-- 4. `recurring_rules` resta fuori, deliberatamente
-- ----------------------------------------------------------------------------
-- `recurring_rules_type_check` NON acquisisce `disinvestimento`, quindi un piano
-- di decumulo automatico non è esprimibile. È una scelta, non una svista:
--
--   · una vendita ricorrente esiste come prodotto (piano di decumulo) ma è raro,
--     e nessuno dei dati veri di questo progetto ne contiene una;
--   · ammetterla allargherebbe la superficie da collaudare a
--     `generate_recurring_transactions()`, che copia il tipo sulla transazione
--     generata, senza un caso d'uso che lo chieda.
--
-- Aggiungerla dopo costa una riga di CHECK e nessun backfill — al contrario di
-- una colonna, che va messa subito. Se servirà, sarà una decisione presa in
-- chiaro invece di una conseguenza scivolata dentro adesso.


-- ============================================================================
-- 5. CONTROPROVA — COMMENTATA DI PROPOSITO, si esegue A PARTE
-- ============================================================================
-- ⚠️⚠️ NON togliere i commenti dentro questo file. Il blocco termina con un
-- `raise exception` deliberato, e il SQL Editor di Supabase esegue lo script
-- come UNA SOLA TRANSAZIONE: lasciato eseguibile qui, quell'eccezione fa
-- rollback anche delle sezioni 1 e 2, cioè **della migration stessa**.
--
-- Il sintomo è ingannevole e vale registrarlo: l'editor stampa
-- `ROLLBACK VOLUTO — tutte le prove superate`, che sembra il messaggio di
-- successo previsto, mentre in realtà è appena stato annullato tutto. È successo
-- il 2026-08-20, alla prima esecuzione di questo file.
--
-- Si copia il blocco qui sotto in una query NUOVA, si tolgono i `--`, si esegue.
-- Stessa forma della controprova della `20260815`, che era già commentata per
-- questa ragione — averla ricopiata come codice vivo è stato l'errore.
--
-- ⚠️ Perché non basta togliere il `raise exception` finale: le prove SCRIVONO
-- righe vere su un database di produzione. L'eccezione garantisce insieme due
-- cose — che il referto si veda (l'editor mostra sempre l'errore, i `notice`
-- no) e che nulla resti scritto. Un collaudo che per essere letto deve poter
-- committare non è un collaudo.
--
-- La regola già scritta per la #47 e ripetuta dalla 20b: *un registro di guasti
-- non è collaudato finché non ha registrato un guasto*. Le prove che contano
-- sono quelle che devono FALLIRE — solo righe verdi non distinguono "funziona"
-- da "non ha guardato".

--   do $$
--   declare
--   	v_user   uuid;
--   	v_acct   uuid;
--   	v_acct2  uuid;
--   	v_cat    uuid;
--   	v_bal0   numeric;
--   	v_bal1   numeric;
--   	v_bal2   numeric;
--   	v_ok     boolean;
--   begin
--   	select id into v_user from auth.users order by created_at limit 1;
--   	if v_user is null then
--   		raise notice 'SALTATA — nessun utente nel database.';
--   		return;
--   	end if;
--
--   	select id into v_acct from public.accounts
--   		where user_id = v_user and not archived order by created_at limit 1;
--   	select id into v_acct2 from public.accounts
--   		where user_id = v_user and not archived and id <> v_acct order by created_at limit 1;
--   	select id into v_cat from public.categories
--   		where user_id = v_user and type::text = 'investimento' limit 1;
--
--   	if v_acct is null then
--   		raise notice 'SALTATA — l''utente non ha conti attivi.';
--   		return;
--   	end if;
--
--   	select balance into v_bal0 from public.account_balances where id = v_acct;
--   	raise notice 'saldo di partenza: %', v_bal0;
--
--   	-- ---- a1 · un disinvestimento AUMENTA il saldo -------------------------
--   	insert into public.transactions (user_id, account_id, category_id, amount, type, date, notes)
--   	values (v_user, v_acct, v_cat, 100, 'disinvestimento', now(), 'controprova #52');
--
--   	select balance into v_bal1 from public.account_balances where id = v_acct;
--   	if v_bal1 = v_bal0 + 100 then
--   		raise notice 'a1 OK — il saldo sale di 100 (% → %)', v_bal0, v_bal1;
--   	else
--   		raise exception 'a1 FALLITA — atteso %, trovato %', v_bal0 + 100, v_bal1;
--   	end if;
--
--   	-- ---- a2 · investimento e disinvestimento si annullano sul saldo -------
--   	insert into public.transactions (user_id, account_id, category_id, amount, type, date, notes)
--   	values (v_user, v_acct, v_cat, 100, 'investimento', now(), 'controprova #52');
--
--   	select balance into v_bal2 from public.account_balances where id = v_acct;
--   	if v_bal2 = v_bal0 then
--   		raise notice 'a2 OK — comprare e vendere 100 riporta il saldo a % ', v_bal2;
--   	else
--   		raise exception 'a2 FALLITA — atteso %, trovato %', v_bal0, v_bal2;
--   	end if;
--
--   	-- ---- b1 · una vendita NON può avere un conto di destinazione ----------
--   	-- Nessun vincolo nuovo lo impone: lo fa `transactions_dest_type_check`
--   	-- della 20260815, e questa prova è ciò che lo dimostra invece di dedurlo.
--   	if v_acct2 is null then
--   		raise notice 'b1 SALTATA — serve un secondo conto attivo.';
--   	else
--   		v_ok := false;
--   		begin
--   			insert into public.transactions
--   				(user_id, account_id, to_account_id, category_id, amount, type, date, notes)
--   			values (v_user, v_acct, v_acct2, v_cat, 50, 'disinvestimento', now(), 'controprova #52');
--   		exception when check_violation then
--   			v_ok := true;
--   		end;
--   		if v_ok then
--   			raise notice 'b1 OK — destinazione su un disinvestimento RIFIUTATA, come deve';
--   		else
--   			raise exception 'b1 FALLITA — il database ha accettato una vendita con to_account_id';
--   		end if;
--   	end if;
--
--   	-- ---- b2 · un tipo inventato resta rifiutato --------------------------
--   	-- Allargare un CHECK non deve trasformarlo in "qualsiasi stringa".
--   	v_ok := false;
--   	begin
--   		insert into public.transactions (user_id, account_id, category_id, amount, type, date, notes)
--   		values (v_user, v_acct, v_cat, 10, 'disinvestimentoo', now(), 'controprova #52');
--   	exception when check_violation then
--   		v_ok := true;
--   	end;
--   	if v_ok then
--   		raise notice 'b2 OK — un tipo non previsto resta RIFIUTATO';
--   	else
--   		raise exception 'b2 FALLITA — il CHECK accetta tipi arbitrari';
--   	end if;
--
--   	raise exception 'ROLLBACK VOLUTO — tutte le prove superate, niente è stato scritto.';
--   end $$;

-- Il blocco termina SEMPRE con un'eccezione: è il modo di non lasciare righe di
-- prova in un database con dati veri. Vedere
--   ERROR: ROLLBACK VOLUTO — tutte le prove superate
-- significa che è andato tutto bene. Qualsiasi altro messaggio è un guasto vero.
