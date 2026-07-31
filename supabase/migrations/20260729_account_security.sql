-- ============================================================================
-- Fase 16 — Gestione account e sicurezza
-- ============================================================================
-- Esegui questo file nel SQL Editor di Supabase (una volta sola).
-- È idempotente: puoi rieseguirlo senza rompere nulla.
--
-- Cosa fa:
--   1. profiles: aggiunge full_name + avatar_url e fa il backfill dai metadata
--   2. RLS su profiles
--   3. trigger: crea la riga profiles alla registrazione (non più solo in onboarding)
--   4. foreign key: garantisce ON DELETE CASCADE verso auth.users
--   5. storage: bucket "avatars" con policy per-utente
--   6. delete_current_user(): eliminazione account senza service_role key
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. PROFILES — nuove colonne
-- ----------------------------------------------------------------------------
-- Il nome NON viene letto da auth.users.raw_user_meta_data perché quel campo è
-- scrivibile dal client (supabase.auth.updateUser({ data })): l'utente potrebbe
-- metterci qualsiasi cosa e non è interrogabile con una join. profiles è la
-- tabella applicativa, protetta da RLS, ed è già la fonte di verità per le
-- preferenze.

alter table public.profiles
	add column if not exists full_name  text,
	add column if not exists avatar_url text;

-- Backfill: nome e cognome salvati al signup (options.data) oppure forniti da
-- Google/Facebook al primo login OAuth.
update public.profiles p
set full_name = nullif(
	trim(
		coalesce(u.raw_user_meta_data ->> 'full_name',
			concat_ws(' ',
				u.raw_user_meta_data ->> 'name',
				u.raw_user_meta_data ->> 'surname'
			)
		)
	),
	''
)
from auth.users u
where u.id = p.id
	and p.full_name is null;


-- ----------------------------------------------------------------------------
-- 2. RLS su profiles
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
	for select to authenticated
	using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
	for insert to authenticated
	with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
	for update to authenticated
	using ((select auth.uid()) = id)
	with check ((select auth.uid()) = id);

-- Nessuna policy di DELETE: la riga sparisce solo via cascade da auth.users.


