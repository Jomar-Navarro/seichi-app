# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Seichi (整地) — Personal Budgeting App

Next.js 15 app router, TypeScript strict, Tailwind CSS, Supabase, Zustand, Recharts. PWA via next-pwa. Deploy su Vercel.

## Commands

```bash
npm run dev          # avvia dev server
npm run build        # build produzione
npm run lint         # eslint
npx supabase start   # avvia supabase locale
npx supabase db push # applica migrations
```

## Project Structure

```
src/
├── app/                  # Next.js app router (pagine e layout)
│   ├── (auth)/           # login, register
│   ├── (app)/            # dashboard, transactions, statistics,
│   │   │                 # savings, investments, settings
│   └── layout.tsx        # root layout con provider
├── components/
│   ├── ui/               # Button, Input, Card, Badge, ProgressBar
│   └── features/         # TransactionForm, CategoryDropdown,
│                         # FilterBar, TransactionList, StatCard
├── lib/
│   ├── supabase/         # client, server, middleware
│   └── utils/            # helpers, formatters
├── store/                # Zustand store (transactions, categories,
│                         # settings, theme)
└── types/                # TypeScript types globali
```

## Stack

- **Framework**: Next.js 15 App Router
- **Language**: TypeScript strict (`"strict": true`)
- **Styling**: Tailwind CSS con token Zen Glass custom
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (JWT + Row Level Security)
- **State**: Zustand
- **Charts**: Recharts
- **Icons**: Lucide React (outline only)
- **PWA**: next-pwa (aggiunta alla fine)

## Database Schema

```sql
-- Sempre usare UUID, mai INT per gli ID
-- Ogni tabella ha RLS abilitato

categories: id, user_id, nome, icona, colore, tipo (ENUM), created_at
transactions: id, user_id, importo (DECIMAL 10,2), tipo (ENUM),
              categoria_id, investment_type, data (TIMESTAMP),
              note, is_ricorrente, frequenza (ENUM), parent_id, created_at
```

ENUMs tipo: `spesa | entrata | investimento | risparmio`
ENUMs frequenza: `settimanale | mensile | annuale`

## Design System — Zen Glass

Stile ispirato al minimalismo giapponese. Superfici come vetro satinato, pietra, carta di riso. Mai effetti cyber o plastic glass.

### Token CSS (definiti in globals.css)

```css
--color-yoru: #0f1624 /* background */ --color-kage: #161e30 /* surface card */
	--color-hane: #1e2a40 /* glass overlay */ --color-tsuki: #e8edf5
	/* testo primario */ --color-kiri: #8a97b0 /* testo secondario */
	--color-midori: #4db89a /* entrate / positivo */ --color-aka: #e06b6b
	/* uscite / negativo */ --color-ao: #7b9fe0 /* investimenti */
	--color-kin: #c4a85a /* risparmi / goals */ --color-murasaki: #9b7fd4
	/* ricorrenti */;
```

### Regole stilistiche

- Border radius: 24–32px per card e modal, 12px per elementi interni
- Borders: 1px, opacità bassissima (`rgba(255,255,255,0.10)`)
- Glass card: `background: rgba(255,255,255,0.06)`, `backdrop-filter: blur(12px)`
- Shadows: soffuse e diffuse, mai nere
- Typography: Inter, sentence case ovunque, mai title case
- Icons: Lucide outline, stroke uniforme, mai filled

## Rules

- Ogni tabella Supabase DEVE avere RLS abilitato — non creare tabelle senza policy
- Usare `DECIMAL(10,2)` per tutti i valori monetari, mai float
- UUID per tutti gli ID, mai INT sequenziali
- Variabili Supabase sempre in `.env.local`, mai hardcoded
- I colori delle categorie finanziarie seguono il design system:
  verde = entrate, rosso = uscite, blu = investimenti, oro = risparmi
- Componenti UI in `components/ui/`, logica di business in `components/features/`
- Per i grafici usare sempre Recharts, non installare altre librerie chart
- Le transazioni ricorrenti usano pg_cron + Supabase Edge Functions (Fase 13)
- PWA viene aggiunta solo a progetto completato (Fase 14)

## Implementation Order

Seguire questo ordine, non saltare fasi:

1. Setup Next.js + Tailwind + TypeScript
2. Token Zen Glass in globals.css
3. Supabase: progetto + tabelle + RLS
4. Auth: login, register, sessione, middleware
5. Componenti base: Button, Input, Card, Badge, ProgressBar
6. TransactionForm + CategoryDropdown
7. Lista transazioni + FilterBar
8. Homepage dashboard con totali
9. Statistiche + grafici Recharts
10. Savings + goals con ProgressBar
11. Investimenti + breakdown portafoglio
12. Impostazioni + categorie custom
13. Transazioni ricorrenti (pg_cron + Edge Functions)
14. PWA: manifest.json + Service Worker
15. Responsive tablet + ottimizzazione mobile
16. Animazioni: transizioni morbide, micro-interazioni

## Key Decisions

- **Storage**: Supabase (multi-device, non localStorage)
- **Auth**: Supabase Auth con RLS — ogni utente vede solo i propri dati
- **State globale**: Zustand per transactions, categories, theme, settings
- **Ricorrenti**: generazione automatica lato server con pg_cron (non al login)
- **Monetario**: DECIMAL(10,2) in DB, `Intl.NumberFormat` per display
