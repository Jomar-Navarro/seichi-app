# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Seichi (整地) — Personal Budgeting App

Next.js 16 App Router, TypeScript strict, Tailwind CSS v4, Supabase (cloud), Zustand, Recharts. PWA via next-pwa (Fase 15). Deploy su Vercel.

## Commands

```bash
npm run dev          # avvia dev server
npm run build        # build produzione
npm run lint         # eslint
```

## Project Structure

```
app/
├── (auth)/               # welcome, sign (login + signup), callback OAuth,
│   │                     # recupera-password + reimposta-password (+ actions.ts)
├── (onboarding)/         # start, preference, category + actions.ts
├── (main)/               # app autenticata:
│   ├── page.tsx          #   home dashboard + action.ts (server actions transazioni/totali)
│   ├── transazioni/      #   lista + filtri
│   ├── risparmi/         #   obiettivi + actions.ts (getGoals, getInvestments, CRUD goal)
│   ├── investimenti/     #   breakdown portafoglio
│   ├── analisi/          #   statistiche + grafici
│   └── impostazioni/     #   lista + actions.ts (categorie, preferenze, signOut)
│       ├── account/      #     actions.ts — nome, avatar, email, password, eliminazione
│       ├── profilo/      #     foto profilo + nome
│       ├── email/        #     cambio email in 2 passi
│       ├── password/     #     cambio password
│       ├── elimina/      #     eliminazione account in 2 passi
│       ├── categorie/    #     gestione categorie custom
│       ├── ricorrenti/   #     regole ricorrenti
│       └── importa/      #     import da file + actions.ts (Fase 21)
├── auth/confirm/         # verifyOtp per link email (?next= per il recupero password)
└── layout.tsx            # root layout — legge i cookie e decide `.dark` e `lang`
                          #   su <html> (Fasi 18-19). NON forza più nulla

components/
├── UI/                   # Button, Input, Select, card, BrandHeader, OnboardingProgress,
│   │                     # SignTab, TransactionForm, TransactionModal, BottomNav,
│   │                     # SummaryCard, Sparkline, EmptyState, Avatar, PageHeader,
│   │                     # SettingsRow (+ SettingsGroup), PasswordInput,
│   │                     # PasswordStrength, SubmitButton, StatusScreen, AuthShell,
│   │                     # Switch, FrequencySelector, DatePicker
├── features/             # BalanceCard, TransactionList, RecentTransaction, Filterbar,
│   │                     # GoalCard, GoalSheet, GoalsPageClient, InvestimentiTab,
│   │                     # HomeSkeleton, DashboardRefresher, AnalyticsTabs,
│   │                     # SpendingPieChart, MonthlyLineChart, ProfileEditor,
│   │                     # EmailChangeForm, PasswordChangeForm, DeleteAccountFlow,
│   │                     # ForgotPasswordForm, ResetPasswordForm, NotificationBell,
│                     # ImportFlow (+ AccountPicker, ImportHistory),
│   │                     # ThemeProvider (+ useTheme), ThemeToggle, ThemeSection,
│   │                     # I18nProvider (+ useI18n)
├── LoginForm.tsx, SignUpForm.tsx, PasswordField.tsx
└── icons.tsx             # GoogleIcon, FacebookIcon

lib/
├── import/               # Fase 21 — csv.ts (lettore RFC 4180 + numeri, date,
│                         #   mojibake), trade-republic.ts (profilo riconosciuto
│                         #   dall'intestazione), generic.ts (colonne indicate
│                         #   dall'utente + contatore di occorrenza), types.ts,
│                         #   index.ts (`analyze()` + IMPORT_MAX_BYTES)
├── supabase/             # client.ts, server.ts, proxy.ts (PUBLIC_PATHS)
├── i18n/                 # config.ts (locale, cookie, negoziazione — client-safe),
│   │                     # format.ts (Intl: numeri, denaro, date, plurali),
│   │                     # server.ts (getI18n/getDictionary — importa next/headers),
│   │                     # dictionaries/it.ts (fonte di verità) + en.ts (Fase 19)
├── accounts.ts           # icone/colori dei conti (DECORATIVI) + isAccountId()
│                         #   + rememberAccount() — il cookie del conto scelto (20b)
├── accounts-server.ts    # getSelectedAccount() — importa next/headers:
│                         #   URL = istruzione (si corregge), cookie = memoria (si dimentica)
├── seichi-icons.tsx      # set icone SVG custom (SeichiIcon)
├── icon-map.ts           # nome categoria → icona (Lucide)
├── goal-icons.ts         # GOAL_ICON_MAP + GOAL_ICONS
├── category-icons.ts     # CATEGORY_LIBRARY — SOLO id icona per tipo (etichette nel dizionario)
├── investment-types.ts   # INVESTMENT_TYPE_COLOR + FALLBACK (le etichette nel dizionario)
├── transaction-utils.ts  # TIPO_COLOR/TIPO_INK, formatDate, formatAmount,
│                         #   amountSign() — il segno dipende da QUALE conto guardi (20b)
├── budget.ts             # BUDGET_PERIODS (id), soglia, budgetStatus/Color/Ink
├── recurring.ts          # FREQUENCIES (id) + aritmetica delle date
├── jobs.ts               # getDailyJobHealth() + DAILY_JOB_STALE_HOURS (issue #47)
├── auth.ts               # getSessionUser() — id + email dalle CLAIMS, senza rete (è una FOTOGRAFIA)
├── account.ts            # getAccountContext() — identità VIVA + profilo, per le impostazioni
│                         #   getProfileHeader() — avatar/nome per la home, dalle claims
├── profile.ts            # getInitials, getDisplayName
├── password.ts           # PASSWORD_MIN_LENGTH, scorePassword, validateNewPassword
├── notifications.ts      # icone/colori per tipo + renderNotification (frasi dal payload)
├── safe-redirect.ts      # safeNext() — blocca gli open redirect sul parametro next
└── theme.ts              # tipi, cookie e risoluzione del tema (Fase 18)

supabase/migrations/      # SQL da eseguire a mano nel SQL Editor di Supabase

store/  useUIStore.ts      # Zustand: modal transazioni, edit, refresh trigger
types/  index.ts           # Transaction, Category, GoalWithProgress, Investment*, TRANSACTION_TYPES
```

## Stack

- **Framework**: Next.js 16 App Router
- **Language**: TypeScript strict (`"strict": true`)
- **Styling**: Tailwind CSS v4 con token Zen Glass custom
- **Database**: Supabase cloud (PostgreSQL)
- **Auth**: Supabase Auth (JWT + Row Level Security) — email confirmation abilitata
- **State**: Zustand (`store/useUIStore.ts`)
- **Charts**: Recharts
- **Icons**: set custom `lib/seichi-icons.tsx` (SVG outline) + Lucide React (outline only)
- **PWA**: next-pwa — non ancora installata (Fase 15)

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

transactions: id (UUID), user_id (UUID NOT NULL), amount (DECIMAL 10,2),
              type (VARCHAR 20), category_id (UUID), investment_type (VARCHAR 50,
              nullable), date (TIMESTAMP senza fuso), notes (VARCHAR 255),
              created_at (TIMESTAMP), recurring_rule_id (UUID, nullable),
              account_id (UUID NOT NULL), to_account_id (UUID, nullable),
              import_id (UUID, nullable), import_key (TEXT, nullable)
