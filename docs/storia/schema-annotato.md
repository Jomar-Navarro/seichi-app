# Lo schema annotato, com'era in CLAUDE.md fino al 2026-11-10

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

## Database Schema

```sql
-- Sempre usare UUID, mai INT per gli ID
-- Ogni tabella ha RLS abilitato
-- NB: i nomi colonna sono in INGLESE (amount/type/date...), non italiano

-- ⚠️ I TIPI qui sotto sono quelli REALI, letti dal catalogo (issue #43, 2026-08-12).
--   Prima erano approssimati a "TEXT": in questo database sono `character
--   varying(n)`, e la differenza NON è cosmetica — `RETURN QUERY` di plpgsql
--   pretende i tipi esatti (vedi dashboard_totals).

profiles: id (UUID = auth.users.id), currency (VARCHAR 50, default 'EUR'),
          theme (VARCHAR 50, nullable), created_at (TIMESTAMP),
          language (VARCHAR, nullable), full_name (TEXT, nullable),
          avatar_url (TEXT, nullable)
-- La riga nasce da un trigger on_auth_user_created (non più solo in onboarding);
--   full_name viene fatto backfill da auth.users.raw_user_meta_data.
-- Il nome NON si legge da user_metadata: quel campo è scrivibile dal client.
-- language: tag MINUSCOLO ('it' | 'en'), vincolato da profiles_language_check
--   (Fase 19). NULL = non ancora scelto → l'app ripiega su Accept-Language, che
--   è un'informazione migliore di un italiano d'ufficio. Vietare NULL romperebbe
--   la registrazione, perché il trigger crea la riga prima dell'onboarding.
--   ⚠️ Il DEFAULT era 'IT' MAIUSCOLO e violava il proprio CHECK: ogni
--   registrazione falliva dal 2026-08-07. Rimosso dalla 20260813 — vedi #43.
-- theme: 'light' | 'dark' | 'system', NULL = non ancora scelto. La colonna
--   esiste dalla Fase 3 ma NON è ancora usata: la Fase 18 persiste solo su
--   cookie. Il default 'dark' è stato tolto perché fabbricava una preferenza.
-- ⚠️ NIENTE policy di DELETE, ed è voluto: si cancella da delete_current_user().

categories: id (UUID), user_id (UUID, nullable), name (VARCHAR 50),
            icon (VARCHAR 50), color (TEXT), type (VARCHAR 20),
            created_at (TIMESTAMP),
            target_amount (DECIMAL 10,2, nullable), target_date (DATE, nullable)
-- type values: 'spesa' | 'entrata' | 'investimento' | 'risparmio' | 'abbonamento'
-- Vincolo DB: categories_type_check
-- Gli OBIETTIVI di risparmio NON hanno tabella dedicata: sono categorie con
--   type='risparmio' + target_amount/target_date. saved_amount è calcolato
--   sommando le transazioni risparmio della categoria (vedi getGoals).

transactions: id (UUID), user_id (UUID NOT NULL), amount (DECIMAL 10,2 NOT NULL,
              CHECK > 0), type (VARCHAR 20 NOT NULL), category_id (UUID),
              investment_type (VARCHAR 50, nullable), date (TIMESTAMP senza fuso,
              NOT NULL), notes (VARCHAR 255),
              created_at (TIMESTAMP), recurring_rule_id (UUID, nullable),
              account_id (UUID NOT NULL), to_account_id (UUID, nullable),
              import_id (UUID, nullable), import_key (TEXT, nullable)
-- amount > 0, e NOT NULL anche type e date: dalla 20260821 (#123). Gli importi
--   sono SENZA SEGNO e la direzione la porta `type`: un -50 su una `spesa`
--   faceva SALIRE il saldo, e nessun vincolo lo fermava.
-- import_id: il lotto da cui la riga proviene (Fase 21). ON DELETE CASCADE —
--   cancellare la riga di `imports` ANNULLA l'import. È l'unica cascade oltre
--   a quella di `categories`, e come quella è l'operazione, non un effetto.
-- ⚠️ Gli ALLEGATI non sono qui: sono la tabella `attachments` (Fase 22), 0..N
--   per movimento, con FK composita `(transaction_id, user_id)`.
-- import_key: chiave di deduplica, UNIQUE con user_id. NULL = riga inserita a
--   mano, e i NULL restano DISTINTI (all'opposto di `budgets`).
--   ⚠️ Quella del profilo generico porta il CONTO del file
--   (`generico:<conto>:…`), quella di Trade Republic no — vedi #118.
-- type: 'entrata' | 'spesa' | 'investimento' | 'risparmio' | 'abbonamento'
--     | 'trasferimento'    (Fase 20b)
--     | 'disinvestimento'  (Fase 21b, #52)
-- ⚠️ `categories_type_check` è DELIBERATAMENTE più stretto: né 'trasferimento'
--   né 'disinvestimento' sono tipi di CATEGORIA. Il primo non ne ha per
--   costruzione; il secondo la prende IN PRESTITO dagli investimenti, perché
--   acquisto e vendita devono compensarsi sulla stessa posizione. Le due
--   tabelle dicono cose diverse sullo stesso vocabolario, e stavolta è scritto
--   in entrambe — la #47 nacque proprio da una divergenza non documentata.
-- ⚠️ 'disinvestimento' è l'UNICO tipo oltre a 'entrata' che AUMENTA il saldo
--   del conto (`account_balances`): il denaro investito era uscito, vendere lo
--   fa rientrare. Non entra nel Flusso, come non ci entra l'investimento.
-- to_account_id: il conto di DESTINAZIONE. Obbligatorio su 'trasferimento',
--   facoltativo su 'risparmio' e 'investimento', vietato altrove — quattro CHECK
--   nella 20260815, non una convenzione applicativa.
-- ⚠️ user_id NON è più nullable (Fase 20b): era il prerequisito della FK
--   composita `(account_id, user_id) → accounts (id, user_id)`. Con MATCH SIMPLE
--   basta una colonna NULL perché l'intero vincolo non venga verificato, quindi
--   un user_id NULL avrebbe reso account_id libero di puntare ovunque — una
--   garanzia PIÙ DEBOLE della FK a una colonna che sostituiva.
-- recurring_rule_id: se valorizzato, la transazione è stata generata da una regola ricorrente
-- FK category_id: ON DELETE CASCADE — cancellare una categoria cancella le sue
--   transazioni. È ciò su cui poggia l'eliminazione di un obiettivo.
-- ⚠️ `date` è TIMESTAMP WITHOUT TIME ZONE, quindi NON è un istante assoluto
--   malgrado sia usata come tale. dashboard_totals() le confronta con bound
--   `timestamptz`: Postgres interpreta la colonna nel TimeZone della sessione,
--   e regge solo perché su Supabase è UTC. Debito aperto, non risolto da #43:
--   cambiare il tipo cambia il significato dei dati già scritti.

recurring_rules: id, user_id, amount (DECIMAL 10,2, CHECK > 0), type (TEXT),
                 category_id, notes (TEXT), frequency (TEXT), start_date (DATE),
                 next_run (DATE), end_date (DATE, nullable), active (BOOL), created_at
-- frequency: 'settimanale' | 'mensile' | 'annuale'
-- pg_cron chiama generate_recurring_transactions() (giornaliero): per ogni regola
--   attiva con next_run <= oggi inserisce transazioni e avanza next_run (idempotente).
--   Dalla 20260821 il cursore è `for no key update`: cron e RPC sovrapposti
--   non scrivono più due volte la stessa occorrenza (#123).
```

