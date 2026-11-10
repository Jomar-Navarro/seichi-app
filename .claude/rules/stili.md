---
paths:
  - "**/*.tsx"
  - "app/globals.css"
---

# Stili: Zen Glass, temi, Tailwind

Storia: `docs/storia/fase-18-tema`, `issue-081-firefox-bordi`,
`issue-126-contrasto`, `issue-153-movimento-ridotto`, `fase-27-mobile`,
`fase-28-responsive`, `fase-28e-desktop`.

L'estetica è il minimalismo giapponese: vetro satinato, pietra, carta di riso.
Ombre soffuse, mai nere; mai effetti cyber o plastica. Raggi di 24-32px per card
e modali, 12px per gli elementi interni.

## Token

`app/globals.css` è la fonte: `:root` è il chiaro, `.dark` lo scuro. Qui sotto i
valori chiari.

```css
--color-tsuki #f5f1e8  --color-kami #ece6da   /* carta, superfici */
--color-yoru  #33373d  --color-kage #4a4e45   /* testo primario, secondario */
--color-midori #6f8a63 /* entrate */   --color-aka #b47358      /* uscite */
--color-ao     #6e86a8 /* investimenti */ --color-kin #ae8b49   /* risparmi */
--color-murasaki #8a6fc4 /* ricorrenti, abbonamenti */
--ink-midori #5c7350 --ink-aka #96543d --ink-ao #4c6588 --ink-kin #7f6229
--ink-murasaki #6b4fa8 --ink-kiri #6b6558      /* gli stessi, come TESTO */
--on-accent #ffffff  /* in .dark: #131a28 */
```

1. **Accento ≠ inchiostro.**
   - Gli accenti servono a riempimenti, pastiglie, icone e grafici, dove basta
     un contrasto di 3:1.
   - Il testo colorato usa l'inchiostro: `text-aka-ink`, `TIPO_INK` accanto a
     `TIPO_COLOR`, `budgetInk()` accanto a `budgetColor()`.
   - In scuro gli inchiostri coincidono con gli accenti, tranne `--ink-kiri`.
2. **Sopra un riempimento d'accento va `--on-accent`, mai `#fff`**: gli accenti
   invertono la luminosità fra i due temi.
3. **Usa le classi Tailwind, non `var()` inline.** Il nome del token e quello
   della classe non coincidono, e una variabile inesistente non fa rumore.

   | serve | token | classe |
   |---|---|---|
   | bordo | `--border` | `border-subtle` |
   | testo primario | `--text-primary` | `text-foreground` |

   `--color-border` e `--color-primary` NON esistono.
4. **Il testo si colora con `text-foreground` e `text-muted`**, mai con i neutri
   del marchio (`tsuki`, `kiri`, `yoru`), che non cambiano in `.dark`.
   `--text-disabled` risolve allo stesso colore di `--text-muted`: la gerarchia
   fra i due è tipografica.
5. **Il tema lo decidono due cookie** (la scelta e il valore risolto), letti dal
   root layout, così il primo byte è già giusto. Niente `localStorage`, niente
   `suppressHydrationWarning`.

## Bordi, ombre, livelli

1. ⚠️ **Mai un `border` traslucido su un elemento arrotondato**: Firefox lascia un
   quadrato agli angoli.
   - Usa `ring-border` o `card-shadow-ring`, `box-shadow-ring`,
     `modal-shadow-ring`.
   - Uno stato (fuoco, errore, selezionato) riscrive l'anello intero con
     `box-shadow`, oppure usa un bordo OPACO. Un `borderColor` su un elemento
     senza `border` non colora niente.
   - Il tratteggio, che `box-shadow` non sa fare, è un SVG (`DashedBorder`).
2. **Il vetro sfocato su un elemento arrotondato si fa in tre livelli**: il
   guscio (`overflow-hidden`, anello, ombra), il vetro (`absolute inset-0`,
   `backdrop-blur`, senza raggio proprio), il contenuto.
