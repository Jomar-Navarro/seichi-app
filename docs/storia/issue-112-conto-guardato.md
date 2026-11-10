# #112 — il nuovo movimento propone il conto guardato

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

#### Il nuovo movimento propone il conto guardato (issue #112, 2026-09-25)

Emerso usando l'app: con Revolut selezionato in home, "Nuovo movimento"
proponeva "Conto principale", cioè il primo conto attivo. Bisognava cambiarlo a
mano ogni volta, e dimenticarsene scriveva il movimento sul conto sbagliato.

La causa è strutturale: il modale sta nel layout di `(main)` e lo aprono il FAB e
la sidebar, che non sanno quale pagina c'è sotto. È lo stesso caso di
`fullScreenActive` (Fase 26a) — componenti fratelli, non genitore e figlio — e ha
la stessa soluzione: uno stato condiviso, `viewedAccountId` in `useUIStore`.

- **Lo dichiarano le PAGINE**, con `<ViewedAccount>` (server) o
  `useViewedAccount()` (client): home, `/analisi` e `/investimenti` il conto del
  selettore, `/transazioni` il filtro conto, `/conti/[id]` il conto del dettaglio.
  Nessuno lo ricalcola nel client: è la scelta che il server ha già risolto (URL
  = istruzione, cookie = memoria), e le tre pagine server lo rendono **dopo** il
  `redirect` che scarta un conto non tuo.
- ⚠️ **La dichiarazione si ritira confrontando il TURNO, non l'id.** Nel passare
  da una pagina all'altra l'ordine fra smontaggio della vecchia e montaggio della
  nuova non è una garanzia su cui costruire; e con lo stesso conto su entrambe
  (home → `/analisi`, stesso Revolut) un confronto sull'id farebbe cancellare alla
  vecchia la dichiarazione della nuova. `viewAccount()` restituisce la funzione di
  ritiro, che azzera solo se nessuno ha dichiarato dopo.
- **Il form lo usa solo per un movimento NUOVO e solo se il conto è attivo.** Una
  pagina può guardare un conto archiviato — la sua storia resta consultabile — ma
  proporlo vorrebbe dire suggerire di scriverci sopra. In modifica resta il conto
  del movimento. Letto con `getState()` all'apertura, non sottoscritto: un form
  aperto non cambia conto da solo.
- **`/transazioni` dichiara il proprio filtro conto**, che dalla #148 parte dalla
  memoria in cookie: da Movimenti filtrata su Revolut il FAB propone Revolut. A
  filtro vuoto ("Tutti i conti") propone il primo attivo.

Collaudo: 14 controlli nell'app vera, fra cui la navigazione soft home →
`/analisi` (stesso conto, resta proposto) e `/analisi` → `/risparmi`
(dichiarazione ritirata). L'archiviato si prova **senza scrivere** sul database:
Playwright modifica nel browser la risposta REST dei conti. Controprova: tolta la
modifica al form, i sette controlli sul conto guardato diventano rossi e quelli
sul ripiego restano verdi.

⚠️ E due KO erano del driver, non dell'app: la modifica di un movimento si apre
sul passo dell'**importo** come la creazione (serve "Continua" prima del form), e
la sidebar è un `div`, non un `<aside>`.

