# #165 — i pannelli come finestre di dialogo: ruolo, nome, fuoco, Esc, inert

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Da dove arriva (2026-11-19)

Due issue sulla stessa cosa, unite in una:

- **#165** (dal report sullo stato del progetto, 2026-11-07): con la sola
  tastiera l'app non si usa. Nessun pannello porta il fuoco, lo trattiene o lo
  restituisce; Esc funziona solo nel menu profilo.
- **#211** (dal collaudo di #162 e #163, 2026-11-18): un
  `getByRole("dialog")` dopo il tocco su «Aggiungi transazione» contava zero
  dialog, con il pannello aperto a schermo.

Chiusa la #211 come duplicato; i suoi dettagli (i quattro fogli senza nome,
`aria-labelledby` dal titolo, `inert`, Esc che non deve arrivare al passo
dell'importo, `Select` e notifiche da guardare) sono passati nella #165.

### Cosa c'era

Un giro su tutti gli strati che si aprono sopra la pagina, non solo i due della
issue:

| tipo | quali | prima della #165 |
|---|---|---|
| modali | i 5 fogli di `BottomSheetShell`, `TransactionModal`, il visore delle ricevute, le conferme di `CategoryManager` e `RecurringManager` | dialog solo `CoachBubble` |
| ancorati a un comando | `NotificationBell`, `AccountSelector`, `ProfileMenu`, `Select`, `DatePicker`, il menu della finestra di grazia del PIN | Esc solo in `ProfileMenu`, con un ascoltatore suo |

E in più, per la regola dei bottoni di sole icone (`react.md`,
Accessibilità 1): la X di quattro fogli su cinque, la X e la freccia indietro
del wizard e le frecce del calendario non avevano un nome.

### La decisione: `inert` fuori dal ramo, non `<dialog>` nativo

Due strade, scelta la seconda con Jomar.

**`<dialog>` con `showModal()`** fa da sé quasi tutto: sfondo inerte, Esc,
pannelli annidati. Scartato perché un dialog nativo vive nel *top layer*, sopra
ogni z-index, mentre il velo del PIN copre con lo z-index (`AppLockScreen`, 65).
Bloccandosi con un foglio aperto, il foglio sarebbe rimasto visibile **sopra**
il velo, con i conti in chiaro. In più avrebbe cambiato il guscio che la #81 ha
sistemato in tre tentativi su Firefox.

**Un hook nostro, `useDialog`** (`components/UI/useDialog.ts`): all'apertura
risale dal pannello fino a `<body>` e rende `inert` i fratelli di ogni antenato.
Il pannello resta dov'è nel DOM, senza portali. Con lo sfondo inerte il Tab non
può uscire dal pannello senza altro codice.

Le attenzioni, tutte scritte nel codice:

- **un contatore per elemento**, non un sì/no: visore e wizard possono rendere
  inerte lo stesso nodo, e chiudere uno dei due non deve risvegliarlo;
- **un `inert` che c'era già non si tocca** (quello di `AppLockProvider`):
  toglierlo alla chiusura sveglierebbe ciò che il velo copre;
- **si parte dall'elemento più esterno** (`rootRef`, sfondo compreso): partendo
  dal pannello, lo sfondo, suo fratello, diventava inerte e il tocco fuori non
  chiudeva più;
- **ciò che compare dopo l'apertura non diventa inerte**: il velo del PIN deve
  anzi restare vivo, e inseguire ogni nodo nuovo vorrebbe un
  `MutationObserver` per elementi che stanno comunque sotto lo sfondo.

⚠️ Per la seconda PR (gli annunci): un elemento inerte è muto anche per lo
screen reader. La regione `aria-live` che annuncia l'esito mentre un pannello
si chiude non deve finire fra i fratelli resi inerti.

### Fuoco e nome

- Il nome viene dal **titolo visibile** (`aria-labelledby`), così non può
  divergere da ciò che si legge. I fogli disegnano il titolo da sé, quindi
  `BottomSheetShell` vuole un `titleId` **obbligatorio** (prima c'era un
  `ariaLabel` facoltativo, e lo passava uno solo). `label` solo per il visore,
  che un titolo non ce l'ha; lo stesso testo è l'`alt` dell'immagine (#135, §10).
