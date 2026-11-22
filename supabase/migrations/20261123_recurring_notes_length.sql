-- ============================================================================
-- 20261123 — la nota di una regola ricorrente entra nel movimento (issue #220)
-- ============================================================================
-- `transactions.notes` è `varchar(255)`, `recurring_rules.notes` era `text`.
-- `generate_recurring_transactions()` copia la nota della regola nel movimento,
-- quindi una regola con una nota di 300 caratteri si salvava e poi falliva a
-- ogni generazione (`22001 value too long`): saltata subito, e di nuovo ogni
-- notte. Dalla #173 almeno lo si diceva; ora non si può più scrivere.
-- Storia: docs/storia/issue-220-note-lunghe.md.
--
-- È un'invariante fra due tabelle difesa da un lato solo (lezione 7 di
-- CLAUDE.md): la colonna di arrivo aveva il limite, quella di partenza no.
--
-- Cosa fa, in ordine:
--   1. conta le regole che il vincolo rifiuterebbe, e si ferma PRIMA di
--      scrivere (in produzione, il 2026-11-22: zero, la nota più lunga ne
--      ha 15);
--   2. `recurring_rules_notes_length_check`: `char_length(notes) <= 255`.
--
-- ⚠️ CHECK e non `alter column … type varchar(255)`. Il risultato è lo stesso
-- limite, contato allo stesso modo (`char_length` e `varchar(n)` contano i
-- caratteri, cioè i code point, non i byte); ma cambiare il tipo riscrive la
-- tabella, mentre il CHECK la legge una volta e aggiunge una regola. Ed è la
-- forma dei vincoli fratelli (`recurring_rules_amount_check`). La
-- costante 255 è la stessa di `NOTES_MAX` (`lib/notes.ts`), che il form e le
-- action usano contando nello stesso modo.
--
-- NULL resta legale: una regola senza descrizione.
--
-- Ordine di deploy: il CODICE PRIMA, poi questo file. Il codice nuovo rifiuta
-- già una nota lunga nel form e nell'action, quindi regge con o senza il
-- vincolo; il vincolo senza il codice nuovo trasformerebbe il salvataggio di
-- una nota lunga da «regola saltata ogni notte» in un errore generico del form
-- — non peggiore, ma senza la frase che dice perché. In pratica nessuno scrive
-- 255 caratteri di descrizione nei minuti fra i due: l'ordine è una cortesia.
--
-- Rieseguibile: il conteggio non scrive, il CHECK si toglie e si rimette.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Le regole che il vincolo rifiuterebbe — contate PRIMA di scrivere
-- ----------------------------------------------------------------------------
-- L'`add constraint` fallirebbe comunque, ma con un messaggio che non dice
-- quante né quali. Non si accorciano da qui: tagliare la nota di qualcuno è una
-- decisione sulle sue parole, non una regola.

do $$
declare
	v_rules int;
begin
	select count(*) into v_rules
	from public.recurring_rules
	where char_length(notes) > 255;

	if v_rules > 0 then
		raise exception
			'STOP prima di scrivere: % regole ricorrenti hanno una nota oltre i 255 caratteri (select id, user_id, char_length(notes) from public.recurring_rules where char_length(notes) > 255). Vanno accorciate a mano, poi rieseguire.',
			v_rules
			using errcode = 'check_violation';
	end if;
end $$;


-- ----------------------------------------------------------------------------
-- 2. Il limite della colonna di arrivo, anche su quella di partenza
-- ----------------------------------------------------------------------------

alter table public.recurring_rules drop constraint if exists recurring_rules_notes_length_check;
alter table public.recurring_rules add  constraint recurring_rules_notes_length_check
	check (char_length(notes) <= 255);


-- ----------------------------------------------------------------------------
-- 3. Controprova
-- ----------------------------------------------------------------------------
-- In `supabase/tests/note-lunghe.test.sql`, a ogni PR. Dopo il rilascio, in
-- sola lettura (`db query --remote --read-only`):
--
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'recurring_rules_notes_length_check';
--   -- CHECK ((char_length(notes) <= 255))
