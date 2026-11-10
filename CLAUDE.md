# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Seichi (整地) — Personal Budgeting App

Next.js 16 App Router, TypeScript strict, Tailwind CSS v4, Supabase (cloud), Zustand, Recharts. PWA via next-pwa (Fase 15). Deploy su Vercel.

## Commands

```bash
npm run dev          # avvia dev server
npm run build        # build produzione
npm run lint         # eslint
npm test             # Vitest, le funzioni pure di lib/ (#155) — `test:watch` in sviluppo
npm run audit:eslint-rules # le regole di eslint scattano ancora (PR #185)
npm run audit:tokens # token e classi di colore (richiede una build) — vedi sotto

# collaudo end-to-end (#156) — su un Supabase LOCALE in Docker, mai la produzione
npm run e2e:db       # avvia il database locale, ricostruito dalle migration
npm run e2e:build    # costruisce l'app contro quel database (sovrascrive .next)
npm run test:e2e     # la suite Playwright su `next start -p 3200`
```

La CI (`.github/workflows/ci.yml`, #152) li esegue tutti da sola su ogni PR e
su master, più `audit:pwa-cache` e `npm audit --audit-level=high` sull'intero
albero; la suite end-to-end gira nel job `e2e`, accanto a `verifica`. Node:
`engines.node` in `package.json` (24.x), lo stesso per locale, CI e Vercel.
Vedi «CI (#152)» sotto «Dipendenze e avvisi di sicurezza» e «Collaudo
end-to-end (#156)».

## Project Structure

```
app/
├── (auth)/               # welcome, sign (login + signup), callback OAuth,
│   │                     # recupera-password + reimposta-password (+ actions.ts)
├── (onboarding)/         # start, preference, category + actions.ts
├── (main)/               # app autenticata:
│   ├── page.tsx          #   home dashboard + action.ts (server actions transazioni/totali)
│   │                     #   + budget-actions.ts, attachment-actions.ts (Fase 22:
│   │                     #   firma gli URL, e spezza le `.in()` — vedi IN_CHUNK)
│   │                     #   + app-lock-actions.ts (#125: l'UNICO che scrive il
│   │                     #   cookie del PIN — ITP tronca quelli di document.cookie)
│   ├── error.tsx         #   una pagina che solleva: frase + Riprova (#124)
│   ├── transazioni/      #   lista + filtri: page server sottile (conto ricordato)
│   │                     #   + actions.ts (getMovimentiData, #148) → MovimentiClient
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
│   │                     # DashedAddButton (il "Nuovo …" tratteggiato, #108),
│   │                     # SettingsRow (+ SettingsGroup), PasswordInput,
│   │                     # PasswordStrength, SubmitButton, StatusScreen, AuthShell,
│   │                     # Switch, FrequencySelector, DatePicker,
│   │                     # LoadError — una lettura fallita, MAI uno stato vuoto (#124)
├── features/             # BalanceCard, TransactionList, RecentTransaction, Filterbar,
│   │                     # GoalCard, GoalSheet, GoalsPageClient, InvestimentiTab,
│   │                     # HomeSkeleton, DashboardRefresher, AnalyticsTabs,
│   │                     # SpendingPieChart, MonthlyLineChart, ProfileEditor,
│   │                     # EmailChangeForm, PasswordChangeForm, DeleteAccountFlow,
│   │                     # ForgotPasswordForm, ResetPasswordForm, NotificationBell,
│   │                     # ImportFlow (+ AccountPicker, ImportHistory),
│   │                     # AttachmentPicker — ricevute; PROPRIETARIO UNICO della
│   │                     #   coda in attesa, il form gliela chiede (Fase 22),
│   │                     # ThemeProvider (+ useTheme), ThemeToggle, ThemeSection,
│   │                     # I18nProvider (+ useI18n),
│   │                     # ViewedAccount (+ useViewedAccount) — il conto che la
│   │                     #   pagina guarda, proposto al nuovo movimento (#112)
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
├── amount.ts             # #119 — gli importi SCRITTI A MANO: parseAmountInput
│                         #   (virgola e punto, migliaia; l'ambiguo lo decide la
│                         #   lingua), formatAmountInput, i tasti del tastierino,
│                         #   isStorableAmount per le server action — DECIMAL(10,2)
├── thousands.ts          # #155 — couldBeThousandsGroup(): la regola delle migliaia
│                         #   che amount.ts e import/csv.ts condividono
├── *.test.ts             # #155 — test Vitest accanto ai moduli (`npm test`)
├── attachments.ts        # Fase 22 — bucket, limiti, MIME, TTL della firma,
│                         #   ATTACHMENT_MAX_EDGE. ⚠️ client-safe TRANNE
│                         #   receiptPath(): crypto.randomUUID() vuole un
│                         #   contesto sicuro, che in LAN su HTTP non c'è
├── storage-files.ts      # #120 — cancellazioni dallo Storage: removeStorageFiles
│                         #   (blocchi da 1000) e purgeStorageFolder (giri sulla
│                         #   prima pagina finché è vuota). Fuori da "use server"
├── attachment-paths.ts   # #120 — receiptPathsOf(): i file da togliere PRIMA di
│                         #   una cascata (movimento, categoria, import)
├── offline-revision.mjs  # #127 — la revisione di /~offline nel precache:
│                         #   hash delle ALTRE voci del manifest. JS perché la
│                         #   usa anche audit:pwa-cache, che la ricalcola
├── read-all.ts           # readAll() — il lettore a blocchi (era `leggiTutte`
│                         #   di /analisi): ordinamento totale + fusibile
├── errors.ts             # #124 — genericError() (log + frase del dizionario) e
│                         #   authErrorMessage(): nessun testo del server a schermo
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
│                         #   getSidebarProfile() — footer della sidebar (#108), non
│                         #   rifiuta MAI; countActiveAccounts() — la query UNA sola
├── profile.ts            # getInitials, getDisplayName
├── password.ts           # PASSWORD_MIN_LENGTH, scorePassword, validateNewPassword
├── notifications.ts      # icone/colori per tipo + renderNotification (frasi dal payload)
├── safe-redirect.ts      # safeNext() — blocca gli open redirect sul parametro next
├── sidebar.ts            # cookie "la rail si vede qui": il layout salta le query
│                         #   del footer sul telefono (review post-merge #108)
└── theme.ts              # tipi, cookie e risoluzione del tema (Fase 18)

supabase/migrations/      # SQL da eseguire a mano nel SQL Editor di Supabase
supabase/config.toml      # il Supabase LOCALE dei test end-to-end (#156) — non la produzione

tests/e2e/                # #156 — scenari Playwright (`*.spec.ts`), uno per difetto
│                         #   storico; support/ = account di prova, dati, gesti
scripts/e2e.mjs           # #156 — `db` (supabase start) e `build` (l'app contro il
                          #   database locale + il marcatore che global-setup pretende)

store/  useUIStore.ts      # Zustand: modal transazioni, edit, refresh trigger,
                           #   conto guardato dalla pagina (#112, vedi ViewedAccount)
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
- **PWA**: Serwist (`@serwist/turbopack`) — `app/manifest.ts` nativo + service
  worker a precache minimo (Fase 25). ⚠️ Non `next-pwa`: è un plugin webpack,
  e Next 16 usa Turbopack di default per `next dev` **e** `next build` — un
  plugin webpack non si aggancia più alla pipeline. Era il nome scritto qui
  prima della Fase 25; è rimasto perché nessuno l'aveva ancora verificato
  contro i doc di questa versione

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
`card-shadow-ring`, `box-shadow-ring`, `modal-shadow-ring`, `ring-border`,
`transaction-type-card`, `btn-primary`, `fab`, `segment-tab`, `active-tab`,
`circle-1`, `circle-3`, `zg-pulse` (+ keyframes `zg-breathe`, `zg-pulse`)

### Regole stilistiche

- Border radius: 24–32px per card e modal, 12px per elementi interni
- Borders: 1px, opacità bassissima (`rgba(255,255,255,0.10)`) — ⚠️ **mai un
  `border` vero su un elemento arrotondato**: vedi issue #81 subito sotto. Il
  bordo si esprime come anello (`ring-border`/`card-shadow-ring`/
  `modal-shadow-ring`/`box-shadow-ring`), non come proprietà `border`.
- Glass card: `background: rgba(255,255,255,0.06)`, `backdrop-filter: blur(12px)`
- Shadows: soffuse e diffuse, mai nere

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
- **`anon` non ha privilegi in `public`** (#154): né sulle tabelle né sulle
  funzioni, e i default di `postgres` fanno nascere così anche gli oggetti
  nuovi. Nessuna richiesta senza sessione legge una tabella. Se un giorno una
  pagina pubblica ne avesse bisogno, si concede quella tabella e quel
  privilegio in una migration che dica perché, mai un grant generale.
  ⚠️ Il rovescio: una funzione che `postgres` crea **fuori** da `public` e
  `storage` (uno schema `private` per le policy, per esempio) nasce eseguibile
  solo dal proprietario. L'`execute` ad `authenticated` si concede nella stessa
  migration, o ogni policy che la chiama risponde `permission denied for function`
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
- PWA viene aggiunta solo a progetto completato (Fase 25)
- Server Actions (`"use server"`) per tutte le operazioni DB — mai chiamate API REST dirette.
  ⚠️ **Un'eccezione, dichiarata**: le LETTURE di conti e categorie dei moduli
  (`components/UI/useClientRows.ts`, #150) partono dal browser, con la RLS a
  limitare le righe. Next spedisce le server action una alla volta, e come
  server action finirebbero in coda dietro a quelle della pagina sotto (#122,
  #148). Solo letture: ogni SCRITTURA resta una server action
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
- **Ogni animazione dice cosa fa con `prefers-reduced-motion`**, accanto alla
  propria definizione in `globals.css`: si ferma, lascia uno stato fermo che
  dica la stessa cosa, o resta per una ragione scritta lì. Uno scorrimento da
  JavaScript passa da `scrollBehavior()` (`lib/motion.ts`), e un grafico
  Recharts lascia `isAnimationActive` a `"auto"` invece di `true` (#153)

## Key Decisions

- **Storage**: Supabase cloud (multi-device, non localStorage)
- **Auth**: Supabase Auth con RLS — ogni utente vede solo i propri dati
- **Email confirmation**: abilitata — dopo signup l'utente vede "controlla la tua email" nella stessa pagina (nessun redirect)
- **Onboarding gate**: `profiles.currency` è il flag — NULL = onboarding non completato
- **State globale**: Zustand (`store/useUIStore.ts`) per stato UI — modal transazione, edit, trigger di refresh, conto guardato dalla pagina (#112). I dati DB arrivano dai server components / server actions, non sono in Zustand
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