-- import_id: il lotto da cui la riga proviene (Fase 21). ON DELETE CASCADE —
--   cancellare la riga di `imports` ANNULLA l'import. È l'unica cascade oltre
--   a quella di `categories`, e come quella è l'operazione, non un effetto.
-- import_key: chiave di deduplica, UNIQUE con user_id. NULL = riga inserita a
--   mano, e i NULL restano DISTINTI (all'opposto di `budgets`).
-- type: 'entrata' | 'spesa' | 'investimento' | 'risparmio' | 'abbonamento'
--     | 'trasferimento'  (l'ultimo dalla Fase 20b)
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

recurring_rules: id, user_id, amount (DECIMAL 10,2), type (TEXT), category_id,
                 notes (TEXT), frequency (TEXT), start_date (DATE), next_run (DATE),
                 end_date (DATE, nullable), active (BOOL), created_at
-- frequency: 'settimanale' | 'mensile' | 'annuale'
-- pg_cron chiama generate_recurring_transactions() (giornaliero): per ogni regola
--   attiva con next_run <= oggi inserisce transazioni e avanza next_run (idempotente)
```

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

#### ⚠️ Le guardie: tre file non vanno più rieseguiti

`20260727`, `20260728` e `20260809` descrivono stati **superati** da migration
successive, e rieseguirli non dà un errore pulito: fallisce a metà, dopo aver già
modificato qualcosa. Ciascuno ha ora un `do $$ … raise exception` in testa che si
rifiuta di partire, riconoscendo il file successivo da un fatto del catalogo:

| file | cosa rifarebbe | riconosce il successore da |
|---|---|---|
| `20260727` | ricrea le colonne residue e le 20 policy duplicate | `profiles_theme_check` (la `20260813`) |
| `20260728` | ridichiara `generate_recurring_transactions()` `returns void` | il tipo di ritorno `integer` (la `20260810`) |
| `20260809` | sostituisce `run_daily_jobs()` con quella che scarta il conteggio | idem |

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
- **`anon` ha DML su tutte e tre**, per default di Supabase. Innocuo *solo*
  grazie alla RLS — ogni policy è `to authenticated` — quindi è difesa singola.

### Storage & funzioni (Fase 16)

- Bucket `avatars` — pubblico in LETTURA, path `{user_id}/{uuid}.{ext}`. Il segmento
  casuale rende l'URL non ricostruibile dal solo user_id; le policy su
  `storage.objects` limitano ogni utente alla propria cartella — **anche in SELECT**.
  Nessuna policy di select aperta a `public`: il bucket è pubblico, quindi
  `/object/public/...` non passa da RLS e le immagini si vedono comunque, mentre una
  select pubblica autorizzerebbe `list()` e chiunque abbia la anon key potrebbe
  enumerare cartelle (= tutti gli user_id) e nomi file, annullando la non
  ricostruibilità dell'URL.
- L'upload dell'avatar passa da una server action: il limite di 2 MB regge solo perché
  `next.config.ts` alza `experimental.serverActions.bodySizeLimit` (default 1 MB).
  Cambiando uno dei due limiti vanno allineati anche l'altro, il `file_size_limit` del
  bucket, `AVATAR_MAX_BYTES` e il testo nella UI.
- `delete_current_user(dry_run boolean default false)` — funzione `SECURITY DEFINER`
  con `SET search_path = ''`, eseguibile solo da `authenticated`. Cancella
  esclusivamente `auth.uid()`, così non serve tenere la `service_role` key nel backend.
  Le FK verso `auth.users` sono `ON DELETE CASCADE`. `deleteAccount()` la chiama due
  volte: prima con `dry_run: true` (non tocca niente, ma verifica funzione, grant e
  sessione) e solo dopo cancella l'avatar e chiama quella vera — la rimozione dei file
  è irreversibile e deve precedere la RPC, quindi non può basarsi sulla speranza che la
  RPC poi funzioni.
- **I file dello Storage non si cancellano in SQL.** Supabase rifiuta il `DELETE`
  diretto su `storage.objects` ("Direct deletion from storage tables is not allowed.
  Use the Storage API instead") e farebbe fallire l'intera funzione. La rimozione
  dei file avviene lato app in `deleteAccount()` con `storage.from(...).remove()`,
  **prima** della RPC. Vale per qualsiasi cleanup futuro (es. ricevute, Fase 22).

### Fase 17 — budget e notifiche

Progettata per intero il 2026-08-03 prima di scrivere codice.
**Entrambe IMPLEMENTATE e verificate end-to-end** — migration
`20260803_budgets.sql` (17a) e `20260804_notifications.sql` (17b).

```sql
budgets: id (UUID), user_id, category_id (UUID, NULLABLE), period (TEXT),
         amount (DECIMAL 10,2, NULLABLE), valid_from (DATE), created_at
-- period: 'settimanale' | 'mensile' | 'annuale'
-- category_id NULL = budget GLOBALE (non una tabella separata)
-- amount NULL = "lapide": da questo periodo, nessun budget
```

- **Niente `valid_to`: è ridondante.** La riga successiva chiude la precedente. Il
  budget di un periodo = la riga più recente con `valid_from <= inizio_periodo`.
  Sovrapposizioni impossibili per costruzione, storico gratis, zero righe generate
  e zero job. Correggere un errore nel periodo corrente sovrascrive la riga esistente
  (stesso `valid_from`); alzare il budget da un periodo futuro crea una riga nuova —
  **stessa operazione nel codice, intenzione dedotta dal periodo**, nessuna scelta
  concettuale davanti all'utente.
- **`amount` NULL, mai 0, per cancellare.** "Nessun budget" e "budget di zero" sono
  affermazioni diverse: usare 0 come sentinella renderebbe impossibile distinguerle.
  La lapide è NULL per non doverlo fare. **Se poi 0 vada anche ammesso è una domanda
  separata, e la risposta è no** — `CHECK (amount IS NULL OR amount > 0)`: un limite
  di zero è nei fatti indistinguibile dal non voler tracciare la categoria, e
  costringerebbe a gestire `spent/0` in percentuale e stato per un caso che nessuno
  imposta.
- **Periodi ancorati al CALENDARIO** (settimana da lunedì, mese dal 1°, anno solare),
  non alla data di creazione. Un budget è una *finestra sul tempo condiviso*, non un
  evento che si ripete: l'utente pensa "questa settimana", non "i 7 giorni da quando
  l'ho creato". **Diverso da `recurring_rules`, ed è corretto così** — lì l'ancoraggio
  è `start_date` perché l'affitto esce il 5. Nessun conflitto con `addClampedMonths`:
  i confini non si calcolano avanzando, si ottengono troncando.
- **`valid_from` è sempre un confine di periodo, e lo impone il DB** con un `CHECK`
  su `date_trunc(<periodo>, valid_from)`. Non è una convenzione applicativa: una riga
  scritta a mano dal SQL Editor viene rifiutata. È anche ciò che regala alla Fase 17b
  la sua chiave di idempotenza già deterministica.
- ⚠️ **`UNIQUE (user_id, category_id, valid_from)` richiede `NULLS NOT DISTINCT`**
  (Postgres 15+). Di default in un vincolo di unicità i NULL sono tutti distinti tra
  loro → due budget **globali** per lo stesso periodo passerebbero senza errore.
- `CHECK (category_id IS NOT NULL OR period = 'mensile')` — il globale è ancorato allo
  stipendio, che è mensile. Periodi misti sì tra categorie (la spesa alimentare *ha*
  un ritmo settimanale, i viaggi annuale), ma il globale non è configurabile.
- Indice su `(user_id, category_id, valid_from DESC)`. La lettura "budget corrente per
  categoria" è un `DISTINCT ON` e va incapsulata in una **vista**.
  ⚠️ **La vista va creata con `security_invoker = true`**: una vista normale gira con i
  privilegi del proprietario e **scavalca la RLS** della tabella sottostante — ogni
  utente vedrebbe i budget di tutti.
- **Nessuna colonna `spent`.** Lo speso si somma dalle transazioni alla lettura, come
  `saved_amount` in `getGoals`. Un totale memorizzato avrebbe quattro punti di
  scrittura da tenere allineati (insert/update/delete + gli insert di pg_cron).
- **Budget solo su categorie `spesa`, e NON è imposto dal DB.** Non è esprimibile con
  una FK; servirebbe una colonna `type` ridondante o un trigger. Lo stato illegale che
  preverrebbe è innocuo (un budget su una categoria risparmio mostrerebbe 0), quindi
  il controllo sta nella server action. Denormalizzare per un difetto cosmetico costa
  più di quanto rende.
- ⚠️ **Affitto e utenze sono categorie `abbonamento`, non `spesa`** (vedi
  `app/(onboarding)/actions.ts`), e tipo transazione e tipo categoria sono accoppiati
  1:1 (`TransactionForm` filtra con `.eq("type", selectedType.id)`). Quindi restano
  fuori da ogni budget. Per il per-categoria è voluto; per il **globale** significa che
  la cifra va chiamata **"spese variabili"**, mai "spese totali", con accanto una riga
  di sola lettura "uscite fisse previste" sommata da `recurring_rules`. Un numero
  sbagliato che sembra giusto è peggio di un numero assente: se il globale ignora in
  silenzio l'affitto, l'utente smette di fidarsene. Il calcolo *stipendio − fisse =
  disponibile* e il suggerimento dell'importo restano alla Fase 24 (AI).

```sql
notifications: id, user_id, type, payload (JSONB), dedup_key (TEXT),
               destination (TEXT), read (BOOL), created_at
-- UNIQUE (user_id, dedup_key)
```

- **`payload` JSONB, non testo già composto.** Il DB registra i FATTI, la frase la
  compone `lib/notifications.ts` alla lettura. Salvare `'€ ' || round(x)` avrebbe
  cablato la valuta ignorando `profiles.currency`, saltato il separatore delle
  migliaia (le card accanto scrivono "€ 1.234" via `Intl.NumberFormat`) e reso
  **intraducibile alla Fase 19 tutto lo storico già scritto**.
- ⚠️ Il campo si chiama `destination`, **in inglese** come ogni altra colonna. Il
  primo progetto lo chiamava `destinazione`, contraddicendo la regola di questo
  stesso documento.

- **Generazione SOLO da pg_cron, mai da trigger o server action**, e **dopo**
  `generate_recurring_transactions()` nella stessa esecuzione — invertito valuterebbe
  lo stato di ieri e mancherebbe proprio lo sforamento causato dalla ricorrente appena
  inserita, che è il caso per cui esiste.
- **Perché non sincrono**: quando l'utente inserisce la spesa a mano sta guardando lo
  schermo e la barra diventa rossa da sola — una notifica tre secondi dopo è rumore, e
  il rumore fa smettere di aprire il campanello, seppellendo l'unica notifica che vale
  ("tra 3 giorni escono 12€"). Le notifiche servono per ciò che accade **mentre non
  guardi**: l'affitto generato dal cron alle 3 di notte, che nessuna server action
  vedrebbe mai. Conseguenza accettata: sfori martedì alle 18, la notifica arriva
  mercoledì. Va bene — **la notifica è il registro, non l'allarme**.
- **`dedup_key` TEXT + UNIQUE, non un vincolo composito tipizzato.** Gli eventi hanno
  chiavi naturali diverse: budget = categoria + inizio periodo, rinnovo abbonamento =
  `recurring_rule_id` + data. Una colonna `category_id` che contiene un id di regola è
  un campo che mente sul proprio nome. Ogni generatore compone una stringa
  deterministica (`budget_sforato:{category_id}:{2026-08-01}`) e usa
  `INSERT ... ON CONFLICT DO NOTHING` → **idempotente per costruzione, non per
  attenzione di chi scrive**. Il cron può girare due volte o fallire a metà senza
  duplicare niente.
- Ogni notifica porta una **destinazione** (una notifica non toccabile è un vicolo
  cieco) — colonna da mettere subito, aggiungerla dopo richiede backfill delle righe
  già spedite.
- ⚠️ **Le notifiche NON si cancellano mai**, e la pulizia a 90 giorni prevista in
  progetto **era un bug**: la riga non è solo un messaggio, è anche la prova che
  quell'evento è già stato emesso. Cancellandola si libera la `dedup_key` e il
  generatore rifà la notifica — un obiettivo al 100% verrebbe rinotificato ogni 90
  giorni per sempre, e i budget annuali hanno chiavi valide 365 giorni contro una
  finestra di 90. Scartato anche un registro eventi separato: sarebbe la separazione
  concettualmente giusta, ma aggiunge una tabella per poter cancellare poche migliaia
  di righe in dieci anni.

#### Deciso il 2026-08-03 leggendo `Seichi Stati Supporto.dc.html`

- **Soglie obiettivo: 50% e 100%.** Un obiettivo dura mesi, quindi sono ~2 notifiche
  in tutto. Il mockup mostrava "al 58%", cioè un avanzamento arbitrario: sarebbe
  rumore, e il rumore fa smettere di aprire il campanello.
- **Anticipo rinnovo abbonamento: 3 giorni** (confermato dal mockup).
- **Il tap segna come letta E naviga**, più un comando "segna tutte come lette". È ciò
  che rende utile la colonna `destinazione`. Scartato "aprire il pannello segna tutto":
  azzererebbe il valore del non-letto, che è l'unica cosa che distingue ciò che hai
  già visto.
- **Badge con il numero** sulla campanella (9+ oltre la nona). Il mockup mostra la
  campanella nuda, ma senza segnale non c'è motivo di aprirla.
- **Due notifiche del mockup NON si fanno.** "Il tuo stipendio è stato registrato" è
  la categoria scartata nella decisione di Fase 15 (ridondante con la banca). "Il
  valore del tuo portafoglio è aumentato del 4,1%" non è **calcolabile**: Seichi non ha
  quotazioni, gli investimenti sono transazioni manuali e il totale è la somma dei
  versamenti — non varia da solo. Servirebbe un feed prezzi, che non è in roadmap.
- **Stati visivi dal mockup**: non letta = riga piena + pallino `kin`; letta =
  `opacity: 0.55` + pallino spento. Pastiglia icona 36px colorata per tipo, testo 13px,
  timestamp **relativo** ("2 ore fa", "Ieri", "3 giorni fa"). Pannello come card sotto
  l'header, con overlay sfocato dietro.
- ~~Nel mockup la campanella è in alto a destra, ma nell'app quel posto è di
  `ProfileMenu`: saranno due pastiglie affiancate.~~ **Non più vero dalla Fase 18**:
  l'header della Home è stato rifatto sul mockup `Seichi Dashboard.dc.html`, che
  mette l'avatar col saluto e il nome **a sinistra** — ad aprire il menu è il
  gruppo intero, non il solo avatar — e lascia alla campanella il suo angolo.
- **`delete_current_user()` va aggiornata** con `budgets` e `notifications`: fa i
  `DELETE` espliciti tabella per tabella, deliberatamente, e la cascade da sola non
  basta per come è scritta.
- **Consegna in due PR**: 17a budget (schema, vista, RLS, CRUD, barre, uscite fisse),
  17b notifiche. Dipendenza a senso unico — il budget con la barra che diventa ambra
  all'80% e rossa al 100% è già un prodotto finito senza una sola notifica.

#### Emerso implementando la 17a

- **La scrittura passa da `set_budget()`, non da un insert del client.** Così
  `valid_from` lo calcola il DB con `budget_period_start()`, la stessa funzione usata
  dal `CHECK`: se lo calcolasse l'app, la stessa aritmetica esisterebbe in due
  linguaggi. In più l'upsert è atomico (niente leggi-poi-scrivi fra due tab) e i
  controlli non esprimibili come vincolo (categoria `spesa`, globale mensile) danno un
  messaggio leggibile invece di una violazione di CHECK. Riceve la data **locale** del
  client: il server è in UTC e fra mezzanotte e le 2 sbaglierebbe periodo.
- ⚠️ **Cambiare periodo poteva sparire in silenzio.** Difetto del versionamento a solo
  `valid_from`: il nuovo inizio può non essere il più recente, in entrambe le
  direzioni. Mensile → settimanale il 1° agosto (venerdì): la settimana è iniziata il
  27 luglio, *prima* della riga mensile del 1 ago, che `budgets_at()` continuerebbe a
  restituire. Settimanale → mensile il 15 agosto: l'inizio mensile è il 1 ago, prima
  della settimana corrente. **Il primo tentativo di correzione avanzava al confine
  successivo del periodo nuovo — sbagliato**: nel secondo caso il budget entrava in
  vigore il 1° *settembre*, l'azione rispondeva "salvato" e per tre settimane non
  cambiava nulla. Un no-op silenzioso è il difetto peggiore possibile qui.
  Soluzione attuale: il nuovo budget vale **subito**, e `set_budget()` rimuove le
  righe interne al periodo corrente scritte sotto il regime precedente
  (`valid_from > v_from AND valid_from <= p_today`). Cambiare periodo *è* ridefinire
  la finestra corrente; lo storico dei periodi precedenti e le righe future non si
  toccano.
- ⚠️ **La rimozione di un budget non applica il controllo "solo categorie spesa".**
  Se l'utente cambia il tipo di una categoria che aveva un budget, quel budget va
  ripulito **proprio quando** la categoria non è più `spesa`. Applicare il controllo
  anche in rimozione lascerebbe una riga che nessuno può più togliere: la card
  resterebbe a "€0 / €X" per sempre, e il campo budget è ormai nascosto.
  `CategorySheet` scrive la lapide quando il tipo cambia via da `spesa`.
- ⚠️ **Il fuso orario non si chiede al server.** Le server action girano in UTC su
  Vercel: `new Date()` lì dà il giorno del *server*, e fra mezzanotte e le 2 ora
  italiana è ancora ieri. L'orologio arriva dal client come `ClientClock`
  (`lib/dates.ts`), che porta la data locale **e lo scostamento di fuso** — serve
  entrambi, perché `transactions.date` è un istante assoluto e senza offset i confini
  di periodo sarebbero comunque quelli della mezzanotte del server. Per lo stesso
  motivo `GlobalBudgetSection` carica i propri dati da sé: la pagina impostazioni è un
  server component e non può conoscere il fuso dell'utente.
- **Il budget si imposta nel form categoria** (`CategorySheet`), non in una pagina
  dedicata — è una proprietà della categoria, si modifica dove si modifica lei. La
  *memorizzazione* resta la tabella versionata: `getBudgetForCategory()` la carica
  all'apertura, e si riscrive solo se è cambiata davvero, altrimenti ogni rinomina
  della categoria creerebbe una riga di storico identica alla precedente.
- **Il globale sta nelle impostazioni**: non appartiene a nessuna categoria, quindi il
  form categoria non poteva ospitarlo.
- **La finestra temporale sta su ogni card, non nell'intestazione di sezione.** Era il
  rischio previsto dei periodi misti: l'intestazione diceva "Budget del mese" seguendo
  il periodo del globale, cioè una dichiarazione falsa sulle card settimanali accanto.
  E le card si scorrono orizzontalmente, quindi guardandone una a metà scroll
  "€ 10 / € 100" non dice su quale arco di tempo. Intestazione neutra ("Budget"),
  finestra sulla card ("questo mese"). Per lo stesso motivo la cifra delle uscite
  fisse dice esplicitamente "del mese".
- `createCategory()` ora restituisce l'`id`: serve a impostare il budget subito dopo,
  sulla categoria appena creata.

#### Emerso implementando la 17b

- **Un solo job, non due.** Il cron della Fase 14 (`generate-recurring`) è stato
  smontato e sostituito da `seichi-daily`, che invoca `run_daily_jobs()`: quella
  chiama in sequenza ricorrenti → notifiche → pulizia. Un secondo cron a un orario
  più tardi sarebbe stato *sperare* che il primo avesse finito, e qui l'ordine è
  **correttezza**, non ottimizzazione.
- ⚠️ **Il wrapper è sicuro solo perché `generate_recurring_transactions()` distingue
  cron da RPC con `auth.uid()`** (NULL dal cron → tutti gli utenti). Invocandola da
  `run_daily_jobs()`, anch'essa lanciata dal cron, `auth.uid()` resta NULL e il
  comportamento non cambia. Verificato sul codice della funzione prima di agganciarla:
  cambiarlo in silenzio avrebbe fermato le ricorrenti senza alcun errore.
- **`generate_notifications()` non può riusare `budgets_at()`**: quella filtra su
  `auth.uid()`, che dal cron è NULL. La stessa logica è riscritta in forma
  insiemistica su tutti gli utenti — con lo stesso `DISTINCT ON`, che raggruppa i NULL
  e quindi tratta il budget globale come una categoria a sé.
- **Nessuna policy di INSERT su `notifications`.** Sono un registro generato dal
  server, non contenuto dell'utente: se il client potesse scriverle, "non letto"
  smetterebbe di significare qualcosa e la `dedup_key` sarebbe aggirabile.
- ⚠️ **Una policy RLS non sa limitare le COLONNE**, e col solo `for update` l'utente
  poteva riscriversi `dedup_key` e `destination` sulle proprie righe. Non è estetica:
  forgiando una chiave futura si **zittisce per sempre** la notifica vera di quel
  periodo — l'idempotenza per costruzione è proprio ciò che rende una chiave falsa un
  silenziatore permanente. Serve anche un **grant a livello di colonna**
  (`grant update (read)`): la RLS decide quali RIGHE, il grant quali COLONNE.
- ⚠️ **pg_cron esegue il comando come UNA transazione.** Con i passi in sequenza nuda,
  un'eccezione nelle notifiche faceva rollback anche degli **insert finanziari** delle
  ricorrenti appena eseguiti. Ogni passo di `run_daily_jobs()` ha il proprio blocco
  `exception`: le ricorrenti restano scritte e il motivo finisce nei log.
- **Il seed dei traguardi già superati** viene scritto dalla migration come *già
  letto*: senza, la prima esecuzione dopo il deploy scoprirebbe insieme tutti i
  traguardi storici e riempirebbe il pannello di notifiche "adesso" per fatti di mesi
  fa — il rumore che questa fase esiste per evitare.
- **La soglia dell'80% è duplicata fra SQL e TypeScript** e non è eliminabile senza
  generazione di codice: serve alla barra a ogni render e al job notturno. È isolata
  in `budget_warning_threshold()` e in `BUDGET_WARNING_THRESHOLD`, così i due punti da
  tenere allineati hanno un nome.
- **Il rinnovo abbonamento usa `next_run between today and today + 3`**, non
  `= today + 3`: se il job salta un giorno l'avviso arriva comunque invece di perdersi
  per sempre, e la dedup lo tiene singolo.
- **"Ricorrenti generate" filtra su `created_at`, non su `date`.** Il ciclo interno di
  `generate_recurring_transactions()` recupera più occorrenze arretrate in una sola
  esecuzione: quelle hanno `date` nel passato ma sono state create oggi.
- **`coalesce` sui nomi nei titoli.** Un `name` NULL produrrebbe per concatenazione un
  `title` NULL, e il `NOT NULL` farebbe fallire l'INTERO job notturno per tutti gli
  utenti. La FK in cascade lo rende impossibile oggi, ma un job non sorvegliato non è
  il posto dove appoggiarsi a un'invariante altrui.
- ⚠️ **Il cron usa l'orologio del DATABASE (UTC), non quello del client.** È
  inevitabile: un job gira una volta per tutti e non ha un client. È schedulato alle
  03:00 UTC apposta, così per l'Europa continentale `current_date` coincide con la data
  locale. Per un fuso molto a ovest le soglie verrebbero valutate con un giorno di
  anticipo; la chiusura pulita è una colonna `profiles.timezone`.
- **Il pannello non usa `bg-modal`** (0.85 in scuro, tarato per i bottom sheet che
  coprono uno sfondo già oscurato) ma `--color-deep` al 94%: galleggia sulla dashboard
  piena di numeri, e il design lo vuole a 0.92.
- ⚠️ **La SQL della Fase 14 non era nel repo** — è esistita solo dentro Supabase fino
  al 2026-08-04, quando è stata ricostruita in `20260728_recurring.sql`
  interrogando il catalogo (`information_schema.columns`, `pg_constraint`,
  `pg_policies`, `pg_get_functiondef`), non a memoria: una migration che indovina è
  peggio di una che manca.
- ⚠️ **`recurring_rules` non aveva alcun `CHECK` su `type`.** Emerso proprio
  ricostruendo il file: nel database era testo libero, mentre `categories` ha il suo
  `categories_type_check`. Il difetto contava perché la notifica di rinnovo
  abbonamento filtra su `type = 'abbonamento'` e quindi si appoggiava alla sola
  disciplina applicativa. Vincolo aggiunto il 2026-08-04.
- ~~⚠️ **IL REPO NON RICOSTRUISCE ANCORA IL DATABASE DA ZERO.**~~ — **chiuso il
  2026-08-12** dalla issue #43: `profiles`, `categories` e `transactions` sono
  ora versionate in `20260727_baseline_fase3.sql`, e le correzioni che quella
  fotografia ha reso visibili — fra cui **la registrazione rotta da cinque
  settimane** — stanno in `20260813_schema_cleanup.sql`. Vedi la sezione
  "Ricostruzione dello schema". Recuperare `recurring_rules` aveva chiuso un
  buco; questo ha chiuso gli altri.

### Fase 18 — tema chiaro/scuro

Implementata il 2026-08-05 (issue #32). Tre stati: chiaro, scuro, sistema.

- **La preferenza sta in un COOKIE, non in `localStorage`.** La classe `.dark` va su
  `<html>`, che è emesso dal root layout, cioè un server component: il cookie viaggia
  con la richiesta, quindi il server sa già cosa rendere e **il primo byte è quello
  giusto**. Niente flash, e soprattutto niente `suppressHydrationWarning` — che nella
  soluzione classica (`next-themes`: script inline + localStorage) non risolve il
  mismatch, lo **zittisce**. Quel cerotto serve solo perché la fonte del dato è
  irraggiungibile dal server; cambiando fonte il problema non esiste. Il costo
  abituale — leggere i cookie rinuncia allo static — qui era già pagato: proxy su
  ogni richiesta e cookie di sessione Supabase ovunque.
- **Due cookie, non uno.** `prefers-color-scheme` è una proprietà del browser e **non
  viaggia negli header**: con la scelta su "sistema" il server sarebbe di nuovo cieco.
  Il secondo cookie porta il valore **già risolto**, scritto dal client che lo conosce.
  Così `globals.css` resta a due soli blocchi (`:root` chiaro, `.dark` scuro): la via
  alternativa — far gestire "sistema" a un `@media` — avrebbe richiesto di duplicare
  ~50 token dentro la media query.
- Il cambio applica la classe **nel fotogramma corrente** e scrive il cookie per il
  caricamento successivo: nessun round-trip, nessun `router.refresh()`.
- **Primissima visita senza cookie: si rende scuro**, l'aspetto storico dell'app. Se
  il sistema dice altro, `ThemeProvider` corregge al mount — un lampo, una volta sola.
- **Doppio comando, voluto**: interruttore binario nel `ProfileMenu` (dal mockup) e
  tre stati in `/impostazioni`. Il binario non sa esprimere "sistema", quindi riflette
  ciò che si **vede** e, se toccato, fissa una scelta esplicita.
- La persistenza è **solo cookie**: `profiles.theme` per la sincronizzazione fra
  dispositivi è rimandata e si innesta senza toccare nulla, perché il cookie resta la
  fonte per il rendering. Serve comunque per le pagine pre-auth, che non hanno utente.

#### Il tema chiaro non era mai stato renderizzato — cosa è emerso

- ⚠️ **Due token CSS inesistenti, vivi da mesi**: `--color-hane` (sfondo dei tooltip
  dei tre grafici) e `--deep` (sfumatura in fondo alle transazioni recenti). Una
  variabile CSS inesistente **non fa rumore**: la dichiarazione è invalida e la
  proprietà semplicemente non si applica. C'è un audit ripetibile — confrontare ogni
  `var(--…)` del codice con i token definiti in `globals.css` — ed è il modo per
  trovarli. Vale la pena rieseguirlo a ogni fase.
  Nota: correggendo `--deep` è **comparsa** una sfumatura concettualmente sbagliata
  (suggeriva contenuto nascosto in una lista che non scorre, e sfumava verso il colore
  della pagina invece che della card). È stata **rimossa**, non riparata.
- ⚠️ **Un token può essere giusto in un tema e semanticamente sbagliato nell'altro.**
  `--bg-tab` (pastiglia del tab attivo) valeva una tinta *più scura del fondo* in
  entrambi. In scuro funziona — scurire fa emergere. In chiaro il selezionato leggeva
  come **disabilitato**: il design lo vuole bianco in rilievo. È il difetto che il
  grep non trova, perché la sintassi è corretta.
- **`--shadow-drop` in chiaro era sottotono** (0.10 contro lo 0.13–0.20 dei mockup):
  ogni superficie sembrava incollata al fondo. Portato a 0.14, l'inset a 0.9.
- I neutri brand (`tsuki`, `kiri`, `yoru`…) **non sono ridefiniti in `.dark`**: usarli
  come testo (`text-tsuki` era il testo primario di `/analisi` e `/investimenti`)
  significa colore fisso, invisibile in chiaro. Usare sempre i semantici
  (`text-foreground`, `text-muted`).
- Il separatore fra le fette dei donut era `var(--color-yoru)`: somigliava allo sfondo
  scuro **per caso**, e in chiaro disegnava un anello di inchiostro. Va usato il
  colore del **fondo** (`--background-secondary`).
- La palette del donut spese era policroma (rosso/blu/oro/viola = uscite, investimenti,
  risparmi, ricorrenti): suggeriva una distinzione di natura che lì non esiste, visto
  che sono **tutte uscite**. Ora è una scala monocromatica derivata da `--color-aka`
  con `color-mix`, quindi si ricalcola da sé nei due temi.
- Nuovi token: `--ink-*` (vedi Design System), `--switch-track-off`/`--switch-knob-off`
  (componente `components/UI/Switch.tsx`), `--halo-a`/`--halo-b` per gli aloni
  `zg-breathe`, che ora stanno anche sulla Home. **I valori scuri degli aloni sono
  identici a prima**: welcome e onboarding non cambiano di un pixel.

#### Emerso dal code-review, dopo il merge della PR #45 (2026-08-05)

La migrazione accento→inchiostro era stata applicata **a campione**: quasi sempre a
un elemento e non al suo vicino identico — l'importo di una ricorrente sì e il
pulsante "elimina" cinque righe sotto no, "Esci" sì e "Elimina il tuo account"
accanto no. Quattordici difetti, tredici dei quali lì dentro. Le correzioni che
non sono semplici sostituzioni di colore:

- **`tone` di `SettingsRow` faceva due lavori.** Colorava la label *e* la pastiglia
  dell'icona, quindi passargli l'inchiostro ri-tingeva anche la pastiglia e due
  righe adiacenti finivano con pastiglie di tinta diversa sotto la stessa icona.
  Ora sono due prop separate: `tone` (solo testo, vuole un inchiostro) e `accent`
  (solo pastiglia, vuole l'accento pieno).
- **Il colore lo distribuisce la libreria, in coppia.** Dove il colore arriva da un
  modulo condiviso si aggiunge il gemello invece di cambiare quello esistente:
  `TIPO_INK` accanto a `TIPO_COLOR`, `budgetInk()` accanto a `budgetColor()`,
  `PasswordStrength.ink` accanto a `.color`. Riempimenti e barre restano
  sull'accento, il testo prende l'inchiostro, e la scelta non è del chiamante.
- **`SwitchVisual` estratto da `Switch`.** La riga "Ripeti" di `TransactionForm` non
  può usare `<Switch>` — è già un `<button>`, e annidare il `role="switch"` sarebbe
  markup interattivo dentro markup interattivo — quindi ne ricopiava il disegno. Le
  due geometrie erano **già** divergenti (38×22 con pomello 18 contro 40×24 con
  pomello 20): un commento che dice "usa gli stessi token così non divergono" non
  impedisce niente, il disegno condiviso sì.
- **Un ramo morto in `ProfileMenu`**: la forma compatta (solo avatar, menu ancorato
  a destra) non era raggiungibile, perché l'unico chiamante passa sempre `name`.
  Rimossa insieme alle prop opzionali che la descrivevano.
- ⚠️ **Una frase può essere sbagliata dove un colore era solo un lampo.** Con la
  scelta su "sistema", alla primissima visita `resolved` è l'ipotesi del server, e
  `/impostazioni` scriveva "segue il sistema · ora scuro" su una pagina chiara. Il
  lampo di colore era messo in conto (vedi sopra); una *dichiarazione* falsa no.
  Fino all'idratazione si dice solo la parte vera comunque ("segue il sistema",
  icona monitor). Il rilevamento usa `useSyncExternalStore`, **non**
  `useEffect`+`setState`: il lint di React vieta il secondo come render a cascata,
  e qui la differenza fra render del server e render del client è esattamente ciò
  che il primo esiste per esprimere.
- ⚠️ **L'audit dei token non vede tutto.** Rieseguito, passa: 72 token definiti,
  zero `var(--…)` usate senza definizione. Ma `--ink-kiri` *era* definito e non
  mappato in `@theme inline`, quindi `text-kiri-ink` non esisteva e sarebbe
  fallito in silenzio come qualsiasi classe inventata. Va confrontata anche la
  lista dei `--color-*-ink` di `@theme inline` con quella dei `--ink-*` di `:root`.

#### Rimandato

- Saluto orario al posto di "Bentornato": il server è in UTC su Vercel, quindi un
  "buongiorno" alle 23 è peggio di un saluto neutro. Si fa lato client, al costo di un
  lampo del testo dopo l'idratazione.
- ~~⚠️ **`<input type="date">` mostra `mm/dd/yyyy`**~~ — **chiuso nella Fase 19**
  con `components/UI/DatePicker.tsx`. Il formato seguiva la lingua del **browser**,
  non `lang="it"` della pagina: era l'unico pezzo di interfaccia non traducibile,
  perché il testo lo disegna il browser e non è nostro.

### Fase 19 — lingua (it/en)

Implementata il 2026-08-07 (issue #33). Migration `20260807_language.sql`, eseguita.
Verificata end-to-end. **96 file toccati, 545 voci di dizionario per lingua.**

#### Le tre decisioni di partenza

- **Il locale NON sta nell'URL.** Le route restano in italiano (`/impostazioni`,
  `/risparmi`): sono identificatori, non testo. Metterlo nel percorso avrebbe
  imposto `app/[locale]/`, il riadattamento di `PUBLIC_PATHS` nel proxy e la
  revisione di ogni `redirect()` e `emailRedirectTo`, in cambio di URL
  condivisibili per lingua e SEO multilingua — che dietro un login non valgono
  nulla. La preferenza vive in un **cookie**, come il tema della Fase 18.
- ⚠️ **Un cookie solo, non due.** Il tema ne ha due perché `prefers-color-scheme`
  è una proprietà del browser e **non viaggia negli header**, lasciando il server
  cieco sulla scelta "sistema". `Accept-Language` invece viaggia: il server
  risolve da sé anche alla primissima visita. È il caso **speculare**, e vale
  sfruttarlo invece di ricopiare la struttura del tema per simmetria.
- **`profiles.language` NON si legge a ogni render**: sarebbe una query a
  Supabase su ogni pagina per un valore che cambia due volte nella vita di un
  account. La riga del database è la persistenza fra dispositivi e viene
  riversata nel cookie **al login**, dentro la query che già interroga il profilo
  per il gate dell'onboarding (`profiles.currency`) — quindi a costo zero.
  Il cookie è la fonte per il rendering.

#### Struttura

- **Dizionari tipizzati a mano, zero dipendenze.** `it.ts` è la fonte di verità,
  `en.ts` è annotato `: Dictionary` e derivato da essa: una chiave dimenticata
  **non compila**, invece di apparire in produzione come `settings.account.title`
  in mezzo alla pagina. Plurali e numeri con `Intl.PluralRules` /
  `Intl.NumberFormat`, che sono nativi.
- ⚠️ **`it.ts` non usa `as const`.** Con le stringhe irrigidite a tipi letterali,
  `Dictionary` pretenderebbe da `en.ts` esattamente le stesse parole italiane.
- ⚠️ **I dizionari contengono SOLO stringhe e oggetti semplici, mai funzioni.**
  Il dizionario attraversa il confine server→client come prop di
  `<I18nProvider>`: una funzione lì dentro fa fallire la serializzazione RSC.
  I valori variabili passano da segnaposto `{nome}` + `fill()`.
- **`I18nProvider` non ha `setLocale`**, a differenza di `ThemeProvider`. Il tema
  cambia nel fotogramma corrente perché al client basta una classe; le parole
  stanno sul server. L'alternativa era impacchettare entrambe le lingue nel
  browser per risparmiare un round-trip su un'azione biennale.
- **`lib/i18n/config.ts` non importa `next/headers`** (serve ai client component);
  `server.ts` sì, ed è quella la guardia che rende il modulo inutilizzabile dal
  client — per questo non serve il pacchetto `server-only`.
- **`en-GB` e non `en-US`** come tag `Intl`. Seichi è un'app europea in euro:
  `en-US` scriverebbe `8/7/2026`. `en-GB` dà `07/08/2026`, identico all'italiano.
- **Gli errori li traducono le server action**, che il cookie ce l'hanno:
  `requireUser()` restituisce anche il dizionario. Restituire codici da mappare
  sul client sarebbe più puro ma raddoppierebbe gli elenchi da tenere allineati.

#### Il testo esce da `lib/`, e non è un dettaglio di stile

Sette moduli distribuivano una parola accanto a un dato. È lo stesso schema di
`TIPO_COLOR`/`TIPO_INK`, applicato ovunque: **il modulo tiene la meccanica, il
dizionario le parole.**

| Modulo | Cosa se n'è andato |
|---|---|
| `transaction-utils.ts` | `TIPO_LABEL`, `numberFormatter` |
| `types/index.ts` | `TRANSACTION_TYPES[].label` e `.description` — in un file di TIPI |
| `password.ts` | etichette di robustezza; `validateNewPassword` ora torna un **codice** |
| `budget.ts` | `label`/`suffix`/`window` per periodo |
| `recurring.ts` | `label`/`recurLabel` per cadenza |
| `category-icons.ts` | 69 etichette icona |
| `investment-types.ts` | `label` per tipologia |

⚠️ **Le etichette icona sono annidate per TIPO, non una mappa piatta `id →
etichetta`**: nove icone cambiano nome col contesto (`Landmark` è "Bonifico" fra
le entrate e "Azioni" fra gli investimenti; `Home` è "Casa / Affitto" fra le
spese e "Casa nuova" fra i risparmi). Appiattire avrebbe mostrato l'etichetta di
un altro contesto **senza alcun errore**.

#### Quello che fa `Intl`, e che quindi NON sta nei dizionari

Sei array/rami italiani sono spariti perché `Intl` li produce per ogni lingua.
Vale la pena cercarne altri prima di aggiungere una voce di dizionario:

- `"Oggi"`/`"Ieri"` e `"oggi"/"domani"/"fra N giorni"` → `Intl.RelativeTimeFormat`
  con `numeric: "auto"` (`relativeDayLabel`, `formatRelativeTime`)
- `MESI`/`GIORNI` in `action.ts`, `MESI_LUNGHI` in `/analisi`, `DAYS` in
  `TransactionForm` → `Intl.DateTimeFormat` (`formatDate`, `weekdayInitials`)
- plurali scritti a mano (`n === 1 ? … : …`) in quattro punti → `Intl.PluralRules`
  (`plural()`)

#### I difetti che la traduzione ha fatto emergere

- ⚠️ **`profiles.language` conteneva `"IT"`/`"EN"` maiuscoli.** L'onboarding
  scriveva il valore grezzo della select, le impostazioni leggevano minuscolo:
  chi sceglieva English si ritrovava "Italiano", in silenzio. Invisibile finché
  nessuno consumava il campo; con l'i18n acceso sarebbe stata l'intera app nella
  lingua sbagliata. Normalizzato al confine (`normalizeLocale`), in lettura, e
  con un `CHECK` in migration — perché il codice applicativo lo scavalca un
  insert dal SQL Editor.
- ⚠️ **`nuova {type}` era grammaticalmente sbagliato in italiano per tre tipi su
  cinque**: il pulsante diceva "Nuova investimento", "Nuova risparmio", "Nuova
  abbonamento". Un aggettivo si accorda col genere del nome, e il genere non sta
  nella chiave del database. **In inglese il problema non esiste — ed è
  esattamente per questo che un template pensato in inglese lo nasconde.**
  Ora `newByType` ha frasi intere. Stessa classe: `Seleziona ${title}` in
  `Select` (che produceva "Seleziona category") e `Budget "X" ` + aggettivo nelle
  notifiche.
- ⚠️ **`splitAmount` in `BalanceCard` si sarebbe rotto in inglese.** Cercava la
  virgola (`lastIndexOf(",")`) per staccare i decimali; in `en-GB` la virgola
  separa le MIGLIAIA, quindi `1,234.50` sarebbe diventato `1` grande e `,234.50`
  piccolo. Ora passa da `formatToParts`, che etichetta i pezzi.
- **`GoalCard` era l'unico punto che usava `style: "currency"`**, cioè scriveva
  "180 €" mentre tutto il resto scrive "€ 180".
- Tre `color: "#fff"` sopra un riempimento d'accento (la stessa dialog di
  conferma, ricopiata tre volte) — la trappola documentata nella Fase 18.

#### Le categorie di default: tradotte alla SCRITTURA

`CATEGORY_MAP` non ha più `name`. Il nome arriva da
`t.presetCategories[chiave].title` **al momento dell'insert**, non al render.

Motivo: una volta scritto in `categories.name` non è più una stringa dell'app ma
un **dato dell'utente**, rinominabile, e già copiato nel payload delle notifiche
(`'category', c.name` nella migration della 17b). Tradurlo alla lettura avrebbe
richiesto una colonna `preset_key`, una regola "se è valorizzata ignora `name`",
l'azzeramento al primo rename — e avrebbe fatto **disaccordare la lista dalle
notifiche già emesse**, due nomi per la stessa categoria nella stessa schermata.
Chi cambia lingua dopo rinomina le proprie categorie, come farebbe comunque.

Lo **stesso catalogo** serve il picker dell'onboarding e la server action: se
fossero due elenchi, la card potrebbe dire "Groceries" e la categoria creata
chiamarsi "Alimentari".

#### Le notifiche: la 17b aveva ragione

`payload` JSONB con i **fatti** invece della frase già composta era stato deciso
nella Fase 17b prevedendo esattamente questo momento. Il risultato: le frasi si
compongono alla lettura, quindi **anche le notifiche di mesi fa cambiano lingua**
insieme all'app. Salvando il testo, tutto lo storico sarebbe rimasto italiano.

#### La valuta NON è stata toccata

`profiles.currency` è scelta dall'utente e già letta da `getAccountContext()` e
dalle notifiche, ma farla arrivare a ogni foglia è un lavoro **indipendente dalla
lingua** — tocca gli stessi file per un'altra ragione. Il comportamento resta
identico dietro `DISPLAY_CURRENCY` in `lib/i18n/format.ts`: quando si affronterà,
basta seguirne i riferimenti invece di cercare "€" in tutto il codice. Per questo
anche i cinque `€` decorativi nel markup passano da `currencySymbol()`.

#### ⚠️ Come verificare, e cosa la verifica NON vede

Quattro controlli, tutti ripetibili. I primi due sono **codice di verifica usa e
getta**, non parte del repo: si riscrivono in dieci minuti quando servono.

1. **Testo cablato** — cerca stringhe letterali in posizione di testo (nodi JSX,
   prop testuali, qualsiasi stringa con uno spazio). ⚠️ **NON cercare "parole
   italiane da un elenco"**: è stato provato e ha mancato "Altro", "Ago",
   "Investito", "Seleziona" — e non avrebbe mai trovato
   `"Sorry, something went wrong"`, che era cablato **in inglese**. In un'app
   tradotta ogni letterale in posizione di testo è un residuo, in qualunque
   lingua: quello è il controllo giusto.
2. **Confine server→client** — per ogni server component, le prop
   `icon`/`on*`/`render*` passate a un figlio `"use client"`.
3. **Parità dizionari** — stesse foglie in it/en, voci mai usate, e **valori
   identici fra le due lingue** (una traduzione dimenticata compila benissimo;
   i 26 identici attuali sono tutti parole internazionali: Email, ETF, Budget…).
4. **Audit dei token CSS** della Fase 18, incluse le costruzioni **dinamiche**
   (`` var(--color-${accent}) ``): il suffisso non è visibile al grep, quindi
   vanno enumerati i valori possibili.

⚠️ **`tsc` e `next build` non vedono gli errori di serializzazione RSC.** Marcare
`SummaryCard` come `"use client"` per usare `useI18n()` ha rotto la home: la
pagina è un server component e gli passa `icon`, cioè una funzione. I tipi erano
corretti e la build passava — l'errore compare solo **aprendo la pagina**.
`SummaryCard` resta quindi un server component e legge la lingua con `getI18n()`.
Build verde non significa app funzionante.

⚠️ **Scrivere il cookie della lingua NON basta a cambiare la lingua resa.** Una
navigazione soft (`router.push`) riusa il root layout dalla cache del router, e
quindi il dizionario vecchio. Nell'onboarding questo produceva il difetto
peggiore possibile: `/category` mostrava le card in italiano mentre
`saveCategories()` — che il cookie lo legge sul server — scriveva i nomi in
inglese nel database, cioè proprio il disallineamento che il catalogo unico
esiste per impedire. Ogni action che cambia lingua deve fare
`revalidatePath("/", "layout")`, non solo `setLocaleCookie()`.

#### Emerso dal code-review

Dodici difetti, undici introdotti dalla fase. I quattro che valgono una regola:

- ⚠️ **`t.mappa[valoreDalDatabase].campo` è una dereferenziazione ottimista.**
  Il tipo dice cosa il DB *dovrebbe* contenere, non cosa contiene: sostituendo
  `FREQ_RECUR_LABEL[f] ?? f` con l'accesso diretto, una riga inattesa passava da
  difetto cosmetico a schianto di pagina. Si usa `lookup()` di
  `lib/i18n/format.ts`, che il ripiego lo impone.
- ⚠️ **Un array italiano sostituito da `Intl` può perdere la maiuscola.**
  `MESI`/`GIORNI` davano "Gen"/"Lun", `Intl` dà "gen"/"lun" — e in inglese non si
  nota ("Jan"/"Mon"), quindi la regressione si vede **solo nella lingua di
  default**. Vale per `weekdayInitials` e `shortMonth`, che ora capitalizzano.
- ⚠️ **`Intl` non vince sempre.** `format(0, "second")` in italiano è "ora", che
  accanto a "1 ora fa" nella stessa colonna si legge come un conteggio troncato.
  È l'unico caso in cui una parola scritta a mano ("adesso") batte `Intl`, e sta
  nel dizionario per questo.
- ⚠️ **Sostituire un controllo nativo può togliere uno stato.**
  `<input type="date">` si poteva svuotare; il `DatePicker` emetteva solo giorni
  concreti, quindi una scadenza opzionale diventava irreversibile. Il comando che
  la rimuove compare quando `placeholder` dichiara che la data è opzionale.

Più due lezioni sul metodo di verifica, entrambe pagate:
**estrarre un componente non è finito finché l'originale non è cancellato**
(il calendario è vissuto duplicato in `TransactionForm` e `DatePicker`, già
divergenti); e **uno scanner va messo alla controprova**, perché quello del testo
cablato leggeva solo i `.tsx` e non guardava le stringhe fuori dal JSX — due
buchi che insieme nascondevano sei `"Non autenticato"` nelle server action.

### Fase 20 — conti multipli e trasferimenti

Progettata per intero il 2026-08-13 prima di scrivere codice, come la Fase 17.
**Non ancora implementata.** Consegna in due PR: **20a** conti (issue #34),
**20b** trasferimenti (issue #49) — dipendenza a senso unico, la 20a è un
prodotto finito da sola.

```sql
accounts: id (UUID), user_id (UUID NOT NULL), name (VARCHAR 50 NOT NULL),
          type (VARCHAR 20), icon (VARCHAR 50), color (TEXT),
          initial_balance (DECIMAL 10,2 NOT NULL default 0),
          archived (BOOL NOT NULL default false), created_at

transactions: + account_id (UUID NOT NULL), to_account_id (UUID, nullable)
recurring_rules: + account_id (UUID NOT NULL)
-- type acquisisce 'trasferimento'
```

#### ⚠️ Il vincolo che rende praticabile tutto il resto

Prima di progettare è stato fatto l'audit di **ogni** consumatore di
`transactions`: `dashboard_totals()` (l'app legge per nome — `somma(b,"entrata")`),
il grafico mensile (`.in("type", [...5 nomi...])`), la torta (`spesa`), i budget
(`spesa`/`abbonamento`), gli obiettivi (`risparmio`), gli investimenti
(`investimento`). **Nessuno somma "tutto ciò che c'è".**

Quindi un tipo nuovo è invisibile a ogni totale esistente **per costruzione, non
per attenzione di chi scrive** — ed è ciò che rende sicuro modellare il
trasferimento come transazione invece che come tabella separata. Se anche uno
solo di quei punti avesse sommato indiscriminatamente, la conclusione sarebbe
stata l'opposta. L'audit va rifatto prima di aggiungere altri tipi.

#### Le decisioni

- **`initial_balance` è una COLONNA, non una transazione di apertura.** Quando si
  aggiunge "Conto corrente" ci sono già 2.400 € dentro, e l'app non ha quella
  storia. Modellarli come `entrata` li farebbe comparire fra i redditi del mese e
  gonfierebbe ogni grafico: **è lo stesso difetto del trasferimento, in versione
  una-tantum.** Una colonna dice "il conto parte da qui" senza affermare che quei
  soldi siano un reddito.
- ⚠️ **`transactions.account_id` è `on delete RESTRICT`, non `cascade`.** La
  cascade su `categories` è deliberata — serve a eliminare un obiettivo — ma qui
  cancellare un conto cancellerebbe anni di movimenti reali. Un conto chiuso in
  banca non fa sparire ciò che ci hai speso. Da qui `archived`: si archivia, non
  si elimina.
- **`account_id` NOT NULL**, con migration che crea un conto per ogni utente
  esistente e fa il backfill. Nullable era la scelta comoda, ma
  `categories.user_id` nullable è già un debito aperto per esattamente questo
  motivo: il DB permette uno stato che l'app dà per impossibile. L'onboarding
  crea il primo conto, come già crea le categorie.
- ⚠️ **`recurring_rules.account_id` serve anche lei**, e
  `generate_recurring_transactions()` va aggiornata per copiarlo sulla
  transazione generata. Dimenticarlo produrrebbe righe senza conto — cioè
  violerebbe il NOT NULL e fermerebbe il job notturno per tutti (la #47 insegna
  che un guasto lì è per-utente solo se qualcuno lo isola).

#### Il trasferimento: UNA riga, non due

`type='trasferimento'`, `account_id` = origine, `to_account_id` = destinazione.

L'alternativa — due righe legate da un `transfer_group_id` — è quella che questo
progetto ha già scartato tre volte con lo stesso ragionamento: niente `valid_to`
sui budget, nessuna colonna `spent`, nessun `saved_amount` memorizzato. **Due
righe per un evento sono due punti di scrittura da tenere allineati**, e basta
cancellarne una per ottenere mezzo trasferimento: una somma che sparisce da un
conto senza comparire nell'altro, senza alcun errore e senza che nulla lo
segnali.

Con una riga sola lo stato illegale è **irrappresentabile**, e lo impone il DB:

```sql
check (to_account_id is null or type in ('trasferimento','risparmio','investimento'))
check (type <> 'trasferimento' or to_account_id is not null)
check (type <> 'trasferimento' or category_id is null)
check (to_account_id is null or to_account_id <> account_id)
```

⚠️ **Qui si rompe l'accoppiamento 1:1 fra tipo di transazione e tipo di
categoria** (`TransactionForm` filtra con `.eq("type", selectedType.id)`): il
trasferimento non ha categoria, e nel form il selettore categoria lascia il posto
al conto di destinazione. È il punto di rottura, ed è deciso adesso invece di
essere scoperto a metà implementazione.

#### ⚠️ `risparmio` e `investimento` possono avere una destinazione

Deciso il 2026-08-13. È la collisione che il progetto non aveva mai dovuto
affrontare: oggi `risparmio` e `investimento` **tolgono** soldi dal saldo e non
li mettono da nessuna parte. Con i conti, mettere 200 € da parte diventa
esprimibile due volte — una transazione `risparmio` verso un obiettivo **oppure**
un trasferimento verso il conto "Libretto" — e chi facesse entrambi vedrebbe
uscire 400 € dal conto corrente.

Soluzione: `to_account_id` è **facoltativo** su `risparmio` e `investimento`. Un
versamento verso l'obiettivo "Vacanza" può dire anche "i soldi sono finiti sul
Libretto": avanza l'obiettivo **e** sposta il denaro, in un gesto solo. Il doppio
conteggio diventa **impossibile**, non sconsigliato — la stessa preferenza per
l'irrappresentabile che regge `ProfileHeader` senza `email` nella Fase 19.

#### Il saldo si CALCOLA

Nessuna colonna `balance`, per la stessa ragione di `spent` e `saved_amount`:
avrebbe quattro punti di scrittura da tenere allineati, inclusi gli insert di
pg_cron.

```
saldo(X) = initial_balance(X)
         + Σ amount dove type='entrata' e account_id = X
         − Σ amount dove type <> 'entrata' e account_id = X
         + Σ amount dove to_account_id = X
```

#### ⚠️ La home perde "Saldo totale" — deciso il 2026-08-10 sul mockup `Seichi Conti.dc.html`

Oggi la home mostra `saldoTotale` = entrate − spese − risparmi − investimenti −
abbonamenti **su tutta la storia**. Con i conti quel numero entra in
contraddizione con la pagina conti, che alla stessa domanda ("quanto ho")
risponde con la somma dei saldi — diversa, perché `saldoTotale` **sottrae i
risparmi**, che sono ancora soldi tuoi solo altrove, e **ignora
`initial_balance`**.

⚠️ **La prima stesura rimandava la riconciliazione** ("la 20a non li
riconcilia"). Sbagliato, e vale registrare perché: rimandare non è *non
decidere*, è **spedire la contraddizione**. È la 20a a creare l'ambiguità —
prima non esisteva, perché non c'era un secondo numero — quindi è la 20a a
doverla chiudere. Due schermate della stessa app che rispondono diversamente a
"quanto ho" sono il difetto già elevato a regola nella 17a: *un numero sbagliato
che sembra giusto è peggio di un numero assente*.

La chiusura non lascia due numeri concorrenti perché ne toglie uno:

| | oggi | dalla 20a |
|---|---|---|
| cifra grande | `saldoTotale`, "Saldo totale" | **"Flusso · <mese>"** |
| formula | entrate − spese − risparmi − investimenti − abbonamenti, **su tutta la storia** | **entrate − spese − abbonamenti, del mese** |
| riga sotto | "↑ + € X questo mese" | *"entrate meno uscite di questo mese — non il saldo dei conti"* + *"i saldi reali sono nella pagina conti"* |

⚠️ **"Flusso" NON è `saldoMese`, ed è un errore già commesso una volta** (questa
riga diceva "è una rinomina, non un calcolo nuovo"). Va scritta una formula
nuova, e le due sottrazioni che cambiano hanno ragioni opposte:

- **risparmi e investimenti NON si sottraggono più.** Investire e risparmiare non
  è *consumare*, è **spostare**: con i conti quel denaro è ancora tuo, solo
  altrove. Sottrarlo lo farebbe sembrare speso — la premessa stessa della fase.
  La sottrazione di oggi era corretta solo finché quei soldi sparivano dalla
  vista, perché non c'era un posto dove metterli.
- ⚠️ **gli abbonamenti SÌ, e questo il mockup lo sbagliava.** I suoi numeri —
  2.400 − 1.240 = 1.160 — sottraggono le sole spese. Ma la home mostra quattro
  card (entrate, spese, investimenti, risparmi) e `abbonaMese` **non è fra
  quelle**: l'affitto sarebbe invisibile *e* non conteggiato, e il numero
  direbbe "ti restano 1.160" mentre deve ancora uscire. È la trappola già
  elevata a regola nella 17a ("spese variabili", mai "spese totali"). Nel
  mockup non si vede perché il mese di esempio non ha abbonamenti — **il difetto
  è nei dati d'esempio, non nel disegno**, ed è la ragione per cui i mockup vanno
  letti anche sui numeri e non solo sul layout.

Da qui anche il sottotitolo: **"uscite"**, non "spese", perché comprende gli
abbonamenti che nella tassonomia dell'app sono un tipo a sé.

**La home resta una vista di FLUSSO, i saldi stanno nella pagina conti** — la
divisione non cambia, cambia il fatto che ora la home lo *dice*. `saldoTotale`
non era una vista di patrimonio: era un **surrogato** costruito senza conti, e i
conti sono la versione vera della stessa domanda. Tenerlo significherebbe due
risposte, che è la configurazione peggiore.

⚠️ **Conseguenza sul costo**: `saldoTotale` è l'**unico** consumatore del bucket
`null` di `dashboard_totals()` — l'aggregazione su tutta la storia dell'account,
rifatta a ogni vista della home. Togliendo il numero il bucket diventa morto e va
rimosso nella stessa migration che tocca la funzione, o resta una scansione
dell'intero storico per un valore che nessuno mostra.

#### ⚠️ …e il saldo TORNA in home, in un carosello — deciso il 2026-08-11

La sezione qui sopra dice che la home perde la giacenza. **Non è più vero, e la
distinzione è precisa**: quello che è stato cancellato è `saldoTotale`, che dava
un numero **diverso** da `/conti`; quello che torna è la **somma dei saldi**,
cioè lo stesso identico numero, dalla stessa vista `account_balances`.

**La regola fissata dalla fase vieta la CONTRADDIZIONE, non la ripetizione.**
Due schermate non possono rispondere *diversamente* a "quanto ho". Rispondere
allo stesso modo è un'altra cosa — e affiancare i due numeri, ciascuno con la
propria spiegazione, è il modo più diretto di insegnare la differenza fra ciò
che si è *mosso* e ciò che *c'è*. Erano già dovute convivere in due pagine
diverse; il carosello le mette a confronto invece di sperare che l'utente le
colleghi da sé.

⚠️ **Va registrato che il primo tentativo era un'applicazione TROPPO LARGA della
regola.** Aggiungendo la riga "Saldo · € …" sotto il selettore l'avevo mostrata
solo con un conto singolo, motivando che "mostrarla su tutti i conti rimetterebbe
in home il numero che la fase ha tolto". Sbagliato: confondeva *un numero
sbagliato che contraddice* con *il numero giusto che concorda*. Una regola
applicata senza rileggere il motivo per cui esiste diventa superstizione.

Le decisioni del carosello:

- **"Saldo · N conti attivi"**, mai "Saldo totale" — il mockup scriveva la
  seconda, e sarebbe stata la parola falsa di sempre: gli archiviati restano
  fuori. Stesso titolo della pagina conti, o lo stesso numero avrebbe due nomi.
- **Con un conto selezionato la card mostra il saldo di QUEL conto**, non il
  totale. Le due pagine devono parlare dello stesso insieme, o sarebbe un flusso
  filtrato accanto a una giacenza globale — il difetto già corretto su
  "Risparmi · N%".
- ⚠️ **L'importo del saldo è NEUTRO** (`--color-yoru`), non verde come il flusso,
  e il mockup ha ragione. Un flusso è positivo o negativo — hai guadagnato o
  speso; **una giacenza semplicemente è**. Colorarla direbbe che avere 800 € è
  "buono" e un conto in rosso un fallimento: affermazioni che la card non ha
  titolo per fare.
- **Lo stato dell'occhio sta in `HomeHero`**, non nelle card: restando in
  `FlowCard` si poteva nascondere il flusso lasciando il saldo accanto in chiaro,
  cioè non nascondere niente.
- **Il link "i saldi reali sono nella pagina conti" è sparito dalla FlowCard.**
  Mandava per la strada lunga a una cosa distante uno swipe, ed era diventato
  incompleto al punto di sviare. La riga di spiegazione ne ha preso il posto e
  ora fa due lavori: dice cosa il numero **non** è *e* insegna che si scorre —
  che è il difetto tipico dei caroselli, metà del contenuto invisibile a chi non
  sa del gesto.

⚠️ **Due trappole di CSS, entrambe scoperte guardando lo schermo:**

- **`overflow-x-auto` RITAGLIA il `box-shadow`.** Per specifica, se un asse non è
  `visible` non lo è nemmeno l'altro: il taglio avviene su tutti e quattro i
  lati, e la card sembra piatta pur avendo le stesse classi di prima. Non ha
  perso l'ombra, ha perso lo spazio dove disegnarla. `card-shadow` è
  `0 8px 24px`, quindi si estende **32px sotto**, 16 sopra e 24 ai lati: il
  padding va dimensionato leggendo la definizione, non a occhio — il primo
  tentativo con `py-4` dava metà dello spazio necessario proprio sotto, dove
  quell'ombra si vede di più.
- **Il padding va sulle PAGINE, non sul contenitore.** Messo sul track, ogni
  pagina risultava più stretta della vista: si vedeva sbucare la card successiva
  e il bordo sembrava tagliato comunque. Il contenitore va a tutta larghezza
  (`-mx-5`, fino ai bordi dello schermo) e sono le pagine a portare `px-5`, gli
  stessi 20px del resto della home — così la card è allineata alle quattro sotto.

#### ⚠️ `accounts.type` è DECORATIVO, mai semantico — deciso il 2026-08-10

La domanda che l'ha sollevato: un conto "Portafoglio investimenti" **collide con
la pagina Investimenti**? No, e il test che lo dimostra è *"esiste un caso reale
in cui i due numeri devono divergere?"*. Ce ne sono tre, tutti normali:

1. **Liquidità non investita** — 1.000 € trasferiti sul conto titoli e non ancora
   impiegati: il conto ha giacenza, il *totale investito* non si muove. La
   differenza è un'informazione, non un errore.
2. **Investimento da un altro conto** — un PAC addebitato sul corrente è
   `type='investimento'` a pieno titolo, e il conto titoli non lo vede.
3. **Plusvalenze** — il totale investito è per definizione la somma dei
   versamenti (Seichi non ha quotazioni); il saldo di un conto un domani potrebbe
   essere allineato al valore reale. Allora divergono *strutturalmente*.

Sono due **dimensioni**: `transactions.type` dice **che cosa** hai fatto (flusso,
alimenta la pagina Investimenti), il conto dice **dove si trova** il denaro
(giacenza, alimenta la pagina Conti). Formule diverse su insiemi diversi: non
possono essere lo stesso numero, e non devono.

⚠️ **Ma regge solo se `accounts.type` non decide niente.** Nel momento in cui
facesse qualcosa — "i movimenti su un conto investimento sono investimenti", o
"il saldo del conto entra nel totale investito" — la domanda *"questo movimento è
un investimento?"* avrebbe **due risposte**, quella di `transactions.type` e
quella di `accounts.type`. È la classe di difetto già pagata tre volte:
`hasPasswordIdentity` derivato in due punti (→ account impossibile da eliminare),
`getAccountContext()` che serviva due bisogni con freschezze diverse, `currency
default 'EUR'` che affermava "onboarding finito". Vale la regola già scritta:
**un campo che serve a disegnare e un campo che serve a decidere hanno bisogni
diversi anche quando contengono la stessa stringa.**

Quindi `accounts.type` sceglie **icona ed etichetta, nient'altro**. La natura del
movimento la decide sempre e solo `transactions.type`. Se un domani servirà far
comportare l'app diversamente su un conto, sarà una decisione nuova presa in
chiaro, non una conseguenza scivolata dentro da un'etichetta.

**Lo stesso vale per "Fondo risparmio" contro gli obiettivi**: l'obiettivo è un
**traguardo**, il conto è un **luogo**. Un obiettivo si finanzia da qualunque
conto; un conto può contenere denaro di più obiettivi o di nessuno. Il saldo non
è la somma degli obiettivi. È la ragione per cui `to_account_id` facoltativo su
`risparmio` (20b) è la forma giusta: un gesto solo che avanza il traguardo *e*
sposta il denaro.

**Conseguenza sui nomi, come "spese variabili" nella 17a**: la pagina Conti parla
di **giacenza**, la pagina Investimenti di **investito**. Se entrambe li
chiamassero "investimenti", l'utente non saprebbe a quale credere e smetterebbe
di fidarsi di tutti e due.

#### I filtri per conto — deciso il 2026-08-10

Due, non uno solo come prevedeva la prima stesura:

- **nella lista movimenti**, accanto ai filtri esistenti;
- **in home**, il selettore "Tutti i conti" in cima al mockup.

⚠️ **Il filtro in home non è gratis**: i totali della home li calcola
`dashboard_totals()`, quindi la funzione acquisisce un parametro conto e **cambia
firma**. Valgono le due trappole già documentate — i cast espliciti su ogni
colonna (`RETURN QUERY` di plpgsql pretende i tipi esatti, e fallisce solo a
runtime) e l'**ordine di deploy vincolante**: migration prima del codice, o la
home risponde 404 sulla RPC. È anche la migration in cui togliere il bucket
`null` rimasto senza consumatori.

**Filtrando per conto la home resta una vista di FLUSSO**, quindi i trasferimenti
continuano a non comparire: spostare denaro non è né guadagnarlo né spenderlo, e
il filtro cambia *quali* righe si guardano, non *che cosa* la pagina afferma. Per
la stessa ragione il filtro agisce su `account_id` (l'origine del movimento): un
`risparmio` fatto dal corrente verso il Fondo è un atto compiuto **dal corrente**.

#### Emerso rileggendo i mockup, prima di scrivere codice (2026-08-10)

##### `Seichi Conti.dc.html`

L'audit contro le regole già scritte qui. Oltre al difetto sugli abbonamenti
(sopra), quattro cose:

- ⚠️ **"Saldo totale · 4 conti attivi" non era un totale.** 3.240 + 180 + 3.400 +
  8.600 = 15.420, e il conto archiviato da 1.150 resta fuori. Il sottotitolo
  correggeva a voce bassa una parola falsa in cifre grandi — di nuovo la 17a.
  **Deciso: gli archiviati restano fuori e il numero si chiama "Saldo · N conti
  attivi".** Le altre due strade erano peggiori: includerli fa contribuire al
  patrimonio un conto chiuso in banca; vietare l'archiviazione con saldo ≠ 0
  rende irrappresentabile lo stato illegale ma **richiede un trasferimento per
  svuotare il conto, che arriva solo con la 20b** — in 20a un conto con soldi
  dentro non sarebbe archiviabile affatto.
- ⚠️ **`initial_balance` era modificabile solo alla creazione, e questo rende un
  refuso irreparabile.** Il conto non si cancella (per decisione presa), il saldo
  deriva da lì, e l'unico rimedio sarebbe una transazione fittizia — cioè
  sporcare i movimenti reali per riparare un campo di configurazione. **Deciso:
  modificabile**, con il testo che dice cosa fa ("cambiarlo sposta il saldo, non
  crea né entrate né spese"). Vale il precedente della 17a: *correzione e cambio
  sono la stessa operazione*.
- **"riattiva" usava `--color-ao` come colore del testo** a 11,5px: ~3,2:1,
  sotto AA. Va `--ink-ao` (`text-ao-ink`). ⚠️ Notare che è l'**unico** caso in
  tutto il file — il mockup rispetta accento≠inchiostro ovunque, quindi è una
  svista isolata e non un pattern da correggere a tappeto.
- **Sei neutri fuori dai token**, il più diffuso `#5A5548` (32 usi, stroke delle
  icone SVG); poi `#E6DFD1`, `#F2F5FA`, `#D7DEEA`, `#A9B0BF`, `#7C766A`. Tutto il
  resto mappa **esattamente** sulla palette — i cinque accenti, gli inchiostri, i
  neutri chiari e scuri — il che è ciò che rende visibili i pochi fuori elenco.
  Vanno ricondotti a un token, o restano colori fissi che non si spostano fra i
  temi.

##### `Seichi Dashboard.dc.html`

⚠️ **Le quattro card mescolavano flusso e giacenza senza dirlo, e questo riapriva
il conflitto da cui è nata l'intera discussione su `accounts.type`.**

Entrate `2.400` e Spese `1.240` sono flussi del mese; Investimenti `8.600` e
Risparmi `3.400` **coincidono esattamente con i saldi** di `Portafoglio
investimenti` e `Fondo risparmio` in `Seichi Conti.dc.html`. Quattro card
identiche, due semantiche temporali, sotto un'intestazione che dice "Questo
mese". Tre contraddizioni in un colpo:

- **con la card tre centimetri sopra**, che dichiara *"non il saldo dei conti —
  i saldi reali sono nella pagina conti"*;
- **con l'altro mockup**, la cui home mostra le stesse due card come `€ 300
  investiti / € 200 risparmiati`, cioè i flussi;
- ⚠️ **con la separazione giacenza/investito appena decisa**: se la card
  "Investimenti" della home è il *saldo del conto* mentre la pagina Investimenti
  mostra l'*investito*, la home rimette sotto la stessa parola i due numeri che
  `accounts.type` decorativo esiste per tenere distinti.

**Deciso: restano flussi del mese**, come oggi (`investimentiMese`,
`risparmiMese`, con la sparkline del trend). L'intestazione "Flusso" promette
flusso; quattro card che parlano dello stesso arco di tempo sono la sola forma
che non ha bisogno di essere spiegata.

Da qui anche **"Risparmi · N%"**: il `%` è il progresso verso la somma dei target
degli obiettivi, quindi l'importo accanto dev'essere il risparmiato — non il
saldo di un conto, che un target non ce l'ha. Accostarli metteva un *luogo* e un
*traguardo* nella stessa card.

- ⚠️ **`risparmio` col `+` e `investimento` col `−` a due righe di distanza.**
  Oggi il codice è netto (`sign = type === "entrata" ? "+" : "−"`), e due atti
  della stessa natura non possono avere segni opposti. **Deciso: entrambi `−`** —
  dal punto di vista del conto di origine il denaro esce, e l'origine è sempre
  valorizzata perché `account_id` è NOT NULL. Il **trasferimento resta l'unico
  caso neutro** (20b), ed è coerente: là il segno dipenderebbe da quale dei due
  conti stai guardando.
- ⚠️ **Nessuna porta d'ingresso alla pagina Conti**, in nessuna delle due nav.
  **Deciso: dal selettore "Tutti i conti" della home** — il tap apre un pannello
  coi conti e i loro saldi, più una voce "gestisci conti". Nessuna quinta voce
  nella bottom nav, che con il FAB centrale è già a quattro, e l'ingresso sta
  dove l'utente sta già pensando ai conti. Scartato `/impostazioni`: i conti non
  sono una configurazione, sono dove vivono i saldi.
- **Le due bottom nav del mockup non coincidono fra loro**: la chiara dice
  "Risparmi" e "Impostazioni", la scura "Obiettivi" e "Investimenti". Ha ragione
  la scura, che è anche ciò che l'app fa già (`nav.goals: "Obiettivi"`). Nessuna
  decisione, solo un difetto del mockup chiaro.

#### La divisione in due PR

- **20a — conti**: tabella, `account_id` NOT NULL + backfill, conto in
  onboarding, `recurring_rules.account_id` + funzione SQL, pagina conti con
  saldo, selettore conto nel form, **filtro per conto nella lista e in home**,
  **home da "Saldo totale" a "Flusso · <mese>"** + `dashboard_totals()` con
  parametro conto e senza bucket `null`.
- **20b — trasferimenti**: tipo `trasferimento`, `to_account_id` e i quattro
  CHECK, destinazione su `risparmio`/`investimento`, form e resa nella lista.

#### Il collaudo dello schema — `20260814_accounts.sql` eseguita il 2026-08-10

Migration **eseguita e verificata**. Otto controlli strutturali (utenti/righe
senza conto, quattro policy su `accounts`, zero policy con `auth.uid()` nudo,
`security_invoker` sulla vista, **una sola** firma di `dashboard_totals`, due FK
`NO ACTION`) più quattro prove di comportamento:

| prova | esito |
|---|---|
| cancellare un conto con movimenti | `23503 … violates foreign key constraint` — **fallimento atteso** |
| chiamare la vecchia `dashboard_totals(timestamptz[])` | `42883 … does not exist` — **fallimento atteso** |
| `account_balances` come `authenticated` senza JWT | **0 righe** |
| job con tre regole scadute | `saltate: 0`, `transazioni 20 → 23` |

⚠️ **Le prime due sono le uniche che dimostrino qualcosa**, ed è la regola già
scritta per la #47: *un registro di guasti non è collaudato finché non ha
registrato un guasto*. Solo righe verdi non distinguono "funziona" da "non ha
guardato".

⚠️ **La prova RLS va eseguita cambiando ruolo**, con `set local role
authenticated` dentro un blocco, non dal ruolo `postgres` del SQL Editor: quello
ha `BYPASSRLS` e restituisce tutte le righe **anche se `security_invoker`
mancasse**. Al primo tentativo è stata letta come superata mentre non aveva
testato nulla.

⚠️ **La prova del job dimostra la copia di `account_id` solo leggendo tre numeri
insieme.** `transactions.account_id` è NOT NULL: se la funzione non copiasse
`r.account_id`, ogni insert verrebbe rifiutato, il gestore per-regola della #47
lo catturerebbe, e il risultato sarebbe `saltate: 3` con `delta 0`. Un
`saltate: 0` da solo è compatibile con "nessuna regola è stata elaborata" — che è
esattamente com'era andato il primo tentativo.

⚠️ **E il primo tentativo era rotto per `now()` contro `clock_timestamp()`.**
Contava le righe generate con `created_at >= clock_timestamp()` letto a inizio
blocco; ma `created_at` ha default `now()`, che è `transaction_timestamp()` —
**congelato per tutta la transazione**, quindi *precedente* a un
`clock_timestamp()` valutato qualche istruzione dopo. Le righe appena scritte
risultavano vecchie e il conteggio dava zero. Contare le righe prima e dopo non
dipende da alcun orologio, e per questo è la forma giusta.

#### Emerso dal code-review della 20a (2026-08-11)

Quindici rilievi, quattordici applicati. I quattro che valgono una regola:

- ⚠️⚠️ **La 20a ha RICREATO ALTROVE il difetto che esisteva per chiudere.**
  `saldoTotale` è stato cancellato dalla home perché due schermate non possono
  rispondere diversamente a "quanto ho". Ma `/analisi` mostrava — e mostra
  ancora — un KPI etichettato **"Flusso netto"**, la stessa parola, calcolato
  come `entrate − (tutto ciò che non è entrata)`: quindi sottraeva anche
  risparmi e investimenti. Home € 1.540,70, `/analisi` € 1.060,70 per lo stesso
  mese, e il collegamento "Analisi" sta **due righe sotto la card**.

  **La lezione: togliere un'affermazione da una schermata non basta se un'altra
  la ripete.** Prima di cambiare che cosa significa una parola va cercata
  *ovunque compaia*, non solo dove la si sta cambiando. La definizione ora vive
  in `sommaUscite()` (`app/(main)/action.ts`), condivisa da KPI, variazione e
  grafico mensile: tre `filter` scritti a mano erano tre occasioni di
  divergere, e infatti divergevano già fra loro.

- ⚠️ **Un gate autorizza l'ingresso, e presuppone invarianti che nessuno gli ha
  detto.** `profiles.currency` è il flag dell'onboarding e viene scritto a
  `/preference`; il primo conto nasceva a `/category`, un passo dopo. Chi
  abbandonava in mezzo entrava nell'app **senza conti**, e con
  `transactions.account_id` NOT NULL il bottone di salvataggio restava spento
  per sempre, senza un messaggio. Il conto ora si crea in `savePreferences`,
  *prima* dell'upsert che apre il cancello: **l'invariante va stabilita dove il
  gate scatta, non dove sarebbe comodo scriverla.**

- ⚠️ **Correggere un numero può rendere FALSA l'etichetta che lo descriveva.**
  La legenda del grafico di `/analisi` diceva "Uscite totali", vero finché la
  serie conteneva tutto. Rendendo il calcolo più corretto — via risparmi e
  investimenti — quella parola è diventata una bugia: la stessa di "spese
  totali" nella 17a, prodotta questa volta *da un miglioramento*. Ora è
  "Uscite". Quando cambia una formula va riletto il testo che le sta accanto.

- ⚠️ **Il collaudo va fatto nella lingua in cui il difetto è VISIBILE, che non
  è quella di default.** Il primo conto prende il nome da un dizionario, e in
  `savePreferences` il `t` di `requireUser()` viene dal cookie **precedente** —
  `setLocaleCookie` non è ancora stato chiamato. In italiano il difetto è
  invisibile (vecchio e nuovo danno entrambi "Conto principale"); solo
  registrandosi in inglese si vede la differenza fra "Conto principale" e "Main
  account". Verificato così il 2026-08-11: `dictionaryFor(locale)` risolve.
  È il gemello della regola della Fase 19 — *una regressione che si vede solo
  nella lingua di default* — con i ruoli invertiti.

Il resto: guardia mancante sulla `20260810` (la regola dell'autosufficienza
vale anche per i file che si superano); chip del selettore che mentiva su un
conto archiviato mentre restava selezionato; `?conto=abc` che sostituiva
l'intera home con "Errore"; conto archiviato che spariva dal form di un
movimento esistente; tipo "corrente" assegnato in silenzio a un conto che non
ne aveva; "Risparmi · N%" con importo filtrato e percentuale globale;
`reactivate()` che ingoiava l'errore; `updateAccount` che azzerava `icon`; otto
voci di dizionario mai usate.

⚠️ **E una sopravvalutazione corretta nella migration**: il commento della
sezione 8 diceva che togliere il bucket `null` eliminava la scansione
dell'intero archivio a ogni vista della home. Falso — `account_balances` ne fa
una identica. Il guadagno è qualitativo, non di costo: **stessa scansione, ma
per numeri che l'utente legge invece che per uno che nessuno mostrava.**

#### La 20a è verificata su tutti i rami (2026-08-11)

Dieci controlli automatici col driver Playwright, zero errori console, più
quattro prove a mano per i rami che un driver con sessione riusata non può
raggiungere: **ultimo conto non archiviabile** (serve un utente con un conto
solo — quello appena registrato), **percorso di login** (il driver lo salta per
non far transitare la password), **tema scuro** e **lingua inglese**.

⚠️ La prova che vale più delle altre è una sola: **home € 1.540,70 ==
`/analisi` € 1.540,70**. Prima della correzione differivano di € 480, cioè
esattamente risparmi + investimenti — e nessun controllo automatico l'avrebbe
detto, perché entrambi i numeri erano "corretti" secondo il proprio codice.

#### Emerso implementando la 20b — migration `20260815_transfers.sql`

Migration **eseguita e collaudata il 2026-08-12**. Sei prove che dovevano
fallire, tutte fallite; il saldo si sposta di 100 fra due conti e il **totale non
si muove**; 23 righe prima, 23 dopo.

⚠️ **Le due prove che valgono sono b5 e b6** — un movimento verso, o da, il conto
di un ALTRO utente. Prima delle FK composite quegli insert **passavano**: nessuna
policy RLS guarda `account_id`. Sono anche le uniche che richiedono un secondo
utente nel database, quindi il collaudo dice esplicitamente `SALTATA` quando non
c'è: un test che si autoesclude in silenzio è peggio di un test assente.

- ⚠️ **`drop … if exists` NON è idempotenza.** Il file falliva alla *seconda*
  esecuzione con `2BP01: cannot drop constraint accounts_id_user_key … other
  objects depend on it`. Un vincolo con dipendenti **non si può droppare
  affatto**: la clausola `if exists` protegge solo l'esecuzione in cui il vincolo
  non c'è, cioè l'unica che non ne ha bisogno. E il guasto arriva **a metà file**,
  dopo che le sezioni precedenti hanno già scritto — esattamente ciò che le
  guardie in testa agli altri file esistono per impedire, solo che qui a rompersi
  era il file nuovo contro se stesso. Si chiude togliendo i dipendenti **per
  nome** prima del vincolo, non con `drop … cascade`: quello li rimuoverebbe
  senza ricrearli se il file si fermasse subito dopo, lasciando il database privo
  del vincolo di proprietà e senza che nulla lo segnali.
- ⚠️ **`user_id` NOT NULL era un prerequisito, non un extra.** Vedi lo schema: con
  `MATCH SIMPLE` una colonna NULL disattiva l'intero vincolo composito.
- **La FK ha un nome nuovo, e PostgREST se ne accorge.** Le relazioni embedded si
  chiamano come il VINCOLO (`accounts!transactions_account_owner_fkey(name)`):
  per questo i nomi dei conti nella lista si risolvono lato client da una mappa
  che il chiamante ha già, invece che con una join che si romperebbe in silenzio
  alla prossima rinomina.

**Il segno di un movimento dipende da CHI lo guarda** (`amountSign()` in
`lib/transaction-utils.ts`). Fino alla 20a stava in una riga — `type === "entrata"
? "+" : "−"` — perché ogni movimento aveva un conto solo e quindi un solo punto
di vista. Con i trasferimenti la stessa riga toglie denaro a un conto e lo dà a
un altro:

| vista | righe | segno |
|---|---|---|
| **un conto selezionato** | origine **o** destinazione | relativo a *quel* conto |
| **tutti i conti** | tutte | assoluto; il trasferimento è neutro, con la freccia |

Con un conto davanti la lista è il suo **estratto conto** e deve riconciliare col
saldo che `/conti` mostra tre tap più in là; senza filtro è il **diario di ciò che
hai fatto**, e lì il segno di un trasferimento non ha riferimento. ⚠️ Nella
funzione il ramo della destinazione viene **prima** del tipo: invertendoli, il
Libretto mostrerebbe "− € 200" per denaro appena arrivato.

⚠️ **La home e `/analisi` restano all'ORIGINE soltanto, e non vanno allineate per
simmetria.** Sono viste di FLUSSO: i trasferimenti non ci entrano affatto, perché
spostare denaro non è né guadagnarlo né spenderlo.

- **L'audit dei consumatori rifatto**, ed è la verifica che dice se la premessa
  della fase regge: `getGoals` (`risparmio`), `getInvestments` (`investimento`),
  trend di `/analisi` (`.in` su cinque nomi), torta (`spesa`), budget (`spesa`),
  uscite fisse (`abbonamento`), `deleteCategory` (per `category_id`, e un
  trasferimento non ne ha), `dashboard_totals()` (raggruppa per tipo, l'app legge
  per nome). **Nessuno somma "tutto ciò che c'è": nessun totale si muove.**
- ⚠️ **Un difetto che né `tsc` né il lint vedono**: la griglia dei tipi nel
  `TransactionModal` è `2×3` e la quinta card occupava **due colonne** per
  riempire la terza riga, con la condizione `i === length - 1`. Con sei tipi la
  griglia è esatta e quella riga avrebbe spinto il trasferimento su una quarta
  riga inesistente, dentro un `flex-1 min-h-0` che non può crescere. Ora la card
  larga esiste solo se il numero di tipi è **dispari** — che è ciò che ha sempre
  significato. Si vede solo aprendo il modale, e solo dopo aver aggiunto un tipo.
- **Tre voci di dizionario aggiunte e poi TOLTE.** `typesSingular`, `newByType` e
  `typesShort` servono solo alla UI delle categorie, e una categoria
  `trasferimento` non può esistere: sarebbero state codice morto in due lingue —
  il difetto che il code-review della 20a ha trovato otto volte. Al loro posto c'è
  scritto *perché* mancano, o la prossima persona le rimette per simmetria.
  `t.types` e `t.transactionTypes` invece ce l'hanno, perché descrivono i tipi di
  MOVIMENTO e vengono resi davvero.
- ⚠️ **`isAccountId()` (`lib/accounts.ts`) perché `.or()` è SINTASSI, non un
  parametro.** `getTransactions` interpola il conto in
  `` `account_id.eq.${conto},to_account_id.eq.${conto}` ``: lì `.eq()` non fa da
  parametro, e una virgola dentro il valore aggiungerebbe condizioni al gruppo OR.
  È l'unico punto dell'app dove un valore dell'utente diventa sintassi. La regex
  era già in `page.tsx` per un motivo diverso (`?conto=abc` uccideva la home con
  `22P02`): ora è una sola, ed è il modo in cui il secondo chiamante non se la
  dimentica.
- **I due debiti della 20a sono chiusi entrambi.** La FK composita ha eliminato
  `assertOwnAccount()`; le ricorrenti su conto archiviato sono chiuse in tre pezzi
  che dovevano andare **insieme**: `setAccountArchived()` rifiuta se ci sono
  regole attive, `updateRecurringRule()` accetta il conto, `RecurringSheet` espone
  il campo. ⚠️ Rifiutare **senza** la via d'uscita sarebbe stato un vicolo cieco —
  `recurring_rules.account_id` era a scrittura unica, quindi l'unico rimedio
  sarebbe stato cancellare la regola. Un avviso ignorabile invece lascerebbe
  accadere proprio ciò che il controllo esiste per impedire: pg_cron continua a
  scrivere su un conto escluso da ogni totale mostrato, senza errori e senza
  segnali.
- **`RecurringRule` non aveva `account_id` nel tipo TypeScript**, pur essendo NOT
  NULL dalla 20a. Un tipo incompleto non produce un errore: produce una
  funzionalità che non viene scritta perché il dato **sembra non esserci**.

#### La verifica visiva — 25 controlli, e due cose che solo lo schermo dice

- ⚠️⚠️ **"Seleziona dal conto".** Le due estremità del trasferimento si
  chiamavano "Dal conto" e "Al conto", che lette da sole sono le parole giuste.
  Ma `Select` compone il segnaposto come `` `Seleziona {etichetta minuscola}` ``,
  quindi i campi vuoti dicevano **"Seleziona dal conto"** e **"Seleziona al
  conto"** — due mezze frasi. In inglese identico: *"Select to account"*.

  **È letteralmente la trappola documentata per la Fase 19** ("Seleziona
  category", "Nuova investimento"), reintrodotta da chi l'aveva scritta, in un
  file che la descrive dodici righe più su. Non l'ha vista `tsc`, non l'ha vista
  il lint, non l'ha vista la rilettura del codice: si è vista **aprendo il
  form**. Ora sono "Conto di partenza" / "Conto di arrivo" (EN "Source account" /
  "Destination account"). La regola: **un'etichetta di campo non si sceglie da
  sola, si sceglie insieme alla frase che la conterrà** — e in questo progetto
  quella frase esiste sempre, perché la costruisce `Select`.
- ⚠️ **Un falso allarme che somigliava moltissimo a un difetto vero**: al primo
  scatto il form trasferimento mostrava i conti vuoti, il bottone spento e
  l'avviso rosso *"serve un conto per registrare un movimento"* — su un utente
  che i conti ce li ha. Era l'attesa troppo corta: i conti arrivano da una query
  Supabase e alla prima apertura c'è anche la compilazione del chunk. Nel driver
  l'attesa dei form è ora 2500ms, con scritto perché.
- Il selettore delle ricorrenti punta a **"modifica"**, non a un bottone che
  contenga `€`: l'importo sta in un *fratello* della riga. È la stessa trappola
  già annotata per le righe conto, e si ripresenta ovunque il markup
  interattivo annidato sia stato sciolto.

Le prove 8-11 del driver sono la parte 20b e stanno nello skill `collauda-app`,
quindi si rieseguono. **Restano fuori**, da provare a mano: il percorso di login
(il driver riusa una sessione) e il **rifiuto di archiviare un conto con regole
ricorrenti attive** — entrambi verificati a mano il 2026-08-12, insieme al primo
trasferimento reale.

#### Il conto selezionato si RICORDA — deciso usando l'app (2026-08-12)

Emerso da chi la usava, non da un controllo: *"al click della home il filtro per
conto si resetta e torna a tutti i conti"*. La causa è che la selezione viveva
**solo** in `?conto=`, e "Home" nella bottom nav punta a `/`: ogni giro fuori e
ritorno la azzerava. Su un'app che si apre dieci volte al giorno è la differenza
fra uno strumento e un fastidio.

Ora c'è un cookie (`seichi-account`), stesso meccanismo di tema e lingua e per le
stesse ragioni: viaggia con la richiesta, quindi il server sa già cosa rendere e
il primo byte è quello giusto.

- ⚠️ **L'URL è un'ISTRUZIONE, il cookie è una MEMORIA**, e la distinzione decide
  cosa fare quando il conto non esiste più. `?conto=` che punta a un conto non
  tuo va **corretto** (`redirect("/")`), o il chip direbbe "Tutti i conti" sopra
  dati filtrati su un id fantasma. Un cookie stantio va invece **dimenticato**:
  col redirect si tornerebbe su `/`, dove il cookie verrebbe riletto, e da lì di
  nuovo su `/` — **un ciclo infinito innescato dall'archiviazione di un conto**.
  `getSelectedAccount()` (`lib/accounts-server.ts`) restituisce `fromUrl` proprio
  perché il chiamante non debba riscoprire questo ragionamento.
- ⚠️ **Un filtro appiccicoso è di norma una trappola** — dati parziali senza che
  l'utente sappia perché. Regge qui solo perché la selezione è **sempre visibile
  e sempre annullabile**: il chip porta scritto il nome, la prima voce del
  pannello è "Tutti i conti", e scegliere quella *cancella* il cookie invece di
  lasciarlo fermo. Il giorno in cui una pagina leggesse il cookie senza mostrare
  il chip, il cookie va tolto da quella pagina.
- **Il selettore è ora anche in `/analisi`**, e non è una comodità in più: senza,
  per analizzare un conto servivano tre passaggi — tornare in home, selezionarlo,
  ripartire dalla scorciatoia "Analisi". Tre passaggi per cambiare una variabile
  sono il modo più affidabile di far smettere qualcuno di usare un filtro.
  `keepParams` conserva il periodo, o un tocco ne cambierebbe **due**.
- **Il nome del conto sotto il periodo è sparito** da `/analisi`. Non perché la
  regola "se la pagina è filtrata deve dirlo" sia decaduta, ma perché a dirlo è
  ora il chip, che porta lo stesso nome ed è pure il comando per cambiarlo.
- ⚠️ **`/transazioni` NON eredita la memoria, deliberatamente.** Il cookie segue
  le due viste che rispondono a *"come sto andando"*; la lista movimenti risponde
  a *"cosa è successo"* e ha la propria barra filtri sempre a schermo, dove la
  selezione è visibile e si cambia sul posto. Ricordarla là aggiungerebbe uno
  stato invisibile senza togliere un passaggio.
- ⚠️ `keepParams` è un **oggetto di stringhe, non una funzione** che costruisce
  l'URL: `AccountSelector` è un client component istanziato da un server
  component, e una prop funzione fa fallire la serializzazione RSC — l'errore che
  né `tsc` né `next build` vedono e che compare solo aprendo la pagina.

⚠️⚠️ **La memoria ha rotto il COLLAUDO, ed è così che si è vista funzionare.**
Il driver sceglie un conto al passo 2. Prima quella scelta moriva al `goto("/")`
successivo; da adesso sopravvive, quindi:

- il **confronto 6** ("home non filtrata == /analisi") ha continuato a passare
  misurando due numeri **filtrati** — € 2.334,10 invece di € 2.740,70. Un
  controllo verde che dichiara una cosa e ne misura un'altra;
- il **confronto 7** e il **controllo 12** cercavano il chip per il testo "Tutti
  i conti", che ora porta il nome del conto: sono stati **saltati in silenzio**,
  sparendo dal referto senza che nulla lo dicesse.

Due lezioni, e la seconda vale oltre questo progetto:

1. **Da quando esiste una memoria, "aprire la home" non è più uno stato
   determinato.** Un collaudo che ha bisogno di uno stato preciso deve
   **chiederlo**: `?conto=` vuoto è un'istruzione ("nessun conto") e batte il
   cookie, quindi è il modo di dire "tutti i conti" senza toccare l'interfaccia.
2. ⚠️ **Un `if` senza `else` in un collaudo è un buco.** Un elenco di soli OK non
   distingue *passato* da *non eseguito*, ed è la stessa regola già scritta per
   la #47 (*un registro di guasti non è collaudato finché non ha registrato un
   guasto*) applicata al collaudo stesso. Ogni ramo di scarto ora scrive un KO
   che dice **quale** controllo non è stato eseguito.

#### Emerso dal code-review della 20b (2026-08-12)

Tre rilievi, e tutti e tre stanno nella **relazione fra due punti**, non dentro
l'uno o l'altro — cioè invisibili leggendo un file per volta.

- ⚠️⚠️ **La memoria in cookie ha RIAPERTO il difetto che il redirect esisteva per
  chiudere.** La guardia della home scattava solo con `fromUrl`, per non entrare
  in ciclo. Ma un id che arriva dal *cookie* e non è fra i conti dell'utente non
  veniva né corretto né annullato: la pagina restava **filtrata su un id
  fantasma** (totali a zero) mentre il chip, non trovandolo, scriveva "Tutti i
  conti". Etichetta e dati che si contraddicono.
  La via d'uscita è `redirect("/?conto=")`: un parametro **presente ma vuoto** è
  un'istruzione ("nessun conto") e batte il cookie, quindi la destinazione non
  può rimbalzare indietro. Lo stesso buco esisteva su `/analisi`, dove in 20a non
  serviva alcuna guardia perché l'id arrivava solo dal link della home.
  **La lezione: aggiungere una fonte a un dato riapre ogni domanda già risposta
  sull'altra fonte.** Non basta che la nuova fonte funzioni.
- ⚠️ **`contoError()` diceva "Conto non trovato" anche per un `check_violation`.**
  Un trasferimento verso se stessi o con categoria non ha niente a che vedere coi
  conti: il messaggio avrebbe mandato a controllare una cosa sana. È la stessa
  classe corretta nella review della 20a — `assertOwnAccount` che rispondeva
  "Conto non trovato" a un guasto di rete. **Due cause diverse non possono avere
  lo stesso messaggio solo perché arrivano dalla stessa `catch`.**
- ⚠️ **Home "Flusso", `/analisi` "Flusso netto": lo stesso numero con due nomi**,
  e la review della 20a l'ha *creato correggendo*. Finché i due valori
  divergevano, due nomi erano coerenti con due cose; allineandoli si è lasciata
  una differenza di parola su una identità di sostanza. Vale la regola già
  scritta per i conti — *stesso titolo, o lo stesso numero ne avrebbe due* — ed è
  il **gemello** dell'altra già registrata (*correggere un numero può rendere
  falsa l'etichetta che lo descriveva*): qui l'etichetta non è diventata falsa, è
  diventata **superflua e divergente**. Ora entrambe dicono "Flusso".
  ⚠️ Il driver cercava `/Flusso netto|Net flow/`: senza i rami `else` aggiunti
  poco prima, i confronti 6 e 7 sarebbero **spariti dal referto** invece di
  fallire.

Segnalato e **non corretto**, perché precedente alla fase e difendibile:
`RecurringManager` usa `type === "entrata" ? "+ " : ""`, quindi una regola in
uscita non ha segno mentre la transazione che ne deriva mostra `− € 12,00`. Una
regola è un importo futuro, non un movimento avvenuto.

#### E il trasferimento non entra nel flusso — la domanda che lo conferma

Chiesto usando l'app: *"non segna il flusso, ma il trasferimento alla fine è un
flusso o sbaglio?"*. È la domanda giusta, e la risposta è la premessa dell'intera
fase: **"Flusso" è entrate − uscite, cioè quanto è entrato e uscito dal
patrimonio.** Spostare 500 € fra due conti non rende né più ricchi né più poveri:
cambia *dove* sta il denaro. Se entrasse nel flusso, l'app affermerebbe un
guadagno o una perdita per un gesto che non è né l'uno né l'altro.

Il posto dove quel movimento si vede è il **saldo** — seconda pagina del
carosello — e nella lista, che filtrata sul conto di arrivo scrive `+ € 500,00`
mentre senza filtro lo lascia neutro con la freccia. Che la domanda sia sorta
guardando la home è la prova che la separazione va **detta**, non dedotta: è
esattamente il lavoro che fanno il sottotitolo "entrate meno uscite di questo
mese" e la riga che insegna a scorrere.

### Fase 21 — import da file (CSV / Trade Republic)

Implementata il 2026-08-13 (issue #35). Migration `20260816_imports.sql`.
Progettata leggendo un export `pytr` **reale**, non la documentazione.

```sql
imports: id, user_id, account_id (il conto del FILE), source, filename, created_at
transactions: + import_id (FK cascade), + import_key (unique con user_id)
import_transactions(account, source, filename, rows jsonb) → (import_id, inserted, submitted)
```

#### Le decisioni di schema

- **Una tabella `imports`, non solo una colonna.** Il lotto è ciò che rende
  l'import **annullabile**: `transactions.import_id` è `on delete cascade`,
  quindi disfare è una sola istruzione atomica. La colonna va messa subito —
  vale il precedente di `notifications.destination`, e qui il backfill sarebbe
  **impossibile**: nessun dato residuo direbbe quali righe erano arrivate insieme.
- ⚠️ **`on delete cascade` su `import_id` mentre `account_id` è `no action`**, ed
  è la stessa asimmetria di `categories` (cascade, serve a eliminare un
  obiettivo) contro `accounts` (no action, cancellerebbe movimenti reali). Qui la
  cascade **è** l'operazione.
- **Nessuna colonna `row_count`** — quinta volta che questo progetto rifiuta un
  totale memorizzato, dopo `spent`, `saved_amount`, `balance` e `valid_to`. Qui
  divergerebbe al primo movimento importato che l'utente cancella a mano.
- **`import_key` TEXT + `unique (user_id, import_key)` + `on conflict do nothing`**,
  come `notifications.dedup_key`: reimportare un file sovrapposto **non può**
  duplicare, per costruzione. ⚠️ I NULL restano **distinti** (default) — è
  l'opposto di `budgets`, dove NULL significava "il budget globale", cioè una
  cosa sola. Qui NULL significa "riga inserita a mano", e ce ne sono migliaia.
- **FK composita `(account_id, user_id) → accounts (id, user_id)`**, come nella
  20b: nessuna policy RLS guarda `account_id`.
- ⚠️ **`import_transactions()` è `security invoker`**, cioè il default — non
  `definer` come le altre funzioni del progetto. Qui non serve alcun privilegio
  in più, e marcarla `definer` per abitudine avrebbe disattivato la RLS in cambio
  di niente. Serve come funzione solo per l'**atomicità** lotto + righe.
- **Tre policy su `imports`, niente UPDATE**: una riga è il verbale di un evento
  accaduto, non contenuto modificabile.

#### Le quattro cose che il file vero insegna, e nessuna documentazione dice

1. ⚠️ **`amount` non è il movimento di cassa.** Su un acquisto vale il
   controvalore e la commissione sta a parte (`amount −24,97`, `fee −1,00`: dal
   conto escono 25,97). Sulle vendite c'è anche `tax`.
2. ⚠️ **La colonna che contiene la cassa cambia con il tipo di riga.**
   `TAX_OPTIMIZATION` (il bollo) ha `amount = 0` e il movimento in `tax`.
3. ⚠️ **Alcune righe non sono movimenti.** `MIGRATION` (trasloco di custodia, a
   coppie ±n) e `FREE_RECEIPT` hanno gli importi **vuoti**.
4. ⚠️ **`counterparty_iban` è popolata solo sulle righe recenti.** Sulle altre
   l'IBAN sta dentro il testo libero, o non c'è affatto — quindi **non** si può
   costruire su di lei una colonna `accounts.iban`: mancherebbe metà delle volte.

I primi tre si chiudono con **una regola sola** invece che con tre rami speciali:
`netto = amount + fee + tax`, e **netto zero significa nessun movimento di
cassa**. La conferma che sia quella giusta la dà il file: il versamento del
07/03/2024 ha `amount 201,40` e `fee −1,40`, cioè **200,00 tondi**. Un numero
rotondo che esce dall'aritmetica non è una coincidenza.

#### Il passo centrale decide per GRUPPO, non per riga

È lo scostamento voluto dal mockup `Seichi Importa CSV.dc.html`, che mostrava una
lista di transazioni con una pastiglia "seleziona categoria" ciascuna. Un estratto
di tre anni ha **~200 righe e ~15 decisioni**: tutti gli acquisti sono
investimenti, tutti gli interessi entrate, tutti i bonifici da uno stesso IBAN
vengono dallo stesso conto. Le righe restano ispezionabili aprendo il gruppo: è
la **decisione** che si accorpa, non l'informazione.

⚠️ **La direzione fa parte dell'IDENTITÀ del gruppo.** `TAX_OPTIMIZATION` compare
sia in addebito sia in storno: raccolti insieme, una decisione sola varrebbe per
righe che vanno in versi opposti.

#### Gli altri difetti del mockup, corretti

- **Mancava il conto**, e senza `transactions.account_id` (NOT NULL dalla 20a)
  l'import non scrive una riga. Sta nel passo 1, perché è una proprietà
  dell'**estratto**, non delle singole righe.
- **La riga "Trasferimento risparmio" chiedeva una categoria**, che
  `transactions_transfer_category_check` vieta. Un trasferimento vuole invece il
  **conto di destinazione**.
- **"max 10 MB" contro `bodySizeLimit: 3mb`** in `next.config.ts`. Il limite è
  ora 2 MB (`IMPORT_MAX_BYTES`), quarto numero della catena da tenere allineata
  insieme a quelli dell'avatar. Per la misura: l'estratto di tre anni pesa **40
  KB**; il mockup dichiarava "2,1 MB" per 42 transazioni.
- ⚠️ **"42 da importare · 3 duplicati ignorati" nella schermata di conferma**
  prometteva prima dell'import un numero conoscibile solo **dopo**: quante righe
  risultino già presenti lo decide il vincolo di unicità. Il riepilogo mostra ora
  *da importare / ignorate / illeggibili*, che sommano al totale del file; i "già
  presenti" compaiono alla fine.

#### ⚠️⚠️ Il difetto più costoso: 216 movimenti sul conto sbagliato

Il primo import reale ha attribuito un estratto **Trade Republic** al **Conto
principale**, e ha scritto 31 trasferimenti fra Revolut e il corrente — portando
Revolut a **−2.618,08 €** su un conto che non aveva mosso un euro.

**Non è stato un errore dell'utente: era l'unica strada che l'interfaccia
offriva.** Tre buchi che si sommavano, e ognuno da solo sarebbe stato innocuo:

1. **Un conto Trade Republic non esisteva**, e dal flusso non si poteva creare —
   uscire a farlo avrebbe perso il file già caricato.
2. **Il selettore della controparte conteneva UNA voce** (l'unico altro conto),
   con il gruppo già proposto come `trasferimento`. Non una scelta: l'unica riga
   disponibile.
3. **L'app sapeva che era un estratto Trade Republic e non lo diceva.**

Le correzioni: l'analisi si fa **alla scelta del file** (solo dopo si conosce il
profilo, quindi l'avviso arriva prima della scelta e non dopo), un avviso ambra
per gli estratti di broker, e `AccountPicker` — un selettore che sa **creare** un
conto senza uscire.

⚠️ **E il quarto buco, che è mio e vale come regola: l'annullamento viveva solo
nello stato del componente.** Il lotto era stato progettato apposta per rendere
l'import reversibile, e poi il comando aveva la vita di una schermata: uscito da
lì, la riga di `imports` era irraggiungibile da tutta l'app e restava solo il SQL
Editor. **Progettare la reversibilità e non darle una casa stabile è metà del
lavoro** — e la metà mancante si vede solo usando l'app. Ora
`/impostazioni/importa` elenca gli import precedenti con il comando che li disfa.

#### Emerso dal code-review (12 rilievi, tutti applicati)

I quattro che valgono una regola:

- ⚠️ **`parseAmount("1.250")` restituiva 1,25** — un fattore mille perso in
  silenzio: la riga si importa, non finisce fra le illeggibili, e l'importo è
  semplicemente sbagliato. Ora un separatore **ripetuto**, o seguito da
  **esattamente tre cifre**, è quello delle migliaia. Ambiguità residua
  dichiarata: un file tecnico con tre decimali. Trade Republic ne usa sei.
- ⚠️ **`targetsFor` ignorava la direzione in due rami su cinque.** `vendite`
  proponeva `entrata` per definizione — vero quasi sempre, falso quando le
  commissioni superano il ricavo. È **esattamente il difetto che il tipo
  `Direction` è stato introdotto per rendere impossibile**, sopravvissuto dentro
  le eccezioni scritte a mano: un filtro applicato al caso generale e saltato nei
  casi speciali non è una difesa, è una convenzione.
- ⚠️ **`ImportHistory.run()` scartava l'esito di `undoImport`**: un annullamento
  fallito chiudeva la conferma e ricaricava come uno riuscito, lasciando lotto e
  transazioni al loro posto. L'utente vedeva il gesto compiersi e i dati restare.
- ⚠️ **Nessun `try/finally` attorno alle server action**: una promise rifiutata
  lasciava `pending` a `true` e il flusso bloccato senza messaggio.

Più: errori di query scartati che si travestivano da "categoria sbagliata",
messaggi Postgres grezzi mostrati all'utente, controparte non controllata per
`archived`, `ready` vero dopo un'analisi fallita (un pulsante vivo che non fa
niente), la corsa fra due scelte di file ravvicinate, il contatore delle tendine
che restava sbilanciato allo smontaggio, e tre voci di dizionario mai usate.

#### ⚠️ Tre volte su tre, a sbagliare era la VERIFICA e non il codice

Vale come regola di metodo, perché è successo in una fase sola:

- il controllo sul **mojibake** interrogava una riga che usa il campo `name`,
  dove la riparazione non passa mai: passava senza testare niente;
- il **driver** decideva un gruppo solo e concludeva "il pulsante non si accende",
  mentre a bloccare erano i quattro gruppi di bonifici — e intanto quel KO
  nascondeva il difetto vero, che era l'ordinamento;
- ⚠️ la **controprova nella migration** cercava `qual not like '%select
  auth.uid()%'`. Postgres non conserva il testo che scrivi: lo ri-stampa
  dall'albero sintattico, e `(select auth.uid())` diventa `( SELECT auth.uid()
  AS uid)` — maiuscolo e con un alias. Con `like` sensibile alle maiuscole il
  controllo dichiarava **nude tutte e 25 le policy** del database, tutte
  perfettamente corrette. Si controlla con `~*`, mai con `like`.

La regola già scritta per la #47 — *un registro di guasti non è collaudato finché
non ha registrato un guasto* — ha un gemello: **un controllo che segnala un
guasto va diagnosticato prima di crederci.** Due dei tre difetti veri di questa
fase si sono visti proprio andando a capire perché una verifica diceva rosso.

#### La tendina, e perché `Select` da solo non poteva farcela

⚠️ Una card con `backdrop-filter` crea un **contesto di impilamento**: il menu
resta confinato al livello della card, quindi nessuno z-index scritto dentro
`Select` può superare la `BottomNav`, che è `fixed` a z-40. Tre difese, e servono
tutte e tre perché falliscono in modi diversi:

- **si ribalta verso l'alto** quando sotto non c'è spazio (calcolo al tocco, non
  al render: in una lista lunga la posizione cambia di continuo);
- **altezza massima con scorrimento interno**, o una lista lunga esce comunque;
- **lo z-index lo alza il CHIAMANTE**, avvisato da `onOpenChange` — l'unico che
  può alzare la card è chi la disegna.

Il contatore delle tendine aperte è un **numero**, non un booleano: `Select` non
si chiude quando se ne apre un'altra.

#### `SELL` non ha un tipo — issue #52, aperta e non chiusa qui

Seichi non sa registrare un **disinvestimento**: `investimento` è a senso unico.
Le scorciatoie sbagliano in versi opposti — `entrata` falsifica il Flusso
(vendere non è guadagnare), `ignora` lascia il saldo del conto più basso del
reale — quindi il gruppo `vendite` non ha una proposta e **la scelta è
dell'utente**. Un settimo tipo obbliga a rifare l'audit di ogni consumatore di
`transactions`, che è una fase a sé.

⚠️ **L'import non crea il buco, lo rende visibile** — stesso schema della #43.
La misura, sui dati veri: versato su Trade Republic € 3.578,50, vendite
€ 881,31, quindi **versato netto € 2.697,19** contro un valore reale di
€ 2.935,61; la differenza di € 238,42 sono plusvalenze e liquidità non
investita. Il modello regge, ma senza `disinvestimento` il totale investito
**cresce e non cala mai**.

#### Debito aperto: `/investimenti` non ha il selettore conto

`getInvestments()` filtra su `user_id` e `type`, **mai sul conto**, e la pagina
non ha un selettore — quindi somma gli investimenti di tutti i conti. La 20b lo
ha dato a `/analisi` per la stessa ragione. Da fare come lavoro a sé.

### Sorveglianza del job giornaliero (2026-08-09, issue #47)

Il guasto è emerso guardando a occhio una data in `/impostazioni/ricorrenti`: una
regola con `next_run` al 3 luglio che non aveva generato nulla.

⚠️ **L'ipotesi iniziale — "il cron non gira" — era SBAGLIATA**, e vale
registrarlo perché il modo in cui si è sbriciolata è il punto di questa sezione.
`cron.job_run_details` diceva `succeeded` ogni notte. La causa vera erano tre
difetti sovrapposti (migration `20260810_recurring_fixes.sql`):

1. **`transactions_type_check` non ammetteva `abbonamento`**, mentre
   `categories_type_check` e `recurring_rules_type_check` sì. Una categoria e una
   regola potevano essere `abbonamento`, la transazione che ne deriva **no**:
   nessun abbonamento ricorrente si è mai potuto materializzare, da quando quel
   tipo esiste. Difetto invisibile per la issue **#43** — nessun file descrive
   quei vincoli, quindi la divergenza fra tabelle sorelle non era leggibile.
2. ⚠️ **Una regola guasta abortiva TUTTE le altre.** `for r in … loop` non aveva
   `exception` per singola regola, quindi la prima che falliva fermava l'intera
   funzione — ecco perché non usciva nulla, nemmeno l'ETF che era valido. E dal
   cron `auth.uid()` è NULL: i dati di un utente potevano fermare le ricorrenti
   di **tutti**.
3. **`run_daily_jobs()` trasformava l'errore in `succeeded`.** L'`exception`
   della 17b protegge gli insert finanziari, ma catturando il guasto fa ritornare
   la funzione normalmente, quindi pg_cron registra successo. Prima del
   2026-08-04 `job_run_details` almeno diceva `failed`; dopo ha smesso.

**La lezione, e vale oltre questo caso: isolare un guasto senza registrarlo lo
rende invisibile.** Per questo `generate_recurring_transactions()` ora
**restituisce il numero di regole saltate** invece di `void`: senza quel valore,
l'isolamento per-regola avrebbe ricreato lo stesso silenzio un livello più in
basso.

Due cose trovate per strada, entrambe dai vincoli reali:

- ⚠️ **`transactions.type` è `character varying`, non `text`.** È la **conferma
  retroattiva** che i cast espliciti in `dashboard_totals()` non erano una
  precauzione ma una necessità.
- ⚠️ **`transactions.frequency` esiste e non è documentata qui**, con vocabolario
  inglese (`weekly/monthly/yearly`) mentre `recurring_rules.frequency` usa
  l'italiano. Residuo pre-Fase 14. La riga di DETAIL dell'errore mostra 13 valori
  dove questo documento elenca 10 colonne: ce ne sono altre due da mappare.
  **Chiuso dalla issue #43 il 2026-08-12**: le altre due erano `is_ricurrent` e
  `parent_id`, tutte e tre residui pre-Fase 14 e tutte NULL, rimosse dalla
  `20260813`. Che il conteggio delle colonne di un messaggio d'errore fosse
  l'unico modo per accorgersene è precisamente ciò che la #43 esisteva per
  chiudere.
- ⚠️ **`generate_recurring_transactions()` non aveva grant espliciti** e si
  affidava al default su PUBLIC — di cui `anon` è membro. Chiunque con la chiave
  pubblicabile poteva invocare una funzione SECURITY DEFINER che con
  `auth.uid()` NULL scrive per tutti gli utenti. Ora ha la coppia
  revoke/grant come ogni altra funzione dalle Fasi 16-17.

- ⚠️ **L'allarme NON può essere una notifica, né un secondo cron.** Le notifiche
  le genera il job: se è morto non può annunciarlo. E un cron di sorveglianza
  soffrirebbe lo stesso guasto — se pg_cron non gira, non gira nemmeno lui.
  L'unica posizione sana è **alla lettura**, su una traccia che il job lascia.
- **`job_runs`** (migration `20260809_job_runs.sql`): una riga per passo per
  esecuzione, con `run_at` uguale per tutti i passi dello stesso giro — è ciò che
  permette di chiedere "l'ultima esecuzione è andata bene *per intero*". Gli
  `insert` nei rami `exception` **persistono**: `begin … exception … end` apre una
  sottotransazione, e il gestore gira in quella esterna.
- ⚠️ **RLS abilitata e NESSUNA policy**, deliberatamente. In scrittura è un
  registro del server come `notifications`; in lettura è un dato **globale**, e
  un errore prodotto dai dati di un utente non deve comparire sullo schermo di un
  altro. Si legge solo da `daily_job_health()`, che restituisce **tre fatti e
  nessun testo d'errore** — `details` resta nel database.
- **La soglia sta in TypeScript** (`DAILY_JOB_STALE_HOURS = 36`), non in SQL: è
  una decisione di prodotto e cambiarla non deve richiedere una migration.
  36 ore e non 24 perché il cron gira alle 03:00 e un singolo ritardo non è un
  guasto.
- **Un seme all'installazione.** Senza righe, `last_run_at` è NULL e "mai girato"
  va trattato come il caso peggiore — giusto, ma appena eseguita la migration il
  job non ha *ancora* avuto occasione di girare, e l'avviso comparirebbe a torto.
  La migration inserisce una riga con `step = 'installed'` che fa partire il
  cronometro: non dichiara che un lavoro è stato svolto, dichiara "da qui mi
  aspetto un giro al giorno".
- ⚠️ **L'avviso sta in `/impostazioni` e `/impostazioni/ricorrenti`, NON in home.**
  Scelta di costo: la home è appena passata da 12 a 6 richieste, e un controllo
  di salute lì sarebbe una richiesta REST in più **a ogni vista**, pagata sempre,
  anche a job sano. Le ricorrenti sono la pagina i cui dati *sono* sbagliati
  quando il job è fermo, quindi è là che l'avviso ha significato. La riga in
  impostazioni compare solo in caso di problema: una spia sempre verde smette di
  essere guardata.
- **Ambra, non rosso**: in questa app il rosso significa "uscite", e prestarlo a
  un allarme di sistema confonderebbe i due. L'ambra è già il livello
  "attenzione" delle barre budget all'80%.
- `daily_job_health()` è **`language sql`** e con cast espliciti su ogni colonna:
  vedi la trappola di `dashboard_totals()` qui sotto — `RETURN QUERY` di plpgsql
  pretende i tipi esatti e falliva solo a runtime.

#### Il collaudo — migration eseguite e verificate il 2026-08-09

`20260809_job_runs.sql` e `20260810_recurring_fixes.sql` **eseguite** (in
quest'ordine, che è vincolante). Verifica end-to-end superata, idempotenza
inclusa. Le righe di `job_runs` raccontano la vicenda intera e vanno lette in
sequenza, perché è la seconda a dare valore a tutte le altre:

| quando | passo | esito |
|---|---|---|
| 08/08 12:32 | `installed` | il seme che avvia il cronometro |
| 08/08 12:34 | `recurring` | **`error`** — `transactions_type_check`, catturato |
| 08/08 12:46 | entrambi | `ok` — dopo la `20260810` |
| **09/08 03:00** | entrambi | `ok` — **il cron vero**, non una corsa a mano |
| 09/08 15:14 | entrambi | `ok` — corsa manuale, nessun insert |

⚠️ **La riga in `error` è la prova che conta, e serviva vederla.** Solo righe
verdi non avrebbero distinto "il meccanismo funziona" da "il meccanismo è cieco
quanto pg_cron": quel guasto era rimasto invisibile per cinque settimane proprio
perché `job_run_details` diceva `succeeded`. Vale come regola di metodo — **un
registro di guasti non è collaudato finché non ha registrato un guasto.**

Gli arretrati sono stati recuperati in **un solo giro** (i `created_at` delle tre
transazioni generate sono identici): `Orange palestra` 39,90 datata **3 luglio** e
3 agosto, `Spotify` 12,00 datata 5 agosto, tutte con `recurring_rule_id`
valorizzato. La prima è letteralmente la riga del `DETAIL:` dell'errore citato in
testa alla migration. I `next_run` sono ora tutti al futuro (03/09, 05/09, 08/09).

⚠️ **`details` NULL con `status = 'ok'` significa zero regole saltate**, non
"nessuna informazione": se ce ne fossero state, `run_daily_jobs()` avrebbe scritto
`error` col conteggio. È il valore di ritorno di `generate_recurring_transactions()`
che rende leggibile la differenza.

I passi registrati sono **due** — `recurring` e `notifications`. La "pulizia"
nominata nella 17b non esiste più: cancellare le notifiche era il bug documentato
là sopra (libera la `dedup_key` e il generatore rifà la notifica).

⚠️ **Il collaudo dal SQL Editor è rappresentativo del cron**, e non per caso: in
quella sessione non c'è JWT, quindi `auth.uid()` è NULL esattamente come
dall'esecuzione notturna, e la funzione lavora su tutti gli utenti. Se l'avesse
lanciata un utente autenticato via RPC, avrebbe toccato solo i propri dati e non
avrebbe detto nulla sul comportamento del job.

#### Emerso dal code-review — la sorveglianza affermava più di quanto sapeva

⚠️ **Migration `20260811_job_health_fixes.sql` DA ESEGUIRE** (dopo la `20260809`
e la `20260810`). Cambia il tipo di ritorno di `daily_job_health()`: senza, le
due pagine impostazioni chiamano una firma che non esiste più.

Il guasto era chiuso, ma il meccanismo costruito per sorvegliarlo diceva il falso
in tre casi. **Sono lo stesso difetto in tre travestimenti**, ed è la classe già
elevata a regola nella Fase 18 — *un lampo di colore era messo in conto, una
dichiarazione falsa no.*

- ⚠️ **Il seme `installed` era scritto `status = 'ok'`**, quindi finiva in
  `last_ok_at`: l'app annunciava "ultimo controllo riuscito: 3 giorni fa" per un
  job che non aveva eseguito un solo passo. E siccome la tabella non è mai vuota,
  `t.jobHealth.never` era **irraggiungibile**: l'unico messaggio che descriveva
  davvero quello stato era codice morto in due lingue.
  ⚠️ **La correzione ovvia era sbagliata.** Togliere il seme da `last_ok_at` e
  basta lo rende NULL su un database appena migrato, e in TypeScript
  `lastOkAt === null` significa `stale` → l'avviso a torto dal primo minuto,
  cioè proprio ciò che il seme esisteva per impedire. Servono **due fatti
  distinti**: `watching_since` (l'inizio del cronometro) e `last_ok_at` (una
  riuscita). Erano stati confusi in una colonna sola.
- ⚠️ **Il verdetto schiacciava i due passi in un booleano e buttava via `step`.**
  Un guasto nelle sole notifiche faceva scrivere "i movimenti ricorrenti non
  vengono registrati" mentre erano stati registrati. La tabella sapeva quale
  passo era fallito; la funzione lo perdeva. Ora `failed_steps` esce dalla RPC e
  `DailyJobScope` (`lib/jobs.ts`) sceglie quale delle due frasi è lecita.
- ⚠️ **`job_runs` è GLOBALE**, quindi una regola saltata di un utente marcava
  `recurring / error` per l'intera esecuzione e l'allarme compariva sulle
  impostazioni di **tutti gli altri**, le cui ricorrenti erano state generate
  perfettamente. Non si chiude rendendo la tabella per-utente — è globale per la
  stessa ragione per cui `details` non esce verso il client — ma **abbassando la
  pretesa dell'affermazione**: terzo stato `partial`, che resta registrato senza
  alzare un allarme che parlerebbe a nome di chi non c'entra.
  Buco dichiarato: l'utente della regola saltata non riceve alcun segnale. Là una
  *notifica* sarebbe la sede giusta — il job è vivo, quindi può generarla, a
  differenza dell'allarme "job morto" che per costruzione non può esserlo.

**E un silenzio che sarebbe tornato da solo:** fino alla `20260811` l'unico file
con `cron.schedule` era la `20260809`, quindi era là che si tornava per
riagganciare il job — ma quel file contiene anche la **propria** versione di
`run_daily_jobs()`, quella che scarta il conteggio delle regole saltate.
Rieseguirlo dopo la `20260810` avrebbe restaurato il difetto originale senza un
errore e senza traccia. Due difese: una **guardia** in testa alla `20260809` che
si rifiuta di girare fuori ordine (riconosce la `20260810` dal tipo di ritorno di
`generate_recurring_transactions()`, che passa da `void` a `integer`), e la
regola che ne discende — **il file più recente dev'essere autosufficiente**, così
non c'è mai motivo di tornare indietro.

Tre correzioni di testo, tutte della stessa famiglia:

- **`hint` diceva "Controlla lo stato del database"** — in entrambe le lingue,
  tre righe sotto un commento che vieta di nominare il meccanismo. Era anche
  l'**unica** frase azionabile dell'avviso, rivolta a un utente che non ha né
  database né credenziali. Ora l'azione è quella vera: inserire a mano nel
  frattempo.
- ⚠️ **`formatRelativeTime` oltre i 7 giorni perde l'anno**: il default
  (`{day, month}`) è tarato sul campanello, dove le righe sono recenti per
  costruzione. Questo avviso si vede **solo da fermo**, quindi "3 luglio" non
  distingue cinque settimane da diciassette mesi — cioè l'unica cosa che quel
  testo esiste per dire. Il formato è ora un parametro opzionale.
- La riga del job era l'**unica `href` senza `chevron`** della pagina: si leggeva
  come un'etichetta di stato invece che come l'ingresso alla spiegazione.

Restano aperti, come commit separati: `createRecurringRule()` che scarta errore e
conteggio dell'RPC (`app/(main)/action.ts`), `details` che porta il conteggio ma
non gli id delle regole, `search_path to 'public'` in
`generate_recurring_transactions()` dove tutte le altre usano `''`, `logged_at`
che nessuno legge, e il `Promise.all` di `/impostazioni` che affianca una
funzione capace di `redirect()` a una promise che resterebbe non osservata.

### Costo delle richieste a Supabase (2026-08-08)

Il pannello Supabase segnava ~2300 richieste in un'ora di uso normale. Non era un
loop: era **fan-out architetturale**. Una vista della home costava **12 richieste**
— 5 auth + 7 REST — e si ripagava a ogni navigazione, a ogni `router.refresh()` e
dopo ogni `revalidatePath("/", "layout")`, cioè dopo ogni transazione salvata.
Ora ne costa **6**, con le chiamate auth a **zero**.

#### ⚠️ `auth.getUser()` è una chiamata di RETE, una per invocazione

È la trappola centrale, e non si vede leggendo il codice: `getUser()` **non legge
il cookie**, fa una `GET /auth/v1/user` verso GoTrue ogni volta e non memoizza
nulla. Siccome ogni loader apriva il proprio client e rifaceva il proprio
controllo, la home chiedeva **cinque volte la stessa risposta, in parallelo,
dentro lo stesso render**.

Il rimpiazzo è `getSessionUser()` in `lib/auth.ts`, che legge le **claims** del
JWT: firma verificata in locale con WebCrypto, JWKS in una cache di modulo di
`auth-js` (`GLOBAL_JWKS`, una volta per processo). Costo di rete a regime: zero.

- ⚠️ **Il risparmio dipende dal TIPO DI CHIAVE, non da questo codice.** Funziona
  perché il progetto usa chiavi JWT asimmetriche — si verifica con
  `curl $SUPABASE_URL/auth/v1/.well-known/jwks.json`, che deve rispondere
  `"alg":"ES256"`. Con un segreto simmetrico HS256 `getClaims()` ripiega **da
  solo** su `getUser()`: nessun errore, nessun avviso, e ogni chiamata torna a
  essere rete. È una regressione che nessun test coglie.
- ⚠️ **`SessionUser` è una FOTOGRAFIA, `User` era VIVO.** È la differenza che
  conta, e ignorarla è già costata un difetto (vedi sotto). Il tipo espone `id`
  — `sub` non cambia mai, quindi non può diventare stantio — e `email`, marcata
  come utilizzabile **solo per disegnare**. Niente `providers`: chi ha bisogno
  dei provider ha bisogno di quelli di adesso.
- **Le letture d'account restano su `getUser()`, ed è deliberato**: cambio email, cambio
  password, eliminazione account (`impostazioni/account/actions.ts`),
  `resetPassword`, il gate di `/reimposta-password` e il `/callback` subito dopo
  lo scambio del code. Le claims dicono che il token è autentico e non scaduto,
  **non che la sessione sia ancora viva**: un logout altrove non si vede fino
  alla scadenza dell'access token. Sul percorso di lettura non è una perdita —
  PostgREST valida quello stesso JWT allo stesso modo, quindi la RLS non avrebbe
  comunque visto la revoca — ma sulle operazioni sensibili la verifica lato
  server è esattamente ciò che si sta comprando, e là costa una chiamata per
  azione invece di cinque per render.

#### ⚠️ Il difetto che questa fase ha introdotto, e come si chiude

Trovato dal code-review, non dalla verifica manuale — che infatti era passata.

`getAccountContext()` era passata alle claims come tutto il resto. Ma quella
funzione serviva **due bisogni con requisiti di freschezza diversi**: la home
(avatar, iniziali, nome) e le pagine impostazioni (email e provider come
*fatto*, e come *conferma*). Sulle prime uno scatto vecchio è innocuo; sulle
seconde no.

**Perché l'email diventa stantia**: `/email-confermata` non è un flusso PKCE —
non scambia alcun `code` e quindi **non rinnova la sessione**. E `getSession()`
rinnova solo un token già *scaduto*, non uno che sta per esserlo. Quindi dopo un
cambio email confermato il JWT porta l'indirizzo vecchio per un'ora.

**La conseguenza**: `/impostazioni/elimina` passava a `DeleteAccountFlow`
l'email delle claims (vecchia), mentre `deleteAccount()` la confrontava con
quella di `auth.getUser()` (nuova). Digitare la nuova non abilitava il pulsante,
digitare la vecchia veniva rifiutato dal server: **account impossibile da
eliminare**. Stesso schema per `hasPasswordIdentity`, che la UI ricavava dalle
claims e il server da `user.identities` — due derivazioni della stessa domanda
nello stesso flusso, concordi per fortuna e non per costruzione.

**La chiusura è una separazione, non un ripiego a `getUser()` ovunque**:

| funzione | fonte | chi la usa |
|---|---|---|
| `getAccountContext()` → `AccountContext` | `auth.getUser()`, viva | le 5 pagine impostazioni |
| `getProfileHeader()` → `ProfileHeader` | claims | la home |

⚠️ **A garantirlo è il TIPO, non il commento.** `ProfileHeader` non espone
`email` né `hasPasswordIdentity`, quindi nessuna pagina che parta di lì può
usare per una conferma d'identità un dato che è una fotografia. La classe di
difetto non è mitigata: è **irrappresentabile**. Il costo è una chiamata auth
sulle sole impostazioni — una per vista, non cinque — e la home resta a zero.

**La regola generale**: quando si sostituisce una fonte viva con una copia
memorizzata, la domanda non è "il dato è lo stesso?" ma "**per quanto tempo può
divergere, e chi se ne accorge?**". Un campo che serve a disegnare e un campo
che serve a decidere hanno bisogni diversi anche quando contengono la stessa
stringa.

#### Un preambolo solo: `requireUser()`

Le quattro righe di apertura (client, utente, dizionario, controllo) stavano
copiate identiche in **32 server action su sei file**, e in un solo giorno hanno
dovuto cambiare due volte: prima per passare alle claims, poi per gestire
l'errore di `getClaims()`. Ogni volta una modifica a tappeto in cui **applicarla
a metà non si vede** — la stessa "migrazione a campione" descritta nella Fase 18.
Ora sono una chiamata: `const { supabase, user, t } = await requireUser()`.

⚠️ **`requireUser()` (`lib/auth.ts`) e `requireLiveUser()`
(`impostazioni/account/actions.ts`) NON sono intercambiabili**, e i nomi sono
diversi apposta: la prima legge le claims (fotografia), la seconda interroga
GoTrue (utente di adesso, `email` e `identities` compresi). Con lo stesso nome
basterebbe un import distratto per riaprire il difetto dell'eliminazione account.

#### Le risposte con i cookie di sessione non devono essere memorizzabili

`@supabase/ssr` passa a `setAll` un secondo argomento con
`Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`,
`Expires: 0`, `Pragma: no-cache`, e la sua documentazione dice perché:
*"Responses that set auth cookies must not be cached by CDNs or reverse proxies,
otherwise one user's session token can be served to a different user."*

- Nel **proxy** quegli header ora vengono tenuti da parte e applicati **anche al
  ramo di redirect**, che costruisce una risposta nuova e prima copiava i soli
  cookie: usciva un 307 con dei token in `Set-Cookie` e nessuna direttiva.
- ⚠️ **`lib/supabase/server.ts` NON può applicarli**, e non è una svista: in un
  Server Component `cookies()` non ha un canale per gli header di risposta, e in
  un Route Handler la `Response` nasce dopo il client. La copertura sta in
  `next.config.ts`, con una regola `headers()` sulle quattro rotte che scrivono
  cookie di sessione fuori dal proxy — `/callback`, `/auth/confirm` e i due
  signout. Verificata a runtime.

#### `cache()` su `createClient()`

Non è cosmesi: senza, la home istanziava cinque client, ognuno col proprio client
GoTrue. Con un'istanza sola per richiesta il rinnovo di un token scaduto avviene
una volta dentro il lock interno di GoTrue, invece che in cinque corse parallele
sullo stesso refresh token — **che è monouso**, la stessa classe di difetto già
documentata nel proxy.

⚠️ **Fuori da un render React `cache()` non memoizza e non solleva** (verificato,
React 19.2.7): nelle server action degrada al comportamento precedente, dove il
controllo si fa comunque una volta sola. Quindi è sicura ovunque, ma il guadagno
si vede **solo durante un render** — cioè esattamente nel caso che serviva.

#### Le query: due difetti dello stesso tipo

- **`getDashboardTotals` lanciava due query dove la seconda era un SOVRAINSIEME
  della prima** (una filtrata sul mese, una senza filtri). La filtrata non
  aggiungeva un solo dato: costava una richiesta e ritrasferiva le stesse righe.
- **`getNotifications()` chiamava `getUnreadCount()`**, che è una server action a
  sé: apriva un secondo client e rifaceva il proprio controllo auth per una query
  che parte comunque nello stesso `Promise.all`. Ora la query è estratta in
  `unreadCountQuery()`, condivisa fra le due.

#### `dashboard_totals()` — migration `20260808_dashboard_totals.sql`

Le somme della home le fa Postgres. Prima si scaricava **ogni transazione
dell'account**, tutta la storia, per produrre una trentina di numeri.

- ⚠️ **I confini dei mesi li calcola l'APP e li passa come parametro**, non
  `date_trunc` nel database. Oggi nascono da `new Date(y, m, 1)`, cioè nel fuso
  del processo che rende la pagina: UTC su Vercel, **ora italiana in sviluppo
  locale**. Spostare il calcolo nel DB li avrebbe fissati a UTC, cambiando in
  silenzio i totali della dashboard locale — e solo nelle prime ore del mese,
  cioè il momento peggiore per accorgersene. La chiusura pulita è `ClientClock`
  (Fase 17a), ma la home è un server component e non conosce il fuso dell'utente.
- **Un array di 7 confini, non due domande separate.** Il mese corrente **è**
  l'ultimo bucket del trend a 6 mesi (`m-5+i` con `i=5` è `inizioMese`):
  chiederli separatamente avrebbe sommato due volte le stesse righe.
- **`total` torna `numeric` senza precisione**, non `numeric(10,2)` come la
  colonna: una somma può superare le dieci cifre anche se nessun importo singolo
  lo fa, e il cast la farebbe fallire.
- ⚠️ **Ordine di deploy vincolante**: la migration va eseguita **prima** di
  pubblicare il codice, o la home risponde 404 sulla RPC. Nessun ripiego sulla
  vecchia strada, di proposito — un fallback silenzioso nasconderebbe una
  migration non eseguita e l'app girerebbe per mesi sulla via lenta.
- ⚠️⚠️ **`RETURN QUERY` di plpgsql pretende i tipi ESATTI; `language sql` no.**
  Una funzione SQL accetta qualsiasi tipo *binary-coercible* e converte in
  silenzio (`varchar` dove è dichiarato `text`, `int2` dove è dichiarato `int`).
  La prima versione di `dashboard_totals()` era `language sql` e funzionava
  proprio grazie a quell'indulgenza; aggiungendo il tetto su `p_bounds` è
  diventata plpgsql e la home è morta con
  `structure of query does not match function result type` — messaggio che **non
  dice quale colonna** e che compare solo all'esecuzione, non alla creazione
  (`create or replace` era passato senza un lamento). Ogni colonna restituita ha
  ora un cast esplicito. Non è ridondanza: lega la funzione alla propria firma
  invece che a un'assunzione sullo schema — che all'epoca **nessuno poteva
  verificare leggendo il repo**, perché `transactions` non era versionata. Da
  quando lo è (issue #43, `20260727`) l'assunzione è controllabile, e si vede
  che era **giusta**: `type` è davvero `character varying`, non `text`.

#### Il proxy: un redirect è un'AFFERMAZIONE

`updateSession()` scartava l'`error` di `getClaims()` esattamente come faceva
`getSessionUser()`. Stesso difetto, conseguenza peggiore: un JWKS irraggiungibile
o un GoTrue lento finivano nello stesso cesto di "token non valido", e l'utente —
con una sessione buona — veniva spedito su `/welcome`. Un redirect **dichiara**
"non sei autenticato", e lì era una dichiarazione falsa.

Ora su un errore di rete la richiesta **passa**. Non è un buco, ed è la parte che
va capita: ⚠️ **il proxy è una comodità di navigazione, non il perimetro di
sicurezza.** Il perimetro sono la RLS e il controllo che ogni pagina e ogni
action rifanno da sé — necessario comunque, perché una server action è
raggiungibile con una POST diretta. Verificato: tutte e dodici le pagine di
`(main)` passano da un loader che autentica. A valle `getSessionUser()` incontra
lo stesso guasto e solleva, quindi si vede una pagina d'errore: sgradevole ma
**vera e ricaricabile**, invece di un logout che mente.

#### ⚠️ Il travaso dei cookie nel redirect fa il contrario di quel che diceva

Il commento originale sosteneva di "salvare la rotazione" persa da un redirect
nudo. Riesaminato, **era sbagliato due volte**:

- la rotazione riuscita non passa quasi mai di lì — se il refresh va a buon fine
  `getClaims()` torna le claims, `user` è valorizzato e si esce dall'altro ramo;
- un `NextResponse.redirect()` senza `Set-Cookie` **non può cancellare niente**:
  non ha alcun header con cui farlo.

Ciò che arriva davvero in quel ramo è l'opposto: refresh **fallito**, sessione
dismessa da auth-js, e `setAll` che scrive delle **cancellazioni**. Inoltrarle è
comunque la cosa giusta — il token è morto, e ripulire impedisce al browser di
ripresentarlo a ogni richiesta. Il codice resta, il commento no.

⚠️ Rischio residuo dichiarato: sotto concorrenza una richiesta che perde la corsa
potrebbe cancellare i cookie appena scritti da una sorella. È mitigato **da
GoTrue, non da noi** — il *refresh token reuse interval* (10s di default) fa sì
che le richieste parallele con lo stesso refresh token ricevano tutte la stessa
sessione nuova invece di un errore, ed esiste esattamente per il burst di
prefetch dell'hard refresh. Se venisse portato a 0 nelle impostazioni Auth, quel
blocco va rivisto.

#### Cosa NON era il problema

Vale la pena saperlo prima di rimettere mano a questa zona:

- **Il proxy.** Gira su ogni richiesta ma usa già `getClaims()`, che con ES256
  non tocca la rete.
- **Il prefetch della `BottomNav`.** `node_modules/next/dist/docs/01-app/02-guides/prefetching.md`:
  le pagine dinamiche non si prefetchano senza `loading.js`, e nel repo non ce
  n'è nessuno. In sviluppo il prefetch automatico non gira proprio.
- **Polling.** Non ce n'è: `DashboardRefresher` reagisce a un contatore di
  Zustand, non a un timer.

#### Come misurare, la prossima volta

Il numero da guardare nel pannello Supabase non è il totale ma la **card Auth**:
se non è quasi piatta, da qualche parte è rientrato un `getUser()` sul percorso
di lettura.

## Auth Flow

- `/welcome` → landing page pre-auth
- `/sign?tab=signup` → registrazione. `signup()` gestisce **entrambe** le configurazioni
  di Supabase (Authentication → Sign In / Providers → Email → *Confirm email*):
  - conferma **attiva** → `signUp` ritorna `session: null` → schermata "controlla la tua email"
  - conferma **disattiva** → `signUp` ritorna già una sessione → `redirect("/start")`

  Senza il controllo su `data.session` l'utente resterebbe fermo davanti a un
  messaggio che rimanda a un'email mai inviata. `emailRedirectTo` punta a `/callback`:
  senza, il link atterrerebbe sul Site URL (`/`), che non scambia il `code`.
- `/sign` → login → dopo login controlla `profiles.currency`: se NULL → `/start`, altrimenti → `/`
- `/callback` → gestisce OAuth (Google/Facebook) e verifica email → stesso check su `profiles.currency`
- Onboarding: `/start` → `/preference` → `/category` → `/`
- `savePreferences()` fa upsert su `profiles` (currency, language)
- `saveCategories()` cancella le categorie onboarding esistenti e reinserisce quelle selezionate
- **Recupero password**: `/recupera-password` → `resetPasswordForEmail` con
  `redirectTo=/callback?next=/reimposta-password` → `/reimposta-password` →
  al termine `signOut()` + `/sign?reset=1` (il login mostra la conferma).
  Entrambe le route sono in `PUBLIC_PATHS` (`lib/supabase/proxy.ts`), altrimenti il
  proxy rimanderebbe a `/welcome` chi è sloggato. Il form risponde sempre "inviato",
  anche per indirizzi inesistenti, per non esporre chi ha un account.
- **Cambio email**: `updateUser({ email })` con `emailRedirectTo=/email-confermata`,
  **non** `/callback`. Non è un flusso PKCE — la sessione esiste già, quindi nessun
  `code_verifier` viene generato e Supabase reindirizza senza `code`. `/callback` lo
  pretende e manderebbe su `/auth/auth-code-error`: l'utente leggerebbe "accesso non
  riuscito" a fronte di un cambio andato perfettamente a buon fine. La rotta è in
  `PUBLIC_PATHS` perché il link può essere aperto da un browser senza sessione.
- **Marcatore di recupero** (`lib/recovery.ts`): la sessione creata dal link è una
  normale sessione Supabase, indistinguibile da un login. `/callback` emette un
  cookie httpOnly di 15 minuti quando `next=/reimposta-password`; la pagina e
  `resetPassword()` lo esigono, e viene bruciato dopo il cambio. Senza, chi trova un
  dispositivo già loggato reimposta la password saltando la verifica di quella attuale.

  ⚠️ **Residuo di sicurezza accettato**: su `/callback` arriva un `code` opaco, quindi
  il marcatore si basa sul solo `next` — un login OAuth costruito a mano con
  `next=/reimposta-password` lo otterrebbe. La chiusura pulita è far passare il
  recupero da `/auth/confirm` (già pronta: emette il marcatore solo per
  `type === "recovery"`), ma richiede un template email custom, e **Supabase permette
  di modificare i template solo con SMTP personalizzato**. Quando si configurerà
  l'SMTP — necessario comunque in produzione, l'email integrata è limitata a pochi
  invii/ora — cambiare `redirectTo` in `/auth/confirm?next=/reimposta-password` e
  impostare il template:

  ```html
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reimposta-password">Reimposta la password</a>
  ```
- **Cancellare un cookie in una server action fa ri-renderizzare la pagina**: per
  questo `resetPassword()` fa `redirect()` invece di tornare al client — altrimenti
  la guardia di `/reimposta-password`, ormai senza marcatore, rimbalzerebbe l'utente.
- **`profiles`: sempre `upsert`, mai `update`**. Gli utenti registrati prima del
  trigger `on_auth_user_created` che non hanno finito l'onboarding non hanno la riga:
  un `UPDATE` su zero righe non è un errore, e l'app direbbe "salvato" a vuoto.
- **Operazioni sensibili** (cambio email, cambio password, eliminazione account):
  richiedono sempre la riautenticazione con `signInWithPassword`. Supabase non la
  impone, ma senza di essa un dispositivo sbloccato basterebbe a prendere l'account.
  Il controllo va rifatto a ogni server action: lo stato del passo precedente vive sul
  client e non è affidabile.
- **Ogni server action che legge dati apre con `requireUser()` (`lib/auth.ts`)**,
  che dà client, utente (dalle claims) e dizionario in un colpo solo. Non
  `auth.getUser()` — quest'ultima è una chiamata di rete a ogni invocazione.
  Le eccezioni sono le operazioni sensibili qui sopra, `resetPassword`, il gate
  di `/reimposta-password`, il `/callback` **e tutto ciò che passa da
  `getAccountContext()`**: là serve la verifica lato server, perché le claims
  non vedono né una sessione revocata né un'email appena cambiata. Motivi e
  trappole nella sezione "Costo delle richieste a Supabase".
- Gli account solo-OAuth non hanno `identities` con provider `email`:
  per loro cambio email e cambio password sono disabilitati (`hasPasswordIdentity`).
  ⚠️ Quel predicato lo calcolano **sia** `getAccountContext()` (per mostrare o
  nascondere i campi) **sia** `deleteAccount()` (per pretenderli): devono venire
  dalla stessa fonte viva, o la UI nasconde un campo che il server poi esige.

  ⚠️ **Eccezione nota**: per questi account l'**eliminazione** non ha riautenticazione
  — non esiste una password da verificare, e resta solo la digitazione dell'indirizzo.
  La chiusura corretta è `supabase.auth.reauthenticate()`, che invia un nonce a 6 cifre
  e funziona anche senza password; non è stata implementata perché aggiunge un passo
  al flusso e dipende dall'invio email (vedi debito SMTP). Da fare prima di aprire le
  registrazioni OAuth al pubblico.
- ⚠️ **Limite PKCE cross-browser**: i link di recupero password e di conferma
  registrazione passano da `/callback`, che chiama `exchangeCodeForSession` e ha
  bisogno del cookie `code_verifier` creato al momento della richiesta. Chi apre
  l'email in un browser diverso da quello da cui ha chiesto il reset finisce su
  `/auth/auth-code-error`. Si risolve con lo stesso intervento del debito SMTP: il
  flusso `token_hash` su `/auth/confirm` non usa PKCE e funziona da qualsiasi
  dispositivo.

## Design System — Zen Glass

Stile ispirato al minimalismo giapponese. Superfici come vetro satinato, pietra, carta di riso. Mai effetti cyber o plastic glass.

### Temi

Doppio tema **light (default) + dark**, gestito dalla classe `.dark` su `<html>`.
`globals.css` è la fonte di verità: `:root` = light, `.dark` = override.
Dalla Fase 18 il tema è scelto dall'utente e il root layout **non forza più nulla**:
legge i cookie e decide lì. Vedi "Fase 18" sotto.

### Token CSS (definiti in globals.css — valori light di default)

```css
/* Neutri (cambiano nel .dark) */
--color-tsuki: #f5f1e8   /* carta chiara / superfici */
--color-kami:  #ece6da
--color-yoru:  #33373d   /* testo primario */
--color-kage:  #4a4e45   /* testo secondario */
--color-kiri:  #8e887b   /* testo muted */
--color-hai:   #9a9384   /* testo disabled */