3. **`overflow-x-auto` ritaglia anche in verticale**: ombre e tendine `absolute`.
   - Una barra di chip va a capo con `flex-wrap`.
   - In un carosello il padding va sulle pagine, non sul contenitore.
4. **`backdrop-filter` crea un contesto di impilamento**: nessuno z-index scritto
   dentro una card di vetro ne esce, e il livello lo alza il chiamante.
5. **La scala degli z-index**: `BottomNav` 40, una card con la tendina aperta 60,
   il velo del PIN 65, `BootSplash` 70. Un livello nuovo sopra 60 va confrontato
   col velo, o i dati restano visibili sopra il blocco.

## Tailwind

1. **Ogni classe sta scritta per intero nel sorgente**: lo scanner legge il
   testo, non esegue il codice.
   - Niente `grid-cols-${n}`: si usa uno `style` inline o un ternario fra classi
     complete.
   - Mai una classe incollata a `${` in un template: lascia uno spazio prima.
2. **Non nominare in un commento del codice una classe che non deve esistere**:
   i commenti sono scansionati e la rigenerano. I `.md`, `.claude`, `scripts`,
   `supabase` e i test sono esclusi (`@source not` in `globals.css`).
3. **Queste classi non esistono**: `text-md` (la scala è xs, sm, base, lg, xl),
   `text-primary`, `bg-glass-border`.
4. **`npm run audit:tokens` fa quattro controlli**:
   - A: `var()` non definite;
   - B: classi non generate, misurate su una build di produzione;
   - C: inchiostri non mappati in `@theme inline`;
   - D: classi incollate a `${`.

   Non vede un nome di token usato come valore CSS (`background: ao`).
5. **Una controprova sul CSS si fa su una build di produzione**, mai sul dev
   server: in sviluppo Tailwind accumula le classi già generate.

## Movimento

1. **Ogni animazione dichiara accanto alla sua definizione cosa fa con
   `prefers-reduced-motion`.**
   - Si ferma con `animation: none` più l'opacità di un fotogramma che
     l'animazione mostra davvero.
   - Oppure resta, con la ragione scritta lì.
   - Niente regola globale che azzera le durate.
2. **Lo splash (`zg-boot-out`) resta anche con il movimento ridotto**: è una
   dissolvenza, e con `animation: none` coprirebbe l'app per sempre.
3. **In Recharts `isAnimationActive` resta su `"auto"`**, che legge da sé il
   movimento ridotto; `false` solo per la stampa.
4. **Gli scorrimenti chiesti da JavaScript passano da `scrollBehavior()`**
   (`lib/motion.ts`). Le transizioni che spostano molto hanno
   `motion-reduce:transition-none`.

## Telefono, tablet, desktop

1. **Sul telefono**:
   - altezze in `dvh` o `svh`, mai `vh`;
   - `env(safe-area-inset-*)` su nav, FAB, header e modali;
   - input a 16px o più, o iOS zooma al fuoco;
   - bersagli di tocco di almeno 44×44px.
2. **Breakpoint**:
   - sotto `lg:` (1024px) è l'app del telefono, iPad in verticale compreso;
   - da `lg:` la sidebar e i dialog centrati;
   - gli split di pagina a due colonne da `xl:`, Impostazioni da `lg:`;
   - niente `md:`.
3. **Il contenitore delle pagine da `lg:`**: `lg:px-10 lg:pt-9 lg:pb-12
   lg:max-w-6xl lg:mx-auto lg:w-full`.
4. **Un pezzo montato due volte, uno per breakpoint**, ha la copia nascosta in
   `display: none`, quindi fuori dal Tab e dall'albero di accessibilità.
5. **L'hover si attiva solo con un puntatore che non preme**: `onPointerEnter`
   con `e.pressure === 0`. Un tap emette anche gli eventi del mouse.

## Stampa

`/analisi/report` è un documento.

- `.paper` riporta i token chiari condividendo il selettore con `:root`, e
  dichiara `color` a parte.
- Il fondo è `--color-tsuki`, mai vetro.
- In stampa si usano gli inchiostri, perché gli sfondi non si stampano.
- `print:border` dove un anello deve restare visibile sulla carta.
