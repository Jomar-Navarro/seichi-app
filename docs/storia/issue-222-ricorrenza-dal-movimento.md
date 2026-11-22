# #222 — dal movimento generato alla sua regola

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Da dove arriva (2026-11-22)

Segnalata da Jomar durante la #173, con uno screenshot del pannello «Modifica
movimento» di un abbonamento generato: per cambiare importo o frequenza della
ricorrenza bisognava sapere che esiste Impostazioni › Ricorrenti, e ritrovarla
lì. La colonna che li lega c'era già (`transactions.recurring_rule_id`), e
nessuna schermata la usava. Il titolo del pannello, «Ricorrente», è
l'etichetta del TIPO `abbonamento` e non dice che il movimento viene da una
regola.

### Le decisioni (con Jomar)

- **Il collegamento porta alla pagina Ricorrenti**, non apre un pannello sopra
  il movimento. Lì vivono già pausa, eliminazione e il rifiuto di riprendere
  una regola su un conto archiviato (#117), e due finestre impilate avrebbero
  voluto spostare quella logica fuori dalla pagina.
- **Una riga dice che la modifica vale per i prossimi movimenti.** Chi cambia
  l'importo della regola si aspetterebbe di vederlo cambiare anche nel
  movimento da cui è partito.
- **Niente mockup**: è una riga, sul modello di «Ripeti» nella stessa sezione.

### Come funziona

- `TransactionForm`, in modifica e con `recurring_rule_id`: sezione «Ricorrenti»
  con «Modifica la ricorrenza» e la riga sui movimenti futuri. Il tocco chiude
  il pannello, aspetta `whenModalEntryGone()` e naviga a
  `/impostazioni/ricorrenti?regola=<id>` (`recurringRuleHref()`).
- Tutte le liste che aprono il pannello in modifica (home, Movimenti,
  `/conti/[id]`) leggono le righe da `getTransactions()` con `*`, quindi
  `recurring_rule_id` arriva sempre. Una regola eliminata lo annulla (FK
  `set null`): niente riga.
- La pagina passa il parametro così com'è a `RecurringManager`, che apre il
  pannello nell'inizializzatore di `editing` con `ruleFromParam()`: solo un uuid
  singolo e solo fra le regole lette per l'utente. Un id falso, ripetuto o non
  suo non apre niente.
- **Il parametro si toglie alla chiusura del pannello**, così ricaricando la
  regola già chiusa non si riapre. Due strade scartate, lette nel codice di
  Next installato (`app-router.js`):
  - *all'apertura con `history.replaceState`*: a pagina caricata da zero Next
    installa la sua `replaceState` in un effetto dell'app, che gira DOPO i
    nostri. Quella nativa, chiamata con `null`, azzera lo stato della voce
    (`__NA`), e `handlePopState(null)` di Next ignora poi il ritorno a quella
    voce;
  - *alla chiusura con `history.replaceState`*: dopo un salvataggio
    `RecurringSheet` chiede `router.refresh()` e chiude, e la `replaceState`
    patchata fa un *restore* che potrebbe scavalcare il refresh in volo.
  Scelta: `whenModalEntryGone()` e poi `router.replace()`, lo schema di
  `AccountSheet`. Costa una lettura della pagina in più, solo quando si è
  arrivati col parametro.

### Il collaudo

- **Vitest**: `ruleFromParam` e `recurringRuleHref` (`lib/recurring.test.ts`).
  Mutazione: con il ripiego sulla prima regola invece che su nessuna cade «un
  uuid che non è fra le regole». Il controllo `isUuid` resta come difesa in
  profondità: nessun test lo distingue, perché un valore che non è un uuid non
  sarebbe comunque fra le regole.
- **e2e** (`tests/e2e/ricorrenza-dal-movimento.spec.ts`): dal movimento alla
  regola, modifica dell'importo, URL ripulito, importo nuovo in lista, movimento
  generato invariato, ricaricamento senza riapertura; il gemello senza regola e
  i parametri sbagliati. Tre controprove dichiarate nel commento del file.