/* Accenti finanziari (ruolo stabile in entrambi i temi) */
--color-midori:   #6f8a63  /* entrate / positivo */
--color-aka:      #b47358  /* uscite / negativo */
--color-ao:       #6e86a8  /* investimenti */
--color-kin:      #ae8b49  /* risparmi / goals */
--color-murasaki: #8a6fc4  /* ricorrenti / abbonamenti */

/* Accenti come INCHIOSTRO — solo per il TESTO (Fase 18) */
--ink-midori: #5c7350
--ink-aka:    #96543d
--ink-ao:     #4c6588
--ink-kin:    #7f6229
--ink-murasaki: #6b4fa8
--ink-kiri:   #6b6558  /* neutro di ripiego: categoria senza tipo, 6° dei grafici */

/* Contenuto SOPRA un riempimento d'accento — mai un #fff cablato */
--on-accent:  #ffffff  /* in .dark: #131a28 */
```

⚠️ **Accento ≠ inchiostro.** Gli accenti qui sopra sono tarati per RISALTARE:
come riempimento, pastiglia, bordo, icona o fetta di grafico vanno benissimo.
Come **testo su fondo chiaro** danno circa 3,2:1, sotto il 4,5:1 di WCAG AA.
Per il testo si usano `--ink-*` (classi `text-aka-ink`, `text-midori-ink`…) o
`TIPO_INK` in `lib/transaction-utils.ts`, il gemello di `TIPO_COLOR`.
In `.dark` gli inchiostri **sono** gli accenti (là il contrasto è già sopra 6:1):
il token esiste comunque, così i componenti non devono sapere in che tema stanno.
⚠️ **Unica eccezione `--ink-kiri`**, che ha un valore proprio anche in `.dark`
(`#9aa1b0`): `--color-kiri` non è ridefinito là, quindi ereditarlo lo lasciava
identico nei due temi — l'unico a non spostarsi — e a ~4,5:1 invece del 6:1.
Le **icone restano sull'accento pieno** — per gli elementi grafici lo standard
chiede 3:1, che già rispettano.

