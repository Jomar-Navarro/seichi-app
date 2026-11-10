---
paths:
  - "supabase/**"
  - "lib/jobs.ts"
  - "lib/notifications.ts"
  - "app/**/notification-actions.ts"
  - "app/**/budget-actions.ts"
---

# Database, migration, job notturno

Si carica quando apri un file di `supabase/` o i moduli di job, notifiche e
budget. Il perché sta in `docs/storia/`: `issue-043-ricostruzione-schema`,
`issue-123-database-integrita`, `issue-154-anon`, `issue-047-job-giornaliero`,
`fase-17-budget-notifiche`, `schema-annotato`.

## Scrivere una migration

1. **Scrivila interrogando il catalogo, non a memoria** (`information_schema`,
   `pg_constraint`, `pg_policies`, `pg_indexes`, `pg_get_functiondef`). Perché:
   una migration che indovina è peggio di una che manca, e i tipi reali qui sono
   `character varying(n)`, non `text`. I privilegi si leggono da
   `pg_class.relacl`: `information_schema.role_table_grants`, letta da un ruolo
   terzo, risulta vuota.
2. **Il file più recente è autosufficiente.** Se sostituisce una funzione o una
   struttura di un file precedente deve bastare da solo, così non c'è mai motivo
   di rieseguire un file vecchio.
3. **Una guardia in testa** (`do $$ … raise exception`) ferma chi riesegue un file
   superato, riconoscendo il successore da un fatto del catalogo (la tabella è in
   `issue-043-ricostruzione-schema`). Una guardia copre i successori che
   esistevano quando è stata scritta: allungando la catena (`delete_current_user()`
   ne ha una lunga), ricontrolla le guardie dei file che ridefiniscono la stessa
   cosa.
4. **Rieseguibile davvero.** ⚠️ `drop … if exists` non è idempotenza: un vincolo
   con dipendenti non si droppa affatto (`2BP01`), e il guasto arriva a metà file
   dopo che le sezioni precedenti hanno scritto. Togli i dipendenti per nome e
   ricreali dopo; mai `drop … cascade`. `create table if not exists` non aggiunge
   colonne a una tabella che c'è già.
5. **Prima di aggiungere un vincolo conta le righe che lo violano**, e fermati se
   ce ne sono. Poi cerca ogni scrittore che oggi produce il valore vietato: dopo
   `amount > 0`, l'import generico arrotondava ancora a 0,00 e avrebbe fatto
   fallire l'intero lotto.
6. **Cast espliciti su ogni colonna restituita da una funzione plpgsql**:
   `RETURN QUERY` pretende i tipi esatti e fallisce solo a runtime, con un
   messaggio che non dice quale colonna.
