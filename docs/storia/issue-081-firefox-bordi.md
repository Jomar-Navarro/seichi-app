# #81 — i quadrati di Firefox sugli angoli arrotondati

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

#### Issue #81 — i quadrati di Firefox sugli angoli arrotondati

Trovata il 2026-09-02, chiusa il 2026-09-03. Invisibile su Chrome e Safari, e
per questo rimasta a lungo indisturbata: `collauda-app` guida Chromium e non
poteva vederla — è la stessa classe di difetto già registrata per la stampa
(Fase 23b) e per `crypto.randomUUID()` (Fase 22), *"ogni fase che tocca un'API
o un motore di rendering diverso ha una parte di collaudo che nessun driver
può fare"*.

**L'ipotesi iniziale era sbagliata, ed è quella che il debito originale
registrava**: sembrava un problema di `backdrop-filter` + `border-radius`
sullo stesso elemento. È un difetto reale — Firefox non ritaglia bene uno
sfondo sfocato sull'angolo arrotondato quando le due proprietà stanno sullo
stesso nodo — ma **non è la causa dei quadrati**. La causa vera, isolata
disattivando singole dichiarazioni CSS dal vivo in Firefox DevTools (due volte,
su un elemento CON sfocatura e su uno SENZA): **un `border-color` traslucido
(`--border`, sempre `rgba(...)` in questo progetto) combinato con
`border-radius`**, indipendentemente da `backdrop-filter` e da
`overflow-hidden`. Firefox non antialiasa bene l'angolo del border-box contro
il ritaglio arrotondato quando il colore del bordo non è opaco: resta visibile
un piccolo quadrato dell'angolo NON arrotondato, sotto il bordo.

La correzione nota per questo bug: un **anello** — `box-shadow: inset 0 0 0 1px
var(--border)` — al posto di un `border` vero. Un box-shadow SI ritaglia
correttamente sull'angolo in Firefox, e in più non tocca il box model (nessuno
scarto di 1px sul padding, a differenza di un bordo reale).

**Le due correzioni convivono, e sono ortogonali**: dove un elemento ha
ANCHE `backdrop-filter` sullo stesso raggio, serve pure la separazione in tre
livelli — guscio (`overflow-hidden`, l'anello, l'ombra) → vetro (`absolute
inset-0`, `backdrop-blur-*`, **senza** un proprio `border-radius`) →
contenuto (`relative`, padding e layout) — perché quella è la correzione per
*l'altro* bug, quello di `backdrop-filter`. Un elemento senza sfocatura ha
bisogno SOLO dell'anello, non della separazione in livelli.

