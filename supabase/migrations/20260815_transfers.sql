-- ============================================================================
-- Fase 20b — trasferimenti fra conti (issue #49)
-- ============================================================================
-- ⚠️ ESEGUIRE DOPO `20260814_accounts.sql`, che crea `accounts` e la vista
-- `account_balances` su cui questo file interviene.
--
-- Progetto e motivazioni: CLAUDE.md → "Fase 20 — conti multipli e trasferimenti".
--
-- ----------------------------------------------------------------------------
-- Ordine di deploy: migration PRIMA del codice, e stavolta senza conflitti
-- ----------------------------------------------------------------------------
-- La 20a aveva due modifiche che volevano ordini opposti e nessun ordine buono.
-- Qui non succede, ed è utile sapere perché invece di ricopiare la cautela:
--
--   · codice nuovo su database vecchio → il form manda `type='trasferimento'`,
--     `transactions_type_check` lo rifiuta, e ogni trasferimento fallisce.
--   · database nuovo su codice vecchio → **non succede niente**. `to_account_id`
--     è nullable e nessuno la scrive; il termine in entrata della vista somma
--     zero righe; le FK composite sostituiscono quella a una colonna senza che
--     nessun chiamante se ne accorga.
--
-- Asimmetria pulita, quindi un ordine solo e nessuna nota da rileggere il giorno
-- in cui l'app avrà utenti veri.
--
-- ----------------------------------------------------------------------------
-- Cosa fa, in ordine
-- ----------------------------------------------------------------------------
--   1. `transactions.to_account_id` + indice (la FK sta nella 4: è composita)
--   2. `trasferimento` in `transactions_type_check`
--   3. i quattro CHECK che rendono irrappresentabile il mezzo trasferimento
--   4. FK composite: la proprietà del conto smette di essere applicativa
--      (chiude il debito lasciato aperto dalla 20a)
--   5. `account_balances` — il termine in entrata
--   6. controprova
-- ============================================================================


-- ----------------------------------------------------------------------------
-- GUARDIA — questo file non va più rieseguito
-- ----------------------------------------------------------------------------
-- La sezione 5 ricrea `account_balances` con la formula in cui **solo `entrata`
-- somma in positivo**. Dalla `20260817` non è più vero: anche `disinvestimento`
-- aggiunge alla giacenza, perché è capitale che rientra nel conto.
--
-- ⚠️ Rieseguire questo file dopo la `20260817` NON darebbe alcun errore: un
-- `create or replace view` compatibile riesce benissimo, e il risultato sarebbe
-- che ogni vendita torna a ABBASSARE il saldo — in silenzio, su dati veri, con
-- la causa illeggibile mesi dopo. È esattamente la classe che le guardie della
-- `20260727`, `20260728` e `20260809` esistono per intercettare, e vale la
-- regola che ne discende: **il file più recente dev'essere autosufficiente**,
-- così non c'è mai motivo di tornare indietro.

do $$
begin
	if exists (
		select 1
		from pg_views
		where schemaname = 'public'
		  and viewname   = 'account_balances'
		  and definition ilike '%disinvestimento%'
	) then
		raise exception
			'STOP: la 20260817 è già stata eseguita. Questo file ricrea account_balances senza il termine `disinvestimento`, quindi ogni vendita tornerebbe ad abbassare il saldo invece di alzarlo — senza alcun errore. Su un database allineato non ha nulla da fare.';
	end if;
end $$;


-- ----------------------------------------------------------------------------
-- 1. transactions.to_account_id
-- ----------------------------------------------------------------------------
-- UNA riga per un trasferimento, non due: `account_id` è l'origine,
-- `to_account_id` la destinazione.
--
-- L'alternativa — due righe legate da un `transfer_group_id` — è quella che
-- questo progetto ha già scartato tre volte con lo stesso ragionamento: niente
-- `valid_to` sui budget, nessuna colonna `spent`, nessun `saved_amount`
-- memorizzato. Due righe per un evento sono due punti di scrittura da tenere
-- allineati, e basta cancellarne una per ottenere **mezzo trasferimento**: una
-- somma che sparisce da un conto senza comparire nell'altro, senza alcun errore
-- e senza che nulla lo segnali.
--
-- Nullable, e non è una concessione: la stragrande maggioranza delle
-- transazioni non ha destinazione. È il CHECK della sezione 3 a dire *quando*
-- deve esserci.
--
-- ⚠️ **La FK non è qui, è nella sezione 4**, e non per gusto di ordinamento: è
-- composita `(to_account_id, user_id)`, quindi ha bisogno del vincolo di unicità
-- `accounts (id, user_id)` che nasce là. Crearne una a una colonna qui e
-- sostituirla trenta righe dopo lascerebbe nel file una versione che non è mai
-- stata la verità — e chi lo legge per capire com'è fatto il database si
-- fermerebbe alla prima.
--
-- La regola che ne discende resta quella della 20a: `on delete no action`, mai
-- `cascade`. Un conto che ha RICEVUTO denaro non si cancella, si archivia. La
-- cascade su `categories` è deliberata perché serve a eliminare un obiettivo;
-- qui cancellerebbe movimenti reali.

alter table public.transactions add column if not exists to_account_id uuid;

-- ⚠️ L'indice non serve alle SELECT — serve alla verifica di integrità che
-- Postgres esegue a ogni tentativo di cancellare un conto. Senza, quel controllo
-- scandisce l'intera tabella. È la stessa ragione per cui la #43 ha aggiunto gli
-- indici sulle FK esistenti, che nessuna query applicativa usava.
create index if not exists transactions_to_account_id_idx
	on public.transactions (to_account_id)
	where to_account_id is not null;


-- ----------------------------------------------------------------------------
-- 2. `trasferimento` in transactions_type_check
-- ----------------------------------------------------------------------------
-- ⚠️ Questa versione è AUTOSUFFICIENTE rispetto alla `20260810_recurring_fixes`,
-- che aveva aggiunto `abbonamento`: il file più recente deve contenere tutto,
-- così non c'è mai motivo di tornare indietro a rieseguire un file superato.
--
-- ⚠️ `categories_type_check` e `recurring_rules_type_check` NON acquisiscono
-- `trasferimento`, e **la divergenza è deliberata** — al contrario di quella che
-- è costata cinque settimane alla #47, dove le tre tabelle dicevano cose diverse
-- sulla stessa realtà senza che nessun file lo registrasse. Qui i motivi sono
-- due e sono strutturali:
--
--   · un trasferimento NON HA categoria per costruzione (terzo CHECK della
--     sezione 3), quindi una categoria di tipo `trasferimento` non potrebbe mai
--     essere scelta da nessuno;
--   · una regola ricorrente di trasferimento è fuori scopo per questa fase. Il
--     giorno in cui servisse ("ogni mese 200 € dal corrente al libretto") è una
--     decisione nuova, non un allineamento dimenticato.
--
-- Sta scritto qui perché alla rilettura del catalogo i tre vincoli appariranno
-- di nuovo disallineati, ed è esattamente il momento in cui serve sapere se è
-- una scelta o una svista.

alter table public.transactions drop constraint if exists transactions_type_check;

alter table public.transactions add constraint transactions_type_check
	check (
		type::text = any (
			array[
				'entrata', 'spesa', 'investimento',
				'risparmio', 'abbonamento', 'trasferimento'
			]::text[]
		)
	);


-- ----------------------------------------------------------------------------
-- 3. I quattro CHECK — lo stato illegale diventa irrappresentabile
-- ----------------------------------------------------------------------------
-- Con una riga sola non basta *evitare* il mezzo trasferimento: il database deve
-- renderlo impossibile, o la garanzia torna a dipendere dall'attenzione di chi
-- scrive la prossima server action.

alter table public.transactions drop constraint if exists transactions_dest_type_check;
alter table public.transactions drop constraint if exists transactions_transfer_dest_check;
alter table public.transactions drop constraint if exists transactions_transfer_category_check;
alter table public.transactions drop constraint if exists transactions_dest_distinct_check;

-- (a) Chi può avere una destinazione.
--
-- ⚠️ `risparmio` e `investimento` ci sono, ed è la collisione che il progetto non
-- aveva mai dovuto affrontare. Oggi quei due tipi TOLGONO denaro dal saldo e non
-- lo mettono da nessuna parte. Con i conti, mettere 200 € da parte diventa
-- esprimibile due volte — una transazione `risparmio` verso un obiettivo OPPURE
-- un trasferimento verso il conto "Libretto" — e chi facesse entrambi vedrebbe
-- uscire 400 € dal corrente.
--
-- Con la destinazione facoltativa su quei due tipi, un versamento verso
-- l'obiettivo "Vacanza" può dire anche "i soldi sono finiti sul Libretto":
-- avanza l'obiettivo E sposta il denaro, in un gesto solo. Il doppio conteggio
-- diventa impossibile, non sconsigliato.
alter table public.transactions add constraint transactions_dest_type_check
	check (
		to_account_id is null
		or type::text = any (array['trasferimento', 'risparmio', 'investimento']::text[])
	);

-- (b) Un trasferimento senza destinazione è denaro che esce da un conto e non
--     arriva da nessuna parte: è la metà di riga che l'intero modello esiste per
--     impedire.
alter table public.transactions add constraint transactions_transfer_dest_check
	check (type::text <> 'trasferimento' or to_account_id is not null);

-- (c) Un trasferimento non ha categoria.
--
-- ⚠️ Qui si rompe l'accoppiamento 1:1 fra tipo di transazione e tipo di
-- categoria su cui l'app si è appoggiata fino alla 20a (`TransactionForm` filtra
-- le categorie con `.eq("type", selectedType.id)`). È il punto di rottura, ed è
-- stato deciso in progettazione invece di essere scoperto a metà
-- implementazione: nel form il selettore categoria lascia il posto al conto di
-- destinazione.
alter table public.transactions add constraint transactions_transfer_category_check
	check (type::text <> 'trasferimento' or category_id is null);

