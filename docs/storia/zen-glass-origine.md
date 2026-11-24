# Zen Glass — la filosofia, e come è nato il linguaggio visivo

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

Scritta il 2026-11-24, all'inizio della Fase 30 (#225), quando Jomar ha
ritrovato il prompt da cui è nato l'aspetto dell'app. Il prompt è in appendice,
parola per parola. I principi che lo sostituiscono sono in
`docs/design/zen-glass-v2.md`.

### Il nome

整地, *seichi*, è la sistemazione del terreno: il lavoro che si fa prima di
costruire, quando si toglie ciò che ingombra, si livella e si tracciano i
confini. Da lì vengono la frase della pagina di benvenuto, «Prepara il terreno
prima di costruire. Metti in ordine le tue finanze — con calma e intenzione.», e
la didascalia sotto il nome, «整地 · ordine finanziario».

L'idea è che il budget non sia un esercizio di rinuncia ma di ordine: prima si
vede dove sta il denaro, poi si decide cosa costruirci sopra.

### La filosofia

Il prompt la dice con una serie di parole: *calm, intentional, balanced,
natural, quiet, timeless*. E con tre esclusioni, che pesano più delle parole:
**non un'app di cripto, non una piattaforma di trading, non il cruscotto di una
banca**. Seichi non deve eccitare né allarmare: si apre dieci volte al giorno e
deve restare quieta.

Da lì il nome del linguaggio visivo, **Zen Glass**:

- **minimalismo giapponese**: carta di riso, pietra, legno chiaro; ombre
  soffuse, mai nere; niente effetti cyber o plastica;
- **vetro satinato**: le superfici lasciano intravedere il fondo, un gradiente
  radiale caldo con due aloni che respirano piano ai bordi;
- **i colori giapponesi come significati**, non come decorazione: *midori*
  (verde) le entrate, *aka* (rosso terra) le spese, *ao* (blu) gli investimenti,
  *kin* (oro) i risparmi, *murasaki* (viola) le ricorrenze; *tsuki* (luna) e
  *kami* (carta) le superfici, *yoru* (notte) e *kage* (ombra) il testo, *kiri*
  (nebbia) e *hai* (cenere) i toni spenti;
- **raggi morbidi** (24-32 px le card, 12 gli elementi interni), icone Lucide
  al tratto, nessuna maiuscola iniziale su ogni parola.

### Come è nato

- **2026-06-26**, il progetto Next.js. Il **2026-06-29** il primo riordino degli
  stili globali e il **2026-07-03** «Redesign auth screens with unified sign
  page and glass UI»: il vetro arriva con le schermate d'accesso, prima ancora
  dei dati. Nell'ordine delle fasi è la Fase 2, «Token Zen Glass in
  globals.css», subito dopo il setup (`ordine-delle-fasi`).
- **Il metodo**: un prompt per Claude Design, con una sezione di sistema (0) e
  una di contesto tecnico (0c) da incollare sempre, più un prompt per ogni
  schermata. Le schermate venivano disegnate fase per fase nel progetto Claude
  Design «Seichi budgeting app homepage» (`Seichi Dashboard.dc.html`, «Stati
  Supporto», `Seichi Conti.dc.html`, `Seichi Importa CSV.dc.html`,
  `PinCard.dc.html`, il mockup desktop della #108), e poi costruite.
- **Il prompt è cresciuto con l'app.** Nella versione in appendice le fasi
  1-19 sono «già costruite» e la 20 è «progettata ma non ancora costruita»: a
  giudicare da questo, l'ultimo aggiornamento è di poco dopo la Fase 18 (tema,
  2026-08-05) e prima della 20a (conti, progettata il 2026-08-10). Dentro ci
  sono già le lezioni pagate fino a lì: accento ≠ inchiostro, la ciambella in
  un colore solo, il `DatePicker` al posto del calendario nativo.

### Dove l'app si è allontanata dal prompt, di proposito

Ogni fase ha letto il mockup e ne ha scartato una parte, con la ragione scritta:

- **Fase 17**: due notifiche del mockup non si fanno (stipendio registrato,
  movimento registrato: le dice già la banca); la soglia degli obiettivi solo a
  50% e 100% (`fase-17-budget-notifiche`).
- **Fase 20a**: la home perde «Saldo totale», che il mockup proponeva e che
  confondeva il flusso con la giacenza (`fase-20a-conti`).
- **Fase 26a e 26b**: il PIN passa a sei cifre; lo **ensō** prende il posto del
  germoglio sulla schermata di sblocco, «qui soltanto», per scelta esplicita di
  Jomar (`fase-26a-pin`, `fase-26b-biometrico`).
- **Fase 28e**: lo ensō anche in testa alla barra laterale, di nuovo «qui
  soltanto» (commento in `components/UI/Sidebar.tsx`).

### Dove si è allontanata senza volerlo

Trovato nella ricognizione del 2026-11-24 (#225):

- **Il carattere.** Il prompt dice Inter. La 26b scarta Inter perché «l'app usa
  Geist ovunque, confermato in `app/layout.tsx`». In realtà `layout.tsx`
  carica Geist e ne dichiara la variabile, ma nessuna regola la applica: sullo
  schermo c'è il font di sistema (Segoe UI su Windows, San Francisco su iPhone,
  Roboto su Android). La verifica aveva letto l'import, non lo schermo: un font
  si controlla con `getComputedStyle`. È la lezione 9 di `CLAUDE.md`, «build
  verde non è app funzionante», in una forma nuova.
