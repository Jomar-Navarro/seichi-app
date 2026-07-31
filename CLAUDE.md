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
└── layout.tsx            # root layout (forza tema .dark su <html>)

components/
├── UI/                   # Button, Input, Select, card, BrandHeader, OnboardingProgress,
│   │                     # SignTab, TransactionForm, TransactionModal, BottomNav,
│   │                     # SummaryCard, Sparkline, EmptyState, Avatar, PageHeader,
│   │                     # SettingsRow (+ SettingsGroup), PasswordInput,
│   │                     # PasswordStrength, SubmitButton, StatusScreen, AuthShell
├── features/             # BalanceCard, TransactionList, RecentTransaction, Filterbar,
│   │                     # GoalCard, GoalSheet, GoalsPageClient, InvestimentiTab,
│   │                     # HomeSkeleton, DashboardRefresher, AnalyticsTabs,
│   │                     # SpendingPieChart, MonthlyLineChart, ProfileEditor,
│   │                     # EmailChangeForm, PasswordChangeForm, DeleteAccountFlow,
│   │                     # ForgotPasswordForm, ResetPasswordForm
├── LoginForm.tsx, SignUpForm.tsx, PasswordField.tsx
└── icons.tsx             # GoogleIcon, FacebookIcon

lib/
├── supabase/             # client.ts, server.ts, proxy.ts (PUBLIC_PATHS)
├── seichi-icons.tsx      # set icone SVG custom (SeichiIcon)
├── icon-map.ts           # nome categoria → icona (Lucide)
├── goal-icons.ts         # GOAL_ICON_MAP + GOAL_ICONS
├── investment-types.ts   # INVESTMENT_TYPE_META (label + colore per tipo)
├── transaction-utils.ts  # TIPO_COLOR/LABEL, formatDate, formatAmount, numberFormatter
├── account.ts            # getAccountContext() — user + profilo per le impostazioni
├── profile.ts            # getInitials, getDisplayName
├── password.ts           # PASSWORD_MIN_LENGTH, scorePassword, validateNewPassword
└── safe-redirect.ts      # safeNext() — blocca gli open redirect sul parametro next

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

profiles: id (= auth.users.id), currency (TEXT), language (TEXT),
          full_name (TEXT, nullable), avatar_url (TEXT, nullable)
-- La riga nasce da un trigger on_auth_user_created (non più solo in onboarding);
--   full_name viene fatto backfill da auth.users.raw_user_meta_data.
-- Il nome NON si legge da user_metadata: quel campo è scrivibile dal client.

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
Attualmente il root layout **forza `.dark`** su `<html>`, quindi l'app rende sempre
dark; l'infrastruttura per lo switch esiste già.

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
```

I token semantici (`--surface`, `--card`, `--border`, `--text-*`, ecc.) sono
mappati sui nomi Tailwind in `@theme inline` → usare le classi (`bg-card`,
`bg-surface`, `border-subtle`, `text-muted`…), non gli hex.

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
17. Budget per categoria + Notifiche — limite mensile per categoria + tracking/avvisi di sforamento, e in più il sistema di notifiche completo (obiettivo a %, rinnovo abbonamento in anticipo, budget sforato). Tabella `notifications` + RLS, generazione via pg_cron/trigger, stato letto/non-letto (issue #10 + #29)
18. Tema chiaro/scuro — switch nelle impostazioni (infra `.dark` già presente; ora il root layout forza dark)
19. Lingua i18n (it/en) — collegare la preferenza `profiles.language` già salvata ma inattiva
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
- **Monetario**: DECIMAL(10,2) in DB, `Intl.NumberFormat` per display