7. **Funzioni**:
   - sempre `set search_path = ''`;
   - `security definer` solo se serve un privilegio in più: `import_transactions()`
     e `set_budget()` restano `invoker`;
   - sempre `revoke all on function … from public, anon` e
     `grant execute … to authenticated`;
   - una funzione creata fuori da `public` e `storage` nasce eseguibile solo dal
     proprietario (#154): l'`execute` si concede nella stessa migration.
8. **Viste con `security_invoker = true`.** Una vista normale gira coi privilegi
   del proprietario e scavalca la RLS.
9. **La controprova sta in fondo al file, COMMENTATA.** ⚠️ Il SQL Editor esegue
   lo script come una sola transazione: un `raise exception` di collaudo lasciato
   eseguibile annulla anche la migration, e stampa proprio il messaggio di
   successo previsto. Si copia in una query nuova e si esegue a parte.
10. **Una prova RLS cambia ruolo** (`set local role authenticated`, dentro un
    blocco). Il ruolo `postgres` del SQL Editor ha `BYPASSRLS` e vede tutto anche
    se la policy manca.
11. **Le policy si cercano con `~*`, mai con `like`.** Postgres ristampa il testo:
    `(select auth.uid())` diventa `( SELECT auth.uid() AS uid)`.
12. **Ogni vincolo nuovo ha una prova che deve fallire.** Una prova che richiede un
    secondo utente e non lo trova dice `SALTATA`: non passa in silenzio.
13. **L'ordine di deploy si dichiara nella PR.** Di solito la migration va prima
    del codice, o la RPC nuova risponde 404. A volte è il contrario: nella #123
    il codice nuovo reggeva entrambi i payload, quello vecchio no.
14. ⚠️ **L'integrazione GitHub di Supabase prova ad applicare le migration a ogni
    commit su master**, e oggi si ferma sulla guardia della `20260727`.
    `supabase/config.toml` descrive solo il database LOCALE dei test: mai un
    blocco `[remotes]`, mai bucket o funzioni. Allineare la cronologia farebbe
    applicare le migration al merge: decisione aperta (#157).

## Lo schema

1. **Dove una colonna distingue «scelto» da «non ancora scelto», il default è
   NULL.** Perché: un default fabbrica una scelta mai fatta. `'IT'`, `'dark'` ed
   `'EUR'` hanno rotto registrazione e onboarding (`profiles.currency` è il
   cancello dell'onboarding).
2. **Nessun totale memorizzato**: niente `spent`, `balance`, `saved_amount`,
   `row_count`, `valid_to`. Si calcola alla lettura.
3. **Gli importi sono senza segno** (`amount > 0`): la direzione la porta `type`.
4. **Uno stato illegale si rende irrappresentabile nel database** (CHECK, chiavi
   composite), non con una convenzione dell'app. Il controllo resta nella sola
   action quando nessun vincolo sa esprimerlo e lo stato illegale è innocuo (il
   budget solo su categorie `spesa`).
5. **Una chiave composita `(…_id, user_id)` vuole `user_id` NOT NULL**: con
   `MATCH SIMPLE` una colonna NULL disattiva l'intero vincolo.
6. **Unicità e NULL**: di default i NULL sono distinti. Dove NULL vuol dire «una
   cosa sola» (il budget globale) serve `NULLS NOT DISTINCT`.
7. **Prima di aggiungere un tipo di movimento, fai l'audit di ogni consumatore di
   `transactions`**: totali, viste, grafici, form, import. Oggi nessuno somma
   «tutto ciò che c'è», ed è questo che rende sicuro un tipo nuovo.
   `categories_type_check` resta più stretto di `transactions_type_check`, di
   proposito.
8. **I file dello Storage non si cancellano in SQL**: Supabase rifiuta il
   `DELETE` su `storage.objects`. Li toglie l'app, vedi `storage.md`.
9. **`anon` resta a zero privilegi** (#154). I default di `supabase_admin`
   concedono ancora tutto ad `anon`: se la piattaforma creasse un oggetto in
   `public`, lo direbbero le prove c1 e c2 della `20260822`.

## Job notturno e notifiche

1. **Un solo cron, `run_daily_jobs()` alle 03:00 UTC**: prima le ricorrenti,
   poi le notifiche. L'ordine è correttezza: le notifiche devono vedere le
   ricorrenti appena inserite.
2. **Ogni passo ha il suo blocco `exception` e scrive l'esito in `job_runs`.**
   pg_cron esegue tutto come una transazione, e un guasto catturato senza
   registrarlo diventa invisibile: «succeeded» per cinque settimane (#47).
3. **Una regola guasta non ferma le altre.** `generate_recurring_transactions()`
   isola ogni regola e restituisce quante ne ha saltate. Dal cron `auth.uid()`
   è NULL, e la funzione lavora per tutti gli utenti.
4. **Il cursore delle ricorrenti è `for no key update`.** Non `skip locked`, che
   salterebbe in silenzio una regola in modifica; non `for update`, che
   bloccherebbe anche i controlli di FK.
5. **Le notifiche nascono solo dal cron**, mai da trigger o action: servono per
   ciò che accade mentre l'utente non guarda.
6. **`payload` porta fatti, non frasi**: la frase la compone l'app alla lettura,
   nella lingua di adesso. Un rinnovo salva la DATA, mai «fra N giorni».
7. **Idempotenza per costruzione**: `dedup_key` + `on conflict do nothing`.
   - Le notifiche non si cancellano mai: la riga è la prova che l'evento è già
     stato emesso.
   - Il client aggiorna solo la colonna `read`: la RLS decide le righe, il grant
     di colonna decide le colonne.
   - Nessuna policy di INSERT.
8. **Le join verso `categories` confrontano anche `user_id`**: le chiavi esterne
   sono a colonna singola.
9. **L'allarme «job fermo» si calcola alla lettura** (`daily_job_health()`,
   `lib/jobs.ts`, soglia di 36 ore in TypeScript). Mai da una notifica o da un
   secondo cron: un job morto non può annunciarsi.