- **Le misure.** Il prompt non fissa una scala: nel codice ci sono 297
  dimensioni di testo scritte a mano, in 30 valori, e 20 raggi.
- **Le varianti.** Il prompt descrive ogni schermata per conto suo, e nessuna
  regola dice che un bottone principale è uno: oggi ne esistono tre stili, due
  righe di movimento, due forme di progresso.
- **Le maiuscole.** Il prompt chiede il minuscolo di frase ovunque; l'app ha
  etichette in maiuscolo spaziato e azioni tutte in minuscolo.

### Perché il prompt ha prodotto l'effetto «generato»

Detto da Jomar il 2026-11-22, aprendo la #225: «c'è troppo AI slop, si nota che
è vibe codata». Rileggendo il prompt, le ragioni sono nel suo modo di essere
scritto più che nei singoli mockup:

1. **I principi erano aggettivi.** «Quiet, grounded, elegant, premium» non
   escludono niente. Dove il prompt taceva, ogni mockup ha riempito il vuoto con
   le scelte di default di chi disegna, cioè proprio l'aspetto riconoscibile
   del design generato.
2. **Era un inventario, non un sistema.** Nove decimi descrivono che cosa sta in
   ogni schermata e con quale componente; un decimo dice come si decide. Mancano
   la scala tipografica, la scala delle spaziature, quando qualcosa è una card,
   la densità, dove vanno le spiegazioni, come si chiamano le pagine, cosa non
   fare.
3. **Era scritto per fasi.** Ogni schermata progettata da sola porta i suoi
   componenti: le varianti sono la conseguenza naturale.
4. **Prescriveva alcune decorazioni.** Una `Sparkline` in ogni card di
   riepilogo e in ogni posizione d'investimento, gli aloni anche in home,
   «Esci» nell'inchiostro del pericolo.
5. **Mescolava progetto e implementazione.** Classi Tailwind, colonne del
   database e nomi di componenti, che a chi disegna non servono e gli tolgono
   attenzione.

