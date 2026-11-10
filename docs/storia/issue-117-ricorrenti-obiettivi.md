# #117 — ricorrenti e obiettivi

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Ricorrenti e obiettivi — regole che scrivevano dove non dovevano (issue #117)

Dalla review completa del 2026-09-28 (#128). Nessuna migration. Quattro difetti,
tutti invisibili a `tsc`, e tre su quattro con lo stesso effetto: il job
notturno che scrive movimenti che nessuno ha chiesto.

- ⚠️ **"Aggiungi movimento" dalla lista vuota creava una regola mensile.**
  `onAction={openTransactionModal}` passava il MouseEvent come `recurring`: un
  oggetto, cioè vero, e "Ripeti" partiva acceso. `tsc` non lo vede perché
  `() => void` accetta una funzione con un parametro opzionale. Chiuso in due
  punti: la freccia nel chiamante, e `recurring === true` nello store, che
  vale anche per il prossimo che passerà l'handler nudo.
- ⚠️ **Pausa → archivia il conto → riprendi aggirava la 20b.** Il rifiuto sta
  in `setAccountArchived`, che conta solo le regole ATTIVE; `setRecurringActive`
  non guardava il conto. **Un'invariante fra due tabelle va difesa da entrambi
  i lati da cui si può rompere.** Ora "riprendi" rifiuta e dice il rimedio
  (cambiare il conto da "modifica"). E una lettura fallita della regola non
  riattiva più con il `next_run` vecchio, che al giro dopo generava tutti gli
  arretrati della pausa. `RecurringManager` mostra gli errori, prima ingoiati.
- ⚠️ **Eliminare un obiettivo lasciava viva la sua regola.** La FK
  `recurring_rules_category_id_fkey` è `on delete set null`: la regola restava
  attiva senza categoria e ogni mese scriveva un `risparmio` che non va a
  nessun obiettivo. `deleteGoal` ora elimina le regole (dopo i versamenti,
  prima della categoria: un guasto a metà lascia uno stato coerente);
  `deleteCategory` rifiuta finché esistono regole, attive o in pausa, come già
  rifiutava con i movimenti. La conferma dell'obiettivo dice quanti versamenti,
  per quale importo e quante regole spariscono, letto al primo tocco
  (`getGoalDeletionImpact`, schema di `canDeleteAccount` della #62); il secondo
  tocco resta spento finché la frase non c'è.
- ⚠️ **Una ricorrente con partenza passata spostava la cadenza.** `firstRunFrom`
  portava `next_run` a oggi: l'affitto del 31 agosto registrato il 2 settembre
  finiva nel flusso di settembre e poi usciva ogni 2 del mese.
  `rollForwardPastToday` da sola, suggerita dalla review, avrebbe **saltato** il
  31 agosto, cioè proprio il movimento che l'utente stava registrando.
  `firstRunForNewRule` riparte dall'occorrenza più recente già dovuta, alla sua
  data vera: al più un movimento retroattivo, mai la raffica. Residuo
  dichiarato: con una partenza lontana si genera solo l'ultima occorrenza.

Collaudo del 2026-09-29, **nell'app vera su un account di prova usa e getta**
(autorizzato da Jomar, registrato dall'app ed eliminato alla fine con
`delete_current_user()`): i cinque criteri della issue, ciascuno letto a schermo
**e** nel database con il token dell'account di prova — 19 controlli su 19. Lo
stato di partenza (secondo conto, obiettivo con versamento, regole) si prepara
via REST; i gesti sotto prova passano dall'interfaccia. Più la logica delle date
con 10 casi, confrontata col passo `+ interval` del job SQL.

**Controprova** col codice di `master` rimesso a mano su `action.ts`, store e
lista, stessi gesti: il form si apre su "Crea ricorrenza", "riprendi" riattiva
la regola sul conto archiviato, e l'affitto del 31/08 esce datato 29/09 con
prossima esecuzione al 29/10. Il criterio 3 non è stato controprovato: là il
controllo legge direttamente il database (regola presente o assente).

Due cose viste solo **guardando gli screenshot**:

- ⚠️ **L'avviso di "riprendi" usciva sbiadito.** Stava dentro la card, e una
  regola in pausa è al 60% di opacità — cioè proprio la regola su cui l'avviso
  compare. Ora sta sotto la card; il driver ne misura l'opacità EFFETTIVA (il
  prodotto lungo gli antenati), che è 1.
- **"Serve un conto per registrare un movimento"** nel primo scatto del form,
  su un account che il conto ce l'ha: il falso allarme già registrato nella 20b
  (i conti arrivano da una query, e alla prima apertura si compila anche il
  modale). Con 6 secondi di attesa il form propone "Conto principale".

