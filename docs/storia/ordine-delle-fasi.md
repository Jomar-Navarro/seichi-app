# L'ordine delle fasi, com'era in CLAUDE.md fino al 2026-11-10

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

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
21b. ✅ Disinvestimento (issue #52) + selettore conto su `/investimenti`
    (issue #53) — settimo tipo `disinvestimento`, l'unico oltre a `entrata` che
    AUMENTA il saldo del conto; `/investimenti` diventa **capitale versato
    netto** (acquisti − vendite) e acquisisce il selettore che la 20b aveva dato
    a `/analisi`. Chiude le due issue aperte dalla Fase 21. Motivazioni, l'audit
    dei sedici consumatori e le decisioni: sezione "Fase 21b" sopra. Migration
    `20260817_disinvestment.sql`
21c. ✅ Lista movimenti — residui (issue #9): filtro categoria, reset filtri e
    paginazione a 50 righe. ⚠️ La decisione che regge tutto: **si pagina solo
    quando NON si cerca**, perché la ricerca filtra lato client su categoria,
    note e nome conto e paginando cercherebbe dentro le sole righe caricate.
    Motivazioni e i due difetti di testo che l'aggiunta di un chip ha reso
    visibili: sezione "Lista movimenti" sopra
22. ✅ Allegati/ricevute (issue #36) — foto scontrino sulle transazioni via
    Supabase Storage. Tabella `attachments` (0..N), **bucket privato con URL
    firmati** — la divergenza voluta dagli avatar, che sono pubblici. ⚠️ Il nodo
    non è l'upload ma la CANCELLAZIONE: la cascade tiene pulito il database e
    perde i file, e in SQL lo Storage non si tocca. Motivazioni, i cinque
    percorsi di cancellazione e la guardia scaduta: sezione "Fase 22" sopra.
    Migration `20260818_attachments.sql`
23. Export CSV e report mensile — complementa l'import (Fase 21). **Progettata
    il 2026-08-25**, sezione "Fase 23" sopra. Nessuna migration, **zero
    dipendenze nuove**. Due PR: **23a ✅ export CSV** (issue #37) — Route Handler
    con `Content-Disposition`, colonne leggibili, re-importabilità NON promessa.
    Implementata e collaudata il 2026-08-25 — vedi "Emerso implementando la 23a";
    **23b ✅ report stampabile** (issue #60) — `@media print` + `window.print()`,
    nessuna libreria PDF, i grafici Recharts restano SVG. ⚠️ Il nodo era stampare
    un'app che può essere in tema scuro: risolto condividendo il SELETTORE dei
    token chiari (`:root, .paper`) invece di ricopiarne 43. Implementata e
    collaudata il 2026-08-25 — vedi "Emerso implementando la 23b"
24. AI Financial Coach (issue #66) — **progettata il 2026-08-27**, sezione
    "Fase 24" sopra. **Tre PR, e solo l'ultima costa**: **24a disponibile**
    (*entrate del mese − uscite fisse previste*, il calcolo che la 17a aveva
    rimandato qui); **24b il coach che non paga** — la bolla che galleggia sulla
    card Investimenti in home, il consiglio d'apertura e le risposte che l'app sa
    già dare, tutte aritmetica e tutte nei dizionari; **24c la chat aperta** —
    **fornitore ancora da scegliere** (⚠️ nessun piano gratuito: i termini di
    Google vietano il tier gratuito per utenti UE), consenso, snapshot, le due
    tabelle e i tetti.
    ⚠️ Il perno è che il modello **non scrive mai una cifra**: riceve numeri già
    calcolati e produce prosa con `{segnaposto}`, che `fill()` sostituisce — una
    qualunque cifra nel testo grezzo fa scartare la risposta. ⚠️ Senza la 24c
    resta comunque un coach funzionante: `package.json` e `.env.local` non si
    toccano fino a lì.
    ⚠️ **24c deliberatamente rimandata all'ultimo posto** (deciso 2026-09-04),
    dopo la 29 — vedi sotto perché 25 e 26 sono state scambiate rispetto
    all'ordine con cui erano state numerate
25. ✅ PWA: manifest + Service Worker (issue #68) — **scambiata di posto con
    la 26** (deciso il 2026-09-04, prima di scrivere codice). Il blocco PIN
    protegge soprattutto un'icona sulla home screen che apre direttamente su
    dati finanziari — è quello scenario, non un tab di browser già dietro il
    login Supabase, a rendere il PIN un livello di sicurezza che aggiunge
    qualcosa. E il trigger tecnico del lock (quando richiederlo: al resume,
    al `visibilitychange`, al cold start) si comporta diversamente in una
    PWA installata (`display: standalone`, l'app può restare "viva" in
    background a lungo) rispetto a un tab di browser normale. Progettare e
    collaudare il lock prima di avere la PWA vera avrebbe rischiato di
    costruire il trigger sbagliato e doverlo rifare. `app/manifest.ts` +
    `Serwist` (non `next-pwa`, webpack-only e incompatibile con Turbopack —
    vedi "Fase 25" sotto), precache ridotto a icone/manifest/chunk statici
    e fallback offline onesto. Implementata il 2026-09-04
26. Blocco app — PIN / biometrico (sezione "Sicurezza" del mockup impostazioni,
    saltata in Fase 13). Due PR, dipendenza a senso unico:
    - **26a ✅ blocco con PIN (issue #67)** — PIN a 6 cifre solo in
      `localStorage`, in chiaro, fail-closed via due cookie non segreti.
      Motivazioni, redesign e i 6 difetti del code-review (due gravi, un
      bypass del blocco e un lockout da tastiera) in "Fase 26a" sopra.
      Implementata il 2026-09-09/10, PR #90. ✅ Il collaudo end-to-end da
      telefono su LAN — criterio di accettazione dell'#67 — verificato il
      2026-09-11.
    - **26b ✅ blocco biometrico (WebAuthn), issue #67** — implementata il
      2026-09-10. Nessuna verifica crittografica (stessa scelta del PIN in
      chiaro: una firma verificata nello stesso contesto che la emette non
      difende da nulla). Il biometrico vive SOTTO il PIN, mai al suo posto —
      `clearPin()` toglie anche lui. Motivazioni, i 4 difetti del
      code-review (due con una corsa reale dietro) e il collaudo con
      autenticatore virtuale via CDP in "Fase 26b" sopra. Il debito residuo
      — il prompt biometrico VERO su un dispositivo fisico, non testabile
      dalla LAN perché WebAuthn esige un URL HTTPS reale — è stato chiuso
      il 2026-09-11, appena disponibile il primo deploy pubblico: Face
      ID/Touch ID verificato funzionante su `https://seichi-app.vercel.app`.
      **L'issue #67 è ora chiusa per intero**, sia 26a sia 26b.
27. ✅ Mobile nativo — comportamento su dispositivo reale (vedi sotto)
28. Responsive tablet + desktop — **progettata per intero il 2026-09-18**,
    mockup Claude Design prima di scrivere codice (sidebar applicata a Home e
    Impostazioni, entrambe le larghezze, entrambi i temi). Quattro PR:
    - **28a ✅ shell** (issue TBD) — sidebar a sei voci da `lg:` in su,
      `MainContentShell`, contenitore di transizione su tutte le pagine.
    - **28b ✅ pagine dashboard** (Home/Investimenti/Analisi/Risparmi/Conti) —
      container definitivo, griglie/donut/grafico più grandi, hover-reveal
      su Conti, fix del pannello notifiche. Merged 2026-09-21, PR #103.
    - **28c** pagine lineari — sostituisce il contenitore di transizione con
      lo stretto definitivo
    - **28d ✅** sheet e modali centrati da `lg:` in su — `BottomSheetShell`
      (i cinque fogli) e `TransactionModal`/`TransactionForm` diventano
      dialog centrati sopra il breakpoint, invariati sotto.
    - **28e ✅ nuovo design desktop (issue #108)** — un progetto Claude Design
      più recente rivede pezzi della 28: footer profilo nella sidebar, griglie
      di Conti/Investimenti invertite, Impostazioni a due colonne (revisione
      esplicita della 28c). Implementata con 5 stream paralleli.
    Motivazioni e decisioni in "Fase 28" e "Fase 28e" sotto.
29. Animazioni: transizioni morbide, micro-interazioni

