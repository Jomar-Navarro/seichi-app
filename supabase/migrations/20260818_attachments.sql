-- ============================================================================
-- Fase 22 — Allegati / ricevute (issue #36)
-- ============================================================================
-- ⚠️ ESEGUIRE PRIMA di pubblicare il codice, e l'asimmetria è la solita:
--
--   · codice nuovo su database vecchio → ogni upload fallisce (la tabella e il
--     bucket non esistono).
--   · database nuovo su codice vecchio → **non succede niente**. Nessuno scrive
--     `attachments`, il bucket resta vuoto, e il vincolo nuovo su `transactions`
--     è un UNIQUE su una coppia già unica per costruzione.
--
-- ----------------------------------------------------------------------------
-- Il bucket è PRIVATO, e qui NON si copia il precedente degli avatar
-- ----------------------------------------------------------------------------
-- `avatars` è pubblico in lettura perché l'avatar compare su ogni pagina e
-- conviene servirlo dalla CDN; l'unica protezione è un path non indovinabile
-- (`{user_id}/{uuid}.{ext}`).
--
-- Per una ricevuta quel calcolo si rovescia. Si apre **una alla volta, su
-- richiesta** — nessun guadagno dalla cache — e contiene cosa hai comprato, dove
-- e quando, a volte le ultime cifre della carta. Un URL non indovinabile è
-- sicurezza per oscurità: accettabile per una foto profilo, non per un
-- documento finanziario. Qui si serve un **URL firmato a scadenza breve**,
-- generato dal server a ogni apertura, e ogni accesso passa da RLS.
--
-- ----------------------------------------------------------------------------
-- ⚠️ Il percorso dei file è PIATTO, e la ragione è la CANCELLAZIONE
-- ----------------------------------------------------------------------------
--   receipts/{user_id}/{uuid}.{ext}      ← e NON .../{transaction_id}/...
--
-- `purgeAvatarFiles()` — il modello che questa fase riusa — fa `list(userId)`,
-- che è **piatto**: con un livello in più restituirebbe le sottocartelle e non i
-- file, e l'eliminazione account lascerebbe ogni ricevuta nel bucket, in
-- silenzio e non più cancellabile da nessuno. Il legame con la transazione vive
-- nel database, che è dove va una relazione.
--
-- ----------------------------------------------------------------------------
-- ⚠️ Il vero nodo della fase: la cascade tiene pulito il DB e PERDE i file
-- ----------------------------------------------------------------------------
-- Supabase **vieta il DELETE diretto su `storage.objects`**, quindi la pulizia
-- non può stare qui né nel job notturno: è per forza lato app. E la `cascade`
-- che cancella la riga di `attachments` è proprio ciò che impedisce all'app di
-- sapere quali file orfanare. I percorsi mappati prima di scrivere:
--
--   deleteTransaction   diretta          → l'app vede le righe
--   deleteGoal          esplicita        → idem
--   deleteCategory      RIFIUTA se ci sono movimenti collegati
--   undoImport          CASCADE          → ⚠️ raccogliere i path PRIMA
--   deleteAccount       CASCADE nella RPC → ⚠️ raccogliere i path PRIMA
--
-- ----------------------------------------------------------------------------
-- Cosa fa, in ordine
-- ----------------------------------------------------------------------------
--   1. `transactions` acquisisce UNIQUE (id, user_id) — serve alla FK composita
--   2. tabella `attachments` + indici
--   3. RLS e policy
--   4. bucket `receipts` (PRIVATO) e policy di storage
--   5. `delete_current_user()` con `attachments`
--   6. guardia sulla `20260816`, che ne ridefinisce una versione superata
--   7. controprova (COMMENTATA — si esegue a parte)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. UNIQUE (id, user_id) su transactions
-- ----------------------------------------------------------------------------
-- Ridondante in senso stretto — `id` è già unico, quindi la coppia lo è per
-- forza — ma è la ridondanza che permette al database di esprimere "quella
-- transazione appartiene a QUESTO utente" come vincolo invece che come
-- controllo applicativo. È esattamente ciò che la 20b ha fatto su `accounts`.
--
-- ⚠️ Senza, l'unica difesa sarebbe la RLS di `attachments`, che filtra
-- `user_id` — una colonna che scrive il server. Un insert costruito a mano con
-- il proprio `user_id` e il `transaction_id` di un ALTRO utente passerebbe: la
-- riga sarebbe "mia" per la RLS e punterebbe alla transazione di un altro.
-- È lo stesso buco che la 20b ha chiuso per i conti, nella stessa forma.

alter table public.transactions drop constraint if exists transactions_id_user_key;
alter table public.transactions add  constraint transactions_id_user_key unique (id, user_id);


-- ----------------------------------------------------------------------------
-- 2. La tabella
-- ----------------------------------------------------------------------------
-- ⚠️ Una TABELLA e non una colonna `attachment_path`, e il test è quello che
-- questo progetto usa altrove (`accounts.type`): *esiste un caso reale in cui
-- ne servono due?* Tre risposte sì, tutte normali:
--
--   1. ristorante — scontrino fiscale + ricevuta della carta;
--   2. fattura multipagina fotografata in due scatti;
--   3. acquisto + certificato di garanzia.
--
-- Con una colonna sola quei casi diventano **irrappresentabili** e costringono a
-- scegliere quale ricevuta perdere. È il rovescio della regola che il progetto
-- applica di solito: là si rende irrappresentabile lo stato ILLEGALE, qui una
-- colonna renderebbe irrappresentabile uno stato perfettamente legale.

create table if not exists public.attachments (
	id             uuid primary key default gen_random_uuid(),
	user_id        uuid not null references auth.users (id) on delete cascade,
	transaction_id uuid not null,
	/*
	 * Il path dentro il bucket, NON un URL.
	 *
	 * ⚠️ Un URL firmato scade: memorizzarlo darebbe una colonna che diventa
	 * falsa da sola, dopo qualche minuto, senza che nulla la aggiorni. Si salva
	 * ciò che non cambia — il percorso — e la firma si chiede all'apertura.
	 * `unique` perché due righe non devono poter puntare allo stesso file: la
	 * rimozione della prima lascerebbe la seconda a indicare il vuoto.
	 */
	storage_path   text not null unique,
	mime_type      text not null,
	size_bytes     integer not null check (size_bytes > 0),
	created_at     timestamptz not null default now(),

	/*
	 * ⚠️ FK COMPOSITA, come nella 20b: garantisce che la transazione ESISTA **e**
	 * che sia dell'utente che sta scrivendo. `cascade` perché un allegato senza
	 * la sua transazione non significa niente — ma vedi la nota in testa: la
	 * cascade cancella la RIGA, il FILE lo deve togliere l'app.
	 */
	constraint attachments_transaction_owner_fkey
		foreign key (transaction_id, user_id)
		references public.transactions (id, user_id)
		on delete cascade
);

-- ⚠️ Indici sulle FK, non solo per le SELECT: senza, ogni cancellazione in
-- cascata scandisce l'intera tabella. È la classe che la #43 ha chiuso a metà e
-- che la #55 tiene aperta — non la si riapre qui.
create index if not exists attachments_transaction_idx on public.attachments (transaction_id);
create index if not exists attachments_user_idx        on public.attachments (user_id);


-- ----------------------------------------------------------------------------
-- 3. RLS
-- ----------------------------------------------------------------------------
-- ⚠️ Tre policy, NIENTE update — come `imports`. Un allegato non si modifica:
-- si aggiunge o si toglie. Una policy di update permetterebbe di riscrivere
-- `storage_path` su una riga propria, cioè di far puntare il proprio allegato a
-- un file altrui: la RLS decide le RIGHE, non le COLONNE (la lezione della 17b).

alter table public.attachments enable row level security;

drop policy if exists attachments_select_own on public.attachments;
create policy attachments_select_own on public.attachments
	for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists attachments_insert_own on public.attachments;
create policy attachments_insert_own on public.attachments
	for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists attachments_delete_own on public.attachments;
create policy attachments_delete_own on public.attachments
	for delete to authenticated using (user_id = (select auth.uid()));


-- ----------------------------------------------------------------------------
-- 4. Il bucket `receipts` — PRIVATO
-- ----------------------------------------------------------------------------
-- ⚠️ `public = false`: è la differenza sostanziale rispetto ad `avatars`, e la
-- ragione sta in testa al file. Con il bucket privato NON esiste un
-- `/object/public/...` che scavalchi la RLS: ogni lettura passa da una policy o
-- da un URL firmato dal server.
--
-- ⚠️ Solo IMMAGINI, e i PDF restano fuori DI PROPOSITO. Una fattura via email è
-- un caso reale, ma richiede una resa in-app che non è un dettaglio; ammetterlo
-- dopo costa **una riga** (`update storage.buckets set allowed_mime_types`) e
-- nessun backfill, quindi non c'è ragione di anticiparlo adesso — al contrario
-- di una colonna, che va messa subito.
--
-- ⚠️ 2 MB come l'avatar e come l'import, e il numero appartiene a una CATENA che
-- va tenuta allineata a mano: `bodySizeLimit` in next.config.ts (3mb, più alto
-- perché vale sul body multipart grezzo), `file_size_limit` qui,
-- `ATTACHMENT_MAX_BYTES` in lib/attachments.ts e il testo nella UI. Cambiarne
-- uno solo produce un rifiuto che arriva dal livello sbagliato, con un messaggio
-- che non aiuta.
--
-- Da qui anche la RIDUZIONE lato client: la foto di un telefono pesa 3-8 MB,
-- quindi senza ridimensionamento la funzione non sarebbe usabile affatto — non
-- è un'ottimizzazione, è il prerequisito.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'receipts',
	'receipts',
	false,
	2097152,                                              -- 2 MB
	array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public             = excluded.public,
	file_size_limit    = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

-- Le policy: ogni utente vede e tocca solo la propria cartella. Identiche a
-- quelle degli avatar tranne che qui la SELECT è l'UNICA via di lettura — là era
-- un di più, perché il bucket pubblico serviva le immagini da sé.
drop policy if exists "receipts_select_own" on storage.objects;
create policy "receipts_select_own" on storage.objects
	for select to authenticated
	using (
		bucket_id = 'receipts'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

drop policy if exists "receipts_insert_own" on storage.objects;
create policy "receipts_insert_own" on storage.objects
	for insert to authenticated
	with check (
		bucket_id = 'receipts'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

drop policy if exists "receipts_delete_own" on storage.objects;
create policy "receipts_delete_own" on storage.objects
	for delete to authenticated
	using (
		bucket_id = 'receipts'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

-- ⚠️ Nessuna policy di UPDATE, al contrario degli avatar. Là serve perché
-- l'upload usa `upsert` su un path che può già esistere; qui ogni ricevuta ha un
-- uuid nuovo, quindi un update non avviene mai — e concederlo permetterebbe di
-- sovrascrivere il contenuto di un file già referenziato da una riga.


-- ----------------------------------------------------------------------------
-- 5. delete_current_user() — con attachments
-- ----------------------------------------------------------------------------
-- ⚠️ La funzione fa i DELETE espliciti tabella per tabella, e il rovescio è che
-- **dimenticare una tabella qui non produce errori**: lascia dati personali di
-- un utente cancellato. `attachments` porta i nomi dei file e le date, quindi è
-- esattamente il genere di residuo che non deve sopravvivere.
--
-- `attachments` PRIMA di `transactions`: la cascade basterebbe, ma la funzione
-- non si appoggia alle cascade per scelta — vale la stessa nota di `imports`.

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
	-- file, che è irreversibile.
	if dry_run then
		return;
	end if;

	-- ⚠️ I file dello Storage NON si cancellano da qui: Supabase blocca il
	-- DELETE diretto su storage.objects. Ci pensa deleteAccount() lato app —
	-- avatar E ricevute, queste ultime dalla Fase 22.

	delete from public.notifications   where user_id = uid;
	delete from public.budgets         where user_id = uid;
	delete from public.attachments     where user_id = uid;   -- prima di transactions
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


-- ----------------------------------------------------------------------------
-- 6. Guardia sulla 20260816
-- ----------------------------------------------------------------------------
-- Quel file ridefinisce `delete_current_user()` nella versione che NON conosce
-- `attachments`. Rieseguirlo non darebbe alcun errore: farebbe il danno in
-- silenzio, lasciando le righe degli allegati — e con esse i nomi dei file — di
-- un utente che ha chiesto di sparire.
--
-- ⚠️ La guardia va messa LÀ, non qui — un file si difende da chi lo riesegue, e
-- chi lo riesegue non sta leggendo questo. **È già scritta in testa alla
-- `20260816`**: riconosce il successore dall'esistenza della tabella
-- `attachments`, cioè da un fatto del catalogo e non da una convenzione sui nomi
-- dei file.
--
-- ⚠️ E la nota in coda alla `20260816` diceva che nessuna guardia nuova serviva,
-- perché quella della `20260814` copriva anche il ripristino di una
-- `delete_current_user()` incompleta. Era vero **finché la 20260816 era l'ultima
-- a definirla**. La lezione, che vale per ogni migration futura: *una guardia
-- protegge dai successori che esistevano quando è stata scritta* — chi allunga
-- la catena deve guardare daccapo, non fidarsi della copertura ereditata.


-- ============================================================================
-- 7. CONTROPROVA — COMMENTATA DI PROPOSITO, si esegue A PARTE
-- ============================================================================
-- ⚠️⚠️ NON togliere i commenti dentro questo file. Il blocco termina con un
-- `raise exception` deliberato, e il SQL Editor di Supabase esegue lo script
-- come UNA SOLA TRANSAZIONE: lasciato eseguibile qui, quell'eccezione fa
-- rollback anche delle sezioni 1-5, cioè **della migration stessa**.
--
-- Il sintomo è ingannevole: l'editor stampa il messaggio di successo previsto
-- mentre in realtà ha appena annullato tutto. È successo il 2026-08-20 con la
-- `20260817`, ed è la ragione per cui questo blocco nasce già commentato.
--
-- Si copia in una query NUOVA, si tolgono i `--`, si esegue.
--
--   do $$
--   declare
--   	v_user   uuid;
--   	v_tx     uuid;
--   	v_altrui uuid;
--   	v_ok     boolean;
--   	v_prima  int;
--   	v_dopo   int;
--   	r        text := '';
--   begin
--   	select id into v_user from auth.users order by created_at limit 1;
--   	if v_user is null then
--   		raise exception 'COLLAUDO #36 — SALTATO: nessun utente.';
--   	end if;
--
--   	select id into v_tx from public.transactions where user_id = v_user limit 1;
--   	if v_tx is null then
--   		raise exception 'COLLAUDO #36 — SALTATO: l''utente non ha movimenti.';
--   	end if;
--
--   	-- a1 · un allegato valido si scrive
--   	insert into public.attachments (user_id, transaction_id, storage_path, mime_type, size_bytes)
--   	values (v_user, v_tx, v_user || '/collaudo.jpg', 'image/jpeg', 1234);
--   	r := r || E'\n  a1 OK  — allegato valido accettato';
--
--   	-- b1 · due righe non possono puntare allo STESSO file
--   	v_ok := false;
--   	begin
--   		insert into public.attachments (user_id, transaction_id, storage_path, mime_type, size_bytes)
--   		values (v_user, v_tx, v_user || '/collaudo.jpg', 'image/jpeg', 1234);
--   	exception when unique_violation then v_ok := true;
--   	end;
--   	if v_ok then r := r || E'\n  b1 OK  — storage_path duplicato RIFIUTATO';
--   	else raise exception 'COLLAUDO #36 — b1 FALLITA: due righe sullo stesso file.%', r;
--   	end if;
--
--   	-- b2 · non si può allegare alla transazione di un ALTRO utente
--   	-- ⚠️ È la prova che conta: nessuna policy RLS guarda `transaction_id`,
--   	--    quindi senza la FK composita questo insert PASSEREBBE.
--   	select t.id into v_altrui from public.transactions t where t.user_id <> v_user limit 1;
--   	if v_altrui is null then
--   		r := r || E'\n  b2 SALTATA — serve un SECONDO utente con movimenti';
--   	else
--   		v_ok := false;
--   		begin
--   			insert into public.attachments (user_id, transaction_id, storage_path, mime_type, size_bytes)
--   			values (v_user, v_altrui, v_user || '/altrui.jpg', 'image/jpeg', 10);
--   		exception when foreign_key_violation then v_ok := true;
--   		end;
--   		if v_ok then r := r || E'\n  b2 OK  — allegato su transazione ALTRUI rifiutato';
--   		else raise exception 'COLLAUDO #36 — b2 FALLITA: allegato su transazione altrui.%', r;
--   		end if;
--   	end if;
--
--   	-- b3 · dimensione non positiva rifiutata
--   	v_ok := false;
--   	begin
--   		insert into public.attachments (user_id, transaction_id, storage_path, mime_type, size_bytes)
--   		values (v_user, v_tx, v_user || '/vuoto.jpg', 'image/jpeg', 0);
--   	exception when check_violation then v_ok := true;
--   	end;
--   	if v_ok then r := r || E'\n  b3 OK  — size_bytes = 0 RIFIUTATO';
--   	else raise exception 'COLLAUDO #36 — b3 FALLITA: accettato un file di 0 byte.%', r;
--   	end if;
--
--   	-- a2 · cancellando la transazione l'allegato sparisce (cascade)
--   	select count(*) into v_prima from public.attachments where transaction_id = v_tx;
--   	delete from public.transactions where id = v_tx;
--   	select count(*) into v_dopo  from public.attachments where transaction_id = v_tx;
--   	if v_prima > 0 and v_dopo = 0 then
--   		r := r || E'\n  a2 OK  — la cascade toglie le righe (' || v_prima || ' -> 0)';
--   	else
--   		raise exception 'COLLAUDO #36 — a2 FALLITA: prima %, dopo %.%', v_prima, v_dopo, r;
--   	end if;
--
--   	-- Il bucket esiste ed è PRIVATO
--   	if exists (select 1 from storage.buckets where id = 'receipts' and public = false) then
--   		r := r || E'\n  c1 OK  — bucket receipts presente e PRIVATO';
--   	else
--   		raise exception 'COLLAUDO #36 — c1 FALLITA: bucket assente o pubblico.%', r;
--   	end if;
--
--   	raise exception 'COLLAUDO #36 — TUTTE LE PROVE SUPERATE, niente è stato scritto.%', r;
--   end $$;
--
-- ⚠️ La prova che vale più delle altre è **b2**: nessuna policy RLS guarda
-- `transaction_id`, quindi senza la FK composita della sezione 1 quell'insert
-- passerebbe e un utente potrebbe appendere file alle transazioni di un altro.
-- Richiede un secondo utente con movimenti: senza, dice `SALTATA` invece di
-- tacere — un test che si autoesclude in silenzio è peggio di un test assente.
