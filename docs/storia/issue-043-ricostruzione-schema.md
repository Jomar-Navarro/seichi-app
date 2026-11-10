# #43 — il repo ricostruisce il proprio database

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Ricostruzione dello schema (2026-08-12, issue #43 — CHIUSA)

Fino a oggi il repo **non era in grado di ricostruire il proprio database**:
`profiles`, `categories` e `transactions` sono nate nella Fase 3 dal pannello di
Supabase e non le creava nessun file. Le migration successive le alteravano
dando per scontata una definizione che non esisteva da nessuna parte.

⚠️ **L'ordine dei file è funzionale, non decorativo.** La baseline è datata
`20260727` — l'epoca che descrive, non il giorno in cui è stata scritta, come già
`20260728_recurring.sql`. Numerata `20260812`, come nel primo tentativo, si
ordinava **dopo** `20260729_account_security.sql`, che fa `alter table
public.profiles`: il file esisteva e la ricostruzione da zero falliva comunque
alla seconda migration. Il difetto della #43 ripresentato come ordinamento.
Conseguenza: `transactions.recurring_rule_id` e la sua FK stanno nella
`20260728`, dove nasce `recurring_rules` — appartengono alla Fase 14, non alla 3.

Due file, e la separazione è il punto:

- **`20260727_baseline_fase3.sql`** — la **fotografia**. Descrive lo stato reale,
  difetti compresi, ed è un no-op su un database allineato.
- **`20260813_schema_cleanup.sql`** — la **decisione**. Corregge.

Fondendoli, la fotografia descriverebbe uno stato mai esistito e chi confronta
repo e database non saprebbe distinguere gli scarti voluti dai difetti. È lo
stesso schema `20260728` (ricostruzione) → `20260810` (correzione) delle
ricorrenti.

⚠️ **Scritte interrogando il catalogo, non a memoria** — `information_schema`,
`pg_constraint`, `pg_policies`, `pg_indexes`. Solo così si scopre che `notes` è
limitata a **255 caratteri** e che `transactions` ha **13 colonne** dove questo
documento ne elencava 10.

#### ⚠️ Il difetto vivo: la registrazione era rotta da 5 settimane

`profiles.language` aveva `default 'IT'` **maiuscolo**, mentre
`profiles_language_check` (Fase 19) pretende minuscolo o NULL. E
`handle_new_user()` inserisce `(id, full_name)` **senza nominare `language`**:
si applicava il default, che violava il CHECK, e siccome il trigger è
`after insert on auth.users` **l'utente non veniva creato**.

Ogni registrazione falliva dal 2026-08-07. Invisibile perché le registrazioni
non sono ancora aperte (issue #40) e perché **il default non era scritto da
nessuna parte**: la Fase 19 aveva normalizzato i valori e aggiunto il vincolo
senza poter vedere ciò che li generava.

**È lo stesso schema del difetto della #47** — `transactions_type_check` che non
ammetteva `abbonamento` mentre le tabelle sorelle sì. Due tabelle che dicono
cose diverse sulla stessa realtà, e nessun file dove la contraddizione sia
leggibile. Non è una coincidenza che entrambi si scoprano scrivendo questi file.

#### ⚠️ E lo stesso difetto su `currency`, che spegneva l'onboarding

Trovato dal code-review **dopo** aver corretto gli altri due, ed è il più
insidioso dei tre perché non rompe niente: `currency` aveva `default 'EUR'` e
`handle_new_user()` non la nomina, quindi la riga nasce non-NULL. Ma
`profiles.currency` **è il flag dell'onboarding** — `if (!profile?.currency)
redirect("/start")` — e con il default quella condizione non è mai vera.

⚠️ **Non si vede registrandosi**, ed è per questo che è sopravvissuto:
`signup()` con la conferma email disattivata fa `redirect("/start")`
incondizionato, senza consultare il gate. Colpisce le altre tre strade — OAuth
e conferma email (entrambe passano da `/callback`, che il gate lo usa) e **il
login successivo**, cioè chi abbandona l'onboarding a metà e non ci viene più
riportato: letteralmente il lavoro per cui il gate esiste.

⚠️ Riattivare *Confirm email* (debito pre-deploy, issue #40) instraderebbe
**ogni** nuova registrazione dentro `/callback`. Il difetto era dormiente solo
perché quel debito non è stato pagato: pagarlo lo avrebbe acceso.

⚠️ **Il default si toglie, i valori NON si azzerano**, al contrario di `theme`:
là ogni valore era fabbricato dal default, qui `savePreferences()` scrive
`currency` per davvero e le righe esistenti contengono scelte vere,
indistinguibili da quelle d'ufficio. Azzerarle rispedirebbe utenti già
configurati dentro l'onboarding.

**La lezione, e vale oltre queste tre colonne: un DEFAULT è un'affermazione sul
mondo.** `'IT'` diceva "questo utente parla italiano", `'dark'` "ha scelto il
tema scuro", `'EUR'` "ha finito l'onboarding". Tutte e tre false, tutte e tre
scritte da nessuno. Quando una colonna serve a distinguere *scelto* da *non
ancora scelto*, l'unico default corretto è **NULL** — e vale la pena controllare
le colonne rimaste prima che sia un'altra fase a scoprirlo.

#### Gli altri difetti che la fotografia ha reso visibili

- **Tre colonne residue su `transactions`**, precedenti alla Fase 14:
  `is_ricurrent` (con il refuso), `frequency` con un CHECK in **inglese**
  (`weekly/monthly/yearly`) mentre `recurring_rules.frequency` usa l'italiano, e
  `parent_id` **senza FK** — un uuid libero che somigliava a un riferimento.
  Tutte NULL su 19 righe, nessuna usata dal codice: rimosse.
- **`profiles.name` e `surname`**, soppiantate da `full_name` nella Fase 16. Mai
  popolate: l'app scrive nome e cognome in `raw_user_meta_data`. Rimosse.
- ⚠️ **`profiles.theme` è lo stesso difetto di `language`**, senza un CHECK che
  lo facesse esplodere: `default 'dark'` **fabbrica una scelta mai fatta**. In
  Fase 18 rendere scuro senza cookie è un ripiego di *rendering* corretto; lo
  stesso valore in colonna diventa una *preferenza dichiarata*, e il giorno in
  cui la sincronizzazione fra dispositivi verrà accesa sovrascriverebbe il tema
  di sistema su ogni altro dispositivo — mesi dopo, in un'altra fase, con la
  causa ormai illeggibile. Colonna tenuta (la Fase 18 la prevede), default tolto,
  CHECK aggiunto: NULL = non ancora scelto.
- ⚠️ **Venti policy per undici operazioni.** `categories` ne aveva otto per
  quattro, `profiles` otto per tre — due serie con nomi quasi identici, più
  quelle della `20260729` che non aveva rimosso le precedenti. Le policy si
  sommano in **OR**, quindi i duplicati sono innocui *e per questo invisibili*:
  il costo arriva quando si vuole **restringere** un accesso, perché bisogna
  rimuoverle tutte e chi ne stringe una lascia l'altra aperta **senza alcun
  errore**. Ora una per operazione, `<tabella>_<op>_own`, tutte nella forma
  `(select auth.uid())` — sotto-select valutato una volta come initplan invece
  che per riga.
- ⚠️ **Nessun indice oltre le chiavi primarie**, su nessuna delle tre. Niente su
  `user_id`, che è la colonna su cui filtra la RLS di *ogni* query. Aggiunti
  `(user_id, date desc)` su `transactions` e gli indici sulle FK — quelli non
  servono alle SELECT ma alle **cancellazioni in cascata**, che senza scandiscono
  l'intera tabella.

#### Ricostruita da zero per davvero — 2026-11-10 (#156)

Fino alla #156 «il repo ricostruisce il database» era un'affermazione: nessuno
aveva mai eseguito le migration su un database vuoto. `supabase start` lo fa a
ogni avvio del collaudo end-to-end, e al primo giro si è fermato sulla
`20260804`: **nessun file creava `pg_cron`**, acceso in produzione dal pannello
con la Fase 14 (la ricostruzione del 2026-08-04 interrogava tabelle, vincoli,
policy e funzioni, non le estensioni). Ora la crea la `20260728`, con `if not
exists`: in produzione non fa niente. Con quella sola riga le venti migration
passano. Da allora la prova si ripete in CI a ogni PR: una migration che non
regge su un database vuoto ferma il job `e2e`.

**Stessa versione maggiore di Postgres**, letta dal database il 2026-11-10
(`select version();`): produzione **17.6**, locale 17.11 (`major_version = 17`
in `config.toml`). Le minori diverse non cambiano niente che le migration
usino. Se un giorno Supabase porta la produzione a una maggiore nuova,
`major_version` va alzato insieme.

#### Verifica contro il catalogo — 2026-08-13

Le affermazioni di questa sezione sono state controllate **interrogando il
database**, non rileggendo i file, con un ruolo di sola lettura. Tutto confermato:

- `profiles.currency`, `.language` e `.theme` **senza default** — la lezione
  "un DEFAULT è un'affermazione sul mondo" è applicata;
- le cinque colonne residue (`is_ricurrent`, `frequency`, `parent_id`,
  `profiles.name`, `.surname`) sono sparite;
- `transactions.user_id` e `.account_id` NOT NULL, `categories.user_id` ancora
  nullable (debito dichiarato), `date` ancora `timestamp without time zone`;
- `budgets_user_category_period_key` è davvero **`NULLS NOT DISTINCT`**;
- `dashboard_totals` ha **una sola** firma; `generate_recurring_transactions`
  torna `integer`;
- ⚠️ `notifications`: `authenticated` ha `ardDxtm` a livello di TABELLA — niente
  `w` — più un grant di colonna `authenticated=w` sulla sola `read`. Il
  meccanismo "la RLS decide le RIGHE, il grant le COLONNE" funziona come scritto.

~~⚠️ **`anon` ha ancora `arwdDxtm` su TUTTE le tabelle**, `imports` e `job_runs`
comprese: il debito è vivo e si è esteso alle tabelle nuove da solo, perché
arriva dai default di Supabase e non da una scelta. Resta innocuo per la sola
RLS — difesa singola.~~ — **chiuso dalla #154** (2026-11-10), anche per le
tabelle future: vedi «Database — anon senza privilegi».
⚠️ Non si verifica con `information_schema.role_table_grants`,
che mostra soltanto i grant in cui il ruolo corrente è concedente o beneficiario:
da un ruolo terzo risulta **vuota**, e sembra che nessuno abbia privilegi. Si
legge `pg_class.relacl`.

**Una lacuna trovata: tre FK senza indice**, tutte nella classe che la #43
doveva chiudere e che è stata chiusa solo in parte.

| vincolo | on delete | effetto |
|---|---|---|
| `budgets_category_id_fkey` | CASCADE | cancellare una categoria scandisce `budgets` |
| `recurring_rules_category_id_fkey` | SET NULL | idem su `recurring_rules` |
| `recurring_rules_user_id_fkey` | CASCADE | cancellare un utente scandisce `recurring_rules` |

Oggi sono tabelle minuscole, quindi è un costo teorico. Le FK **composite**
`(user_id, account_id)` invece stanno bene malgrado non abbiano un indice sulla
coppia: il controllo di integrità cerca per `account_id`, e quell'indice c'è.

`ensure_rls` è un event trigger **della piattaforma**, non nostro: Supabase abilita
la RLS da sé su ogni tabella nuova. Comoda rete di sicurezza, ma non sostituisce
il `enable row level security` esplicito nelle migration — quello dice l'intenzione.
⚠️ La sua funzione, `rls_auto_enable()`, sta però in `public` e appartiene a
`postgres`: è comparsa nel catalogo della #154, che le ha tolto l'`execute` di
PUBLIC e `anon`. Scatta ancora (prova c7 della `20260822`).

#### ⚠️ Le guardie: i file superati non vanno più rieseguiti

`20260727`, `20260728`, `20260804` e `20260809` descrivono stati **superati** da
migration successive, e rieseguirli non dà un errore pulito: fallisce a metà, dopo
aver già modificato qualcosa — o, peggio, riesce. Ciascuno ha ora un `do $$ …
raise exception` in testa che si rifiuta di partire, riconoscendo il file
successivo da un fatto del catalogo:

| file | cosa rifarebbe | riconosce il successore da |
|---|---|---|
| `20260727` | ricrea le colonne residue e le 20 policy duplicate | `profiles_theme_check` (la `20260813`) |
| `20260728` | ridichiara `generate_recurring_transactions()` `returns void` | il tipo di ritorno `integer` (la `20260810`) |
| `20260804` | ⚠️ `drop table notifications` — cancella TUTTE le notifiche — e riporta indietro `run_daily_jobs()` e `generate_notifications()` | ⚠️ SE STESSA: la colonna `notifications.payload`, cioè "le notifiche esistono già" — dalla #123 |
| `20260809` | sostituisce `run_daily_jobs()` con quella che scarta il conteggio | idem `20260728` |

Hanno la loro guardia anche la `20260810`, `20260814`, `20260815` e `20260816`,
descritte nelle rispettive fasi.

⚠️ **La `20260804` è rimasta senza guardia fino alla #123, e diceva "È
idempotente".** Contiene `cron.schedule`, quindi era uno dei file a cui si torna
per riagganciare il cron — e rieseguita cancellava il registro delle notifiche,
con le `dedup_key` che provano quali eventi sono già stati emessi. L'affermazione
"idempotente" in testa a un file che inizia con `drop table` è la classe dei
DEFAULT della #43: una frase sul mondo che nessuno aveva verificato.

La regola che le genera: **il file più recente dev'essere autosufficiente**, così
non c'è mai motivo di tornare indietro — e se qualcuno ci torna comunque, viene
fermato invece di rompere in silenzio. Vale per ogni migration futura che
sostituisca una funzione o una struttura definita in un file precedente.

#### Debiti restati aperti, deliberatamente

- **`transactions.date` è `timestamp WITHOUT time zone`** — vedi la nota nello
  schema qui sopra. Cambiare il tipo cambia il significato dei dati già scritti.
- ~~**`categories.user_id` e `transactions.user_id` sono NULLABLE**~~ — chiuso a
  metà dalla **Fase 20b**: `transactions.user_id` e `recurring_rules.user_id`
  sono ora NOT NULL, perché senza non si poteva costruire la FK composita che
  lega il conto al suo proprietario (vedi lo schema). **`categories.user_id`
  resta nullable**, e vale la pena registrare *perché* è stato chiuso solo uno
  dei due: non per completezza, ma perché su `transactions` quel NULL era
  diventato un buco di sicurezza invece che un'anomalia teorica. Un debito si
  paga quando qualcosa comincia a dipenderne.
  ⚠️ **Dalla #123 qualcosa ne dipende**: le FK verso `categories` sono a colonna
  singola, quindi un movimento, un budget o una regola possono puntare alla
  categoria di un altro utente. La `20260821` chiude la conseguenza visibile (il
  job copiava il nome nella notifica), non la causa: la chiusura sono FK
  composite `(category_id, user_id)` come per i conti, e quelle vogliono
  `categories.user_id` NOT NULL.
- ~~**`anon` ha DML su tutte e tre**, per default di Supabase. Innocuo *solo*
  grazie alla RLS — ogni policy è `to authenticated` — quindi è difesa singola.~~
  — **chiuso dalla #154**: `anon` non ha più privilegi in `public`.

