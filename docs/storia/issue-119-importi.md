# #119 — importi scritti a mano, un parser solo

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Importi scritti a mano — un parser solo (issue #119)

Dalla review completa del 2026-09-28 (#128). Nessuna migration. Ogni campo
importo leggeva il testo a modo suo, e in tre casi salvava un valore diverso da
quello scritto senza dirlo: le ricorrenti toglievano il punto ("12.50" → € 1250,
replicato dal cron ogni mese), il budget lo leggeva come decimale ("1.200" →
1,2), e con `type="number"` un testo che il browser non capisce arrivava vuoto
(saldo iniziale sovrascritto con 0, traguardo rimosso). Il tastierino accettava
decimali e cifre senza limite: "12,999" diventava 13,00 nella colonna.

Ora c'è `lib/amount.ts`, e il suo contratto è l'opposto: **o legge il numero che
la persona intendeva, o dice che non ci riesce.** Mai un terzo numero plausibile.

- **Virgola e punto sono entrambi decimali, in entrambe le lingue.** Il
  tastierino `inputMode="decimal"` mostra il separatore della REGIONE del
  telefono, non della lingua dell'app. Tutti i campi sono `type="text"`.
- ⚠️ **L'ambiguo lo decide la lingua, non la regola dell'import.** Un solo
  separatore seguito da tre cifre: `parseAmount` (`lib/import/csv.ts`) lo legge
  sempre come migliaia, perché un file arriva da chiunque. Un campo lo scrive
  chi usa l'app in una lingua precisa: il separatore delle migliaia della lingua
  vale migliaia ("1.200" in italiano = 1200), quello decimale vale decimale, e
  allora tre decimali sono un **errore** ("1,200" in italiano). Un importo mille
  volte più grande scritto senza chiedere è peggio di un errore che si corregge.
  Le due funzioni divergono **di proposito**: non unificarle per simmetria.
- ⚠️ **Uno zero davanti non è mai un gruppo di migliaia.** Trovato rileggendo il
  parser, non da un controllo: "0.500" in italiano sarebbe diventato 500.
- **Vuoto e illeggibile sono due stati** (`AmountInput`): il vuoto resta ciò che
  il campo dice (0 per il saldo iniziale, "nessun traguardo", "nessun budget"),
  l'illeggibile ferma il salvataggio con un messaggio sotto il campo.
- ⚠️ **`CategorySheet` validava il budget DOPO aver scritto la categoria**: un
  importo sbagliato salvava comunque metà del form. Ora lo legge prima di
  qualunque scrittura. `GlobalBudgetSection` aveva lo stesso parser del budget
  di categoria e la issue non la nominava: corretta insieme.
- **Il tastierino è un campo VINCOLATO** (`applyAmountKey`): la terza cifra
  decimale e la nona intera non entrano, e il tasto decimale mostra il
  separatore della lingua. "1.250" digitato con il punto delle migliaia si
  ferma a "1,25": quello che si vede è quello che si salva, mentre prima lo
  schermo diceva "1,250" e la colonna 1,25.
- ⚠️ **Con il tetto, "99999999,99" è un importo valido e raggiungibile, e a
  `text-8xl` usciva da entrambi i bordi del foglio.** Visto solo guardando lo
  screenshot. La cifra ora scala con la lunghezza, e il driver misura che stia
  nello schermo.
- **`isStorableAmount()` nelle server action** che ricevono un importo
  (movimenti, ricorrenti, obiettivi, budget, saldo iniziale): la stessa regola
  per una POST diretta, con `t.errors.amountInvalid` invece dell'overflow di
  Postgres.

Residuo dichiarato, precedente: il tastierino decimale di iOS **non ha il segno
meno**, quindi un saldo iniziale negativo non si scrive da iPhone — né prima
con `type="number"`, né ora.

Collaudo del 2026-09-30 nell'app vera, su un account di prova usa e getta
(eliminato alla fine): 33 controlli in italiano e 33 in inglese, ciascuno letto
anche nel database — i quattro criteri della issue sui cinque campi più il
limite globale, più il controllo lato server provato riscrivendo la POST vera
di "Salva modifiche" con un id inesistente (12,999 e 100000000 rifiutati, 12,5
no, regola vera intatta). Più 131 casi del parser in Node. **Controprova** con i
componenti e le action di master: ricorrente 1250, budget 1,2, tastierino 13.
Sul saldo e sul traguardo Chromium desktop smette di accettare caratteri alla
virgola in un `type="number"`, quindi "2.400,50" è uscito **2,4** invece di 0:
un altro valore sbagliato, stesso difetto. Lo 0 della issue è il percorso dei
browser che lasciano passare il testo e consegnano `""`.

Due falsi segnali del collaudo, da ricordare:

- ⚠️ **La risposta RIUSCITA di una server action contiene il dizionario
  intero**: `revalidatePath` rende di nuovo la pagina, e la frase d'errore ci
  sta dentro come voce. Cercare la frase nel corpo dava "errore" anche
  all'importo buono. Si cerca il valore di ritorno, `"error":"…"`.
- **Un conto creato via REST con `color: "ao"` non si salva dal foglio**:
  `validate()` vuole il token intero o NULL, e il foglio rispondeva "Colore non
  valido" mentre il driver leggeva un importo invariato. Lo stato preparato a
  mano deve rispettare le stesse regole delle action che il collaudo usa.

