# #62 — conti: swipe, dettaglio, eliminazione a zero movimenti

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Conti — swipe per modificare/archiviare, `/conti/[id]`, eliminazione a zero movimenti (issue #62)

Implementata il 2026-09-02. Nessuna migration: tocca solo l'interazione della
lista `/conti` e aggiunge una pagina di dettaglio, `deleteAccount()` compresa.

#### Le tre decisioni prese prima di scrivere codice

1. **«Cancella» non esisteva, ed è una scelta esplicita del progetto** — la
   20a l'aveva già presa: `transactions.account_id` è `on delete no action`
   proprio perché cancellare un conto non deve portare via anni di movimenti.
   Serviva però una via d'uscita reale per il caso opposto: **un conto creato
   per sbaglio, con zero movimenti**, che oggi restava archiviabile ma non
   eliminabile — sporcava l'elenco per sempre. `deleteAccount()` copre
   esattamente e solo questo caso.
2. **Dove si decide se un conto è eliminabile.** Non nel vassoio dello swipe:
   saperlo per ogni riga a ogni apertura di `/conti` costerebbe query in
   parallelo per ogni conto attivo, sulla stessa pagina per cui questo
   progetto ha già dimezzato le richieste della home. **Il vassoio mostra
   sempre "Archivia"; "Elimina" compare dentro il foglio "Modifica"**,
   verificato con UNA query quando il foglio si apre — un gesto dell'utente,
   non un render passivo della lista.
3. **"Riattiva" sugli archiviati resta visibile, niente swipe per loro.**
   Aggiungere lo swipe anche alle righe archiviate avrebbe messo due modelli
   di interazione sulla stessa riga — il bottone sempre visibile e un gesto
   da scoprire. Le righe archiviate restano tap-only (verso `/conti/[id]`,
   dove "Modifica" resta comunque raggiungibile) più il bottone inline.

#### Il vassoio: `transform`, non `overflow-x`

La riga ha `card-shadow`, e per specifica CSS un asse non `visible` ritaglia
**anche l'altro** — la stessa trappola già pagata due volte in questo
progetto (il carosello della home, la `FilterBar` della 21c). Il vassoio è un
`div` assoluto **sotto** la riga, che è un `button` — non un `div` con un
`button` dentro — e trasla con `translateX()` per rivelarlo. Nessun
`overflow` da gestire, quindi nessun ritaglio possibile.

`touch-action: pan-y` sulla riga lascia il browser libero di gestire lo
scorrimento verticale dell'elenco; l'orizzontale lo intercettano i gestori
pointer, con una soglia di 6px prima di impegnarsi su un asse — sotto,
un tremolio del dito verrebbe letto come una direzione a caso.

Un vassoio aperto per volta (`openId`), e il tap altrove lo chiude: un
backdrop trasparente a schermo intero (z-20) cattura i tap fuori dalle righe
(z-30), mentre le righe stesse — aperte o no — chiudono qualunque vassoio sia
aperto al primo tocco, senza navigare.

#### Emerso dal code-review — 5 rilievi, tutti corretti

- ⚠️⚠️ **Una quarta fonte di movimenti, dimenticata al primo giro.**
  `hasAnyMovement()` guardava `transactions.account_id`, `to_account_id` e
  `recurring_rules.account_id` — le tre FK note dallo schema — ma non
  `imports.account_id`, che ha la STESSA `on delete no action` (Fase 21).
  ⚠️ È il caso facile da dimenticare perché non è un "movimento" nel senso
  ovvio: è il *lotto* da cui un import proviene. `deleteTransaction()` non
  tocca quella riga — solo `undoImport()` la cancella, facendo cascare le sue
  transazioni — quindi un conto può restare a zero transazioni pur avendo
  ancora un `imports.account_id` che lo referenzia, se le righe sono state
  tolte una per una invece che con "annulla import". Senza il quarto
  controllo, `canDeleteAccount()` avrebbe mostrato "Elimina" e il DELETE
  sarebbe fallito sul vincolo — lo stesso `23503` grezzo che la Fase 21 aveva
  già promesso di non mostrare mai.
- ⚠️ **`canDeleteAccount()` controllava solo i movimenti, non l'ultimo conto
  attivo.** Un utente con un conto solo e zero movimenti — il caso normale
  appena finito l'onboarding — vedeva comparire "Elimina", lo confermava, e
  riceveva un rifiuto per un motivo DIVERSO da quello per cui il comando era
  apparso: il foglio aveva appena promesso di mostrarlo solo quando è vero.
  Ora `canDeleteAccount()` controlla lo stesso vincolo di `deleteAccount()`,
  con `countActiveAccounts()` condiviso fra le due — scritta una volta perché
  due punti che decidono la stessa cosa devono decidere la STESSA cosa.
- ⚠️ **Mancava `setPointerCapture`.** Senza, un dito che esce dai confini
  della riga prima di sollevarsi (finisce sulla riga sotto) può far perdere
  gli eventi `pointermove`/`pointerup` successivi: la riga resta bloccata a
  metà corsa, e la transizione di chiusura — soppressa finché il drag è
  attivo — non parte mai. La cattura fissa ogni evento successivo al bottone
  di partenza, indipendentemente da dove va il dito.
- ⚠️ **`suppressClick` poteva restare acceso per sempre.** Veniva azzerato
  solo dentro `handleTap`, quindi se un browser non sintetizza un click dopo
  un pan completato (capita su alcuni mobili), il flag restava vero e il
  primo tap genuino dopo quello swipe veniva ignorato in silenzio. Ora si
  azzera anche a ogni NUOVO `pointerdown`, non solo alla fine di un tap.
- ⚠️ **Una corsa fra "carica altri" e un salvataggio altrove.** In
  `AccountDetailClient`, se `loadMore()` era in volo quando
  `transactionSavedAt` faceva scattare un ricaricamento dalla prima pagina, la
  risposta tardiva di `loadMore()` arrivava comunque con `append=true` e si
  appendeva sopra la lista appena azzerata — doppioni o buchi secondo
  l'ordine di arrivo. Chiuso con un contatore di richiesta: solo l'ULTIMA
  chiamata numerata può scrivere lo stato, una risposta superata si scarta.

#### Il collaudo, e cosa resta dichiaratamente non provato

Verificato nell'app vera: la lista mostra le righe corrette, il tap apre
`/conti/[id]`, l'intestazione e il saldo del dettaglio coincidono con quelli
della lista (**stessa vista `account_balances`**, nessun numero ricalcolato,
come vincolato dalla issue), "Modifica" è raggiungibile in chiaro e apre lo
stesso foglio, "Elimina" è **assente** su un conto con movimenti e **compare**
su un conto creato apposta a zero movimenti, il doppio tocco di conferma
funziona, e dopo l'eliminazione si torna a `/conti` con il conto sparito dalla
lista. Il conto di prova è stato creato ed eliminato dall'app vera, e il
database è tornato esattamente com'era prima (3 conti, € 3013,45).

✅ **Il gesto di swipe vero è stato provato dal telefono il 2026-09-02**,
dopo che il primo giro nell'app vera lo aveva lasciato dichiarato e non
provato (Playwright col mouse simula un click, non un trascinamento touch —
la stessa ragione per cui la Fase 22 e la 23b avevano richiesto un
dispositivo reale). Funziona.

⚠️ **Il ramo "riattiva" non è stato verificato**: l'account di collaudo non
aveva conti archiviati in questo giro. Resta dichiarato, non provato — vale
la regola già scritta per la prova `b2` della Fase 22: *una prova che si
autoesclude va lasciata dichiarata e ripresa, non archiviata come superata
perché tutto il resto è verde.*