⚠️ **Sopra un riempimento d'accento va `--on-accent`, mai `#fff`.** Gli accenti
invertono la luminosità fra i temi (scuri su carta, pastello su notte), quindi
ciò che ci sta sopra deve invertirsi con loro: un bianco cablato è il tema scuro
dato per scontato e là sta a 2,8:1. Vale per il pomello dell'interruttore
"Ripeti", la spunta delle card onboarding e il badge della campanella — che per
lo stesso motivo è **l'unico posto dove un inchiostro fa da FONDO**, perché in
chiaro l'accento è troppo chiaro perché il bianco ci stia sopra a 4,5:1.

I token semantici (`--surface`, `--card`, `--border`, `--text-*`, ecc.) sono
mappati sui nomi Tailwind in `@theme inline` → usare le classi (`bg-card`,
`bg-surface`, `border-subtle`, `text-muted`…), non gli hex.

⚠️ **Il nome del token e il nome della classe NON coincidono**, e sbagliarli
fallisce in silenzio:

| serve | token in `:root` | in `@theme inline` | classe |
|---|---|---|---|
| bordo | `--border` | `--color-subtle` | `border-subtle` |
| testo primario | `--text-primary` | `--color-foreground` | `text-foreground` |

**`--color-border` e `--color-primary` non esistono.** Scrivere
`style={{ borderColor: "var(--color-border)" }}` fa ripiegare il browser su
`currentColor` — cioè il colore del testo: in tema scuro un bordo quasi bianco.
La classe `text-primary` invece non applica nulla e il testo eredita, quindi
sembra giusto per caso (succede in `components/UI/Select.tsx`). Nel dubbio,
usare le classi Tailwind e non `var(--color-*)` inline: una classe inesistente
si nota, una variabile CSS inesistente no.

