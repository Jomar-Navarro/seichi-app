# #158 — la categoria di una riga è del suo proprietario: FK composite verso `categories`

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Il buco (2026-11-17)

Le tre FK verso `categories` — da `transactions`, `budgets`, `recurring_rules`
— erano a colonna singola: garantivano che la categoria esistesse, non che
fosse dell'utente. Le policy RLS guardano `user_id`, che scrive il server, e
nessuna guarda `category_id`: una POST costruita a mano poteva attaccare un
movimento, un budget o una regola alla categoria di un altro utente. La #123
(`20260821`) aveva chiuso la conseguenza visibile — `generate_notifications()`
copiava il nome della categoria altrui nella notifica — e lasciato la causa,
perché `categories.user_id` era ancora nullable: con `MATCH SIMPLE` una
colonna NULL disattiva l'intera FK composita (lezione della 20b). La #157 l'ha
resa NOT NULL (`20261116`), e la #158 ha costruito le chiavi.

### La migration `20261118_categories_owner_fkeys`

La stessa cura della 20b per i conti:

1. **guardia in testa**: conta i riferimenti incrociati sulle tre tabelle e gli
   `user_id` NULL sulle quattro, e si ferma prima di scrivere;
2. `categories_id_user_key unique (id, user_id)`, il bersaglio delle FK;
3. `*_category_owner_fkey (category_id, user_id) → categories (id, user_id)` al
   posto delle `*_category_id_fkey`, con le azioni di prima;
4. **verifica eseguita**: le FK verso `categories` sono tre, una per tabella,
   sulla coppia e con la loro azione, o il file si annulla. Legge le colonne
   del catalogo (`conkey`, `confdeltype`, `confdelsetcols`), non il testo.

Scritta interrogando la produzione (`db query --remote --read-only`): Postgres
17.6, zero riferimenti incrociati su 406 movimenti, 6 budget e 6 regole; un
indice che comincia con `category_id` già su tutte e tre le tabelle, che serve
anche la ricerca sulla coppia (nessun indice nuovo, come per i conti).

- ⚠️ **`recurring_rules` vuole `on delete set null (category_id)`.** Un `set
  null` semplice su una FK composita annulla TUTTE le colonne: Postgres esegue
  `UPDATE … SET category_id = NULL, user_id = NULL`, e `user_id` è NOT NULL —
  eliminare una categoria con una regola sarebbe fallito con `23502`. Visto
  nella controprova, non solo letto. La lista di colonne esiste da Postgres 15.
  L'app oggi non ci arriva (`deleteCategory()` rifiuta una categoria con regole,
  `deleteGoal()` le elimina prima, #117), ma il vincolo dice la verità anche per
  il prossimo chiamante.
- **I nomi seguono i conti** (`*_account_owner_fkey`): `*_category_owner_fkey`
  dice cosa garantisce. Nessun embed PostgREST nominava i vincoli
  (`categories!…`), e c'è una sola relazione verso `categories` per tabella;
  cambiano `types/database.ts` (generato) e tre commenti dell'app che citavano i
  nomi vecchi.
- **Nessun ordine di deploy**: nessun codice nomina i vincoli, e nessuno
  scrittore dell'app usa la categoria di un altro utente.
- La `20260803` non ha guardia: rieseguita ricreerebbe `budgets_category_id_fkey`
  accanto alla composita. Innocuo (la composita resta, le azioni coincidono), e
  con `db push` un file della cronologia non si riesegue: annotato, non
  corretto.

### Le prove

`supabase/tests/categorie.test.sql`, 14 prove nuove con un secondo utente vero
(un `user_id` inventato fallirebbe sulla FK verso `auth.users`, cioè per il
motivo sbagliato): i rifiuti `23503` col nome del vincolo — insert, insert come
`authenticated` sotto RLS, update, budget, regola — ognuno col gemello che
passa; poi le cancellazioni su dati propri, con il conteggio prima.

`integrita.test.sql` perde le righe c3 e c4 sulla categoria altrui: quella riga
non si può più costruire. Restano i gemelli sulle categorie proprie e le c2 sul
testo delle join, che confrontano ancora `user_id` (ridondanti, a costo zero).

Controprova del 2026-11-17, sul database locale, con le mutazioni dichiarate
prima:

| mutazione | cadute attese | cadute viste |
|---|---|---|
| FK di nuovo a colonna singola | i 5 rifiuti | i 5 rifiuti, «no exception» |
| `set null` semplice sulla regola | eliminazione e le sue 2 conseguenze | le 3, con `23502` su `user_id` |
| movimenti senza cascata | le 2 eliminazioni e le loro 3 conseguenze | le 5 |

- ⚠️ **Il primo giro delle mutazioni era verde, e non valeva niente**: `supabase
  db query -f` rifiuta più istruzioni in un file («cannot insert multiple
  commands into a prepared statement»), la mutazione non era stata applicata, e
  le prove giravano sullo schema giusto. Le mutazioni si applicano con `psql`
  nel container (`docker exec -i supabase_db_seichi-app psql …`), e lo script
  stampa le FK prima delle prove.
- **Guardia**: tolta una FK e creato un movimento sulla categoria altrui, la
  migration rieseguita in una transazione sola (come `db push`) si ferma con
  «movimenti 1» e lascia lo stato com'era. Ripulita, la riesecuzione riesce, due
  volte.
- pgTAP 62/62, Vitest, lint, `tsc`, `db:types:check` e la suite end-to-end
  (12/12, che legge le categorie per embed) verdi.

### La review del diff (2026-11-17)

Fatta dopo le controprove, su richiesta di Jomar: le controprove rispondono a
«il test vede il difetto?», non a «il diff dice il vero?».

- ⚠️ **La verifica finale confrontava il testo di `pg_get_constraintdef()`**,
  che scrive `categories(…)` con il `search_path` di default e
  `public.categories(…)` con quello vuoto (provato). In locale passava; con una
  sessione diversa, in produzione, avrebbe annullato un file sano. Ora legge le
  colonne del catalogo, e ogni tabella deve comparire una volta sola. Provata
  sullo stato giusto con i due `search_path`, e sulle tre mutazioni più una FK
  doppia (la `20260803` rieseguita): cade su tutte e quattro.
- Due commenti nelle prove promettevano protezioni che non servivano: un
  `coalesce` contro un `user_id` NULL che il vincolo esclude, e «`ok(NULL)`
  sarebbe un rosso muto» — falso, pgTAP stampa «(test result was NULL)».
  Tolti.
- **PostgREST in produzione ricarica lo schema da solo**: l'event trigger
  `pgrst_ddl_watch` è attivo (letto sul catalogo). In locale non si poteva
  provare: lo stack parte dopo le migration. Resta una verifica dopo il
  rilascio: una schermata che legge le categorie per embed.