-- (d) Origine e destinazione diverse.
--
-- ⚠️ Questo CHECK confronta gli id, NON la proprietà: da solo non impedisce di
-- puntare al conto di un altro utente. Quel controllo è la sezione 4.
alter table public.transactions add constraint transactions_dest_distinct_check
	check (to_account_id is null or to_account_id <> account_id);


-- ----------------------------------------------------------------------------
-- 4. La proprietà del conto smette di essere applicativa (debito della 20a)
-- ----------------------------------------------------------------------------
-- La 20a difendeva `account_id` con `assertOwnAccount()`: una query prima di ogni
-- salvataggio. **Le policy RLS non lo coprono** — filtrano su `user_id`, che lo
-- scrive il server, e nessuna guarda `account_id`: una POST costruita a mano può
-- attaccare un movimento al conto di un altro utente.
--
-- ⚠️ E finché è applicativo, ogni futuro scrittore di `transactions` deve
-- RICORDARSI di chiamarlo. `updateRecurringRule` già non lo fa. Un vincolo rende
-- lo stato illegale irrappresentabile invece che vietato per attenzione, che è
-- la preferenza dichiarata di tutta questa fase — e toglie una query dal
-- percorso caldo di ogni salvataggio.

-- ⚠️ `transactions.user_id` NOT NULL è un PREREQUISITO, non un extra di
-- contorno. Una FK composita usa per default `MATCH SIMPLE`, dove **basta una
-- colonna NULL perché l'intero vincolo non venga verificato**: con `user_id`
-- NULL, `account_id` tornerebbe libero di puntare a qualsiasi conto — cioè una
-- garanzia PIÙ DEBOLE della FK a una colonna che sta sostituendo. Il debito era
-- già dichiarato in CLAUDE.md ("il DB permette uno stato che l'app dà per
-- impossibile"); qui smette di essere teorico e va chiuso.
do $$
declare
	v_orfane int;
begin
	select count(*) into v_orfane from public.transactions where user_id is null;
	if v_orfane > 0 then
		raise exception
			'% transazioni con user_id NULL: nessun utente a cui appartengono, e la FK composita non potrebbe verificarle. Assegnare un user_id o rimuoverle, poi rieseguire.',
			v_orfane
			using errcode = 'not_null_violation';
	end if;
end $$;

alter table public.transactions alter column user_id set not null;

-- Il bersaglio della FK composita. Una FK può riferirsi solo a colonne coperte
-- da un vincolo di unicità: `id` da solo è la primary key, `(id, user_id)` no.
--
-- Ridondante in senso stretto — `id` è già unico, quindi la coppia lo è per
-- forza — ma è la ridondanza che permette al database di esprimere
-- "quell'account_id appartiene a QUESTO utente" come vincolo invece che come
-- controllo.
-- ⚠️ **I DIPENDENTI SI TOLGONO PRIMA**, e questa riga esiste per un errore vero:
-- alla prima stesura il `drop constraint if exists accounts_id_user_key` stava
-- da solo, e la seconda esecuzione del file moriva con
--
--   2BP01: cannot drop constraint accounts_id_user_key on table accounts
--          because other objects depend on it
--   DETAIL: constraint transactions_account_owner_fkey … depends on index …
--
-- La lezione, e vale per ogni migration futura: **`drop … if exists` NON è
-- idempotenza.** Un vincolo con dipendenti non si può droppare *affatto* — la
-- clausola protegge solo l'esecuzione in cui il vincolo non c'è, cioè l'unica
-- che non ha bisogno di protezione. E il fallimento arriva a metà file, dopo che
-- le sezioni 1-3 hanno già scritto: esattamente il guasto che le guardie in
-- testa agli altri file esistono per impedire.
--
-- ⚠️ Non si chiude con `drop … cascade`: quello toglierebbe le tre FK **senza
-- ricrearle** se il file si fermasse subito dopo, lasciando il database senza il
-- vincolo di proprietà e senza che nulla lo segnali. Togliere i dipendenti per
-- nome è più lungo e dice cosa sta succedendo.
alter table public.transactions    drop constraint if exists transactions_account_owner_fkey;
alter table public.transactions    drop constraint if exists transactions_to_account_owner_fkey;
alter table public.recurring_rules drop constraint if exists recurring_rules_account_owner_fkey;

alter table public.accounts drop constraint if exists accounts_id_user_key;
alter table public.accounts add constraint accounts_id_user_key unique (id, user_id);

-- Origine. Sostituisce `transactions_account_id_fkey` della 20a: quella
-- garantiva che il conto ESISTA, questa che sia TUO. La seconda implica la
-- prima, quindi tenerle entrambe sarebbe una verifica in più a ogni scrittura
-- per un fatto già garantito.
alter table public.transactions drop constraint if exists transactions_account_id_fkey;

alter table public.transactions add constraint transactions_account_owner_fkey
	foreign key (account_id, user_id) references public.accounts (id, user_id)
	on delete no action;

-- Destinazione. ⚠️ Senza questa, il buco si riaprirebbe identico sul conto di
-- arrivo, ed è un buco peggiore: là il denaro non solo si attacca al conto di un
-- altro, ci ENTRA — comparirebbe nel suo saldo.
alter table public.transactions add constraint transactions_to_account_owner_fkey
	foreign key (to_account_id, user_id) references public.accounts (id, user_id)
	on delete no action;

-- ⚠️ `delete_current_user()` NON va toccata, ed è stato verificato invece che
-- dato per scontato: cancella `transactions` prima di `accounts`, quindi quando
-- tocca ai conti nessuna riga li riferisce più — né per `account_id` né per
-- `to_account_id`. Fosse stato l'inverso, questa FK `no action` in più avrebbe
-- fatto fallire l'eliminazione, e il guasto sarebbe comparso addosso a un utente
-- che stava cancellando il proprio account.

-- ⚠️ `recurring_rules` ha lo stesso buco e la stessa cura. `updateRecurringRule`
-- non chiama `assertOwnAccount`, quindi qui il vincolo non è un rafforzamento:
-- è l'unica difesa che esista.
do $$
declare
	v_orfane int;
begin
	select count(*) into v_orfane from public.recurring_rules where user_id is null;
	if v_orfane > 0 then
		raise exception
			'% regole ricorrenti con user_id NULL. Assegnare un user_id o rimuoverle, poi rieseguire.',
			v_orfane
			using errcode = 'not_null_violation';
	end if;
end $$;

alter table public.recurring_rules alter column user_id set not null;

alter table public.recurring_rules drop constraint if exists recurring_rules_account_id_fkey;

alter table public.recurring_rules add constraint recurring_rules_account_owner_fkey
	foreign key (account_id, user_id) references public.accounts (id, user_id)
	on delete no action;


-- ----------------------------------------------------------------------------
-- 5. account_balances — il termine in entrata
-- ----------------------------------------------------------------------------
-- La formula del progetto, ora completa:
--
--   saldo(X) = initial_balance(X)
--            + Σ amount dove type='entrata'  e account_id = X
--            − Σ amount dove type<>'entrata' e account_id = X
--            + Σ amount dove to_account_id = X          ← la 20b
--
-- ⚠️ Il terzo termine non si ottiene allargando il `left join` della 20a: quella
-- join lega le transazioni al conto per `account_id`, e una riga che ARRIVA su X
-- non ha X in quella colonna. Serve leggere `transactions` da due punti di vista
-- diversi, ed è ciò che fa la `union all` — che è anche il modo più diretto di
-- scrivere in SQL la frase "un movimento su un conto è ciò che esce dall'origine
-- più ciò che entra nella destinazione".
--
-- Il segno del primo ramo copre tutti i tipi in un colpo: `entrata` somma, ogni
-- altro tipo sottrae. Un `trasferimento` esce dall'origine (secondo ramo del
-- `case`) e rientra sulla destinazione (secondo ramo della `union`), quindi la
-- somma dei saldi non cambia — che è la definizione stessa di spostare denaro.
--
-- ⚠️ Il `left join` resta e non è un dettaglio: con una join interna un conto
-- appena creato sparirebbe finché non ha almeno un movimento — un conto che
-- esiste e non si vede.
--
-- ⚠️ `archived` è esposto ma NON filtrato. La vista descrive i conti, non decide
-- quali mostrare: "Saldo · N conti attivi" esclude gli archiviati, la sezione
-- "Archiviati" li include, e sono due domande diverse sulla stessa riga.

