# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Seichi (整地) — Personal Budgeting App

Next.js 15 App Router, TypeScript strict, Tailwind CSS v4, Supabase (cloud), Zustand, Recharts. PWA via next-pwa. Deploy su Vercel.

## Commands

```bash
npm run dev          # avvia dev server
npm run build        # build produzione
npm run lint         # eslint
```

## Project Structure

```
app/
├── (auth)/               # welcome, sign (login + signup), callback
├── (onboarding)/         # start, preference, category + actions.ts
├── (main)/               # dashboard (da costruire)
└── layout.tsx            # root layout

components/
├── UI/                   # Button, Input, Card, Select, BrandHeader,
│   │                     # OnboardingProgress, SignTab
├── LoginForm.tsx
├── SignUpForm.tsx
├── PasswordField.tsx
└── icons.tsx             # GoogleIcon, FacebookIcon

lib/
└── supabase/             # client.ts, server.ts, proxy.ts
```

## Stack

- **Framework**: Next.js 15 App Router
- **Language**: TypeScript strict (`"strict": true`)
- **Styling**: Tailwind CSS v4 con token Zen Glass custom
- **Database**: Supabase cloud (PostgreSQL)
- **Auth**: Supabase Auth (JWT + Row Level Security) — email confirmation abilitata
- **State**: Zustand (da aggiungere dalla Fase 7)
- **Charts**: Recharts (da aggiungere dalla Fase 9)
- **Icons**: Lucide React (outline only)
- **PWA**: next-pwa (aggiunta alla fine)

## Database Schema

```sql
-- Sempre usare UUID, mai INT per gli ID
-- Ogni tabella ha RLS abilitato

profiles: id (= auth.users.id), currency (TEXT), language (TEXT)

categories: id, user_id, name (TEXT), icon (TEXT), color (TEXT),
            type (TEXT), created_at
-- type values: 'spesa' | 'entrata' | 'investimento' | 'risparmio' | 'abbonamento'
-- Vincolo DB: categories_type_check

transactions: id, user_id, importo (DECIMAL 10,2), tipo (TEXT),
              categoria_id, investment_type, data (TIMESTAMP),
              note, is_ricorrente, frequenza (TEXT), parent_id, created_at
-- frequenza values: 'settimanale' | 'mensile' | 'annuale'
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

### Token CSS (definiti in globals.css)

```css
--color-yoru: #0f1624    /* background */
--color-kage: #161e30    /* surface card */
--color-hane: #1e2a40    /* glass overlay */
--color-tsuki: #e8edf5   /* testo primario */
--color-kiri: #8a97b0    /* testo secondario */
--color-midori: #4db89a  /* entrate / positivo */
--color-aka: #e06b6b     /* uscite / negativo */
--color-ao: #7b9fe0      /* investimenti */
--color-kin: #c4a85a     /* risparmi / goals */
--color-murasaki: #9b7fd4 /* ricorrenti */
```

### Utility classi custom (globals.css)

`onboarding-blur`, `circle-1`, `circle-3`, `card-shadow`, `deep-shadow`,
`bg-surface`, `bg-surface-elevated`, `border-glass-border`

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
- Componenti UI in `components/UI/`, logica di business in `components/features/` (da creare)
- Per i grafici usare sempre Recharts, non installare altre librerie chart
- Le transazioni ricorrenti usano pg_cron + Supabase Edge Functions (Fase 13)
- PWA viene aggiunta solo a progetto completato (Fase 14)
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
7. TransactionForm + CategoryDropdown
8. Lista transazioni + FilterBar
9. Homepage dashboard con totali
10. Statistiche + grafici Recharts
11. Savings + goals con ProgressBar
12. Investimenti + breakdown portafoglio
13. Impostazioni + categorie custom
14. Transazioni ricorrenti (pg_cron + Edge Functions)
15. PWA: manifest.json + Service Worker
16. Responsive tablet + ottimizzazione mobile
17. Animazioni: transizioni morbide, micro-interazioni

## Key Decisions

- **Storage**: Supabase cloud (multi-device, non localStorage)
- **Auth**: Supabase Auth con RLS — ogni utente vede solo i propri dati
- **Email confirmation**: abilitata — dopo signup l'utente vede "controlla la tua email" nella stessa pagina (nessun redirect)
- **Onboarding gate**: `profiles.currency` è il flag — NULL = onboarding non completato
- **State globale**: Zustand per transactions, categories, theme, settings (dalla Fase 7)
- **Ricorrenti**: generazione automatica lato server con pg_cron (non al login)
- **Monetario**: DECIMAL(10,2) in DB, `Intl.NumberFormat` per display
