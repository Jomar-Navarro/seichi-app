# #157 — Supabase CLI: il repo descrive la produzione, tipi generati, prove pgTAP

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Il progetto (2026-11-16, deciso con Jomar)

Fino alla #157 le migration si eseguivano a mano nel SQL Editor, le loro
controprove stavano commentate in fondo ai file e si copiavano a mano, e i tipi
del database erano scritti a mano in `types/index.ts`: la classe di difetto
della #43.

In quattro passi, una PR per ogni prodotto finito:

| | cosa | tocca la produzione |
|---|---|---|
| 0 | `supabase db diff --remote`: il repo descrive davvero la produzione? | sola lettura, lanciato da Jomar |
| PR 1 | `types/database.ts` generato con la sentinella in CI, prove pgTAP | no |
| PR 2 | `createClient<Database>()` e i tipi dell'app derivati da quelli generati | no |
| 3 | `migration repair` delle 20 versioni, integrazione GitHub spenta, rilascio con `db push` | sì, Jomar |

**Decisioni di Jomar**:
- *Deploy to production* dell'integrazione GitHub di Supabase **si spegne**, e
  le migration si rilasciano con `supabase db push --remote` (prima
  `--dry-run`). Scartata l'integrazione accesa: applicherebbe la migration al
  merge, insieme al deploy di Vercel, e l'ordine «prima il codice, poi la
  migration» della #123 non sarebbe più possibile. Scartato il SQL Editor più
  `migration repair` a mano: due passi, e dimenticarne uno fa divergere la
  cronologia senza rumore.
- Il codice delle PR 1 e 2 lo scrive Claude.

### Passo 0 — il repo e la produzione, confrontati (2026-11-16)

Con la CLI 3.1.0 `db diff --remote` non chiede la password del database: passa
dal token di `supabase login`. Il collegamento (`supabase link`) sta in
`supabase/.temp/`, ignorato da git. Lo ha lanciato Jomar.

- ⚠️ **L'issue diceva che la CLI vuole `YYYYMMDDHHMMSS_nome.sql` e che le
  migration andavano rinominate. Falso**, misurato: `migration list` e il database
  ombra di `db diff` registrano `20260727`…`20260822` così come sono, e
  l'integrazione GitHub li leggeva già. Non si rinomina niente: il passo più
  rischioso del piano è caduto prima di cominciare. Era un'affermazione scritta
  a memoria nell'issue.
- **Le 20 migration si applicano tutte al database ombra di `db diff`**, che è
  un'immagine Postgres 17.6 come la produzione: una seconda prova, oltre alla CI,
  che il repo ricostruisce il proprio database.

Il diff (le istruzioni che porterebbero «le migration» a «la produzione»),
classificato riga per riga:

| differenza | cos'è | verdetto |
|---|---|---|
| `rls_auto_enable()` e l'event trigger `ensure_rls` | gli oggetti della piattaforma (#43, #154) | attesi, fuori dal repo |
| `profiles_language_check` | la stessa regola, `'it'`, `'en'` o NULL, ristampata da Postgres in due forme | equivalente |
| 5 funzioni: `budget_period_start/end`, `budgets_at`, `set_budget`, `handle_new_user` | **i fine riga** (sotto) | nessuna differenza di comportamento |
| il ruolo `seichi_ro` | un ruolo con `LOGIN` e `SELECT` su ogni tabella, più un default che gli concede anche quelle future. Nessun file lo crea | da decidere con Jomar |

#### ⚠️ I fine riga: il diff dipendeva dalla macchina

Le cinque funzioni avevano il codice identico byte per byte, a parte gli spazi
attorno alle parentesi; proprietario, privilegi, volatilità, `search_path`,
costo e argomenti uguali (`db query --remote --read-only` sul catalogo). Era
il fine riga: Git per Windows ha `core.autocrlf=true`, quindi le migration — LF
nel repo — sul PC diventano CRLF, e il corpo di una funzione Postgres è il testo
del file così com'è. Il database ombra costruito sul PC aveva le funzioni con
CRLF (12 su 13), quello della CI le avrebbe avute LF, e la produzione è un
misto, a seconda di come ogni file è stato incollato nel SQL Editor.

- **`.gitattributes`: `*.sql text eol=lf`.** Database ombra, database locale e
  un `db push` da Windows mandano lo stesso testo della CI. Dopo, il locale ha
  zero funzioni con CR.