Ciò che invece ha retto è quanto era scritto come regola con il suo perché:
accento e inchiostro, la ciambella monocromatica («never a rainbow of
unrelated colors implying a distinction of kind that isn't there»), i 44 px,
il minuscolo di frase. La v2 prova a scrivere tutto in quella forma.

---

## Appendice — il prompt originale

Conservato com'era, senza correzioni: alcune affermazioni non sono più vere
(la Fase 20 «non ancora costruita», Inter, componenti che non esistono più).

````markdown
# Seichi — Zen Glass: prompt per Claude Design

Allineato a `globals.css` e `CLAUDE.md` reali (Next.js 16, Supabase). Tema doppio light/dark, tre stati (chiaro/scuro/sistema) via cookie — dalla Fase 18 il root layout non forza più nulla, ma alla primissima visita senza cookie rende comunque scuro di default. Fasi 1–19 ✅ già costruite (mockup mantenuti come riferimento, corretti dove il codice reale differiva dal disegno). Fase 20 (conti/trasferimenti) è **progettata per intero ma non ancora costruita** — la sezione 15 riflette lo schema reale, non più una proposta.

Come usarli: incolla sempre prima **0** e **0c**, poi il prompt della schermata.

---

## 0. Prompt di sistema — Zen Glass (da includere sempre)

> Design in "Zen Glass," a proprietary design language for Seichi (整地), a premium personal finance app inspired by Japanese philosophy — calm, intentional, balanced, natural, quiet, timeless. Not a crypto app, not a trading platform, not a traditional banking dashboard. Dual theme: light (default) and dark, toggled via a `.dark` class, user-chosen with three states (chiaro/scuro/sistema) — design both light and dark for every screen.
>
> **Background**: not a flat fill — a soft radial gradient. Light: `radial-gradient(ellipse at 50% 0%, #f5f1e8, #ece6da 50%, #e6dfd1 100%)`. Dark: `radial-gradient(120% 90% at 50% 0%, #1a2436 0%, #151d2b 60%, #101723 100%)`. Two ambient glow blobs sit at the page edges, softly breathing (scale 1→1.05, opacity 0.6→0.88, ~15–18s loop): one top-right in muted midori-green, one bottom-left in muted kin-gold — present on onboarding, auth, AND the home dashboard. Atmosphere, not a foreground illustration — subtle, out of the way of content.
>
> **Color tokens**: neutrals shift between themes; functional colors stay the same role in both. Light — surface `--color-tsuki` #f5f1e8, secondary surface `--color-kami` #ece6da, primary text `--color-yoru` #33373d, secondary text `--color-kage` #4a4e45, muted text `--color-kiri` #8e887b (not redefined in `.dark` — always use the semantic `text-muted` class, never this as a fixed color), disabled text `--color-hai` #9a9384; entrata `--color-midori` #6f8a63, spesa `--color-aka` #b47358, investimento `--color-ao` #6e86a8, risparmio `--color-kin` #ae8b49, ricorrente/abbonamento `--color-murasaki` #8a6fc4. Dark — primary text #e6e9ef, secondary #c7cdda, muted #8892a6, disabled #6e7688; same five accents shift to #67b89a / #cc8c74 / #7b9fe0 / #d4b26a / #9b7fd4.
>
> **Accent ≠ ink.** The five accent colors above are tuned to stand out — perfect as fills, pills, borders, icons, chart slices. As TEXT on a light background they read around 3.2:1, under WCAG AA's 4.5:1. For text, use the "ink" variant of each instead: ink-midori #5c7350, ink-aka #96543d, ink-ao #4c6588, ink-kin #7f6229, ink-murasaki #6b4fa8 (plus a neutral fallback ink-kiri #6b6558). In dark mode ink and accent are the same value. Icons always stay on the full accent, never the ink variant. Anything sitting ON TOP of a solid accent fill (a switch knob, a checkmark, a badge) uses an "on-accent" color — white in light mode, near-black (#131a28) in dark mode — never a hardcoded white, since the accents themselves flip brightness between themes.
>
> **Glass surfaces**: card background is a low-opacity neutral wash over the gradient — light: `rgba(255,255,255,0.45–0.7)` depending on elevation; dark: `rgba(230,233,239,0.05–0.13)`; `backdrop-filter: blur(12–24px)`. Border 1px, barely visible. Shadows soft and diffuse, never harsh, never pure black.
>
> **Corners**: 24–32px on cards/modals, 12px on inner elements. **Typography**: Inter, sentence case everywhere, never Title Case — and never a generic template like "nuova {tipo}" that assumes a fixed grammatical gender; write full phrases per case instead. **Iconography**: Lucide React outline (plus a small custom outline SVG set, `SeichiIcon`, for a few brand-specific marks). **Charts**: category breakdowns (e.g. spending by category) use a MONOCHROMATIC scale derived from the relevant accent (e.g. shades of aka for an all-expense donut) — never a rainbow of unrelated colors implying a distinction of kind that isn't there; slice separators use the page's secondary background color, never a fixed neutral. **Motion**: soft settling, gentle breathing, no snapping. **Accessibility**: WCAG AA, touch targets ≥44×44px.
>
> Mood words: quiet, grounded, intentional, natural, balanced, elegant, editorial, Japanese, premium, warm minimalism.

---

## 0c. Contesto tecnico e funzionale (da includere insieme a 0)

> App context: Seichi is a mobile-first PWA on Next.js 16 App Router, Tailwind CSS v4, Supabase. Routes: `(auth)` group → `/welcome`, `/sign` (`?tab=login`/`?tab=signup`), `/callback`, `/recupera-password`, `/reimposta-password`; `(onboarding)` group → `/start` → `/preference` → `/category`; `(main)` group → `/` (home dashboard), `/transazioni`, `/risparmi`, `/investimenti`, `/analisi`, `/impostazioni` (+ sub-routes `/profilo`, `/email`, `/password`, `/elimina`, `/categorie`, `/ricorrenti`). Bottom nav (`BottomNav`) fixed at the bottom on every `(main)` screen — respect safe-area insets and `dvh` units. Inputs font-size ≥16px, touch targets ≥44×44px.
>
> Reuse existing components — UI: `Button`, `Input`, `Select`, `card`, `BrandHeader`, `OnboardingProgress`, `SignTab`, `TransactionForm`, `TransactionModal`, `BottomNav`, `SummaryCard`, `Sparkline`, `EmptyState`, `Avatar`, `PageHeader`, `SettingsRow`/`SettingsGroup`, `PasswordInput`, `PasswordStrength`, `SubmitButton`, `StatusScreen`, `AuthShell`, `Switch`, `FrequencySelector`, `DatePicker` (a custom date picker — replaces the native `<input type="date">`, which rendered `mm/dd/yyyy` regardless of the app's language). Features: `BalanceCard`, `TransactionList`, `RecentTransaction`, `Filterbar`, `GoalCard`, `GoalSheet`, `GoalsPageClient`, `InvestimentiTab`, `HomeSkeleton`, `DashboardRefresher`, `AnalyticsTabs`, `SpendingPieChart`, `MonthlyLineChart`, `ProfileEditor`, `EmailChangeForm`, `PasswordChangeForm`, `DeleteAccountFlow`, `ForgotPasswordForm`, `ResetPasswordForm`, `NotificationBell`, `ThemeProvider`/`ThemeToggle`/`ThemeSection`, `I18nProvider`, `GlobalBudgetSection`, `ProfileMenu`. Auth: `LoginForm`, `SignUpForm`, `PasswordField`, `GoogleIcon`/`FacebookIcon`.
>
> **Data taxonomy**: a transaction has `type` — **entrata** (midori), **spesa** (aka), **investimento** (ao), **risparmio** (kin), or **abbonamento** (murasaki, same family as "ricorrente") — `amount`, `category_id`, `investment_type` (nullable), `date`, `notes`, `recurring_rule_id` (nullable). Colors/text pairs come from `TIPO_COLOR`/`TIPO_INK` in `lib/transaction-utils.ts` — fills use `TIPO_COLOR`, text uses `TIPO_INK`, never a raw hex. Labels come from the i18n dictionary, never a hardcoded string.
>
> **Goals are categories, not a separate table**: `type='risparmio'` + `target_amount`(+`target_date`). Saved amount derived from that category's transactions, never stored. Icons from `GOAL_ICON_MAP`/`lib/goal-icons.ts`.
>
> **Investments**: `investment_type` (ETF, Azioni, Obbligazioni, Crypto…) has its own label/color; individual `investimento` categories act as named holdings within a type.
>
> Amounts always via `formatAmount`/`Intl.NumberFormat` ("€ 1.240,00"), dates via `formatDate`/`DatePicker`, content in Italian by default (the app also has an English dictionary — mention if an English frame is wanted).

---

## 0d. Sistema icone (foglio di riferimento)

> Using the Zen Glass design language above, design a reference sheet for Seichi's icon system, both light and dark. All icons Lucide React outline.
>
> **Tipi di transazione** (per `TIPO_COLOR`/`TIPO_INK`) — entrata (midori), spesa (aka), investimento (ao), risparmio (kin), abbonamento (murasaki) — each shown neutral and tinted. Separately, `Repeat` in murasaki captioned "ricorrente — trasversale a qualsiasi tipo", and `ArrowRightLeft` in kiri (neutral) captioned "trasferimento — Fase 20, non ancora costruita".
>
> **Navigazione** (`BottomNav`) — Home, Receipt (Transazioni), PiggyBank (Risparmi), LineChart (Investimenti), ChartNoAxesCombined (Analisi), Settings (Impostazioni).
>
> **Categorie comuni** — Briefcase, ShoppingCart, Home, Car, Utensils, HeartPulse, GraduationCap, Landmark, Shield.
>
> **Icone obiettivi** — Plane, Car, Home, Heart, GraduationCap, Shield, Star, TrendingUp.
>
> **Sistema/azione** — Bell (with a numbered badge, 9+ beyond nine), Search, SlidersHorizontal, Plus, Pencil, Trash2 (aka), ChevronRight, X, Check, ArrowLeft, Eye/EyeOff, Calendar, User, LogOut.
>
> Layout: grouped blocks on a card surface, ≥32px spacing, 32–40px icons, Lucide name captioned in muted text. Deliver light and dark.

---

## 0b. `/welcome` — pagina di benvenuto (pre-accesso)

> Using the Zen Glass design language and app context above, design `/welcome`. Full-bleed radial-gradient background with the two ambient glow blobs; small logo mark near top; "Seichi" wordmark + "整地 · ordine finanziario" caption; philosophy headline ("Prepara il terreno prima di costruire. Metti in ordine le tue finanze — con calma e intenzione."). Bottom: primary `Button` ("Crea il tuo account"), secondary line "Hai già un account? Accedi" (midori link, ink variant for the text) → `/sign`. No progress indicator, no inputs.
>
> Deliver mobile, light and dark.

---

## 1. Onboarding — `/start` → `/preference` → `/category`

> Using the Zen Glass design language and app context above, design the three onboarding screens using `BrandHeader` + `OnboardingProgress` for the shared header/progress indicator, background gradient + ambient blobs behind all three.
>
> **`/start`**: logo, wordmark, philosophy line, primary `Button` ("Inizia →"), quiet "Ho già un account · Accedi" link.
> **`/preference`**: `Select` for valuta, `Select` for lingua, primary `Button` ("Continua").
> **`/category`**: 2-column grid of selectable `card`s covering all 5 types, icon + name, subtly filled state in the type's token color when selected, multi-select. Primary `Button` ("Completa la configurazione").
>
> Button always pinned bottom (`flex flex-col grow` + `w-full max-w-lg mx-auto pb-14`).
>
> Deliver mobile, light and dark, all three steps.

---

## 1b. `/sign` — login/registrazione, `/callback`

> Using the Zen Glass design language and app context above, design `/sign` using `SignTab`, `LoginForm`, `SignUpForm`, `PasswordField`.
>
> **Login**: email + `PasswordField`, "Password dimenticata?" link (→ `/recupera-password`, section 9b), primary `Button` ("Accedi"), "Non hai un account? Registrati". When reached with `?reset=1`, show a quiet inline confirmation banner above the form ("Password aggiornata — accedi di nuovo"), midori-ink text on a subtle card — design this as its own frame.
> **Signup**: nome, email, `PasswordField`, terms checkbox, primary `Button` ("Crea il tuo account"). On submit — no redirect — swap the form in place for the `StatusScreen` confirmation state ("Controlla la tua email per confermare la registrazione", Mail icon). Design this as its own frame.
> **SSO row**: divider "oppure" + `GoogleIcon`/`FacebookIcon` buttons.
> **`/callback`**: minimal loading screen, centered logo, soft pulsing glass block, "Un momento…".
>
> Deliver mobile, light and dark: login, login-with-reset-banner, signup, signup-confirmation, callback.

---

## 2. Fase 7 ✅ — Aggiungi/modifica transazione (`TransactionForm` in `TransactionModal`)

> Using the Zen Glass design language and app context above, design `TransactionModal` wrapping `TransactionForm` — dialog surface at the modal elevation, used for create and edit.
>
> Fields: `type` segmented control, all 5 values tinted per `TIPO_COLOR`; large `amount` `Input` ("€" prefix) as focal point; category picker filtered by `type`; for investimento, an `investment_type` `Select`; a `notes` `Input`; a `date` field using the `DatePicker` component (not a native date input). Primary `Button` ("Salva"); edit-mode-only "Elimina transazione" quiet aka-ink text link, no confirmation.
>
> Deliver mobile, light and dark, "Spesa" state with a category selected.

---

## 3. Fase 8 ✅ — `/transazioni` (`TransactionList` + `Filterbar`)

> Using the Zen Glass design language and app context above, design `/transazioni`: `Filterbar` (search + type/date filter, opens a small sheet) at top; `TransactionList` grouped by day, each row (`card` surface) with category icon/color, notes, category tag, amount tinted per `TIPO_COLOR` (text in the `TIPO_INK` variant); tapping opens `TransactionModal` pre-filled. `EmptyState` component for no results.
>
> Deliver mobile, light and dark, 8–10 realistic transactions across ≥2 days and all 5 types.

---

## 4. Fase 9 ✅ — `/` home dashboard (`BalanceCard`, `SummaryCard`, `Sparkline`)

> Using the Zen Glass design language and app context above, design `/`. Top bar: on the LEFT, a single clickable group — avatar, a greeting, and the user's name — that opens `ProfileMenu` (contains the binary light/dark `ThemeToggle`, a link to Impostazioni, sign out); on the RIGHT, `NotificationBell` in its own corner with a numbered badge, opening the notifications panel (section 13) — these are two separate pills, not one shared control. Below: `BalanceCard` with the period total, period selector, muted trend; four `SummaryCard`s (entrata/spesa/investimento/risparmio) each with icon, amount, and a `Sparkline`; `RecentTransaction` list (5–6 rows, murasaki `Repeat` badge on any recurring-generated row) with "Vedi tutte →" → `/transazioni`; FAB opening `TransactionModal`, positioned above `BottomNav` with safe-area padding; `BottomNav`. Ambient glow blobs present in the background here too.
>
> Deliver mobile, light and dark, realistic content.

---

## 5. Fase 10 ✅ — `/analisi` (`AnalyticsTabs`, `SpendingPieChart`, `MonthlyLineChart`)

> Using the Zen Glass design language and app context above, design `/analisi`: `AnalyticsTabs` (range or view switch) at top; `MonthlyLineChart` plotting entrata (midori) vs spesa (aka), thin strokes, minimal gridlines; `SpendingPieChart` breakdown by category — a MONOCHROMATIC scale of tonal aka shades only (every slice is an expense, so no other hue), slice separators in the page's secondary background color, not a fixed dark neutral; 2–3 short insight cards, calm and reassuring, no alarming colors.
>
> Deliver mobile, light and dark, realistic percentages summing to 100%.

---

## 6. Fase 11 ✅ — `/risparmi` (`GoalCard`, `GoalSheet`, `GoalsPageClient`)

> Using the Zen Glass design language and app context above, design `/risparmi`. Remember: a goal is a `category` with `type='risparmio'` + `target_amount`/`target_date` — saved amount is derived from that category's transactions, there is no separate goals table.
>
> **List** (`GoalsPageClient`): header "X attivi · Y completati" + "+ Nuovo"; each `GoalCard` — icon, name, circular ring progress (kin fill, kin-ink label, thin stroke, % centered), "€ saved di € target_amount", estimated date if `target_date` set, edit affordance. Completed: ring fully filled and desaturated, checkmark (`--on-accent` colored) replaces %.
>
> **`GoalSheet`** (create/edit): name, `target_amount` `Input`, `target_date` via `DatePicker` (optional), icon picker from `GOAL_ICON_MAP`. Primary `Button` ("Crea obiettivo"/"Salva modifiche"); edit-only "Elimina obiettivo" quiet aka-ink link.
>
> **Empty state**: `EmptyState` component, "Nessun obiettivo ancora" + CTA.
>
> Deliver mobile, light and dark: list (≥3 active + 1 completed), `GoalSheet` open, empty state (one theme is enough for this one).

---

## 7. Fase 12 ✅ — `/investimenti` (`InvestimentiTab`)

> Using the Zen Glass design language and app context above, design `/investimenti`. Breakdown groups `investimento` transactions by `investment_type`, styled per its own label + color (tonal variants of ao); individual `investimento` categories act as named holdings within a type (e.g. "PAC ETF Mondo" under ETF).
>
> Layout: summary card, total portfolio value + muted trend (ao-ink positive / aka-ink negative, desaturated); composition chart (donut/stacked bar, Recharts) by `investment_type`; list of holding cards — icon, name, investment_type tag, invested amount, allocation %, `Sparkline`.
>
> Deliver mobile, light and dark, ≥4 holdings across ≥2 investment_types.

---

## 8. Fase 13 ✅ — `/impostazioni` (lista) + `/impostazioni/categorie`

> Using the Zen Glass design language and app context above, design `/impostazioni` as a navigation list — `SettingsGroup`s of `SettingsRow`s, each row a link into its own sub-route rather than an inline sheet.
>
> **`/impostazioni` root**: `PageHeader` ("Impostazioni"); **Profilo** group — one row showing `Avatar` + name/email → `/impostazioni/profilo`; **Account** group — rows "Email" → `/impostazioni/email`, "Password" → `/impostazioni/password`; **Preferenze** group — `Select` valuta, `Select` lingua, `ThemeSection` (three-state chiaro/scuro/sistema selector), `GlobalBudgetSection` (the one global monthly budget — always mensile, not per-category, lives here because it belongs to no single category); **Gestione** group — rows "Categorie" → `/impostazioni/categorie`, "Transazioni ricorrenti" → `/impostazioni/ricorrenti`; a conditional single ambra (amber, not red — red already means "spesa" in this app) row that appears ONLY when the nightly job is stale, "Verifica in corso non aggiornata" with a chevron into more detail; **Sicurezza** group — an app-lock row, visually muted with a "Prossimamente" tag (Fase 25, not built); **Zona pericolo** — a `card` with a faint aka-tinted border, "Elimina il tuo account" (aka-ink, `Trash2`) → `/impostazioni/elimina`; a plain "Esci" row (aka-ink) at the very bottom.
>
> **`/impostazioni/categorie`**: `PageHeader` with back arrow ("Categorie"); management list of the user's `categories` — icon, name, type tag colored per `TIPO_COLOR`, edit/delete per row; "+ Nuova categoria" opens a sheet with name `Input`, icon picker, `type` `Select` (all 5 values). If `type='risparmio'`, reveal `target_amount`/`target_date` (`DatePicker`) fields inline — deleting such a category must reuse the exact same confirmation as `deleteGoal` (section 6), not a plain delete. If `type='spesa'` specifically (not abbonamento — subscriptions sit outside every budget by design), reveal an optional monthly budget `Input`; the field disappears — and any existing budget for that category is silently cleared — the moment the type is changed away from `spesa`.
>
> Also show, once inside a budgeted `spesa` category elsewhere in the app (e.g. on its `/transazioni` filter card or a dedicated budget card), a slim progress bar: aka tone up to 80%, shifting to an amber "attenzione" tone at 80%, and to full aka past 100% — plus, only on the global budget card, a read-only line "uscite fisse previste: € X del mese" summed from `recurring_rules` (fixed costs like rent/utilities are `abbonamento`, which never counts toward any budget, so this line exists precisely so the global number isn't silently wrong).
>
> Deliver mobile, light and dark: `/impostazioni` root list (including the ambra job-health row, shown once for reference), `/impostazioni/categorie` list, the "Nuova categoria" sheet in its `spesa`-with-budget state.

---

## 9. Fase 14 ✅ — `/impostazioni/ricorrenti` (`recurring_rules`)

> Using the Zen Glass design language and app context above, design `/impostazioni/ricorrenti` (`PageHeader` with back arrow, "Transazioni ricorrenti"), managing the `recurring_rules` table. Generated transactions carry `recurring_rule_id` and are otherwise normal rows in `/transazioni`; this screen manages the rules, not the generated instances.
>
> **List**: rule cards — category icon, notes/name, amount tinted per `TIPO_COLOR`, `frequency` label ("Ogni settimana"/"Ogni mese"/"Ogni anno") in murasaki, "Prossima: [next_run formatted]", an `active` pause/resume toggle, edit/delete affordances (delete = quiet aka-ink text link, no confirmation). At the very top, the same conditional ambra job-health row as section 8 can also appear here — this is the page whose data is actually wrong when the nightly job is stalled, so the warning belongs here even more than in Impostazioni.
>
> **Create/edit rule** (sheet): type, category, amount, notes, `frequency` `FrequencySelector`, `start_date`/`end_date` via `DatePicker`, `active` toggle. Primary `Button` ("Crea regola ricorrente"/"Salva modifiche").
>
> Any transaction row elsewhere in the app that has a `recurring_rule_id` shows a small murasaki `Repeat` badge next to its amount. Empty state via `EmptyState`.
>
> Deliver mobile, light and dark, ≥3 rules across ≥2 frequency values, at least one paused (desaturated), and one frame showing the ambra warning row.

---

## 9b. Fase 16 ✅ — Gestione account e sicurezza

Chiude le issue #12 e #7. Queste sono pagine intere con la propria route e `PageHeader`, non sheet.

> Using the Zen Glass design language and app context above, design the account & security pages — full routes with their own `PageHeader`, not sheets.
>
> **`/impostazioni/profilo`** (`ProfileEditor`): `PageHeader` ("Profilo"); large `Avatar` with an edit-badge affordance opening an action sheet — "Carica una foto" / "Rimuovi foto"; while uploading, a soft pulsing ring around the avatar (`zg-pulse`); below, a `full_name` `Input`; `SubmitButton` ("Salva modifiche").
>
> **`/impostazioni/email`** (`EmailChangeForm`): `PageHeader` ("Email"); step 1 — "Conferma la tua identità", current email read-only, `PasswordInput` re-auth, `SubmitButton` ("Continua"); step 2 — new email `Input`, `SubmitButton` ("Invia richiesta"); success — `StatusScreen` ("Controlla la tua nuova casella email per confermare il cambio"). For OAuth-only accounts, replace the whole page with an explanatory `StatusScreen`.
> **`/email-confermata`**: standalone `StatusScreen` — success icon, "Email confermata", `Button` back to `/impostazioni`.
>
> **`/impostazioni/password`** (`PasswordChangeForm`): `PageHeader` ("Password"); current/new/confirm `PasswordInput`s, `PasswordStrength` via tonal/opacity steps only; `SubmitButton` ("Aggiorna password"); success — `StatusScreen`. Same OAuth-only exception.
>
> **`/impostazioni/elimina`** (`DeleteAccountFlow`): `PageHeader` ("Elimina account"); step 1 — calm explanation of what's lost, secondary `Button` ("Annulla") + quiet aka-ink text "Continua"; step 2 — password accounts get a `PasswordInput` re-auth first; OAuth-only accounts skip straight to typing their email into an `Input` to enable the final destructive `SubmitButton`. While deletion runs, a brief `StatusScreen` loading state ("Eliminazione in corso…").
>
> **`/recupera-password`** (`ForgotPasswordForm`, in `AuthShell`): email `Input`, primary `Button` ("Invia link di recupero"). Always the same success `StatusScreen` regardless of whether the address exists.
> **`/reimposta-password`** (`ResetPasswordForm`, also `AuthShell`): new/confirm `PasswordInput` + `PasswordStrength`, primary `Button` — on success redirects to `/sign?reset=1`.
>
> Deliver mobile, light and dark: profilo; email (both states); email-confermata; password (both states); elimina (all steps); recupera-password + confirmation; reimposta-password.

---

## 10. Stati vuoti e caricamento

> Using the Zen Glass design language and app context above, design two reusable states — the notifications panel now has its own full spec in section 13, not here.
>
> **`EmptyState`** (reused across Transazioni, Risparmi, Investimenti, Ricorrenti): centered minimal graphic, one line of context copy, one secondary `Button`.
> **`HomeSkeleton`**: pulsing placeholder blocks matching the dashboard layout exactly, using the `zg-pulse` animation (gentle opacity breathing, no shimmer gradient).
>
> Deliver mobile, light and dark.

---

## 11. Onboarding — responsive (`lg:` 1024px, `xl:` 1280px)

> Using the Zen Glass design language and app context above: below 1024px, the mobile layout from section 1 applies unchanged. From `lg:`, split into left panel `w-2/5` / right panel `w-3/5` — left panel fixed across all three steps (logo, wordmark, philosophy line, ambient glow blobs, `onboarding-blur` background treatment), right panel holds the active step + `OnboardingProgress`, button pinned via `w-full max-w-lg mx-auto pb-14`. From `xl:`, wrap the right panel content in a visible card (`xl:bg-surface xl:border`).
>
> Deliver: `lg` and `xl` frames for step 1, light and dark.

---

## 12. `/sign` — responsive (`lg:` 1024px, `xl:` 1280px)

> Using the Zen Glass design language and app context above, apply the identical pattern from section 11 to `/sign`: below 1024px, the mobile layout from section 1b; from `lg:`, the same fixed left panel as onboarding, right panel `w-3/5` with `SignTab` + form; from `xl:`, the same card-wrapper treatment.
>
> Deliver: `lg` and `xl` frames, login state, light and dark.

---

## 13. Fase 17 ✅ — Budget per categoria + Notifiche

Implementata e verificata end-to-end (issue #31 budget, #41 notifiche). Spec confermata dal mockup "Stati Supporto" citato nel CLAUDE.md — non più una proposta.

> Using the Zen Glass design language and app context above, design the budget bars (see section 8 for where the field lives) and the full notifications panel.
>
> **Pannello notifiche** (opened from `NotificationBell`, section 4): a card floating below the header with a softly blurred overlay behind it, background at `--color-deep` around 92-94% opacity — NOT the same as a bottom-sheet's modal backdrop, this one sits over a dashboard still full of numbers so it needs to read as lighter/floating, not a heavy scrim. Header row inside the panel: "Notifiche" + a quiet "Segna tutte come lette" command. Rows: a 36px colored icon pill per notification type — kin for a goal reaching 50% or 100% (only these two thresholds — a goal runs for months, so this is ~2 notifications total, not an arbitrary percentage), murasaki for a subscription renewal coming up within 3 days, aka for a budget exceeded, a neutral kiri tone for "regola ricorrente generata" — 13px text, a relative timestamp ("2 ore fa", "Ieri", "3 giorni fa"). Unread rows: full opacity + a small kin dot. Read rows: the whole row at opacity 0.55, dot off. Tapping a row marks it read and navigates to its destination in one gesture.
>
> **Barre budget**: on a budgeted `spesa` category's card, a slim horizontal bar — aka tone climbing normally, shifting to an amber "attenzione" tone exactly at 80%, full aka past 100%. The time window ("questo mese", "questa settimana") is labeled ON EACH CARD, never in a shared section header — categories can have different budget periods, so a single header claiming "this month" would misdescribe a weekly card sitting right next to it.
>
> Deliver mobile, light and dark: the notifications panel with all four notification types represented (at least one read, one unread), and one budget card in each of its three states (normal / 80%+ amber / over 100%).

---

## 14. Fase 18 ✅ — Tema chiaro/scuro

Implementata (issue #32). Cookie-based, tre stati, doppio comando voluto: interruttore binario in `ProfileMenu` + selettore a tre stati in Impostazioni — non è ridondanza, il binario riflette solo ciò che si vede in quel momento, il selettore fissa una scelta esplicita.

> Using the Zen Glass design language and app context above, design the two theme controls. `ThemeToggle`: a simple binary switch inside `ProfileMenu` (opened from the home header group, section 4) — sun/moon icon, `Switch` component with `--on-accent` on the knob. `ThemeSection`: the three-state "Chiaro / Scuro / Sistema" selector inside `/impostazioni`'s Preferenze group (section 8) — a segmented control or three selectable rows, monitor icon for "Sistema".
>
> Deliver: `ProfileMenu` open showing the toggle (light and dark frame), and the Preferenze group showing `ThemeSection` in its "Scuro" and "Chiaro" selected states.

---

Fase 19 (i18n, ✅ fatta) non ha una schermata propria — non ha aggiunto UI nuova, ha sostituito ogni stringa cablata con un dizionario e reso `DatePicker` (già usato in tutte le sezioni sopra) il rimpiazzo del calendario nativo del browser, che seguiva la lingua del browser invece di quella dell'app.

---

## 15. Fase 20 — Conti/wallet multipli e trasferimenti

Progettata per intero, non ancora costruita — questo però riflette lo schema reale confermato nel CLAUDE.md, non più una proposta.

> Using the Zen Glass design language and app context above, design multi-account support.
>
> **Lista conti** (new page, `PageHeader` "Conti"): cards per account — icon, name, type tag, current balance (always computed: `initial_balance` + the sum of its transactions — never a stored figure); archived accounts collapse into a separate "Archiviati" group at the bottom rather than disappearing, since an archived account still holds real history; "+ Nuovo conto".
> **Nuovo/modifica conto** (sheet): name `Input`, icon picker, color, `type` `Select` (e.g. Corrente, Contanti, Risparmio, Investimento), an `initial_balance` `Input` shown only when creating (the starting point of a real-world account, not a transaction — it never appears in any income/expense total). No delete option on an existing account with any history — only "Archivia", styled as a quiet secondary action, not destructive-red.
> **Selettore conto**: a compact switcher at the top of the dashboard and `/transazioni` — "Tutti i conti" or one specific account — filtering everything below it.
> **Trasferimento**: NOT a separate flow — it's a sixth option in the same `type` segmented control inside `TransactionForm`/`TransactionModal` (Entrata / Spesa / Investimento / Risparmio / Abbonamento / Trasferimento), styled in a neutral kiri tone with an `ArrowRightLeft` icon rather than any of the five financial accent colors — it isn't income or an expense. Selecting it replaces the category picker with a "Conto di destinazione" account picker (no category, no `investment_type`). Additionally, when `type` is Risparmio or Investimento, show an optional collapsed "Sposta anche il denaro su un conto" toggle that reveals the same destination-account picker — a savings contribution can advance a goal AND move real money in one gesture, without risking double-counting.
> **Nota per la Home**: con i conti, "saldo" diventa ambiguo (flusso disponibile vs patrimonio nei conti) — questa fase NON riconcilia i due numeri. La dashboard resta una vista di flusso; i saldi reali stanno solo nella pagina Conti. Non disegnare un unico "saldo totale" che li confonda.
>
> Deliver mobile, light and dark: lista conti (with one archived account visible), nuovo conto sheet, dashboard with the account selector, `TransactionModal` in the Trasferimento state, and the Risparmio state with the "sposta anche il denaro" toggle expanded.

---

## 16. Fase 21 — Import dati (CSV / Trade Republic)

> Using the Zen Glass design language and app context above, design a CSV import flow (new page under Impostazioni or Transazioni, `PageHeader` "Importa transazioni").
>
> Step 1 — a large glass dropzone card ("Trascina un file CSV o tocca per selezionare"), Upload icon. Step 2 — a preview table of parsed rows (date, amount, description → mapped type/category), each row editable, a category-mapping `Select` per unmatched row. Step 3 — a summary card before confirming ("42 transazioni da importare, 3 duplicati ignorati"), primary `Button` ("Importa").
>
> Deliver mobile, light and dark: dropzone state, preview/mapping state, summary-confirm state.

---

## 17. Fase 22 — Allegati/ricevute

> Using the Zen Glass design language and app context above, add receipt attachments to `TransactionForm` (section 2): a "Aggiungi ricevuta" row (Camera/Image icon) below the notes field; once attached, a small thumbnail with a remove affordance. Transaction rows elsewhere that have an attachment show a small `Paperclip` glyph next to the amount. Tapping opens the receipt full-size in a simple glass lightbox.
>
> Deliver mobile, light and dark: `TransactionForm` with a receipt attached, a transaction row with the paperclip glyph, the lightbox view.

---

## 18. Fase 23 — Export dati / report PDF mensile

> Using the Zen Glass design language and app context above, design an export flow (new page under Impostazioni, `PageHeader` "Esporta dati"): a period picker (`DatePicker`, month or custom range), a format choice (CSV / PDF as two selectable cards), and for PDF a brief preview of what's included before a primary `Button` ("Genera report").
>
> Deliver mobile, light and dark: format-selection state, PDF preview state.

---

## 19. Fase 24 — AI Financial Coach

> Using the Zen Glass design language and app context above, design a "Coach" section — a feed of insight cards rather than a chat UI: each card has an icon, one or two sentences of personalized observation grounded in a budgeting methodology, and an optional quiet "Vedi dettaglio" link. A single-line input at the bottom ("Chiedi qualcosa al tuo coach…") for follow-up questions, styled like other text inputs, not a bright chat bubble interface.
>
> Deliver mobile, light and dark: the insight feed with 2–3 cards, the input focused.

---

## 20. Fase 25 — Blocco app (PIN / biometrico)

> Using the Zen Glass design language and app context above, design app-lock setup and the lock screen — fills the "Sicurezza" row left as a placeholder in `/impostazioni` (section 8).
>
> **`/impostazioni/sicurezza`** (setup): a numeric PIN pad (4–6 digits), a confirm step, and — if supported — a biometric toggle.
> **Lock screen**: centered logo, dot indicators for PIN digits entered, numeric keypad, or a biometric prompt button if enabled.
>
> Deliver mobile, light and dark: PIN setup, confirm step, lock screen (PIN state), lock screen (biometric state).

---

## 21. Fase 28 — Responsive tablet + desktop per l'app principale

> Using the Zen Glass design language and app context above, extend the responsive pattern beyond onboarding/auth (sections 11–12) to the main `(main)` screens. From `lg:` (1024px), replace `BottomNav` with a persistent left sidebar — same icons plus labels, logo at top, a compact profile entry near the bottom (opens the same `ProfileMenu`). Content area gets a wider max-width: dashboard's four `SummaryCard`s in a single row instead of 2×2, `/transazioni` optionally showing the filter sheet as a persistent side panel.
>
> Deliver: dashboard at `lg:`, light and dark, sidebar + widget row visible.

---

Fasi 26 (PWA), 27 (mobile nativo) e 29 (animazioni) restano fuori da questo file: lavoro tecnico/di configurazione già incorporato nelle regole di sezione 0/0c, non nuove schermate da generare con Claude Design.
````