-- ----------------------------------------------------------------------------
-- 3. TRIGGER — crea il profilo alla registrazione
-- ----------------------------------------------------------------------------
-- Prima della Fase 16 la riga in profiles nasceva solo quando l'utente
-- completava l'onboarding (savePreferences fa un upsert). Risultato: tra signup
-- e onboarding l'utente non aveva profilo, e la pagina impostazioni non aveva
-- dove leggere il nome. Il trigger rende la creazione deterministica.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''   -- previene lo shadowing di funzioni/tabelle via search_path
as $$
begin
	insert into public.profiles (id, full_name)
	values (
		new.id,
		nullif(
			trim(
				coalesce(new.raw_user_meta_data ->> 'full_name',
					concat_ws(' ',
						new.raw_user_meta_data ->> 'name',
						new.raw_user_meta_data ->> 'surname'
					)
				)
			),
			''
		)
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 4. FOREIGN KEY — ON DELETE CASCADE verso auth.users
-- ----------------------------------------------------------------------------
-- Senza cascade, eliminare l'utente lascerebbe transazioni e categorie orfane
-- (dati personali che sopravvivono alla cancellazione: problema GDPR, oltre che
-- di integrità). Ricreiamo i vincoli con la clausola corretta.

alter table public.profiles        drop constraint if exists profiles_id_fkey;
alter table public.profiles        add  constraint profiles_id_fkey
	foreign key (id) references auth.users (id) on delete cascade;

alter table public.categories      drop constraint if exists categories_user_id_fkey;
alter table public.categories      add  constraint categories_user_id_fkey
	foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.transactions    drop constraint if exists transactions_user_id_fkey;
alter table public.transactions    add  constraint transactions_user_id_fkey
	foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.recurring_rules drop constraint if exists recurring_rules_user_id_fkey;
alter table public.recurring_rules add  constraint recurring_rules_user_id_fkey
	foreign key (user_id) references auth.users (id) on delete cascade;


-- ----------------------------------------------------------------------------
-- 5. STORAGE — bucket avatars
-- ----------------------------------------------------------------------------
-- Bucket pubblico in LETTURA, ma con path non indovinabile:
--   avatars/{user_id}/{uuid}.{ext}
-- Il segmento uuid viene rigenerato a ogni upload, quindi conoscere lo user_id
-- non basta per costruire l'URL. In cambio l'immagine è servita dalla CDN e
-- cacheable, senza dover firmare un URL a ogni render (l'avatar compare in ogni
-- pagina dell'app, nel ProfileMenu).
-- La SCRITTURA resta vincolata: ogni utente può toccare solo la propria cartella.
--
-- ⚠️ Nessuna policy di SELECT aperta a `public`. Il bucket è pubblico, quindi
-- GET /storage/v1/object/public/avatars/... NON passa da RLS: le <img> e
-- next/image funzionano comunque. Una policy `for select to public` servirebbe
-- solo alle API autenticate — cioè a list(), che con essa permetterebbe a
-- CHIUNQUE abbia la anon key di elencare le cartelle del bucket. Sono gli
-- user_id di tutti gli iscritti, più il nome file di ogni avatar: l'URL
-- "non ricostruibile" tornerebbe ricostruibile e la lista utenti sarebbe
-- pubblica. Qui la SELECT è ristretta alla propria cartella, quel tanto che
-- basta al list() di purgeAvatarFiles().

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'avatars',
	'avatars',
	true,
	2097152,                                              -- 2 MB
	array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public             = excluded.public,
	file_size_limit    = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

-- Rimuove la vecchia policy aperta a `public` (vedi nota sopra): il drop deve
-- restare anche dopo che la policy non viene più creata, perché su un progetto
-- dove la migrazione era già stata eseguita è ancora attiva.
drop policy if exists "avatars_public_read"   on storage.objects;

drop policy if exists "avatars_select_own"    on storage.objects;
create policy "avatars_select_own" on storage.objects
	for select to authenticated
	using (
		bucket_id = 'avatars'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

drop policy if exists "avatars_insert_own"    on storage.objects;
create policy "avatars_insert_own" on storage.objects
	for insert to authenticated
	with check (
		bucket_id = 'avatars'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

drop policy if exists "avatars_update_own"    on storage.objects;
create policy "avatars_update_own" on storage.objects
	for update to authenticated
	using (
		bucket_id = 'avatars'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	)
	with check (
		bucket_id = 'avatars'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

drop policy if exists "avatars_delete_own"    on storage.objects;
create policy "avatars_delete_own" on storage.objects
	for delete to authenticated
	using (
		bucket_id = 'avatars'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);


-- ----------------------------------------------------------------------------
-- 6. ELIMINAZIONE ACCOUNT
-- ----------------------------------------------------------------------------
-- supabase.auth.admin.deleteUser() richiederebbe la service_role key nel
-- backend: una chiave che scavalca RLS su TUTTI gli utenti. Metterla nelle env
-- di Vercel per una sola funzione è un rischio sproporzionato.
--
-- Alternativa: una funzione SECURITY DEFINER che gira con i privilegi del
-- proprietario ma cancella esclusivamente la riga di auth.uid(). L'utente non
-- può passare un id altrui perché l'id non è un parametro.
--
-- Note di sicurezza applicate qui:
--   - SET search_path = ''  → impedisce che un oggetto malevolo in uno schema
--     anteposto venga risolto al posto di quello atteso
--   - REVOKE da public/anon → solo un utente autenticato può invocarla
--   - i DELETE espliciti sulle tabelle applicative rendono la funzione corretta
--     anche se un domani una FK venisse ricreata senza cascade

-- Il vecchio prototipo senza argomenti va rimosso esplicitamente: convivendo
-- con la versione che ha un parametro con default, la chiamata a zero argomenti
-- diventerebbe ambigua ("function is not unique") e l'eliminazione account
-- smetterebbe di funzionare su chi ha già eseguito la migrazione.
drop function if exists public.delete_current_user();

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
	-- file dell'avatar. Quella cancellazione è irreversibile e deve precedere la
	-- RPC (vedi sotto), quindi senza una verifica preliminare una funzione mai
	-- installata, un grant sbagliato o una sessione scaduta lascerebbero
	-- l'account vivo e la foto distrutta. Qui non tocchiamo niente: se la
	-- chiamata arriva fin qui, la vera esecuzione può solo fallire per un errore
	-- transitorio.
	if dry_run then
		return;
	end if;

	-- I file dell'avatar NON si cancellano da qui: Supabase blocca il DELETE
	-- diretto su storage.objects ("Direct deletion from storage tables is not
	-- allowed. Use the Storage API instead") e l'intera funzione fallirebbe.
	-- Ci pensa deleteAccount() lato app con l'API storage, prima di invocare
	-- questa funzione. Vedi app/(main)/impostazioni/account/actions.ts

	delete from public.transactions    where user_id = uid;
	delete from public.recurring_rules where user_id = uid;
	delete from public.categories      where user_id = uid;
	delete from public.profiles        where id      = uid;

	delete from auth.users where id = uid;
end;
$$;

revoke all     on function public.delete_current_user(boolean) from public, anon;
grant  execute on function public.delete_current_user(boolean) to authenticated;