### Utility classi custom (globals.css)

`onboarding-blur`, `card-shadow`, `box-shadow`, `modal-shadow`, `deep-shadow`,
`transaction-type-card`, `btn-primary`, `fab`, `segment-tab`, `active-tab`,
`circle-1`, `circle-3`, `zg-pulse` (+ keyframes `zg-breathe`, `zg-pulse`)

### Regole stilistiche

- Border radius: 24–32px per card e modal, 12px per elementi interni
- Borders: 1px, opacità bassissima (`rgba(255,255,255,0.10)`)
- Glass card: `background: rgba(255,255,255,0.06)`, `backdrop-filter: blur(12px)`
- Shadows: soffuse e diffuse, mai nere
- Typography: Inter, sentence case ovunque, mai title case
- Icons: Lucide outline, stroke uniforme, mai filled

### Layout responsive onboarding

- `lg:` (1024px): layout a due colonne — left panel `w-2/5`, right panel `w-3/5`
- `xl:` (1280px): card wrapper visibile nel right panel (`xl:bg-surface xl:border ...`)
- Bottone sempre pinned in fondo: `flex flex-col grow` + `w-full max-w-lg mx-auto pb-14`

## Rules

- Ogni tabella Supabase DEVE avere RLS abilitato — non creare tabelle senza policy.
  ⚠️ **Unica eccezione: RLS abilitata e ZERO policy come nego-tutto deliberato**,
  per i registri che nessun ruolo del client deve toccare (`job_runs`). Va scritto
  nella migration *perché* è voluto, o alla rilettura è indistinguibile da una
  dimenticanza — che è il caso che la regola esiste per intercettare
