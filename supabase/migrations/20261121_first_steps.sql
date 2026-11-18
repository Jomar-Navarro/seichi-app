-- ============================================================================
-- 20261121 — primi passi: la card che guida un utente nuovo in home (issue #163)
-- ============================================================================
-- Finito l'onboarding, un utente nuovo arriva in una home a zeri. La card
-- «Primi passi» gli indica quattro cose da fare e si spunta da sola leggendo i
-- dati. Progetto e design B («pietre di passaggio») decisi con Jomar il
-- 2026-11-18: docs/storia/issue-163-primi-passi.md.
--
-- Cosa fa, in ordine:
--
--   1. `profiles.first_steps_dismissed_at`: quando l'utente ha chiuso la card.
--      Nel database e non in `localStorage`, perché chiusa su un dispositivo
--      deve restare chiusa sugli altri.
--
--      ⚠️ NULL = «non ancora chiusa», e NESSUN default (lezione della #43: un
--      default fabbrica una scelta mai fatta). Nessun backfill per gli utenti
--      esistenti: scrivere «chiusa» per chi non l'ha mai vista affermerebbe il
--      falso. Chi ha già fatto tutto vede lo stato «completati» e lo chiude una
--      volta.
--
--      Le policy e i grant di `profiles` sono per tabella (baseline e
--      `20260822_revoke_anon`), quindi la colonna nuova è già coperta: la
--      scrive solo il proprietario, `anon` non la tocca.
--
--   2. `first_steps()`: le quattro voci più il link dell'import, in UNA
--      richiesta. La home ha già pagato per le sue richieste (storia:
--      costo-richieste-supabase): la chiama solo finché la card è aperta.
--
--      · saldo:       un conto con `initial_balance <> 0`. Il conto
--                     dell'onboarding nasce a 0, quindi zero = «non fatto»;
--                     chi parte davvero da zero chiude la card con «Ho capito».
--      · transazione: una riga qualsiasi di `transactions`, su TUTTI i conti:
--                     la card non dipende dal conto guardato. Contano anche le
--                     generate dalle ricorrenti e le importate: sono vere.
--      · budget:      una riga con `amount` NON nullo. Una lapide da sola non è
--                     un budget; un budget tolto dopo averlo impostato conta,
--                     perché la riga con l'importo resta nello storico.
--      · obiettivo:   una categoria `risparmio` con `target_amount > 0`.
--                     L'onboarding crea già tre obiettivi senza traguardo: senza
--                     questa condizione la voce sarebbe spuntata dal primo giorno.
--      · import:      una riga di `imports`. Non è una voce: decide solo se
--                     mostrare il link «Importa un estratto conto».
--
--      `security invoker`: legge con i privilegi e la RLS di chi chiama. Il
--      filtro su `user_id` c'è comunque, così ogni `exists` usa l'indice per
--      utente invece di affidarsi alla sola policy.
--
-- Rieseguibile: `add column if not exists`, `create or replace function`.
-- Ordine di deploy: migration PRIMA del codice. Il codice nuovo legge la
-- colonna nella stessa select dell'intestazione: sul database vecchio quella
-- select fallisce (42703) e la home perderebbe nome e avatar fino al push.
-- Il database nuovo con il codice vecchio funziona: nessuno legge la colonna.
-- La controprova è `supabase/tests/primi-passi.test.sql`.
-- ============================================================================

alter table public.profiles add column if not exists first_steps_dismissed_at timestamptz;

comment on column public.profiles.first_steps_dismissed_at is
	'Quando l''utente ha chiuso la card «Primi passi» (#163). NULL = non ancora chiusa: nessun default.';

create or replace function public.first_steps()
returns table (
	has_balance     boolean,
	has_transaction boolean,
	has_budget      boolean,
	has_goal        boolean,
	has_import      boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
	select
		exists (
			select 1 from public.accounts a
			where a.user_id = (select auth.uid()) and a.initial_balance <> 0
		)::boolean,
		exists (
			select 1 from public.transactions t
			where t.user_id = (select auth.uid())
		)::boolean,
		exists (
			select 1 from public.budgets b
			where b.user_id = (select auth.uid()) and b.amount is not null
		)::boolean,
		exists (
			select 1 from public.categories c
			where c.user_id = (select auth.uid()) and c.type = 'risparmio' and c.target_amount > 0
		)::boolean,
		exists (
			select 1 from public.imports i
			where i.user_id = (select auth.uid())
		)::boolean;
$$;

revoke all on function public.first_steps() from public, anon;
grant execute on function public.first_steps() to authenticated;
