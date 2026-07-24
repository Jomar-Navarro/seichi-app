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
├── (auth)/               # welcome, sign (login + signup) + callback OAuth
├── (onboarding)/         # start, preference, category + actions.ts
├── (main)/               # app autenticata:
│   ├── page.tsx          #   home dashboard + action.ts (server actions transazioni/totali)
│   ├── transazioni/      #   lista + filtri
│   ├── risparmi/         #   obiettivi + actions.ts (getGoals, getInvestments, CRUD goal)
│   ├── investimenti/     #   breakdown portafoglio
│   ├── analisi/          #   statistiche + grafici
│   └── impostazioni/     #   stub (Fase 13)
└── layout.tsx            # root layout (forza tema .dark su <html>)

components/
├── UI/                   # Button, Input, Select, card, BrandHeader, OnboardingProgress,
│   │                     # SignTab, TransactionForm, TransactionModal, BottomNav,
│   │                     # SummaryCard, Sparkline, EmptyState
├── features/             # BalanceCard, TransactionList, RecentTransaction, Filterbar,
│   │                     # GoalCard, GoalSheet, GoalsPageClient, InvestimentiTab,
│   │                     # HomeSkeleton, DashboardRefresher, AnalyticsTabs,
│   │                     # SpendingPieChart, MonthlyLineChart
├── LoginForm.tsx, SignUpForm.tsx, PasswordField.tsx
└── icons.tsx             # GoogleIcon, FacebookIcon

lib/
├── supabase/             # client.ts, server.ts, proxy.ts
├── seichi-icons.tsx      # set icone SVG custom (SeichiIcon)
├── icon-map.ts           # nome categoria → icona (Lucide)
├── goal-icons.ts         # GOAL_ICON_MAP + GOAL_ICONS
├── investment-types.ts   # INVESTMENT_TYPE_META (label + colore per tipo)
└── transaction-utils.ts  # TIPO_COLOR/LABEL, formatDate, formatAmount, numberFormatter

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

profiles: id (= auth.users.id), currency (TEXT), language (TEXT)

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
              notes (TEXT), created_at
-- Colonne ricorrenti (is_ricurrent, frequency) previste per Fase 14
```

## Auth Flow

- `/welcome` → landing page pre-auth
- `/sign?tab=signup` → registrazione → dopo submit mostra "controlla la tua email" (nessun redirect)
- `/sign` → login → dopo login controlla `profiles.currency`: se NULL → `/start`, altrimenti → `/`
- `/callback` → gestisce OAuth (Google/Facebook) e verifica email → stesso check su `profiles.currency`
- Onboarding: `/start` → `/preference` → `/category` → `/`
- `savePreferences()` fa upsert su `profiles` (currency, language)
- `saveCategories()` cancella le categorie onboarding esistenti e reinserisce quelle selezionate

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
- Le transazioni ricorrenti usano pg_cron + Supabase Edge Functions (Fase 14)
- PWA viene aggiunta solo a progetto completato (Fase 15)
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
13. Impostazioni + categorie custom  ← prossima
14. Transazioni ricorrenti (pg_cron + Edge Functions)
15. PWA: manifest.json + Service Worker
16. Mobile nativo — comportamento su dispositivo reale (vedi sotto)
17. Responsive tablet + desktop
18. Animazioni: transizioni morbide, micro-interazioni

### Fase 16 — Mobile nativo (checklist)

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
