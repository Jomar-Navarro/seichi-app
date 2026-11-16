-- ============================================================================
-- 20261116 — le colonne di `categories` che l'app scrive sempre diventano
-- NOT NULL (issue #157, primo passo della #158)
-- ============================================================================
-- `categories` è nata nella Fase 3 dal pannello di Supabase, e la baseline
-- (`20260727`) l'ha fotografata così com'era: `user_id`, `name`, `icon`,
-- `color`, `type` e `created_at` accettano NULL. L'app non ne ha mai scritto
-- uno, e i tipi scritti a mano in `types/index.ts` dicevano `name: string` —
-- un'affermazione sul database che il database non faceva. L'hanno trovata i
-- tipi GENERATI della #157: con `createClient<Database>()` sei letture di
-- categorie non compilavano più. È la classe di difetto della #43: due file
-- che dicono cose diverse sulla stessa colonna, e nessuno dei due la decide.
--
-- Qui la decide il database: uno stato illegale si rende irrappresentabile.
--
-- ⚠️ Scritta interrogando la PRODUZIONE il 2026-11-16 (`db query --remote
-- --read-only`): 61 categorie, zero NULL in ciascuna delle sei colonne. E ogni
-- scrittore dell'app le valorizza tutte: `createCategory`, `updateCategory`,
-- `createGoal`, `updateGoal` (che non tocca `type`, `color` né `user_id`) e
-- l'onboarding (`saveCategories`, da `CATEGORY_MAP`). Il vincolo rifiuta solo
-- una POST costruita a mano, ed è ciò che deve fare. La policy di insert
-- pretendeva già `user_id = auth.uid()`, quindi dall'API un `user_id` NULL non
-- passava neanche prima: ora non passa nemmeno dal SQL Editor.
--
-- ⚠️ `user_id` NOT NULL è il PREREQUISITO della #158 — le FK composite
-- `(category_id, user_id)` verso le categorie, con `MATCH SIMPLE` una colonna
-- NULL disattiverebbe l'intero vincolo (database.md) — non la #158 intera: le
-- chiavi restano a colonna singola, e una riga può ancora puntare alla
-- categoria di un altro utente. Lo dicono le prove c3 e c4 della #123.
--
-- `target_amount` e `target_date` restano nullable: NULL vuol dire «nessun
-- traguardo», una scelta vera.
--
-- ----------------------------------------------------------------------------
-- Cosa fa, in ordine
-- ----------------------------------------------------------------------------
--   1. conta le righe che violerebbero il vincolo, e si ferma PRIMA di scrivere
--   2. `set not null` sulle sei colonne
--
-- Rieseguibile: `set not null` su una colonna già NOT NULL non fa niente.
-- Nessun ordine di deploy: il codice di prima e quello di dopo danno per
-- scontato lo stesso fatto, che adesso è vero anche nel database.
-- La controprova è `supabase/tests/categorie.test.sql`.
-- ============================================================================

-- 1. Le righe che il vincolo rifiuterebbe. `set not null` fallirebbe comunque,
--    ma con un messaggio che nomina una colonna sola; qui si vedono tutte.
do $$
declare
	v_user int; v_name int; v_icon int; v_color int; v_type int; v_created int;
begin
	select count(*) filter (where user_id is null),
	       count(*) filter (where name is null),
	       count(*) filter (where icon is null),
	       count(*) filter (where color is null),
	       count(*) filter (where type is null),
	       count(*) filter (where created_at is null)
	  into v_user, v_name, v_icon, v_color, v_type, v_created
	  from public.categories;

	if v_user + v_name + v_icon + v_color + v_type + v_created > 0 then
		raise exception 'STOP: categorie con colonne NULL — user_id %, name %, icon %, color %, type %, created_at %. '
			'Vanno sistemate a mano, guardandole: non si inventa un nome o un tipo.',
			v_user, v_name, v_icon, v_color, v_type, v_created;
	end if;
end $$;

-- 2. Il vincolo.
alter table public.categories
	alter column user_id    set not null,
	alter column name       set not null,
	alter column icon       set not null,
	alter column color      set not null,
	alter column type       set not null,
	alter column created_at set not null;