- Usare `DECIMAL(10,2)` per tutti i valori monetari, mai float
- UUID per tutti gli ID, mai INT sequenziali
- Variabili Supabase sempre in `.env.local`, mai hardcoded
- `NEXT_PUBLIC_SITE_URL` è obbligatoria e non ha fallback: è la base di ogni link
  spedito per email. Si usa solo tramite `lib/site-url.ts`, mai leggendo l'env a mano.
  Il controllo che conta sta in `next.config.ts` — le `NEXT_PUBLIC_*` sono inlinizzate
  in compilazione, quindi un throw in un modulo applicativo scatterebbe alla prima
  esecuzione dell'action (cioè addosso a un utente) invece che al build
- I colori delle categorie finanziarie seguono il design system:
  verde = entrate, rosso = uscite, blu = investimenti, oro = risparmi
- Componenti UI generici in `components/UI/`, logica di business in `components/features/`
- Per i grafici usare sempre Recharts, non installare altre librerie chart
- Le transazioni ricorrenti usano pg_cron + una funzione SQL `generate_recurring_transactions()` (Fase 14). Regole in tabella `recurring_rules`; il job inserisce transazioni normali con `recurring_rule_id`
- PWA viene aggiunta solo a progetto completato (Fase 26)
- Server Actions (`"use server"`) per tutte le operazioni DB — mai chiamate API REST dirette
- ⚠️ **I pannelli si MONTANO, non si nascondono.** Un bottom sheet non deve avere
  una prop `isOpen` con dentro `if (!isOpen) return null`: nascondere non è
  smontare, quindi lo stato del form sopravvive alla chiusura e va riazzerato a
  mano in un effetto — cinque o nove `setState` in un `useLayoutEffect`, cioè un
  render a cascata a ogni apertura (`react-hooks/set-state-in-effect`).
  Decide il chiamante: `{aperto && <Sheet key={record?.id ?? "new"} … />}`.
  **Montare È l'azzeramento**: gli inizializzatori di `useState` leggono le prop
  e l'effetto non serve più — non va zittito con un `eslint-disable`, va fatto
  sparire. La `key` copre il passaggio da un record all'altro senza chiudere in
  mezzo. Vale per `GoalSheet`, `CategorySheet`, `RecurringSheet` e
  `TransactionModal` (quest'ultimo diviso in guscio + contenuto, perché lo rende
  il layout e non ha un genitore che possa decidere)
