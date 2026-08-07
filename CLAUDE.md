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
│       └── ricorrenti/   #     regole ricorrenti
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
│   │                     # ThemeProvider (+ useTheme), ThemeToggle, ThemeSection,
│   │                     # I18nProvider (+ useI18n)
├── LoginForm.tsx, SignUpForm.tsx, PasswordField.tsx
└── icons.tsx             # GoogleIcon, FacebookIcon

lib/
├── supabase/             # client.ts, server.ts, proxy.ts (PUBLIC_PATHS)
├── i18n/                 # config.ts (locale, cookie, negoziazione — client-safe),
│   │                     # format.ts (Intl: numeri, denaro, date, plurali),
│   │                     # server.ts (getI18n/getDictionary — importa next/headers),
│   │                     # dictionaries/it.ts (fonte di verità) + en.ts (Fase 19)
├── seichi-icons.tsx      # set icone SVG custom (SeichiIcon)
├── icon-map.ts           # nome categoria → icona (Lucide)
├── goal-icons.ts         # GOAL_ICON_MAP + GOAL_ICONS
├── category-icons.ts     # CATEGORY_LIBRARY — SOLO id icona per tipo (etichette nel dizionario)
├── investment-types.ts   # INVESTMENT_TYPE_COLOR + FALLBACK (le etichette nel dizionario)
├── transaction-utils.ts  # TIPO_COLOR/TIPO_INK, formatDate, formatAmount
├── budget.ts             # BUDGET_PERIODS (id), soglia, budgetStatus/Color/Ink
├── recurring.ts          # FREQUENCIES (id) + aritmetica delle date
├── account.ts            # getAccountContext() — user + profilo per le impostazioni
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

profiles: id (= auth.users.id), currency (TEXT), language (TEXT, nullable),
          full_name (TEXT, nullable), avatar_url (TEXT, nullable)
-- La riga nasce da un trigger on_auth_user_created (non più solo in onboarding);
--   full_name viene fatto backfill da auth.users.raw_user_meta_data.
-- Il nome NON si legge da user_metadata: quel campo è scrivibile dal client.
-- language: tag MINUSCOLO ('it' | 'en'), vincolato da profiles_language_check
--   (Fase 19). NULL = non ancora scelto → l'app ripiega su Accept-Language, che
--   è un'informazione migliore di un italiano d'ufficio. Vietare NULL romperebbe
--   la registrazione, perché il trigger crea la riga prima dell'onboarding.

categories: id, user_id, name (TEXT), icon (TEXT), color (TEXT),
            type (TEXT), created_at,
            target_amount (DECIMAL 10,2, nullable), target_date (DATE, nullable)
-- type values: 'spesa' | 'entrata' | 'investimento' | 'risparmio' | 'abbonamento'
-- Vincolo DB: categories_type_check
-- Gli OBIETTIVI di risparmio NON hanno tabella dedicata: sono categorie con
--   type='risparmio' + target_amount/target_date. saved_amount è calcolato
--   sommando le transazioni risparmio della categoria (vedi getGoals).

transactions: id, user_id, amount (DECIMAL 10,2), type (TEXT),
              category_id, investment_type (TEXT, nullable), date (TIMESTAMP),
              notes (TEXT), created_at, recurring_rule_id (UUID, nullable)
-- recurring_rule_id: se valorizzato, la transazione è stata generata da una regola ricorrente

recurring_rules: id, user_id, amount (DECIMAL 10,2), type (TEXT), category_id,
                 notes (TEXT), frequency (TEXT), start_date (DATE), next_run (DATE),
                 end_date (DATE, nullable), active (BOOL), created_at
-- frequency: 'settimanale' | 'mensile' | 'annuale'
-- pg_cron chiama generate_recurring_transactions() (giornaliero): per ogni regola
--   attiva con next_run <= oggi inserisce transazioni e avanza next_run (idempotente)
```

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
- ⚠️ **IL REPO NON RICOSTRUISCE ANCORA IL DATABASE DA ZERO.** Le tabelle di base —
  `profiles`, `categories`, `transactions` — sono nate nella Fase 3 e non sono mai
  state versionate: nessun file le crea. Anche `transactions.recurring_rule_id` vive
  solo nel database. Recuperare `recurring_rules` ha chiuso un buco, non tutti.
  Tracciato nella **issue #43**, con la tecnica di ricostruzione e le query pronte.

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
- Gli account solo-OAuth non hanno `identities` con provider `email`:
  per loro cambio email e cambio password sono disabilitati (`hasPasswordIdentity`).

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

- Ogni tabella Supabase DEVE avere RLS abilitato — non creare tabelle senza policy
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
20. Conti/wallet multipli — tabella `accounts` + `account_id` su transactions + trasferimenti (feature STRUTTURALE: decide lo schema presto)
21. Import dati — CSV / estratto Trade Republic via file (nessuna API ufficiale TR: si importa un CSV, es. generato da `pytr`; l'app non gestisce credenziali)
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