- ⚠️ Il CR cambia il comportamento solo dentro una stringa che va a capo. Nessuna
  funzione ne ha: controllato con un piccolo analizzatore dei corpi (commenti,
  `''`), messo prima alla prova su tre casi — una stringa su due righe con CRLF,
  una con `''`, un apostrofo in un commento — perché un «nessuna» da uno
  strumento mai visto scattare non dimostra niente.
- Le funzioni che in produzione hanno CRLF continueranno a comparire nel diff
  finché una migration non le riscrive. È rumore noto, non va «corretto»
  ricreandole.
- ⚠️ **PowerShell rovina gli accenti** di un output rediretto con `>` (UTF-8
  letto come cp850: `├¿` al posto di `è`). Il primo confronto fra i testi ha
  dato «diverse» tutte e cinque le funzioni per questo; si decodifica prima di
  confrontare, o si chiede JSON.

### PR 1 — tipi generati e prove pgTAP

#### `types/database.ts`

`npm run db:types` lo rigenera dal Supabase LOCALE (`scripts/db-types.mjs`):
il database ricostruito dalle migration, nessun segreto, nessun accesso alla
produzione. `npm run db:types:check` fallisce se il file nel repo non coincide,
e gira nel job `e2e` della CI.

- Lo script controlla che la CLI dica `Target: local stack`. Con un progetto
  collegato il default resta il locale (misurato con la 3.1.0), ma è
  un'affermazione su un programma altrui: si controlla invece di crederci.
- La CLI stampa il file senza formattarlo e suggerisce `oxfmt`: sarebbe una
  dipendenza nuova solo per questo. Lo ristampa la stampante del compilatore di
  TypeScript, già fra le dipendenze; il risultato è deterministico, e il diff
  dei tipi in una PR resta leggibile.
- ⚠️ **Le colonne di una funzione `RETURNS TABLE` risultano sempre non nulle**
  (`daily_job_health().last_ok_at` è `string`, la funzione può restituire NULL):
  Postgres non dichiara la nullabilità dei risultati di una funzione. Lo dice
  anche l'intestazione del file generato.
- Escluso dallo scanner di Tailwind (`@source not`): nomi di colonne, non classi.
- Controprova: una colonna aggiunta a mano al database locale → `--check` rosso,
  tolta → verde.

#### Le prove pgTAP (`supabase/tests/`, `npx supabase test db`)

Le controprove commentate in fondo alle migration diventano tre suite, 43
prove, che girano a ogni PR dopo `e2e:db`:

| file | da dove | cosa |
|---|---|---|
| `trasferimenti.test.sql` | 20b, `20260815` | b1-b6 e il saldo che si sposta |
| `integrita.test.sql` | #123, `20260821` | importi positivi, il lock del job, le categorie altrui nei rinnovi e nei budget |
| `anon.test.sql` | #154, `20260822` | anon senza privilegi, gli oggetti nuovi, il trigger senza execute, c9 |

- **Il secondo utente lo crea il test**: b5, b6, c3 e c4 non dicono più
  «SALTATA», come succedeva sul database vero con un utente solo.
- **Ogni rifiuto controlla codice d'errore E nome del vincolo** (`throws_ok` col
  messaggio esatto): un insert che fallisce per un altro motivo non passa per il
  vincolo che si voleva provare.
- **Ogni rifiuto ha il suo gemello positivo** (`lives_ok`), e ogni «niente nome
  altrui» il gemello con il nome proprio: senza, una tabella che rifiuta tutto o
  una funzione che non copia mai un nome sarebbero verdi.
- Il cambio di ruolo sta DENTRO la stringa di `throws_ok`/`lives_ok`: se
  l'istruzione fallisce, la sottotransazione annulla anche il `set local role`;
  se riesce, lo toglie il `reset role` che segue.
- Le query di c1 e c2 sono viste temporanee, scritte una volta: c9 le rilegge
  dopo aver iniettato un guasto.
- Restano fuori: la c1 della #123 (guarda i DATI della produzione: su un
  database vuoto passerebbe senza aver visto niente), la concorrenza del job (due
  sessioni), e la parte di c7 «la tabella nuova nasce con la RLS» — è
  `rls_auto_enable()`, della piattaforma, che il locale non ha.
- ⚠️ Una costante `regrole` dentro una vista non è ammessa (crea una dipendenza
  dal ruolo): l'oid si legge da `pg_roles`.