- Pagine onboarding usano `"use client"` + handler async con `useState` per loading/error

## Implementation Order

Seguire questo ordine, non saltare fasi:

1. ✅ Setup Next.js + Tailwind + TypeScript
2. ✅ Token Zen Glass in globals.css
3. ✅ Supabase: progetto + tabelle + RLS
4. ✅ Auth: login, register, sessione (email + OAuth Google/Facebook)
5. ✅ Onboarding: start, preference, category — con salvataggio su profiles e categories
6. ✅ Componenti base: Button, Input, Card, Select, BrandHeader, OnboardingProgress
7. ✅ TransactionForm + CategoryDropdown
8. ✅ Lista transazioni + FilterBar
9. ✅ Homepage dashboard con totali
10. ✅ Statistiche + grafici Recharts
11. ✅ Savings + goals con ProgressBar
12. ✅ Investimenti + breakdown portafoglio
13. ✅ Impostazioni + categorie custom
14. ✅ Transazioni ricorrenti (pg_cron + funzione SQL `generate_recurring_transactions`)
15. ⏸️ Notifiche — RIMANDATA: si fa insieme alla Fase 17. Motivo: escluse le notifiche ridondanti con la banca (movimento/stipendio registrato), quelle utili sono solo forward-looking/goal-based (obiettivo a %, rinnovo abbonamento IN ANTICIPO, conferma generazione ricorrenti) — le stesse che servono agli avvisi budget. L'infra di notifica si costruisce una volta sola nella Fase 17. Vedi design "Stati Supporto"
16. ✅ Gestione account e sicurezza — email, cambio password, reset password dimenticata, avatar, eliminazione account (issue #12 + #7).
    Tutti i flussi verificati end-to-end. Debiti aperti prima del deploy: SMTP
    personalizzato (vedi Auth Flow) e riattivare *Confirm email* su Supabase.
    Tracciati con checklist nella issue #40 — quella è la lista operativa, qui
    restano i motivi tecnici.
17. Budget per categoria + Notifiche — schema e motivazioni in "Fase 17 — budget e
    notifiche" sopra. Due PR, una issue ciascuna:
    - **17a ✅ budget (issue #31**, consolida #10) — tabella `budgets`,
      `budgets_at()`/`set_budget()`, RLS, campo nel form categoria, limite globale
      nelle impostazioni, card con barre (ambra 80%, rossa 100%), riga "uscite fisse
      previste". Verificata end-to-end il 2026-08-03.
    - **17b ✅ notifiche (issue #41**, accorpa #29) — tabella `notifications` con
      `dedup_key`, `run_daily_jobs()` che invoca ricorrenti → notifiche → pulizia,
      campanella con badge e pannello letto/non-letto. Verificata end-to-end il
      2026-08-04, idempotenza inclusa.
18. ✅ Tema chiaro/scuro (issue #32) — cookie + tre stati, interruttore nel `ProfileMenu`
    e selettore in `/impostazioni`. Motivazioni e trappole del tema chiaro nella
    sezione "Fase 18" sopra. Include l'allineamento di Home, Investimenti e Analisi
    ai mockup e i token `--ink-*`.
19. ✅ Lingua i18n (it/en) (issue #33) — dizionari tipizzati a mano, locale da cookie
    (niente `[locale]` nell'URL), `profiles.language` normalizzata e riversata nel
    cookie al login. Il testo esce da sette moduli di `lib/`; sei array italiani
    passano a `Intl`. Include il `DatePicker` custom che chiude il debito
    `<input type="date">` della Fase 18. Motivazioni e trappole in "Fase 19" sopra.
    Migration `20260807_language.sql` eseguita, verificata end-to-end il 2026-08-07
20. Conti/wallet multipli — **progettata per intero il 2026-08-13**, schema e
    motivazioni in "Fase 20" sopra. Due PR:
    - **20a conti (issue #34)** — `accounts`, `account_id` NOT NULL + backfill,
      conto nell'onboarding, `recurring_rules.account_id`, pagina conti con saldo
      calcolato, selettore nel form, filtro nella lista
    - **20b ✅ trasferimenti (issue #49)** — tipo `trasferimento`,
      `to_account_id` + i quattro CHECK, destinazione facoltativa su
      `risparmio`/`investimento`, segno relativo al conto guardato. Chiude
      **entrambi i debiti** della 20a: la FK composita al posto di
      `assertOwnAccount()` e le ricorrenti su conto archiviato. Migration
      `20260815_transfers.sql` eseguita e collaudata il 2026-08-12 — sei prove
      che dovevano fallire, tutte fallite; saldo che si sposta di 100 fra due
      conti col **totale invariato**; 23 righe prima, 23 dopo
21. ✅ Import dati (issue #35) — CSV con mappatura colonne + **profilo Trade
    Republic riconosciuto dall'intestazione** (nessuna API ufficiale TR: si
    importa un file, l'app non tocca mai le credenziali). Tabella `imports` come
    lotto annullabile, `import_key` per l'idempotenza, decisioni **per gruppo**
    e non per riga. Motivazioni, trappole del file vero e i quattro buchi che il
    primo import reale ha rivelato: sezione "Fase 21" sopra. Migration
    `20260816_imports.sql`. **Apre la issue #52 (disinvestimento)**
22. Allegati/ricevute — foto scontrino sulle transazioni via Supabase Storage
23. Export dati / report PDF mensile — complementa l'import (Fase 21)
24. AI Financial Coach — suggerimenti personalizzati basati su metodologie (50/30/20, ecc.) via Claude API
25. Blocco app — PIN / biometrico (sezione "Sicurezza" del mockup impostazioni, saltata in Fase 13)
26. PWA: manifest.json + Service Worker
27. Mobile nativo — comportamento su dispositivo reale (vedi sotto)
28. Responsive tablet + desktop
29. Animazioni: transizioni morbide, micro-interazioni

### Fase 27 — Mobile nativo (checklist)

Ordine per priorità (il viewport è il problema più sentito):

1. **Altezza viewport** — usare `dvh`/`svh`/`lvh`, mai `vh` puro. La bottom nav
   e i bottoni pinned in fondo non devono finire sotto la toolbar dinamica di
   Safari iOS; i container di scroll devono restare accessibili quando la barra
   appare/scompare.
2. **Safe area** — `viewport-fit=cover` + `env(safe-area-inset-*)` su bottom
   nav, FAB, header e modal, per notch e home indicator.
3. **Zoom sugli input** — font-size ≥ 16px su tutti gli `<input>`/`<textarea>`
   per impedire lo zoom automatico di iOS al focus.
4. **Tastiera** — nei form e nei bottom sheet il campo attivo non deve essere
   coperto dalla tastiera; gestire lo scroll-into-view.
5. **Touch target** — area toccabile ≥ 44×44px su tutti gli elementi interattivi.
6. **Scroll** — momentum scroll e `overscroll-behavior` per evitare bounce/pull
   indesiderati fuori dai container.

## Key Decisions

- **Storage**: Supabase cloud (multi-device, non localStorage)
- **Auth**: Supabase Auth con RLS — ogni utente vede solo i propri dati
- **Email confirmation**: abilitata — dopo signup l'utente vede "controlla la tua email" nella stessa pagina (nessun redirect)
- **Onboarding gate**: `profiles.currency` è il flag — NULL = onboarding non completato
- **State globale**: Zustand (`store/useUIStore.ts`) per stato UI — modal transazione, edit, trigger di refresh. I dati DB arrivano dai server components / server actions, non sono in Zustand
- **Obiettivi = categorie**: nessuna tabella goal separata — categorie `type='risparmio'` con `target_amount`/`target_date`; `saved_amount` calcolato dalle transazioni. Scelta confermata (no tabella dedicata finché non servono prelievi tracciati o stato completato persistito). Il "prelievo" da un obiettivo si fa cancellando la transazione (non lascia storico). Categorie risparmio e obiettivi **convivono** di proposito. NB Fase 13: eliminare una categoria risparmio = eliminare l'obiettivo → deve usare la stessa logica/conferma di `deleteGoal`, non un delete secco.
- **Colonne DB in inglese**: `amount`, `type`, `category_id`, `notes`, `date` (non italiano)
- **Ricorrenti**: generazione automatica lato server con pg_cron (non al login)
- **Monetario**: DECIMAL(10,2) in DB, `Intl.NumberFormat` per display — dalla Fase 19
  sempre tramite `lib/i18n/format.ts` (`formatMoney`/`formatNumber`), mai un
  `new Intl.NumberFormat("it-IT")` cablato: quello non è spostabile su un altro locale
- **Lingua**: dizionari tipizzati in `lib/i18n/dictionaries/`, locale dal cookie.
  Nessuna stringa rivolta all'utente vive fuori dai dizionari — nemmeno dentro
  `lib/`, che tiene solo la meccanica (vedi "Fase 19")
- **Identità dell'utente**: dalle **claims** del JWT (`getSessionUser()` in
  `lib/auth.ts`), non da `auth.getUser()` — quella è una chiamata di rete a ogni
  invocazione, e i loader di una pagina sono tanti. `auth.getUser()` resta dove
  il dato dev'essere **vivo** e non una fotografia: le operazioni sensibili
  sull'account e `getAccountContext()`. ⚠️ Il confine passa dal TIPO —
  `ProfileHeader` (claims) non espone email né provider, `AccountContext`
  (`getUser()`) sì. Vedi "Costo delle richieste a Supabase"