create or replace view public.account_balances
with (security_invoker = true)
as
with movimenti as (
	-- ciò che ESCE dal conto di origine (o vi entra, se è un'entrata)
	select
		t.account_id as acct,
		case when t.type::text = 'entrata' then t.amount else -t.amount end as delta
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
-- 6. CONTROPROVA
-- ----------------------------------------------------------------------------
-- ⚠️ Le prove che contano sono quelle che devono FALLIRE. È la regola già pagata
-- due volte: la #47 è rimasta invisibile cinque settimane perché
-- `job_run_details` diceva `succeeded`, e il collaudo della 20a aveva letto come
-- superata una prova RLS che non aveva testato nulla. **Solo righe verdi non
-- distinguono "funziona" da "non ha guardato".**
--
-- ⚠️ Il blocco qui sotto si copia e si incolla COSÌ COM'È: gli id se li trova da
-- solo. La prima stesura chiedeva di sostituire `:u`, `:a`, `:b`… a mano — cioè
-- di eseguire sette insert scritti a metà, dove uno sbaglio di copia si presenta
-- come un errore di vincolo *diverso da quello atteso* e si legge come un
-- fallimento della migration. Un collaudo che si può eseguire male è un
-- collaudo che dirà la cosa sbagliata.
--
-- Non scrive niente: ogni prova gira in una sottotransazione che viene comunque
-- annullata, e il conteggio finale delle righe lo dimostra.
--
--   ┌──────────────────────────────────────────────────────────────────────────
--   do $$
--   declare
--       v_user uuid; v_a uuid; v_b uuid; v_cat uuid; v_altrui uuid;
--       v_righe_prima bigint; v_righe_dopo bigint;
--       v_sa numeric; v_sb numeric; v_tot numeric; v_tx uuid;
--       r text := E'\n';
--   begin
--       select id into v_user from auth.users order by created_at limit 1;
--       select id into v_a from public.accounts where user_id = v_user order by created_at limit 1;
--       select id into v_b from public.accounts where user_id = v_user and id <> v_a order by created_at limit 1;
--       -- ⚠️ Una categoria QUALSIASI. Cercandone una di tipo `risparmio` si
--       --    rischia `v_cat` NULL, e allora b3 inserirebbe un trasferimento
--       --    SENZA categoria — che è legale: la prova riporterebbe un
--       --    fallimento del vincolo mentre il vincolo non è mai stato messo
--       --    alla prova. Un collaudo che può passare per il motivo sbagliato è
--       --    peggio di uno che manca.
--       select id into v_cat from public.categories where user_id = v_user limit 1;
--       select id into v_altrui from public.accounts where user_id <> v_user limit 1;
--
--       if v_b is null then
--           raise exception 'Servono almeno DUE conti per collaudare i trasferimenti. Creane un secondo dall''app.';
--       end if;
--
--       select count(*) into v_righe_prima from public.transactions;
--
--       -- b1) verso se stessi
--       begin
--           insert into public.transactions (user_id, amount, type, date, account_id, to_account_id)
--           values (v_user, 10, 'trasferimento', now(), v_a, v_a);
--           r := r || 'b1 self-transfer      FALLITA — l''insert è passato!' || E'\n';
--       exception when check_violation then
--           r := r || 'b1 self-transfer      ok (' || sqlerrm || ')' || E'\n';
--       end;
--
--       -- b2) senza destinazione
--       begin
--           insert into public.transactions (user_id, amount, type, date, account_id)
--           values (v_user, 10, 'trasferimento', now(), v_a);
--           r := r || 'b2 senza destinaz.    FALLITA — l''insert è passato!' || E'\n';
--       exception when check_violation then
--           r := r || 'b2 senza destinaz.    ok' || E'\n';
--       end;
--
--       -- b3) con categoria
--       begin
--           insert into public.transactions (user_id, amount, type, date, account_id, to_account_id, category_id)
--           values (v_user, 10, 'trasferimento', now(), v_a, v_b, v_cat);
--           r := r || 'b3 con categoria      FALLITA — l''insert è passato!' || E'\n';
--       exception when check_violation then
--           r := r || 'b3 con categoria      ok' || E'\n';
--       end;
--
--       -- b4) destinazione su una spesa
--       begin
--           insert into public.transactions (user_id, amount, type, date, account_id, to_account_id)
--           values (v_user, 10, 'spesa', now(), v_a, v_b);
--           r := r || 'b4 dest. su spesa     FALLITA — l''insert è passato!' || E'\n';
--       exception when check_violation then
--           r := r || 'b4 dest. su spesa     ok' || E'\n';
--       end;
--
--       -- b5/b6) ⚠️ LE PROVE CHE VALGONO PIÙ DELLE ALTRE. Prima della sezione 4
--       --        questi due insert PASSAVANO: nessuna policy RLS guarda
--       --        `account_id`, e `assertOwnAccount()` viveva nel codice.
--       if v_altrui is null then
--           r := r || 'b5/b6 conto altrui    SALTATA — un solo utente nel database' || E'\n';
--       else
--           begin
--               insert into public.transactions (user_id, amount, type, date, account_id, to_account_id)
--               values (v_user, 10, 'trasferimento', now(), v_a, v_altrui);
--               r := r || 'b5 dest. altrui       FALLITA — l''insert è passato!' || E'\n';
--           exception when foreign_key_violation then
--               r := r || 'b5 dest. altrui       ok' || E'\n';
--           end;
--           begin
--               insert into public.transactions (user_id, amount, type, date, account_id)
--               values (v_user, 10, 'spesa', now(), v_altrui);
--               r := r || 'b6 origine altrui     FALLITA — l''insert è passato!' || E'\n';
--           exception when foreign_key_violation then
--               r := r || 'b6 origine altrui     ok' || E'\n';
--           end;
--       end if;
--
--       -- c) Il saldo si sposta, il totale no.
--       --    ⚠️ Vanno lette le TRE cifre insieme: due saldi che cambiano di segno
--       --    opposto e una somma che non si muove. Un solo saldo giusto è
--       --    compatibile con una vista che conta il ramo in uscita e ignora
--       --    quello in entrata — il difetto che questa prova esiste per escludere.
--       select balance into v_sa  from public.account_balances where id = v_a;
--       select balance into v_sb  from public.account_balances where id = v_b;
--       select sum(balance) into v_tot from public.account_balances where user_id = v_user;
--       r := r || 'c  prima:  A=' || v_sa || '  B=' || v_sb || '  totale=' || v_tot || E'\n';
--
--       insert into public.transactions (user_id, amount, type, date, account_id, to_account_id)
--       values (v_user, 100, 'trasferimento', now(), v_a, v_b)
--       returning id into v_tx;
--
--       select balance into v_sa  from public.account_balances where id = v_a;
--       select balance into v_sb  from public.account_balances where id = v_b;
--       select sum(balance) into v_tot from public.account_balances where user_id = v_user;
--       r := r || 'c  dopo:   A=' || v_sa || '  B=' || v_sb || '  totale=' || v_tot
--              || '   (A −100, B +100, totale INVARIATO)' || E'\n';
--
--       delete from public.transactions where id = v_tx;
--
--       select count(*) into v_righe_dopo from public.transactions;
--       r := r || 'righe transactions: ' || v_righe_prima || ' → ' || v_righe_dopo
--              || ' (devono coincidere)' || E'\n';
--
--       raise notice '%', r;
--       raise exception 'COLLAUDO 20b — leggere il riquadro qui sopra.%', r;
--   end $$;
--   └──────────────────────────────────────────────────────────────────────────
--
-- ⚠️ Il blocco termina con `raise exception` DI PROPOSITO: è l''unico modo di
-- garantire insieme due cose — che il referto si veda (il SQL Editor mostra
-- sempre l''errore, i `notice` no) e che nulla di ciò che le prove hanno scritto
-- resti sul database. Un collaudo che per essere letto deve poter committare non
-- è un collaudo.
--
-- Poi, a parte, i controlli di struttura:
--
--   -- I sei vincoli nuovi (atteso: 6 righe)
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.transactions'::regclass and conname in (
--       'transactions_dest_type_check', 'transactions_transfer_dest_check',
--       'transactions_transfer_category_check', 'transactions_dest_distinct_check',
--       'transactions_account_owner_fkey', 'transactions_to_account_owner_fkey')
--   order by conname;
--
--   -- Le FK a una colonna sono sparite (atteso: 0 righe)
--   select conname from pg_constraint where conname in
--       ('transactions_account_id_fkey', 'recurring_rules_account_id_fkey');
--
--   -- ⚠️ `trasferimento` c'è in transactions_type_check e NON nelle due sorelle:
--   --    la divergenza è voluta (sezione 2). Se un giorno ci finisse, è un
--   --    allineamento fatto per simmetria senza rileggere il motivo.
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conname in ('transactions_type_check', 'categories_type_check',
--                     'recurring_rules_type_check');
--
--   -- user_id non è più nullable (atteso: due 'NO')
--   select table_name, is_nullable from information_schema.columns
--   where table_schema = 'public' and column_name = 'user_id'
--     and table_name in ('transactions', 'recurring_rules');