- All'apertura il fuoco va sul **pannello**, non sul primo campo: sul telefono
  un campo a fuoco apre la tastiera, che coprirebbe metà foglio a ogni
  apertura.
- Alla chiusura torna a chi l'aveva prima, se esiste ancora e non è a sua volta
  sotto un pannello.

### Esc: una pila, un ascoltatore

Il difetto per cui la 28d aveva scartato Esc (`fase-28-responsive`): il visore
vive dentro il wizard, e un ascoltatore sul wizard avrebbe chiuso tutto.

Una pila di strati in memoria di modulo, e un solo ascoltatore sul `document`,
acceso solo a pila non vuota. Esc chiude **lo strato in cima**: col visore
aperto il visore, con una tendina aperta dentro un foglio la tendina. Gli strati
ancorati entrano nella stessa pila con `useDismissLayer` (Esc e ritorno del
fuoco, niente `inert`: un tocco fuori li chiude e la pagina non è coperta).
`ProfileMenu` ha perso il suo ascoltatore: con due ascoltatori separati, un Esc
avrebbe chiuso il menu e il pannello sotto.

Esc chiama la stessa `onClose` della X e del tocco sullo sfondo, quindi
`useCloseOnBack` toglie la propria voce dalla cronologia come con loro (#86). Il
passo dell'importo ascolta solo cifre, virgola e Backspace: Esc non lo tocca.

Le due conferme di eliminazione erano blocchi ricopiati a mano: ora sono un
guscio solo, `ConfirmDialog`, perché la correzione non tocchi uno e non il suo
gemello (lezione 3).

### Il collaudo

`tests/e2e/dialog.spec.ts`, tre scenari:

1. il wizard aperto da tastiera è un dialog col nome «Nuovo movimento», ha il
   fuoco, venti Tab non escono mai dal pannello, Esc lo chiude, il fuoco torna
   al + e la voce della cronologia se ne va;
2. Esc chiude solo lo strato in cima: la tendina «Conto» dentro il wizard, poi
   il visore di una ricevuta in coda (dialog «Ricevuta», immagine con `alt`),
   poi il wizard;
3. il foglio «Modifica categoria» e la conferma «Elimina categoria» sono dialog
   col nome del titolo, Esc chiude, e la categoria resta nel database.

Le controprove, una mutazione alla volta in `useDialog.ts` e una build per
ciascuna:

| mutazione | cade |
|---|---|
| c1 · niente `role="dialog"` | tutti e tre, al primo `getByRole("dialog")` |
| c2 · Esc chiude il fondo della pila | solo il secondo, sulla tendina: il wizard sotto si chiude con lei |
| c3 · niente `inertOutside()` | solo il primo, sul giro di Tab (13 comandi della pagina raggiunti) |
| c4 · il fuoco non torna | tutti e tre, ciascuno sul suo «il fuoco torna» |

⚠️ **Un rosso che non era dell'app.** Al primo giro, e di nuovo durante c2, due
test caddero su `PGRST303 JWT issued at future`: Docker Desktop era appena
partito e l'orologio della sua macchina virtuale era indietro rispetto a
Windows. Rilanciati, verdi; c2 rifatta da sola per vedere che cadesse il test
previsto e nessun altro.

### Rimasto fuori, di proposito

- **Indietro col visore aperto chiude l'intero wizard**: il visore non ha una
  voce sua nella cronologia, e `useCloseOnBack` non ne spinge una seconda se
  trova già `seichiModal`. È un'altra strada da Esc, con le sue trappole (#122,
  il doppio montaggio di React): **#214**.
- **Frecce nelle tendine** (`Select`, `DatePicker`): Esc sì, la navigazione con
  le frecce no. È il giro di tastiera della #135, §10.
- **Le righe di `/conti`** si rivelano ancora solo con swipe o mouse.
- **Gli annunci** (`aria-live` per gli esiti dei salvataggi): seconda PR della
  #165.
- **La prova con VoiceOver e TalkBack o NVDA** sul dispositivo vero: di Jomar.