- **Quattro utility nuove**, affiancate a quelle esistenti senza toccarle — un
  elemento che oggi usa `card-shadow` senza bordo non deve guadagnarne uno:
  `ring-border` (il solo anello, per elementi senza altra ombra) e
  `card-shadow-ring`/`modal-shadow-ring`/`box-shadow-ring` (la stessa ombra a
  caduta della base, con l'anello aggiunto come terzo strato del box-shadow).
- **`.deep-shadow`, `.transaction-type-card`, `.fab`, `.segment-tab`** (le
  utility che bundlavano un bordo VERO al loro interno) sono state corrette
  alla fonte, in `globals.css`: nessun chiamante ha dovuto cambiare per loro.
- ⚠️ **Dove il colore del bordo cambia per stato — a fuoco, da riposo a
  selezionato, da riposo a "pericolo"** (l'input del budget globale, le card
  categoria dell'onboarding, `SubmitButton` in variante `danger`) — non basta
  una classe condivisa: il colore dell'anello per lo stato "vivo" è
  un'affermazione diversa da quella di riposo, e serve scriverla per intero
  (`box-shadow` inline, o `border-transparent` + un vero `border` colorato solo
  nello stato attivo, dove il colore è OPACO e quindi immune al bug).
- ⚠️ **Dove `overflow-hidden` non può stare** (`BottomNav` — il FAB esce sopra
  la barra; il pannello categoria di `ImportFlow` e quello valuta/lingua
  dell'onboarding — il menu di `Select` esce dal riquadro) **l'anello si
  applica comunque**: non ha bisogno di `overflow-hidden` per ritagliarsi bene,
  solo lo sfocamento ne ha bisogno. Il ritaglio di `backdrop-filter`
  sull'angolo resta un residuo aperto in questi tre punti, deliberatamente —
  correggerlo richiede la separazione in livelli progettata apposta per ognuno,
  non riusata di corsa.
- ⚠️⚠️ **Il report stampabile (`/analisi/report`) è il solo posto dove
  l'anello NON basta da solo.** `.paper * { box-shadow: none !important }`
  (Fase 23b) azzera ogni ombra in stampa, anello compreso: dove la separazione
  fra due superfici deve restare leggibile SULLA CARTA, un `print:border
  print:border-subtle` esplicito ripristina un bordo vero — e in stampa il bug
  di Firefox non esiste, è una pipeline di rendering diversa. Dove il bordo in
  stampa non serve (il contorno esterno del foglio, delimitato dal margine di
  pagina), `print:rounded-none` restava già sufficiente.
- ⚠️ **Il primo tentativo di correzione — `overflow-hidden` da solo, senza
  toccare il bordo — non bastava**, verificato da Firefox vero due volte
  (hard refresh compreso). Solo dopo aver isolato la causa nel bordo, la
  separazione guscio/vetro/contenuto già in atto per il bug di
  `backdrop-filter` si è rivelata corretta ma **incompleta**: risolveva un bug
  e ne lasciava scoperto un secondo sullo stesso elemento. Un componente
  "già sistemato" (`AccountsBalanceCard`) lo era davvero — ma solo per la metà
  del problema allora conosciuta.
- Riguarda **praticamente ogni superficie arrotondata dell'app** — non solo le
  ~50 card con vetro del debito originale, ma bottoni, righe, chip, input,
  pastiglie: il linguaggio visivo di Seichi è quasi interamente
  `rounded-* + border border-subtle`. Corretto in un solo giro su tutti i
  componenti che lo usavano, non per campione — è la stessa lezione già
  registrata più volte in questo documento (Fase 18, Fase 19): una correzione
  applicata "dove ci si è pensato" invece che ovunque serva è quella che
  lascia il difetto vivo altrove.
- ⚠️⚠️ **Il primo giro cercava `border-subtle`, e la card degli obiettivi non
  usa quella classe.** `GoalCard` colora il bordo con uno stile inline
  (`borderColor: "var(--border)"`), non con la classe Tailwind — quindi era
  invisibile a un grep mirato su `border-subtle` e i quadrati sono
  sopravvissuti al primo giro, scoperti solo riguardando l'app dopo la
  conferma "sono andate via" ("scherzavo, ci sono ancora negli obiettivi").
  Da qui un **secondo giro** cercando ogni `border:`/`borderColor:` inline in
  tutto il repo, non solo le classi Tailwind: ha trovato altri quindici siti,
  fra cui uno vero **regresso introdotto dal primo giro stesso** — la card
  budget "sforato" (`BudgetCards`) aveva il bordo base convertito in anello
  (`ring-border`), ma lo stato sforato lo sovrascriveva ancora con
  `style={{ borderColor: ... }}`, che senza una proprietà `border` non colora
  più nulla: l'anello d'allarme era semplicemente sparito, letto dall'utente
  come "la profondità è scomparsa". Stesso schema su cinque campi con stato
  d'errore (`AccountSheet`, `CategorySheet`, `GoalSheet`, `PasswordInput`) —
  ognuno sovrascriveva un `borderColor` che il proprio `ring-border` di base
  aveva già reso muto. **La lezione: quando un bordo diventa un box-shadow, va
  ricontrollato ogni punto che quel bordo lo sovrascriveva — un `borderColor`
  su un elemento senza più `border` è un difetto silenzioso per costruzione,
  della stessa famiglia della classe Tailwind inesistente.**
  Altri siti dello stesso secondo giro: il banner di conferma password
  (`LoginForm`), l'input di conferma eliminazione account
  (`DeleteAccountFlow`), due avvisi di `ImportFlow`, l'avviso del job fermo
  (`JobHealthNotice`), i tre tooltip di Recharts (`MonthlyLineChart`,
  `SpendingPieChart`, `InvestimentiTab` — `contentStyle` è CSS inline, non una
  classe), l'interruttore spento (`Switch`), il bottone elimina di
  `TransactionForm` e la card tipo selezionata di `TransactionModal`.
  ⚠️ **Un residuo dichiarato**: il riquadro trascina-file di `ImportFlow` ha un
  bordo TRATTEGGIATO (`border-dashed`), e `box-shadow` non sa disegnare un
  tratteggio — lasciato con un bordo vero e un commento che spiega perché, non
  segnalato finora.
- **Verificato**: `tsc`, lint, `next build` (tutte le 32 route) e
  `npm run audit:tokens` puliti in entrambi i giri; le quattro utility nuove
  confermate nel CSS di produzione (`.next/static/chunks/*.css`), incluse le
  varianti `lg:`/`xl:`. **Confermato su Firefox vero due volte**: dopo il
  primo giro ("sono andate via" — poi smentito) e dopo il secondo, sui punti
  esplicitamente segnalati (obiettivi, budget, transazioni home, navbar,
  notifiche, chatbot).

