-- ============================================================================
-- 20260822 — anon perde ogni privilegio sullo schema public (issue #154)
-- ============================================================================
-- Fino a questo file `anon` aveva `arwdDxtm` su TUTTE le tabelle di `public` e
-- `rwU` sull'unica sequenza (`job_runs_id_seq`): il default di Supabase, non una
-- scelta di questo progetto. Lo aveva già registrato la baseline (`20260727`,
-- sezione 5) e lo ha confermato il catalogo il 2026-08-13: le tabelle nate dopo
-- — `imports`, `job_runs`, `attachments` — lo avevano ereditato da sole.
--
-- Era innocuo SOLO grazie alla RLS: ogni policy è `to authenticated`, quindi per
-- `anon` ogni riga è negata. Una difesa sola. Una policy sbagliata domani — un
-- `to public` scritto per fretta, un `using (true)` di prova — sarebbe stata
-- leggibile da chiunque abbia la chiave pubblicabile, che sta nel bundle.
--
-- ⚠️ Scritta INTERROGANDO IL CATALOGO il 2026-11-10 (`pg_class.relacl`,
-- `pg_proc.proacl`, `pg_default_acl`), non a memoria. Cosa ha detto:
--
--   · ogni tabella, vista e sequenza di `public` è di `postgres`, e ogni grant
--     ad `anon` ha `postgres` come concedente: dal SQL Editor si revoca tutto;
--   · `account_balances` era già pulita (la `20260814` le toglie `anon`);
--   · nessun grant di COLONNA ad `anon`;
--   · cinque funzioni eseguibili da `anon`, tutte tramite PUBLIC più un grant
--     esplicito arrivato dal default: `budget_period_start`, `budget_period_end`,
--     `budget_warning_threshold`, `handle_new_user` e `rls_auto_enable` —
--     quest'ultima è la funzione dell'event trigger `ensure_rls` della
--     piattaforma, ma appartiene a `postgres` e sta in `public`;
--   · i default di `postgres` su `public` concedono tutto ad `anon` su tabelle,
--     sequenze e funzioni. Quelli di `supabase_admin` su `public` dicono lo
--     stesso, e `postgres` non può toccarli (non ne è membro): oggi in `public`
--     non c'è un solo oggetto di `supabase_admin`.
--
-- ⚠️ Si verifica su `pg_class.relacl`, MAI su
-- `information_schema.role_table_grants`: quella vista mostra solo i grant in
-- cui il ruolo corrente è concedente o beneficiario, e da un ruolo terzo
-- risulta vuota — sembra che nessuno abbia privilegi.
--
-- ----------------------------------------------------------------------------
-- Cosa fa, in ordine
-- ----------------------------------------------------------------------------
--   0. guardia: si ferma se non gira come `postgres`, o se un privilegio di
--      `anon` in `public` l'ha concesso qualcun altro
--   1. tabelle, viste e sequenze di `public`: via ogni privilegio di PUBLIC e
--      `anon`
--   2. le funzioni eseguibili da `anon` (un ciclo sul catalogo; il 2026-11-10
--      erano cinque): via PUBLIC e `anon`, `authenticated` e `service_role`
--      escono con ciò che avevano
--   3. i default di `postgres`: niente più `anon` sugli oggetti nuovi di
--      `public`, e niente più PUBLIC sulle funzioni nuove
--   4. verifica ESEGUITA: se `anon` ha ancora qualcosa, il file si annulla
--   5. controprova (COMMENTATA — si esegue a parte)
--
-- ⚠️ Eseguita il 2026-11-10 nella prima versione (cinque `revoke` per nome, solo
-- `anon` sulle tabelle), poi corretta dalla code review. È idempotente, e sul
-- catalogo di quel giorno le due versioni danno lo stesso stato — nessun grant
-- a PUBLIC sulle relazioni, nessuna funzione oltre le cinque. RIESEGUITA lo
-- stesso giorno nella versione corretta, perché la verifica della sezione 4
-- girasse una volta sul database vero: "Success". Poi la controprova, c1-c9.
--
-- ⚠️ Nessuna modifica al codice, e nessun ordine di deploy. Prima di scrivere
-- questo file è stato verificato che l'app non legga mai una tabella senza
-- sessione: le uniche letture nei percorsi pre-login (`callback/route.ts` e
-- `sign/action.ts`, la `profiles` del gate dell'onboarding) partono DOPO lo
-- scambio della sessione, sullo stesso client, quindi come `authenticated`.
-- Nessuna RPC parte senza sessione. Il bucket `avatars` è pubblico tramite lo
-- Storage, non tramite grant di tabella, e lo schema `storage` qui non si tocca.
--
-- ⚠️ Cosa cambia per chi chiama senza sessione: una `select` su una tabella
-- passa da `200 []` a `401` con `42501 permission denied for table`. ATTENZIONE
-- all'insert: dava GIÀ `42501`, ma per la RLS ("new row violates row-level
-- security policy"). Chi verifica deve leggere il MESSAGGIO, non il codice, o
-- la prova passa anche senza questo file.
--
-- ----------------------------------------------------------------------------
-- Se servisse tornare indietro
-- ----------------------------------------------------------------------------
-- Lo stato precedente, ricostruito dal catalogo del 2026-11-10:
--
--   grant all on public.profiles, public.categories, public.transactions,
--     public.recurring_rules, public.budgets, public.notifications,
--     public.job_runs, public.accounts, public.imports, public.attachments
--     to anon;
--   grant all on sequence public.job_runs_id_seq to anon;
--   grant execute on function public.budget_period_start(text, date),
--     public.budget_period_end(text, date), public.budget_warning_threshold(),
--     public.handle_new_user(), public.rls_auto_enable() to public, anon;
--   alter default privileges for role postgres in schema public
--     grant all on tables to anon;
--   alter default privileges for role postgres in schema public
--     grant all on sequences to anon;
--   alter default privileges for role postgres in schema public
--     grant execute on functions to anon;
--   alter default privileges for role postgres
--     grant execute on functions to public;
--
-- ⚠️ NON `grant all on all tables in schema public to anon`: rimetterebbe `anon`
-- anche su `account_balances`, che non lo aveva dalla `20260814`.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Guardia
-- ----------------------------------------------------------------------------
-- Due condizioni senza le quali questo file direbbe di aver fatto una cosa e ne
-- farebbe un'altra, SENZA un errore:
--
--   · `alter default privileges` vale per il ruolo che lo esegue. Da un altro
--     ruolo cambierebbe i default di quello, e le tabelle nuove — create da
--     `postgres` nel SQL Editor — continuerebbero a nascere con `anon`;
--   · un `revoke` su un privilegio concesso da un ALTRO ruolo non fallisce: dà
--     un `WARNING: no privileges could be revoked` e prosegue. Il file
--     finirebbe con "Success" e `anon` ancora al suo posto.
--
-- Un oggetto nuovo di un altro ruolo non è un'ipotesi astratta: i default di
-- `supabase_admin` su `public` concedono ancora tutto ad `anon`, e `postgres`
-- non può cambiarli. Se un giorno la piattaforma creasse qualcosa qui, questa
-- guardia lo nominerebbe invece di lasciarlo passare.

do $$
declare
	v_altrui text;
begin
	if current_user <> 'postgres' then
		raise exception
			'20260822 va eseguita come postgres (ora: %): i default dei privilegi valgono per il ruolo che li cambia.',
			current_user;
	end if;

	select string_agg(oggetto, ', ' order by oggetto) into v_altrui
	from (
		select distinct c.relname::text as oggetto
		from pg_class c
		join pg_namespace n on n.oid = c.relnamespace
		cross join lateral aclexplode(c.relacl) a
		where n.nspname = 'public'
		  and a.grantee in (0, 'anon'::regrole::oid)
		  and a.grantor <> 'postgres'::regrole::oid
		union
		-- Per le funzioni conta anche il CONCEDENTE, non solo il proprietario:
		-- un `anon=X/supabase_admin` su una funzione di `postgres` darebbe lo
		-- stesso WARNING muto delle tabelle.
		select p.oid::regprocedure::text
		from pg_proc p
		join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public'
		  and has_function_privilege('anon', p.oid, 'EXECUTE')
		  and (
			p.proowner <> 'postgres'::regrole::oid
			or exists (
				select 1 from aclexplode(p.proacl) a
				where a.grantee in (0, 'anon'::regrole::oid)
				  and a.grantor <> 'postgres'::regrole::oid
			)
		  )
	) s;

	if v_altrui is not null then
		raise exception
			'20260822: privilegi di anon che postgres non può revocare (concessi da un altro ruolo): %. Il file si ferma prima di scrivere.',
			v_altrui;
	end if;
end $$;


-- ----------------------------------------------------------------------------
-- 1. Tabelle, viste e sequenze
-- ----------------------------------------------------------------------------
-- `all tables` comprende le viste: `account_balances` non ha più `anon` dalla
-- `20260814`, e il revoke su di lei è un no-op. Le sequenze sono un comando a
-- parte — `job_runs_id_seq` aveva `anon=rwU`.
--
-- Revocare un privilegio di tabella revoca anche quello delle colonne: oggi
-- `anon` non ne ha nessuno (verificato), ma la regola vale da sé.
--
-- ⚠️ Anche PUBLIC, di cui `anon` è membro: oggi nessuna relazione di `public`
-- ha un grant a PUBLIC (verificato), ma uno lasciato da una correzione a mano
-- passerebbe la guardia — l'ha concesso `postgres` — e `anon` lo erediterebbe.
-- Tabelle e sequenze non hanno PUBLIC per default, quindi nessun altro ruolo
-- perde qualcosa.
--
-- ⚠️ `authenticated` non perde niente. Il grant di sola colonna su
-- `notifications.read` (`20260804`) resta com'è: questo file nomina solo PUBLIC
-- e `anon`.

revoke all on all tables    in schema public from public, anon;
revoke all on all sequences in schema public from public, anon;


-- ----------------------------------------------------------------------------
-- 2. Le funzioni
-- ----------------------------------------------------------------------------
-- Il 2026-11-10 erano cinque — `budget_period_start`, `budget_period_end`,
-- `budget_warning_threshold`, `handle_new_user` e `rls_auto_enable` — tutte
-- eseguibili da `anon` in due modi: tramite PUBLIC (il default di Postgres per
-- ogni funzione) e con un grant esplicito arrivato dal default di `postgres`
-- su `public`. Va tolto da entrambi, o resta l'altro.
--
-- ⚠️ Un CICLO sul catalogo, non cinque nomi scritti a mano (code review della
-- #154): un elenco fisso lascerebbe passare la prossima funzione dimenticata, e
-- su un database ricostruito senza `rls_auto_enable()` — una funzione della
-- piattaforma, che nessun file di questo repo crea — il suo `revoke` fallirebbe
-- con `42883` e trascinerebbe nel rollback tutto il file.
--
-- ⚠️ Togliere PUBLIC toglie l'esecuzione a chi l'aveva SOLO da lì. Il ciclo
-- quindi legge prima se `authenticated` e `service_role` la avevano, e dopo la
-- revoca rende loro un grant esplicito: escono con ciò che avevano, né più né
-- meno. (Il 2026-11-10 avevano già tutti e due un grant esplicito su tutte e
-- cinque: il ripristino è la regola, non una correzione.)
--
-- Per le tre funzioni dei budget il `grant` è anche scritto per esteso, dopo il
-- ciclo, perché lì è NECESSARIO e il file deve dirlo da sé: `budget_period_start`
-- sta nel CHECK di `budgets`, e `set_budget()` è `security invoker` — il CHECK
-- si valuta col ruolo di chi salva, cioè `authenticated`. Senza `execute`,
-- salvare un budget fallirebbe con `permission denied for function`.
--
-- ⚠️ Togliere PUBLIC toglie l'esecuzione anche a ruoli che l'avevano SOLO da lì
-- — `supabase_auth_admin`, `authenticator`, `seichi_ro`. Nessuno di loro chiama
-- queste funzioni direttamente:
--
--   · `handle_new_user()` è la funzione del trigger `on_auth_user_created`, che
--     scatta quando `supabase_auth_admin` inserisce in `auth.users`. Postgres
--     controlla `execute` su una funzione di trigger quando il trigger si CREA,
--     non quando scatta: la registrazione continua a funzionare. La controprova
--     (c8) lo dimostra su un trigger di prova, e il collaudo della issue lo
--     rifà registrando un utente vero;
--   · `rls_auto_enable()` è un event trigger: stesso ragionamento, e le tabelle
--     le crea comunque `postgres`, che ne è il proprietario. Una funzione che
--     restituisce `trigger` o `event_trigger` non si può nemmeno chiamare a
--     mano ("trigger functions can only be called as triggers"): l'esecuzione
--     di `anon` non serviva a niente, se non a sporcare la regola;
--   · il job notturno gira come `postgres`, proprietario di tutto.

do $$
declare
	f record;
begin
	for f in
		-- Firma qualificata a mano: `regprocedure` omette lo schema quando
		-- `public` è nel search_path, e il file non deve dipendere da quello.
		select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as sig,
		       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_aveva,
		       has_function_privilege('service_role',  p.oid, 'EXECUTE') as svc_aveva
		from pg_proc p
		join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public'
		  and has_function_privilege('anon', p.oid, 'EXECUTE')
	loop
		execute format('revoke all on function %s from public, anon', f.sig);
		if f.auth_aveva then
			execute format('grant execute on function %s to authenticated', f.sig);
		end if;
		if f.svc_aveva then
			execute format('grant execute on function %s to service_role', f.sig);
		end if;
		raise notice '20260822: anon non esegue più %', f.sig;
	end loop;
end $$;

grant execute on function public.budget_period_start(text, date) to authenticated, service_role;
grant execute on function public.budget_period_end(text, date)   to authenticated, service_role;
grant execute on function public.budget_warning_threshold()      to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. I default: il debito non si riforma da solo
-- ----------------------------------------------------------------------------
-- Senza questa sezione, la prossima tabella creata dal SQL Editor nascerebbe di
-- nuovo con `anon=arwdDxtm`, esattamente come è successo a `imports`, `job_runs`
-- e `attachments`. I default di `postgres` su `public` restano a concedere
-- tutto ad `authenticated` e `service_role`: le migration future continuano a
-- funzionare senza un grant in più.
--
-- ⚠️ L'ultima riga è GLOBALE (niente `in schema`), ed è l'unica forma possibile:
-- il `execute` a PUBLIC sulle funzioni è un default di Postgres stesso, e un
-- default per schema può solo AGGIUNGERE privilegi, non toglierne di globali.
-- Senza, `anon` riavrebbe ogni funzione nuova di `public` tramite PUBLIC, anche
-- tolto il suo grant esplicito: la regola "ogni funzione dice `revoke … from
-- public, anon`" tornerebbe a reggersi sulla memoria di chi scrive, e una
-- `security definer` dimenticata sarebbe chiamabile con la chiave pubblicabile.
--
-- Il prezzo, dichiarato: una funzione che `postgres` crea FUORI da `public` e
-- `storage` (gli unici schemi dove ha un default proprio) nasce eseguibile solo
-- dal proprietario. Oggi non ce n'è nessuna — estensioni, `cron`, `graphql` e
-- gli altri schemi della piattaforma sono di `supabase_admin`, a cui questi
-- default non si applicano. Se un giorno servisse uno schema `private` per le
-- funzioni delle policy, va concesso `execute` ad `authenticated` a mano. È un
-- guasto che fa rumore (`permission denied for function` al primo uso), contro
-- uno che tace (una funzione chiamabile da chiunque): la scelta è quella.

alter default privileges for role postgres in schema public revoke all     on tables    from anon;
alter default privileges for role postgres in schema public revoke all     on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres                  revoke execute on functions from public;


-- ----------------------------------------------------------------------------
-- 4. Verifica — ESEGUITA, non commentata
-- ----------------------------------------------------------------------------
-- Le post-condizioni leggono il catalogo e non creano niente, quindi possono
-- stare nel file vivo (code review della #154). Ognuno dei modi in cui una
-- revoca non ha effetto — un WARNING su un privilegio concesso da un altro
-- ruolo, un grant a PUBLIC, una funzione sfuggita al ciclo — diventa qui un
-- errore, e il SQL Editor annulla l'intero file invece di stampare un
-- "Success" che mente. È la guardia della sezione 0 vista dall'altra parte:
-- quella controlla le premesse, questa il risultato.

do $$
declare
	v_txt text;
begin
	select string_agg(distinct c.relname::text, ', ') into v_txt
	from pg_class c
	join pg_namespace n on n.oid = c.relnamespace
	cross join lateral aclexplode(c.relacl) a
	where n.nspname = 'public'
	  and a.grantee in (0, 'anon'::regrole::oid);
	if v_txt is not null then
		raise exception '20260822: anon (o PUBLIC) ha ancora privilegi su %. Niente è stato scritto.', v_txt;
	end if;

	select string_agg(p.oid::regprocedure::text, ', ') into v_txt
	from pg_proc p
	join pg_namespace n on n.oid = p.pronamespace
	where n.nspname = 'public'
	  and has_function_privilege('anon', p.oid, 'EXECUTE');
	if v_txt is not null then
		raise exception '20260822: anon esegue ancora %. Niente è stato scritto.', v_txt;
	end if;

	select string_agg(d.defaclobjtype::text, ', ') into v_txt
	from pg_default_acl d
	cross join lateral aclexplode(d.defaclacl) a
	where d.defaclrole = 'postgres'::regrole::oid
	  and d.defaclnamespace = 'public'::regnamespace::oid
	  and a.grantee in (0, 'anon'::regrole::oid);
	if v_txt is not null then
		raise exception '20260822: i default di postgres su public concedono ancora ad anon (tipi: %). Niente è stato scritto.', v_txt;
	end if;

	if not exists (
		select 1 from pg_default_acl d
		where d.defaclrole = 'postgres'::regrole::oid
		  and d.defaclnamespace = 0
		  and d.defaclobjtype = 'f'
		  and not exists (select 1 from aclexplode(d.defaclacl) a where a.grantee = 0)
	) then
		raise exception '20260822: le funzioni nuove di postgres nascono ancora con execute a PUBLIC. Niente è stato scritto.';
	end if;

	-- Il gemello positivo: una revoca troppo larga passerebbe tutte le prove qui
	-- sopra. Questi due servono all'app (il CHECK di `budgets`, ogni lettura).
	if not (has_function_privilege('authenticated', 'public.budget_period_start(text, date)', 'EXECUTE')
	    and has_table_privilege('authenticated', 'public.transactions', 'SELECT')) then
		raise exception '20260822: authenticated ha perso un privilegio che l''app usa. Niente è stato scritto.';
	end if;
end $$;


-- ----------------------------------------------------------------------------
-- 5. Controprova
-- ----------------------------------------------------------------------------
-- ⚠️⚠️ COMMENTATA, e non è un dettaglio: termina con un `raise exception`
-- voluto, e il SQL Editor di Supabase esegue lo script come UNA transazione.
-- Lasciata eseguibile qui sotto, farebbe rollback anche delle sezioni 1-4 —
-- cioè di questa migration — stampando il messaggio di successo (Fase 21b).
-- Si copia in una query NUOVA, si tolgono i `--`, si esegue a parte.
--
-- Tutto ciò che crea (una tabella, due funzioni, un trigger) sparisce col
-- rollback finale. ⚠️ Gira come `postgres`: le prove come `anon` e
-- `authenticated` passano da `set local role`, perché `postgres` ha
-- `BYPASSRLS` e tutti i privilegi da proprietario — da lì nessun rifiuto si
-- vedrebbe mai.
--
-- do $$
-- declare
-- 	v_txt text;
-- 	v_x   int;
-- begin
-- 	-- c1: nessuna relazione di public con anon (o PUBLIC) nella acl
-- 	select string_agg(distinct c.relname::text, ', ') into v_txt
-- 	from pg_class c
-- 	join pg_namespace n on n.oid = c.relnamespace
-- 	cross join lateral aclexplode(c.relacl) a
-- 	where n.nspname = 'public' and a.grantee in (0, 'anon'::regrole::oid);
-- 	if v_txt is not null then raise exception 'c1 KO: anon ha ancora privilegi su %', v_txt; end if;
--
-- 	-- c2: nessuna funzione di public eseguibile da anon
-- 	select string_agg(p.oid::regprocedure::text, ', ') into v_txt
-- 	from pg_proc p
-- 	join pg_namespace n on n.oid = p.pronamespace
-- 	where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');
-- 	if v_txt is not null then raise exception 'c2 KO: anon esegue ancora %', v_txt; end if;
--
-- 	-- c3: authenticated conserva ciò che serve all'app (il gemello positivo di
-- 	-- c1 e c2: senza, una revoca troppo larga passerebbe per riuscita)
-- 	if not (has_table_privilege('authenticated', 'public.transactions', 'SELECT')
-- 	    and has_table_privilege('authenticated', 'public.transactions', 'INSERT')
-- 	    and has_table_privilege('authenticated', 'public.transactions', 'UPDATE')
-- 	    and has_table_privilege('authenticated', 'public.transactions', 'DELETE')
-- 	    and has_table_privilege('authenticated', 'public.account_balances', 'SELECT')
-- 	    and has_function_privilege('authenticated', 'public.budget_period_start(text, date)', 'EXECUTE')
-- 	    and has_function_privilege('authenticated', 'public.dashboard_totals(timestamptz[], uuid)', 'EXECUTE'))
-- 	then raise exception 'c3 KO: authenticated ha perso un privilegio che l''app usa'; end if;
--
-- 	-- c4: anon che legge transactions → rifiutato dal GRANT, non filtrato dalla RLS
-- 	begin
-- 		set local role anon;
-- 		perform 1 from public.transactions limit 1;
-- 		raise exception 'c4 KO: anon legge transactions (0 righe dalla RLS, non un rifiuto)';
-- 	exception when insufficient_privilege then
-- 		if sqlerrm not like 'permission denied for table%' then raise exception 'c4 KO: rifiuto inatteso: %', sqlerrm; end if;
-- 	end;
--
-- 	-- c5: anon che scrive → "permission denied", NON "row-level security"
-- 	-- (quella dava già 42501 prima di questo file: il codice da solo non prova niente)
-- 	begin
-- 		set local role anon;
-- 		insert into public.transactions (user_id, account_id, amount, type, date)
-- 		values (gen_random_uuid(), gen_random_uuid(), 1, 'spesa', now());
-- 		raise exception 'c5 KO: anon ha inserito in transactions';
-- 	exception when insufficient_privilege then
-- 		if sqlerrm not like 'permission denied for table%' then raise exception 'c5 KO: rifiuto della RLS, non del grant: %', sqlerrm; end if;
-- 	end;
--
-- 	-- c6: anon che chiama una helper dei budget
-- 	begin
-- 		set local role anon;
-- 		perform public.budget_warning_threshold();
-- 		raise exception 'c6 KO: anon esegue budget_warning_threshold()';
-- 	exception when insufficient_privilege then null;
-- 	end;
--
-- 	-- c7: una tabella e una funzione NUOVE nascono senza anon (la sezione 3), la
-- 	-- tabella ha la RLS accesa (rls_auto_enable() scatta ancora) e
-- 	-- authenticated ha i suoi privilegi dal default
-- 	create table public._prova_154 (x int);
-- 	if exists (select 1 from pg_class c cross join lateral aclexplode(c.relacl) a
-- 	           where c.oid = 'public._prova_154'::regclass and a.grantee in (0, 'anon'::regrole::oid))
-- 	then raise exception 'c7 KO: una tabella nuova nasce ancora con anon'; end if;
-- 	if not has_table_privilege('authenticated', 'public._prova_154', 'INSERT')
-- 	then raise exception 'c7 KO: una tabella nuova nasce senza authenticated'; end if;
-- 	if not (select relrowsecurity from pg_class where oid = 'public._prova_154'::regclass)
-- 	then raise exception 'c7 KO: la tabella nuova non ha la RLS (rls_auto_enable non è scattata)'; end if;
-- 	create function public._prova_154_f() returns int language sql as 'select 1';
-- 	if has_function_privilege('anon', 'public._prova_154_f()', 'EXECUTE')
-- 	then raise exception 'c7 KO: una funzione nuova è eseguibile da anon'; end if;
-- 	if not has_function_privilege('authenticated', 'public._prova_154_f()', 'EXECUTE')
-- 	then raise exception 'c7 KO: una funzione nuova non è eseguibile da authenticated'; end if;
--
-- 	-- c8: un trigger scatta anche se chi scrive NON ha execute sulla funzione —
-- 	-- è ciò su cui conta handle_new_user() dopo la sezione 2
-- 	create function public._prova_154_trg() returns trigger language plpgsql
-- 		as $f$ begin new.x := 42; return new; end $f$;
-- 	revoke all on function public._prova_154_trg() from public, anon, authenticated;
-- 	create trigger _prova_154_t before insert on public._prova_154
-- 		for each row execute function public._prova_154_trg();
-- 	create policy _prova_154_p on public._prova_154 for all to authenticated
-- 		using (true) with check (true);
-- 	if has_function_privilege('authenticated', 'public._prova_154_trg()', 'EXECUTE')
-- 	then raise exception 'c8 KO: la prova non prova niente, authenticated ha execute'; end if;
-- 	begin
-- 		set local role authenticated;
-- 		insert into public._prova_154 values (1);
-- 	exception when insufficient_privilege then
-- 		raise exception 'c8 KO: un trigger controlla execute quando scatta, handle_new_user() fermerebbe la registrazione: %', sqlerrm;
-- 	end;
-- 	reset role;
-- 	select x into v_x from public._prova_154;
-- 	if v_x is distinct from 42 then raise exception 'c8 KO: il trigger non è scattato (x = %)', v_x; end if;
--
-- 	-- c9: le query della sezione 4 (le stesse di c1 e c2) VEDONO un guasto —
-- 	-- un grant ad anon su una tabella, uno a PUBLIC su una funzione. Senza
-- 	-- questa prova, una verifica che non guarda niente passerebbe come una
-- 	-- che funziona. Il rollback finale toglie entrambi i grant.
-- 	grant select on public.job_runs to anon;
-- 	grant execute on function public.budget_warning_threshold() to public;
-- 	select string_agg(distinct c.relname::text, ', ') into v_txt
-- 	from pg_class c
-- 	join pg_namespace n on n.oid = c.relnamespace
-- 	cross join lateral aclexplode(c.relacl) a
-- 	where n.nspname = 'public' and a.grantee in (0, 'anon'::regrole::oid);
-- 	if v_txt is distinct from 'job_runs' then raise exception 'c9 KO: la verifica delle relazioni non vede il grant iniettato (%)', v_txt; end if;
-- 	select string_agg(p.oid::regprocedure::text, ', ') into v_txt
-- 	from pg_proc p
-- 	join pg_namespace n on n.oid = p.pronamespace
-- 	where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');
-- 	-- coalesce: con NULL, `not like` è NULL e la prova passerebbe senza aver visto niente
-- 	if coalesce(v_txt, '') not like '%budget_warning_threshold%' then raise exception 'c9 KO: la verifica delle funzioni non vede PUBLIC (%)', v_txt; end if;
--
-- 	raise exception 'ROLLBACK VOLUTO — tutte le prove superate (c1-c9), niente è stato scritto';
-- end $$;