**Controprova (2026-11-16)**: difetti storici reintrodotti nel database locale,
dichiarando prima quali prove dovevano cadere. Due giri, il database
ricostruito da zero prima di ciascuno.

| giro | mutazione | rosse, ed esattamente quelle |
|---|---|---|
| 1 | M1 via la FK composita sulla destinazione | b5 |
| 1 | M2 via `transactions_dest_distinct_check` | b1 (20b) |
| 1 | M3 la vista dei saldi conta solo il ramo in uscita | «arrivo sale di 100», «totale non si muove» |
| 1 | M4 via `amount > 0` | b1, b2 (#123) |
| 1 | M5 la join dei rinnovi senza il proprietario | c2 rinnovi, c3 «non copia il nome» |
| 1 | M6 `grant select, insert` ad anon su `transactions` | c1, c4, c5 (ora il rifiuto è della RLS, non del grant), c9 |
| 1 | M7 la join dei budget senza il proprietario | c2 budget, c4 «budget altrui» |
| 2 | M8 il ramo dei budget non salta più la categoria non trovata | c4 «budget altrui», c4 «nessuna notifica finta globale» |

Giro 1: 14 rosse su 43, le dichiarate; giro 2: 2 su 43.

⚠️ **La controprova ha trovato un difetto delle prove.** Nella prima stesura i
saldi si misuravano sugli stessi conti dei rifiuti: con b1 e b5 rotti, il loro
insert restava e il saldo diventava 1230 «prima» del trasferimento. Una
regressione sui vincoli avrebbe fatto cadere anche le prove del saldo, mandando
a cercare il guasto nella vista — due cause, un solo sintomo. Ora il saldo ha
due conti suoi.

### PR 2 — il client tipizzato, e cosa ha trovato (2026-11-16)

`createClient<AppDatabase>()` in client, server e proxy. Il client ricava il
tipo delle righe dalle stringhe di `select()`, quindi delle 106 query in 22
file ne sono emerse **14** che non compilavano, e ciascuna era un'affermazione
dei tipi scritti a mano che il database non faceva:

| errori | causa | chiusa con |
|---|---|---|
| 5 | `categories.name`, `.type`, `.user_id`, `.created_at` (e `icon`, `color`) **nullable nel database**, non nulle in `Category` | migration `20261116_categories_not_null` |
| 3 | `accounts.type` per il generatore è un testo qualsiasi; `accounts_type_check` lo limita a quattro valori | `types/database-app.ts` |
| 5 | argomenti RPC NULL di proposito (`p_account_id` = tutti i conti, `p_category_id` = il globale, `p_amount` = la lapide), che il generatore vuole non nulli | `types/database-app.ts` |
| 1 | la patch di `updateAccount` era un `Record<string, unknown>` | `RowUpdate<"accounts">`, e `validate()` restituisce il tipo ristretto |

- ⚠️ **Le categorie: la verità nel database, non nel tipo.** Contate in
  produzione (`db query --remote --read-only`): 61 righe, zero NULL in ognuna
  delle sei colonne. Ogni scrittore dell'app le valorizza tutte, e la policy di
  insert pretendeva già `user_id = auth.uid()`. Quindi NOT NULL, con la sua
  suite (`categorie.test.sql`, rossa senza la migration e verde con). È anche il
  prerequisito della #158: le FK composite vogliono `user_id` NOT NULL. Scartato
  il ponte «dichiararle non nulle in `database-app.ts`»: sarebbe stata la stessa
  affermazione falsa, solo spostata in un file nuovo.
- **`types/database-app.ts` contiene solo ciò che il catalogo non dichiara**, e
  ogni voce dice da quale fatto viene: `accounts_type_check`, il `coalesce` che
  rende `balance` mai nullo, gli argomenti nullabili, i `max`/`min` di
  `daily_job_health()` (letti dalla funzione: `had_error` e `failed_steps`
  hanno un `coalesce`, le tre date no), il globale e la lapide di `budgets_at()`.
- `Account`, `AccountWithBalance` e `Category` in `types/index.ts` sono derivati
  (`Row<"accounts">`…), non più ripetuti a mano. Gli altri tipi di riga restano
  scritti a mano: portano relazioni incorporate (`Transaction.categories`) o
  restringimenti (`BudgetPeriod`) che il generatore non conosce, e i loro cast
  sono già onesti.
- `TransactionForm` fabbricava una `Category` con `user_id: ""` per mostrare la
  categoria di un movimento prima che arrivasse la lista: `buildCategoryOptions`
  chiede ora solo ciò che mostra (`CategoryOptionSource`).
- Tolto il cast `data as Category[]` di `getCategories()`: con il client
  tipizzato non serviva più, e lasciato avrebbe nascosto la prossima divergenza.

Collaudo: `tsc`, lint, 421 test unitari, 51 prove pgTAP, `db:types:check`, e la
suite end-to-end (12 su 12) sul database con la migration.

### Parte 3 — il rilascio con `db push`, e via `seichi_ro` (2026-11-16)

La procedura di regime sta in `.claude/rules/rilascio.md`. Prima di scriverla
sono state misurate le due cose su cui poggia:

- **`db push` / `migration up` applicano ogni file in una transazione.** Una
  migration finta con un `create table` seguito da un `raise exception`: la
  tabella non resta, e la versione non entra nella cronologia.
- **`db push` non spinge segreti**: il blocco `[db.vault]` di `config.toml` è
  commentato.

⚠️ **Il numero è la versione, e la vuole unica.** La migration di `seichi_ro`
era nata `20261116` come quella delle categorie: due file con la stessa
versione collidono nella cronologia. È diventata `20261117`.

#### `20261117_drop_seichi_ro.sql`

Jomar ha confermato che il ruolo non serve più. Le sue dipendenze, lette da
`pg_shdepend` in produzione (sola lettura): `SELECT` su 11 relazioni, `USAGE`
su `public`, `CONNECT` sul database, un default di `postgres` sulle tabelle
future; nessun oggetto posseduto; `postgres` ne è membro.

- ⚠️ **La prima stesura usava `drop owned by`, e la prova in locale l'ha
  fermata**: vuole i PRIVILEGI del ruolo, non basta amministrarlo (da Postgres
  16 chi crea un ruolo ne riceve l'ADMIN, non l'ereditarietà). Ora revoche
  esplicite, fatte da chi le aveva concesse, e `drop role`: se la produzione
  avesse una dipendenza in più, `drop role` fallirebbe e annullerebbe il file.
- **Provata in locale su una copia del ruolo** con gli stessi privilegi della
  produzione: ruolo, default e grant sul database spariscono; la seconda
  esecuzione non fa niente; con un oggetto posseduto si ferma col suo messaggio
  e non scrive niente.
- ⚠️ **La prima prova della guardia era un verde che non guardava**: il
  preparativo (una tabella data in proprietà al ruolo) falliva per un permesso
  sullo schema, veniva annullato per intero, e la migration trovava il ruolo
  assente. Rifatto il preparativo, la guardia scatta. Lezione 2 di CLAUDE.md,
  ancora una volta.

#### La prima volta, nell'ordine (Jomar)

1. Supabase → *Project Settings* → *Integrations* → GitHub: **spegnere
   *Deploy to production*.** PRIMA di tutto il resto: dopo il punto 5 il merge
   successivo applicherebbe le migration da solo.
2. Unire le tre PR (#201, #204, #203). Il codice regge con e senza le due
   migration nuove.
3. Da `master` aggiornato: `npx supabase migration list --remote` → 22 locali,
   cronologia remota vuota.
4. ⚠️ Solo le 20 già eseguite dal SQL Editor, non le due nuove:
   `npx supabase migration repair --remote --status applied 20260727 20260728 20260729 20260803 20260804 20260807 20260808 20260809 20260810 20260811 20260813 20260814 20260815 20260816 20260817 20260818 20260819 20260820 20260821 20260822`
5. `npx supabase migration list --remote` → 20 allineate, `20261116` e
   `20261117` solo locali.
6. `npx supabase db push --remote --dry-run` → deve elencare esattamente quelle
   due.
7. `npx supabase db push --remote`.
8. Verifiche: `migration list --remote` con 22 allineate; `db diff --remote`
   con il solo rumore noto, senza `seichi_ro` e senza differenze su
   `categories`.

⚠️ **Le PR in pila e lo squash**: unendo la #201 con `--delete-branch`, GitHub
ha CHIUSO la #202 invece di spostarla su `master` (il suo ramo base non
esisteva più), e non si poteva riaprire. La parte 2 è diventata la #204, stesso
ramo ribasato. Con uno squash, ogni PR della pila va poi ribasata su `master`
togliendo i commit già uniti (`git rebase --onto origin/master <ultimo commit
unito>`), e il ramo base si cancella solo dopo aver spostato la PR successiva.
