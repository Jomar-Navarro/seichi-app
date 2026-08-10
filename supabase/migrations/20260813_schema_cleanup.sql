-- ============================================================================
-- Le correzioni che la baseline ha reso visibili (issue #43)
-- ============================================================================
-- ⚠️ ESEGUIRE DOPO `20260727_baseline_fase3.sql`.
--
-- La `20260727` fotografa; questo file decide. La separazione è spiegata là, e
-- il punto è che ciascuno dei difetti qui sotto era **invisibile fino a ieri**:
-- nessun file del repo descriveva quelle tabelle, quindi un default che viola il
-- proprio vincolo o otto policy dove ne bastano tre non erano leggibili da
-- nessuna parte. Non è un caso che si scoprano tutti insieme.


-- ----------------------------------------------------------------------------
-- ⚠️ 1. Il difetto vivo: la registrazione di nuovi utenti è ROTTA
-- ----------------------------------------------------------------------------
-- Due fatti che nessun file metteva uno accanto all'altro:
--
--   · `profiles.language` ha `default 'IT'` — MAIUSCOLO
--   · `profiles_language_check`, aggiunto dalla `20260807`, pretende
--     `language is null or language in ('it','en')` — minuscolo
--
-- E `handle_new_user()` (trigger `on_auth_user_created`) inserisce
-- `(id, full_name)` **senza nominare `language`**: si applica il default, che
-- viola il CHECK. Il trigger è `after insert on auth.users`, quindi sollevando
-- annulla l'intera transazione e **l'utente non viene creato**.
--
-- Ogni registrazione fallisce dal 2026-08-07, data di esecuzione della
-- `20260807`. Non se n'è accorto nessuno perché le registrazioni non sono
-- ancora aperte (debito SMTP + *Confirm email*, issue #40) e da allora non è
-- stato creato un account nuovo.
--
-- ⚠️ **La correzione è TOGLIERE il default, non portarlo a 'it'.** La Fase 19 lo
-- ha già deciso: «NULL = non ancora scelto → l'app ripiega su Accept-Language,
-- che è un'informazione migliore di un italiano d'ufficio». Il default 'IT' è
-- più vecchio di quella decisione e la contraddice; scrivere 'it' vorrebbe dire
-- assegnare a ogni nuovo utente una lingua che non ha scelto, spegnendo la
-- negoziazione da header che la Fase 19 esiste per usare.
--
-- La `20260807` aveva normalizzato i VALORI e aggiunto il vincolo, ma non il
-- default: era invisibile, perché il default non stava scritto da nessuna parte.

alter table public.profiles alter column language drop default;


-- ----------------------------------------------------------------------------
-- ⚠️ 1-bis. E lo STESSO difetto su `currency`, che spegne l'onboarding
-- ----------------------------------------------------------------------------
-- `currency` ha `default 'EUR'`, e `handle_new_user()` non la nomina: ogni riga
-- nasce non-NULL. Ma `profiles.currency` **è il flag dell'onboarding** — NULL =
-- non completato — e il gate è scritto così:
--
--     if (!profile?.currency) redirect("/start")
--
-- Con il default quella condizione non è mai vera. Il difetto è nato con il
-- trigger (`20260729`, Fase 16): prima la riga non esisteva finché l'onboarding
-- non la scriveva, quindi il gate funzionava per costruzione.
--
-- ⚠️ **Non si vede registrandosi**, e per questo era sopravvissuto: `signup()`
-- con la conferma email disattivata fa `redirect("/start")` incondizionato,
-- senza consultare il gate. Colpisce le altre tre strade:
--
--   · **OAuth** (Google/Facebook) → passa da `/callback`, che il gate lo usa
--   · **conferma email** → stessa cosa, `emailRedirectTo` punta a `/callback`
--   · **il login successivo** → chi abbandona l'onboarding a metà non ci viene
--     più riportato, che è letteralmente il lavoro per cui il gate esiste
--
-- ⚠️ E riattivare *Confirm email* — uno dei debiti pre-deploy della issue #40 —
-- instraderebbe OGNI nuova registrazione dentro `/callback`. Il difetto è
-- dormiente solo perché quel debito non è ancora stato pagato: pagarlo lo
-- accende. Vale la pena saperlo prima, non dopo.
--
-- ⚠️ **Il default si toglie, i valori NON si azzerano** — al contrario di
-- `theme`. Là ogni valore era fabbricato dal default; qui `savePreferences()`
-- scrive `currency` per davvero, quindi le righe esistenti contengono scelte
-- vere e indistinguibili da quelle d'ufficio. Cancellarle rispedirebbe utenti
-- già configurati dentro l'onboarding. Il difetto riguarda le righe FUTURE.

alter table public.profiles alter column currency drop default;


-- ----------------------------------------------------------------------------
-- 2. profiles.theme — stesso difetto, senza il vincolo che lo fa esplodere
-- ----------------------------------------------------------------------------
-- `theme varchar(50) default 'dark'` **fabbrica una scelta che l'utente non ha
-- mai fatto**, esattamente come `'IT'`. Nessun codice la scrive né la legge: le
-- due righe esistenti contengono il default e nient'altro.
--
-- ⚠️ Perché non basta lasciarla lì. La Fase 18 dice che in assenza di preferenza
-- l'app RENDE scuro e `ThemeProvider` corregge al mount se il sistema dice
-- altro: quello è un ripiego di rendering, ed è corretto. Ma memorizzato in
-- colonna lo stesso valore diventa una **preferenza dichiarata**. Il giorno in
-- cui la sincronizzazione fra dispositivi verrà accesa — che è il motivo per cui
-- la Fase 18 tiene la colonna — quelle righe diranno "ha scelto scuro" a nome di
-- chi non ha scelto niente, e sovrascriveranno il tema di sistema su ogni altro
-- dispositivo. Il difetto si manifesterebbe mesi dopo, in una fase diversa, con
-- la causa ormai illeggibile.
--
-- La colonna resta (la Fase 18 la prevede) ma prende la semantica di
-- `language`: NULL = non ancora scelto, e un CHECK che elenca i valori leciti —
-- gli stessi tre stati di `lib/theme.ts`.

alter table public.profiles alter column theme drop default;

-- ⚠️ `where theme = 'dark'` e non un azzeramento secco: se una riga contenesse
-- un valore diverso sarebbe una scelta VERA e non va persa. Oggi non ne esistono,
-- ma la differenza fra "cancello i default fabbricati" e "cancello la colonna"
-- deve stare nel codice, non nella fiducia che i dati siano come me li aspetto.
update public.profiles set theme = null where theme = 'dark';

alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add  constraint profiles_theme_check
	check (theme is null or (theme)::text = any ((array[
		'light'::character varying,
		'dark'::character varying,
		'system'::character varying
	])::text[]));


-- ----------------------------------------------------------------------------
-- 3. Le colonne residue
-- ----------------------------------------------------------------------------
-- Verificato PRIMA di rimuoverle, e questo è l'ordine giusto — su una colonna
-- `drop` non si torna indietro:
--
--   transactions: 19 righe, frequency=0, is_ricurrent=0, parent_id=0
--   profiles:      2 righe, name=0, surname=0
--
-- Tutte interamente NULL, e nessuna letta o scritta dal codice (verificato con
-- una ricerca su `.ts`/`.tsx`).
--
-- Cosa erano:
--   · `is_ricurrent`, `frequency`, `parent_id` — il primo impianto delle
--     ricorrenti, precedente alla Fase 14 che le ha spostate su
--     `recurring_rules` + pg_cron. `frequency` portava un CHECK in INGLESE
--     (`weekly/monthly/yearly`) mentre `recurring_rules.frequency` usa
--     l'italiano: due vocabolari per lo stesso concetto nella stessa base dati,
--     ed è il tipo di ambiguità che costa un'ora a chi legge fra sei mesi.
--     `parent_id` non aveva nemmeno una FK, quindi non era un riferimento: era
--     un uuid libero che somigliava a uno.
--   · `name`, `surname` — precedenti alla Fase 16, soppiantate da `full_name`.
--     L'app le scrive in `raw_user_meta_data` (`sign/action.ts`), non qui, e
--     `handle_new_user()` le legge DA LÌ per comporre `full_name`. Le colonne
--     non sono mai entrate nel flusso.
--
-- `transactions_frequency_check` sparisce da sé con la colonna: un vincolo non
-- sopravvive alla propria colonna.

alter table public.transactions drop column if exists frequency;
alter table public.transactions drop column if exists is_ricurrent;
alter table public.transactions drop column if exists parent_id;

alter table public.profiles drop column if exists name;
alter table public.profiles drop column if exists surname;


-- ----------------------------------------------------------------------------
-- ⚠️ 4. Le policy duplicate
-- ----------------------------------------------------------------------------
-- Venti policy per undici operazioni: `categories` ne aveva otto per quattro,
-- `profiles` otto per tre. Nate perché la `20260729` ha aggiunto `profiles_*_own`
-- senza rimuovere le precedenti, e perché su `categories` sono state create due
-- serie con nomi quasi identici ("… own categories" e "… on their own
-- categories") — probabilmente due passaggi diversi dallo stesso pannello.
--
-- ⚠️ **Oggi sono innocue, e questo è precisamente il problema.** Le policy si
-- sommano in OR e dicono tutte la stessa cosa, quindi nulla segnala il
-- duplicato. Il costo arriva il giorno in cui si vuole RESTRINGERE un accesso:
-- bisogna rimuoverle tutte, e chi ne stringe una lascia l'altra aperta senza
-- alcun errore, alcun avviso e alcun test che fallisca. Un permesso concesso da
-- una policy dimenticata è silenzioso per costruzione.
--
-- Si resta con UNA policy per operazione, nella convenzione già usata da
-- `budgets` e `notifications`: `<tabella>_<operazione>_own`.
--
-- ⚠️ **Prima si creano le nuove, poi si rimuovono le vecchie.** L'ordine inverso
-- lascerebbe, fra i due comandi, una tabella con RLS attiva e nessuna policy —
-- cioè nego-tutto, l'app cieca. Le DDL sono transazionali in Postgres, ma questi
-- file si eseguono a mano dal SQL Editor e non c'è garanzia che l'intero script
-- sia una sola transazione: l'ordine sicuro non costa nulla e non dipende da
-- quell'assunzione.
--
-- ⚠️ `(select auth.uid())` e non `auth.uid()` nudo: il sotto-select viene
-- valutato UNA volta come initplan invece che per ogni riga esaminata. È la
-- forma raccomandata da Supabase, ed è anche il motivo per cui questa
-- deduplicazione non è solo cosmetica — le policy vecchie usavano la forma per
-- riga, su una tabella (`transactions`) destinata a crescere.

-- profiles: si tengono le tre della 20260729, già nella forma giusta, e non se
-- ne aggiunge una quarta.
--
-- ⚠️ **L'assenza di una policy di DELETE su `profiles` è voluta**, non una
-- dimenticanza da sanare mentre si fa ordine: la cancellazione passa da
-- `delete_current_user()`, che è `security definer` e quindi non ha bisogno di
-- alcuna policy. Aggiungerne una per simmetria con le altre tabelle
-- concederebbe a ogni utente autenticato un `DELETE /rest/v1/profiles` che oggi
-- non ha — cioè allargare l'accesso mentre si crede di riordinarlo. Una
-- ripulitura che cambia i permessi non è una ripulitura.

drop policy if exists "Users can view own profile"            on public.profiles;
drop policy if exists "Users can insert own profile"          on public.profiles;
drop policy if exists "Users can insert on their own profile" on public.profiles;
drop policy if exists "Users can update own profile"          on public.profiles;
drop policy if exists "Users can update on their own profile" on public.profiles;

-- ⚠️ Le policy nuove si creano **solo se non esistono**, e non con la coppia
-- `drop … if exists` + `create`.
--
-- Senza alcuna difesa, una seconda esecuzione aborta con 42710 ("policy already
-- exists") **a metà di questa sezione** e non arriva mai alla 5: gli indici non
-- verrebbero creati, e chi legge solo l'errore in cima crede di aver fallito
-- l'intero file mentre in realtà lo ha fatto a metà.
--
-- Ma rimuoverle per ricrearle sarebbe peggio: su una riesecuzione le vecchie
-- sono già sparite, quindi fra il `drop` e il `create` la tabella resterebbe con
-- RLS attiva e **nessuna** policy — la finestra di nego-tutto che questa stessa
-- sezione dichiara inaccettabile quindici righe più in su. La forma
-- condizionale non ha né il fallimento né la finestra, e non dipende
-- dall'assunzione che l'editor SQL avvolga il file in una transazione.

do $$
declare
	pol record;
begin
	for pol in
		select * from (values
			('categories',   'categories_select_own',   'select', 'using ((select auth.uid()) = user_id)'),
			('categories',   'categories_insert_own',   'insert', 'with check ((select auth.uid()) = user_id)'),
			('categories',   'categories_update_own',   'update', 'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)'),
			('categories',   'categories_delete_own',   'delete', 'using ((select auth.uid()) = user_id)'),
			('transactions', 'transactions_select_own', 'select', 'using ((select auth.uid()) = user_id)'),
			('transactions', 'transactions_insert_own', 'insert', 'with check ((select auth.uid()) = user_id)'),
			('transactions', 'transactions_update_own', 'update', 'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)'),
			('transactions', 'transactions_delete_own', 'delete', 'using ((select auth.uid()) = user_id)')
		) as t(tbl, name, op, clause)
	loop
		if not exists (
			select 1 from pg_policies
			where schemaname = 'public' and tablename = pol.tbl and policyname = pol.name
		) then
			execute format(
				'create policy %I on public.%I for %s to authenticated %s',
				pol.name, pol.tbl, pol.op, pol.clause
			);
		end if;
	end loop;
end $$;

drop policy if exists "Users can view own categories"            on public.categories;
drop policy if exists "Users can view on their own categories"   on public.categories;
drop policy if exists "Users can insert own categories"          on public.categories;
drop policy if exists "Users can insert on their own categories" on public.categories;
drop policy if exists "Users can update own categories"          on public.categories;
drop policy if exists "Users can update on their own categories" on public.categories;
drop policy if exists "Users can delete own categories"          on public.categories;
drop policy if exists "Users can delete on their own categories" on public.categories;

-- transactions — le nuove le ha già create il blocco qui sopra
drop policy if exists "Users can view own transactions"   on public.transactions;
drop policy if exists "Users can insert own transactions" on public.transactions;
drop policy if exists "Users can update own transactions" on public.transactions;
drop policy if exists "Users can delete own transactions" on public.transactions;


-- ----------------------------------------------------------------------------
-- 5. Gli indici che non c'erano
-- ----------------------------------------------------------------------------
-- ⚠️ Prima di questo file le tre tabelle avevano **solo gli indici delle chiavi
-- primarie**. Nessun indice su `user_id`, che è la colonna su cui filtra la RLS
-- di OGNI query, né su `date`, che è come si interroga la dashboard.
--
-- Con 19 transazioni non si vede: Postgres sceglie comunque una scansione
-- sequenziale, ed è la scelta giusta a quella dimensione. Si vede quando è
-- tardi, ed è il motivo per cui vale metterli adesso invece che "quando
-- servirà" — a quel punto la lentezza si presenta come un problema di rete o di
-- Supabase, non come un indice mancante.
--
-- `(user_id, date desc)` e non due indici separati: le query filtrano su
-- `user_id` e ordinano/filtrano su `date` nello stesso colpo (home, analisi,
-- lista transazioni, `dashboard_totals`). Un indice composito le serve tutte;
-- il solo `user_id` costringerebbe comunque a ordinare dopo.
--
-- Gli indici sulle due FK non servono alle SELECT ma alle CANCELLAZIONI: senza,
-- ogni `on delete cascade` da `categories` o `recurring_rules` scandisce
-- l'intera `transactions` per trovare le righe figlie.

create index if not exists transactions_user_date_idx
	on public.transactions (user_id, date desc);

create index if not exists transactions_category_idx
	on public.transactions (category_id);

create index if not exists transactions_recurring_rule_idx
	on public.transactions (recurring_rule_id);

create index if not exists categories_user_idx
	on public.categories (user_id);


-- ----------------------------------------------------------------------------
-- 6. Controprova
-- ----------------------------------------------------------------------------
--   -- Il default che rompeva le registrazioni non c'è più (deve dare NULL):
--   select column_default from information_schema.columns
--   where table_schema='public' and table_name='profiles' and column_name='language';
--
--   -- E la registrazione ora passa il vincolo. Non scrive nulla: la FK verso
--   -- auth.users fallisce DOPO il CHECK, quindi l'errore atteso è 23503
--   -- (foreign key), non più 23514 (check).
--   do $$
--   begin
--       insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000000');
--   exception when others then
--       raise notice 'ERRORE: % [%]', sqlerrm, sqlstate;
--   end $$;
--
--   -- Una policy per operazione: 11 righe, non 20.
--   select tablename, cmd, count(*) from pg_policies
--   where schemaname='public' and tablename in ('profiles','categories','transactions')
--   group by tablename, cmd order by tablename, cmd;
--
--   -- Le colonne residue sono sparite: 10 su transactions, 7 su profiles.
--   select table_name, count(*) from information_schema.columns
--   where table_schema='public' and table_name in ('profiles','categories','transactions')
--   group by table_name;
