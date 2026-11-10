# Fase 27 — mobile nativo

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

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

#### ✅ Collaudata dal telefono sull'IP di LAN — 2026-09-18

Tutti e sei i punti verificati a mano, PR1 (#96) e PR2 (#99) insieme come
previsto da entrambi i test plan: toolbar dinamica di Safari (item 1) senza
bottom nav o bottoni pinned nascosti sotto di lei; touch target delicati
(item 5 — swatch colore di `AccountSheet`, righe azione di
`RecurringManager`/`CategoryManager`, cestino sulle miniature di
`AttachmentPicker`); overscroll contenuto nei pannelli/tendine senza
propagarsi alla pagina sotto (item 6); scroll-into-view della tastiera su
`TransactionForm` e sui `BottomSheetShell` di Goal/Categoria/Ricorrente/Conto,
col bottone "Salva" fisso sempre sopra la tastiera (item 4). Chiude l'issue
#69 e la Fase 27.

