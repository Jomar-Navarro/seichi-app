-- ============================================================================
-- Fase 14 — Transazioni ricorrenti  ⚠️ FILE RECUPERATO A POSTERIORI
-- ============================================================================
-- Questa SQL è stata eseguita a mano su Supabase il 2026-07-28 e MAI committata:
-- fino al 2026-08-04 è esistita solo dentro il database. Il file è stato
-- ricostruito con:
--
--   select pg_get_functiondef('public.generate_recurring_transactions()'::regprocedure);
--
-- La data nel nome è quella del merge della PR #38, così l'ordinamento dei file
-- rispetta le dipendenze reali (`20260729_account_security.sql` cancella da
-- `recurring_rules`, quindi deve venire dopo).
--
-- ⚠️ INCOMPLETO. Qui c'è la SOLA funzione, verificata parola per parola contro
-- il database. Mancano ancora, perché non sono state ispezionate:
--   - il DDL della tabella `recurring_rules` e i suoi vincoli
--   - le policy RLS su `recurring_rules`
--   - la colonna `transactions.recurring_rule_id`
-- Ricostruirli a memoria dallo schema documentato sarebbe una supposizione, e
-- una migration che mente è peggio di una migration che manca. Vanno recuperati
-- con la stessa tecnica prima di considerare il repo autosufficiente.
--
-- ⚠️ La schedulazione pg_cron di questa funzione è stata SOSTITUITA dalla
-- Fase 17b: il job `generate-recurring` non esiste più, al suo posto c'è
-- `seichi-daily` che invoca `run_daily_jobs()`. Vedi `20260804_notifications.sql`.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- generate_recurring_transactions()
-- ----------------------------------------------------------------------------
-- Per ogni regola attiva con next_run scaduto genera le occorrenze fino a oggi
-- e avanza next_run. Il ciclo interno recupera anche più occorrenze in una sola
-- esecuzione, quindi un giorno di cron saltato non perde movimenti.
--
-- Lo SCOPING è la parte da non toccare: `v_uid := auth.uid()` è NULL quando la
-- funzione parte dal cron (nessun JWT nel contesto), e in quel caso il filtro
-- `(v_uid is null or user_id = v_uid)` la fa lavorare su TUTTI gli utenti.
-- Chiamata invece via RPC da un utente autenticato, auth.uid() ha un valore e la
-- funzione tocca solo le sue regole — ed è ciò che permette a createRecurringRule
-- di materializzare subito la prima occorrenza senza poter toccare dati altrui.
--
-- Da qui la sicurezza del wrapper `run_daily_jobs()` della Fase 17b: essendo
-- anch'esso invocato dal cron, auth.uid() resta NULL e il comportamento non
-- cambia.
--
-- NB: usa `SET search_path TO 'public'` mentre le funzioni delle Fasi 16-17
-- usano `SET search_path = ''`. La seconda è più severa, ma qui ogni oggetto è
-- già qualificato con lo schema, quindi non c'è esposizione allo shadowing.

CREATE OR REPLACE FUNCTION public.generate_recurring_transactions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
	r public.recurring_rules%rowtype;
	v_uid uuid := auth.uid();
	v_next date;
begin
	for r in
		select * from public.recurring_rules
		where active = true
			and next_run <= current_date
			and (v_uid is null or user_id = v_uid)
	loop
		v_next := r.next_run;
		while v_next <= current_date and (r.end_date is null or v_next <= r.end_date) loop
			insert into public.transactions (user_id, amount, type, category_id, notes, date, recurring_rule_id)
			values (r.user_id, r.amount, r.type, r.category_id, r.notes, v_next, r.id);

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
	end loop;
end;
$function$;
