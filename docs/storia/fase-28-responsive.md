# Fase 28 — responsive tablet e desktop

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 28 — responsive tablet e desktop

Progettata per intero il 2026-09-18, mockup Claude Design prima di scrivere
codice (sidebar applicata a Home e Impostazioni, alla larghezza del
breakpoint `lg:` e a una più larga da desktop, entrambi i temi) — lo stesso
principio già seguito per ogni fase grande di questo progetto. Prima di
disegnare, l'audit del codice esistente: **zero classi `md:`/`lg:`/`xl:`/
`2xl:`** in tutto `app/(main)/` e nei componenti che usa in esclusiva — l'app
autenticata era al 100% mobile-only. L'unico precedente responsive nel repo è
`(auth)`/`(onboarding)` (Fase 4-5): un pannello di contenuto senza chrome
persistente, che non si applica direttamente qui — l'app autenticata ha
bisogno di una navigazione che regga su schermi larghi, cosa che quel
contesto non ha mai dovuto risolvere.

#### La decisione che precede tutte le altre: sidebar, non pillola centrata

La pillola mobile (`BottomNav`) ha deliberatamente solo 4 voci + FAB — un
vincolo del pollice deciso in Fase 20a — quindi Analisi e Impostazioni
restano oggi raggiungibili solo da una card scorciatoia in home e dal menu
profilo. Su schermi larghi quel vincolo non esiste, e lasciarle secondarie
avrebbe letto come un porting incompleto piuttosto che un'esperienza
desktop pensata. Decisione (con l'utente, tre opzioni valutate): **una
sidebar fissa a sinistra con tutte e sei le sezioni**, non la pillola solo
centrata (avrebbe conservato il buco) né una barra orizzontale in alto
(avrebbe introdotto un terzo paradigma di navigazione oltre a mobile e
desktop). Chiude anche il gap che Analisi/Impostazioni avevano su desktop.

**Breakpoint riusati identici al precedente auth/onboarding**, non inventati
da zero: `lg:` (1024px, Tailwind default — nessun override in `globals.css`)
per il cambio strutturale, `xl:` per rifinitura. Niente `md:`: un iPad in
verticale (768px) resta nel layout mobile, esattamente come già fa
auth/onboarding.

#### Il mockup, prima del codice

Pubblicato via Claude Design (Artifact "Design"): quattro artboard — Home e
Impostazioni, ciascuna alla larghezza del breakpoint (1024px, il punto più
stretto in cui sidebar e contenuto devono già convivere) e a una desktop
(1440px) — con un componente sidebar condiviso via `<dc-import>` e un
interruttore chiaro/scuro dal pannello Tweaks invece di board duplicate per
tema. Verificato a mente, prima di disegnare, che la griglia a 4 colonne
delle card riassuntive regga anche al punto più stretto (sidebar 256px +
contenuto ~688px → card da ~163px, la stessa larghezza approssimativa delle
card 2 colonne di oggi su mobile) — confermato poi dal collaudo vero.

#### PR 28a — lo shell

**`components/UI/Sidebar.tsx`** (nuovo) — rail fissa `hidden lg:flex fixed
left-0 top-0 bottom-0 w-64`, stesso schema di `BottomNav.tsx`. Le sei voci
usano gli stessi `SeichiIcon` già in `lib/seichi-icons.tsx`
(`ChartNoAxesCombinedIcon`/`SettingsIcon` esistevano già, nella stessa
sezione "Navigation" di `HomeIcon`/`ReceiptIcon`/`PiggyBankIcon`/
`TrendingUpIcon` — riusati, non importati da `lucide-react`). Un bottone
primario "Aggiungi transazione" in cima: l'azione del FAB non può sparire
solo perché la pillola è `lg:hidden`, deve solo cambiare casa.

**`components/UI/useNavVisibility.ts`** (nuovo) — estrae le due guardie che
`BottomNav.tsx` aveva inline (`DOCUMENT_ROUTES`, `fullScreenActive`) in un
hook condiviso. Non è un refactor cosmetico: sidebar e pillola devono
nascondersi esattamente alle stesse condizioni, o una futura rotta-documento
o un futuro flusso a schermo intero ne aggiornerebbe una sola.

**`components/UI/MainContentShell.tsx`** (nuovo) — il gutter `lg:pl-64` che
`{children}` guadagna in `(main)/layout.tsx`. ⚠️ **Legge lo stesso
`useNavHidden()` della sidebar**, non solo `fullScreenActive` come la prima
stesura del piano prevedeva: se la sidebar sparisce anche su una
rotta-documento (`/analisi/report`), il gutter deve sparire con lei, o
resterebbe uno spazio vuoto riservato a una sidebar che non c'è. Verificato
che non confligge con `AppLockPageShell.tsx` (Fase 26a): quello gestisce
solo il proprio `pb-*` interno, un livello diverso dal gutter esterno.

**Il contenitore**: nella stessa PR, `lg:max-w-3xl lg:mx-auto lg:w-full`
aggiunto a tutte le ~17 wrapper `className` esistenti (il pattern `flex
flex-col min-h-dvh px-5 pt-7 pb-3X`, ripetuto pagina per pagina — incluso
`AppLockPageShell.tsx` per `/impostazioni/blocco`, condizionato a
`!fullScreenActive` per lo stesso motivo del gutter: il wizard PIN resta
edge-to-edge anche su desktop). Un valore di transizione uniforme (768px),
non ancora differenziato in stretto/largo — quello arriva pagina per pagina
con 28b/28c. Esclusa deliberatamente `/analisi/report`: è una rotta-documento
(Fase 23b), fuori dal trattamento responsive normale.

⚠️ **`t.nav` guadagna due chiavi** (`analytics`/`settings`, in `it.ts` e
`en.ts`) copiando i valori letterali già in uso altrove
(`t.home.analyticsTitle`, `t.settings.title`/`t.profileMenu.settings`) — non
una nuova traduzione, la stessa parola già scritta altrove.

#### Il collaudo — driver Playwright ad hoc, sessione riusata via cookie

Il driver esistente (`collauda-app`) è fissato a un viewport mobile
(414×896): questa fase ne richiedeva uno nuovo, a più larghezze. Verificato:
768px invariato (nessuna sidebar, pillola presente come sempre — screenshot
a conferma), 1024px e 1440px con la sidebar e tutte e sei le voci, la
pillola assente, "Home" evidenziata come voce attiva, navigazione reale
click-per-click verso Impostazioni e Analisi con l'evidenziazione che segue,
e il wizard PIN che fa sparire la sidebar (verificato `fullScreenActive`
condiviso). Zero errori console in ogni scatto.

⚠️ **Un KO ripetuto due volte, diagnosticato prima di crederci**: il click
sui link di navigazione, letto con `page.url()` subito dopo
`waitForLoadState("networkidle")`, dava "KO" in modo riproducibile dentro il
driver completo ma **non** isolando la stessa identica sequenza di contesti
in uno script a parte, dove un `waitForTimeout` piatto al posto di
`networkidle` vedeva sempre l'evento `framenavigated` corretto. La causa:
`networkidle` dopo una navigazione CLIENT-SIDE di Next.js può risolvere
prima che il router applichi l'URL — una corsa nel test, non nella pagina.
Vale come nota di metodo per ogni futuro driver di questo repo che debba
cliccare un link interno: dopo un click su una navigazione client-side,
un'attesa fissa è più affidabile di `networkidle`.

#### Emerso preparando 28b — poi chiuso nella stessa PR

`components/features/NotificationBell.tsx` ha il pannello `fixed left-5
right-5` — ancorato ai margini del **viewport**, deliberatamente (il
pannello mobile è largo quanto il contenuto, non quanto la campanella). Con
la sidebar e un contenuto centrato su una finestra larga, il pannello si
allargherebbe su quasi tutta la finestra, staccato dalla campanella che lo
apre. `CoachBubble`/`ProfileMenu` non hanno lo stesso problema: il primo usa
già `BottomSheetShell` (coperto da 28d), il secondo è già ancorato al
proprio trigger (`absolute left-0 top-13`).

#### PR 28b ✅ — pagine dashboard (2026-09-21)

Design in **Claude Design prima del codice**, come per la 28a: il mockup
`Seichi — Responsive tablet/desktop` non copriva Investimenti/Analisi/
Risparmi/Conti, quindi è stato **esteso** (non ricreato) con quattro nuovi
artboard — uno per pagina, al breakpoint `lg:`/1024px, quello vincolante —
riusando lo stesso `<dc-import name="Sidebar">` e gli stessi token colore
già stabiliti per Home/Impostazioni. La lettura del mockup esistente ha
anche confermato due decisioni prima di scrivere una riga: le due card hero
di Home sono già disegnate **affiancate** (`grid-template-columns:1fr 1fr`),
non in carosello, e a 1440px il contenuto resta incorniciato a
`max-width:1080px` — non piena pagina — da cui `xl:max-w-5xl` (1024px, la
voce di scala Tailwind più vicina).

- **Container definitivo** sulle cinque pagine: `lg:max-w-3xl xl:max-w-5xl
  lg:mx-auto lg:w-full`, al posto del valore transitorio uniforme della 28a.
- **Home**: `SummaryCard` a `grid-cols-2 lg:grid-cols-4`. `HomeHero.tsx`
  esce dal carosello a scorrimento da `lg:` in su (`lg:grid`, due colonne se
  c'è il saldo altrimenti una — ternario fra due classi COMPLETE, mai
  un'interpolazione: Tailwind non genera `grid-cols-${n}`) e annulla il
  workaround del ritaglio d'ombra (`-mx-5 pt-4 …`) che serve solo con
  `overflow-x-auto`. I puntini di paginazione spariscono con `lg:hidden`:
  inutili quando entrambe le card sono visibili insieme.
- **Investimenti/Analisi**: i due donut crescono da `lg:` (`w-40 h-40` →
  `lg:w-52 lg:h-52` su Investimenti, `w-32 h-32` → `lg:w-44 lg:h-44` su
  Analisi). La lista posizioni diventa `lg:grid lg:grid-cols-2`. Il grafico a
  linea di `MonthlyLineChart.tsx` passava `height={160}` fisso a
  `ResponsiveContainer`: Recharts non varia l'altezza per breakpoint via
  prop, quindi ora è avvolto in un contenitore `h-40 lg:h-56` con
  `height="100%"`.
- **Risparmi/Conti**: stessa griglia (`lg:grid-cols-2 xl:grid-cols-3`) su
  `GoalsPageClient.tsx` e `AccountsPageClient.tsx`; le intestazioni di
  sezione (completati/archiviati) e le card che devono restare a piena
  larghezza guadagnano `lg:col-span-full`.
- ⚠️ **Hover-reveal su Conti, riusando la logica dello swipe invece di
  duplicarla.** Lo swipe touch-only non ha un gesto equivalente col mouse:
  `ActiveAccountRow` guadagna uno stato locale `hovered` che si unisce a
  `isOpen` in un `revealed = isOpen || hovered` condiviso — lo stesso valore
  decide se disegnare il vassoio (`traySmontato`, principio della Fase 20a:
  non disegnare ciò che deve restare nascosto dietro il vetro traslucido) e
  di quanto traslare la riga (`offset`). Nessun overlay nuovo, nessuna
  duplicazione di markup.
  ⚠️⚠️ **La prima stesura usava `onMouseEnter`/`onMouseLeave` nudi**, con la
  giustificazione — MAI verificata — che "i browser touch non emettono
  `mouseenter` su un tap". Falsa, trovata dal code-review prima di mergiare
  la PR successiva: vedi "Emerso dal code-review della 28b" più sotto.
- **`NotificationBell.tsx`** (il debito qui sopra): da `lg:` il pannello si
  ancora al bottone campanella — `panelRight = window.innerWidth -
  rect.right`, letto una volta al tocco come `panelTop`, con `right-5`
  sostituito via `style` e una larghezza fissa (`lg:w-96`) invece che "quanto
  il contenuto". Sotto `lg:` (`panelRight` resta `null`) il comportamento non
  cambia.

##### Il collaudo, e due KO diagnosticati prima di crederci

Driver Playwright ad hoc a 768/1024/1280px (sessione via cookie): tutte le
griglie confermate via bounding box, pannello notifiche ancorato (~0px dal
bordo destro della campanella contro ~20px dal bordo del viewport su
mobile), hover-reveal che apre/richiude, zero errori console.

⚠️ Due controlli hanno segnalato KO, e **nessuno dei due era un difetto
dell'app** — la stessa lezione ripetuta più volte in questo documento. Ma la
prima diagnosi scritta qui sotto per il primo era essa stessa sbagliata a
metà, corretta solo dopo (vedi "Emerso dal code-review" più sotto):

- il confronto "le 4 SummaryCard sulla stessa riga" leggeva le posizioni di
  elementi trovati per TESTO, e due delle quattro etichette hanno agganciato
  l'elemento sbagliato — ma non per lo stesso motivo. **"Investimenti"** è
  davvero anche una voce della sidebar (`t.nav.investments`), quindi il
  locatore ha preso quella. **"Risparmi" invece non è un'etichetta della
  sidebar** (quella voce dice "Obiettivi", `t.nav.goals`) — a sbagliare è
  stato **"Entrate"**, che ha agganciato una frase minuscola dentro
  `FlowCard` ("entrate meno uscite di questo mese…"): il locatore testuale
  di Playwright fa un confronto case-INSENSITIVE per sottostringa, quindi
  "Entrate" ha trovato "entrate" in mezzo a una frase completamente diversa.
  Confermato via screenshot che la griglia è corretta, e poi via uno script
  isolato che stampa `outerHTML` di ogni match per capire ESATTAMENTE cosa
  avesse agganciato ciascuna etichetta — non solo "sembra un problema di
  sidebar", il meccanismo vero;
- il test del click-dopo-hover falliva dentro lo script completo (hover →
  mouseleave → `.click()` sullo stesso locator) ma non isolando la
  sequenza a parte: il `.click()` di Playwright ri-passa dal bottone prima
  di cliccare, re-innescando l'hover-reveal e la sua transizione da 200ms,
  una corsa nello SCRIPT. Verificato con due prove isolate — un click "a
  freddo" su una riga mai toccata, e un hover reale seguito da un click sullo
  stesso punto senza muovere il mouse — che il click naviga a `/conti/[id]`
  in entrambi i casi.

Merged 2026-09-21, PR #103.

#### Emerso dal code-review della 28b, prima di mergiare la PR successiva — PR #106

Fatto su richiesta esplicita ("prima di mergiare fai una code review su
tutto"), non di routine — e in due giri, entrambi su codice già mergiato,
non sulla sola documentazione che lo descriveva.

⚠️⚠️ **Primo giro — "I browser touch non emettono `mouseenter` su un tap"
era un'affermazione MAI verificata**, scritta per giustificare
`onMouseEnter`/`onMouseLeave` nudi sull'hover-reveal di `ActiveAccountRow`.
Verificata con l'emulazione touch di Chromium (`hasTouch: true` +
`page.touchscreen.tap()` — non ancora un dispositivo fisico): **falsa**. Un
tap fa risalire `mouseover`→`mouseenter` fino alla RADICE del documento —
`<html>`, `<body>`, ogni contenitore intermedio, il wrapper della riga
compreso — perché il browser sintetizza l'intera sequenza per
compatibilità con siti che ascoltano solo eventi mouse. Lo stesso tocco che
naviga a `/conti/[id]` faceva quindi scattare `onMouseEnter` sulla riga un
istante prima della navigazione, rivelando il vassoio Modifica/Archivia per
un lampo — non bloccava il click (`hovered` non influenza `handleTap`), ma
era un tocco che diceva "sto passando il mouse" mentre non c'era alcun mouse.

Passare a `onPointerEnter`/`onPointerLeave` sembrava la correzione ovvia
(i Pointer Event non ricevono la sequenza di compatibilità mouse), ma un
tocco genera comunque un `pointerenter` NATIVO — con `pointerType: "touch"`
— perché è così che la Pointer Events API rappresenta l'inizio di un
contatto: serviva anche un controllo esplicito sul tipo.

⚠️⚠️ **Secondo giro — una review multi-agente sulla stessa PR ha trovato
che il controllo sul tipo era ESSO STESSO sbagliato**, e un difetto
d'invariante indipendente. Tre correzioni, non una:

- **`pointerType !== "touch"` lasciava passare una penna SENZA hardware di
  hover** (un Apple Pencil di prima generazione, per dire): tocca lo
  schermo senza una fase di avvicinamento, genera lo stesso `pointerenter`
  di un tap ma con `pointerType: "pen"` — un filtro per NOME dispositivo
  non poteva bastare, perché la lista di nomi non è mai chiusa. Sostituito
  con `e.pressure === 0`: non chiede COSA sta toccando, solo SE sta
  toccando — un tap (qualunque dispositivo) riporta `pressure: 1`, un
  hover reale (mouse o penna, senza bottoni premuti) riporta `pressure: 0`
  per definizione. Verificato con la stessa emulazione: pressure distingue
  correttamente un tap, una penna in hover reale e una penna che tocca
  senza aver mai "sorvolato".
- ⚠️⚠️ **`revealed = isOpen || hovered` rompeva l'esclusività "un vassoio
  aperto per volta"** che l'issue #62 aveva già risolto con l'`openId`
  condiviso: `hovered` è locale a ogni riga e non passa mai da `openId`,
  quindi una riga aperta con lo swipe (`isOpen`) e una riga DIVERSA sotto
  il mouse nello stesso istante (`hovered`) mostravano **due vassoi
  insieme** — l'hover aggirava l'unico meccanismo che garantiva
  l'esclusività. Corretto con `revealed = isOpen || (hovered && !anyOpen)`:
  l'hover non rivela mentre un'altra riga è aperta via swipe, e `isOpen`
  copre comunque il caso in cui la riga aperta sia anche quella sotto il
  mouse. Verificato: drag-apri una riga, poi hover su un'altra — resta
  aperta una sola.
- **`aria-expanded` seguiva solo `isOpen`, mai `hovered`**: con la riga
  rivelata dal solo passaggio del mouse (bottoni Modifica/Archivia già
  montati e cliccabili), l'accessibilità continuava a dichiararla
  "chiusa". Ora segue `revealed`.

⚠️ **Lezione di metodo doppia.** Primo: chiudere un buco enumerando i NOMI
di dispositivo invece della PROPRIETÀ che conta davvero (qui, `pressure`)
lascia sempre un nome fuori dall'elenco — la stessa classe di difetto già
scritta altrove in questo documento sotto altre forme. Secondo: un secondo
giro di review sulla STESSA modifica, chiesto esplicitamente prima di
mergiare, ha trovato un difetto (l'esclusività rotta) che il primo giro —
mirato al sintomo touch — non aveva motivo di cercare: un giro di review
copre le domande che si è fatto, non tutte quelle che si potevano fare.

Merged 2026-09-21, PR #106.

#### PR 28d — sheet e modali centrati da `lg:` in su

Ultima delle quattro PR. Mockup Claude Design **prima** del codice, come
ogni fase grande di questo progetto: due nuovi artboard sul canvas esistente
("Seichi — Responsive tablet/desktop") — `Sheet-Tablet.dc.html` (un dialog
generico, contenuto ispirato a `CategorySheet`) e
`TransazioneModale-Tablet.dc.html` (il wizard, con un `data-props` enum
`step` per passare fra i tre passi dal pannello Tweaks, come già fa
`Sidebar.dc.html` con `active`).

Scope confermato con un giro di esplorazione dedicato, non assunto:
**esclusivamente** `BottomSheetShell.tsx` (guscio condiviso da
`AccountSheet`/`CategorySheet`/`GoalSheet`/`RecurringSheet`/`CoachBubble`) e
`TransactionModal.tsx`/`TransactionForm.tsx` (wizard transazione, markup
proprio perché montato direttamente dal layout di `(main)`, non da un
genitore che lo apre/chiude). Fuori scope, verificato invece di supposto: i
dialog di conferma eliminazione (`CategoryManager`/`RecurringManager`) sono
già centrati, `AttachmentPicker` (visore ricevute) è già centrato,
`NotificationBell`/`AccountSelector` sono pannelli ANCORATI al trigger — non
sheet — e `AppLockScreen`/`AppLockSettings` restano deliberatamente a
schermo intero (Fase 26a).

##### `BottomSheetShell.tsx` — solo classi `lg:`, zero nuova logica

- `lg:items-center lg:justify-center lg:p-6` sul contenitore (era solo
  `items-end`), `lg:max-w-md` sul pannello (448px — verificato contro il
  contenuto reale: griglie a colonne FISSE come `grid-cols-5` di
  `CategorySheet`, quindi più larghezza è sempre più comodo, mai più
  stretto), `lg:hidden` sul manico (nessuno swipe da mouse).
- ⚠️ **L'ombra cambia UTILITY, non solo intensità.** `modal-shadow-ring` è
  direzionale (`0px -24px 70px`, tarata per un foglio il cui fondo è fuori
  schermo — niente ombra sotto, perché sotto non c'è nulla da illuminare).
  Un dialog centrato fluttua libero su tutti i lati e ne avrebbe bisogno:
  `lg:box-shadow-ring` (già esistente in `globals.css` per i box a caduta
  simmetrica) la sostituisce interamente sopra il breakpoint. Stesso schema
  — classe base + variante `lg:` sulla stessa proprietà — già usato da
  `LoginForm.tsx:32` per lo stesso issue #81.
- `rounded-t-4xl` (solo gli angoli superiori, corretto per un foglio a filo
  col fondo) diventa anche `lg:rounded-4xl` (tutti e quattro, il dialog
  fluttua libero).
- `maxHeight: "90dvh"` è uscito dallo `style` inline per entrare in classi
  (`max-h-[90dvh] lg:max-h-[85dvh]`): un valore inline non può differenziarsi
  per breakpoint, una classe sì.

##### `TransactionModal.tsx` + `TransactionForm.tsx` — stesso guscio, più un bug vero

Stesso trattamento (`lg:items-center lg:justify-center lg:p-6`,
`lg:rounded-4xl`, `lg:box-shadow-ring` su `modal-shadow`, manico
`lg:hidden`), applicato al markup proprio del wizard. `h-dvh` resta
invariato sotto `lg:`; sopra diventa `lg:h-[min(760px,85dvh)]
lg:max-w-md` — un'altezza fissa validata prima sul mockup (il passo
"importo" è il più vincolante: tastierino `grid-cols-3` a proporzione fissa
`flex:6`/`flex:4`, pensato per riempire lo schermo di un telefono SENZA
scroll) e poi confermata sui numeri veri, che si sono rivelati persino più
comodi della stima a mano.

⚠️⚠️ **Il bug reale, non solo estetico**: i bottoni "Continua" (passo
importo, `TransactionModal.tsx`) e "Salva movimento" (passo dettagli,
`TransactionForm.tsx`, stesso identico pattern — anzi lo stesso commento nel
codice lo dichiarava già "stessa posizione del Continua") erano entrambi
`fixed left-6 right-6`, ancorati ai bordi REALI del **viewport**. Su un
dialog centrato `fixed` avrebbe fatto scappare il bottone ai bordi della
finestra del browser invece che a quelli della card — un bottone che
galleggia fuori dal dialog. Corretto con `fixed lg:absolute` su entrambi:
l'antenato posizionato più vicino (il div "contenuto", `relative`) esiste
già in entrambi i punti, non serve aggiungerlo. `left-6`/`right-6`/il
`bottom` inline restano identici: coincidono già col `px-6` del contenitore
di riferimento in entrambi i casi, ed `env(safe-area-inset-bottom)` risolve
a 0 su desktop.

##### Tasto Esc — valutato e scartato

Nessun componente dell'app gestisce oggi Escape (solo `useCloseOnBack` per
il tasto/gesto "indietro" del browser). Aggiungerlo sembrava
l'affordance ovvia per un dialog centrato desktop, ma `AttachmentPicker.tsx`
(il visore ricevute a schermo intero) monta DENTRO `TransactionForm` — quindi
dentro `TransactionModal` — e non ha alcuna gestione di Escape propria. Un
listener `keydown` globale sul wizard avrebbe intercettato Escape anche
mentre l'utente guarda una ricevuta ingrandita, chiudendo l'INTERO wizard
(form compreso) invece del solo visore: un difetto vero, introdotto da
un'aggiunta non richiesta. Risolverlo bene avrebbe richiesto coordinare
l'ordine dei listener fra due componenti indipendenti — più complessità di
quanta ne serva per un'affordance che l'issue non chiedeva. La chiusura
resta quindi su tre meccanismi identici sotto e sopra `lg:`: bottone X
(sempre presente, ogni foglio ha il proprio), tap sul backdrop, tasto/gesto
"indietro" del browser.

##### Il collaudo

Driver Playwright ad hoc (come 28a/28b), sessione riusata via cookie, tema
forzato con i due cookie della Fase 18 (`seichi-theme`/`seichi-theme-resolved`)
per evitare di dover toccare l'interfaccia. Verificato a 768px (invariato:
pannello ancorato al fondo, larghezza piena, solo angoli superiori
arrotondati, manico visibile), 1024px e 1440px (dialog centrato
orizzontalmente E verticalmente, larghezza ridotta, angoli tutti
arrotondati, ombra presente, manico nascosto) per `CategorySheet` e
`GoalSheet` — bastano loro due a rappresentare tutti e cinque i fogli,
condividono lo stesso guscio — e per i tre passi di `TransactionModal`, con
misura diretta (bounding box) che il bottone "Continua"/"Salva movimento"
resta DENTRO i bordi della card in ogni combinazione. Tema scuro per il giro
completo, tema chiaro per un passaggio più leggero (`CategorySheet`@1024,
wizard@1440) — entrambi confermano il contrasto e la leggibilità della
griglia icone a 5 colonne. Zero errori console in ogni giro.

⚠️ **Un KO, diagnosticato prima di scartarlo — la regola di sempre.** Il
click sul backdrop per chiudere il wizard falliva SOLO a 768px. Non un
difetto: a quella larghezza il pannello è `w-full h-dvh`, cioè copre
**l'intero schermo** — non c'è alcun backdrop esposto su cui cliccare, ed è
il comportamento di sempre, non toccato da questa fase (la chiusura lì
passa dal bottone X o dal tasto/gesto indietro, mai dal tap fuori, perché
"fuori" non esiste). Il test provava un gesto che l'interfaccia non ha mai
promesso sotto `lg:`.

##### Tastiera fisica sul passo "importo" — chiesto dopo il merge

Il tastierino del passo "importo" rispondeva solo al mouse/tocco
(`onPointerDown` sui tasti disegnati): comodo su un telefono, un passo
indietro su un dialog che ora vive anche su desktop, dove digitare le
cifre sulla tastiera è più naturale che cliccare un tasto alla volta.

`handleAmountKey` è diventato un `useCallback` a dipendenze vuote (usa
solo l'updater funzionale di `setAmount`) apposta perché un secondo
`useEffect` — attivo SOLO mentre `step === "amount"`, su `window` — lo
richiama per ogni tasto fisico premuto: cifre, `,`/`.` (entrambi mappati
alla virgola, per non legare la funzione al layout di tastiera di chi
digita), `Backspace`. Vincolato al passo "importo" perché il passo
"dettagli" ha campi di testo veri (`TransactionForm`): un ascoltatore
sempre acceso ruberebbe le cifre digitate lì prima che arrivino al campo
giusto. `e.preventDefault()` su `Backspace` in particolare — senza,
Firefox con nessun campo a fuoco lo legge come "torna indietro" invece
che "cancella l'ultima cifra".

⚠️ **Il mouse resta utilizzabile insieme alla tastiera**, non alternativo:
nessuna delle due vie disabilita l'altra, `handleAmountKey` è la stessa
funzione per entrambe.

Collaudato con Playwright a 768px e 1024px: digitazione fisica, Backspace,
virgola, bottone "Continua" che si abilita, e un click sul tastierino a
schermo subito dopo — a conferma che le due vie convivono. ⚠️ Il primo giro
a 1024px dava tutto vuoto: non un difetto del listener, ma del driver di
collaudo — un click "neutro" prima di digitare cadeva sul backdrop esposto
sopra il dialog centrato e lo chiudeva. Tolto il click superfluo (il
listener è su `window`, non serve alcun fuoco), il giro successivo è
verde su entrambe le larghezze.

