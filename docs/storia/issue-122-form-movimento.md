# #122 — form movimento, lista, conti e categorie

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Form movimento, lista, conti e categorie (issue #122)

Dalla review completa del 2026-09-28 (#128). Nessuna migration.

- ⚠️⚠️ **Il tasto "indietro" del wizard smontava il form.** Categoria, conto,
  descrizione, data, "Ripeti" e le foto in coda sparivano senza avviso — e con
  loro `createdId`: dopo una ricevuta fallita, indietro → Continua → Salva
  scriveva un secondo movimento. Il commento "il form non si rimonta" era
  falso. Ora `TransactionForm` si monta al primo "Continua" e poi si nasconde
  negli altri passi (`contents`/`hidden`), e `createdId` vive in
  `TransactionModal`. Non è un'eccezione a "i pannelli si montano": il modale
  continua a montarsi e smontarsi, i passi sono pagine dello stesso modulo.
- **La categoria si ricorda per tipo** (chiave `categoryTypeFor`): ora che il
  form sopravvive al ritorno alla griglia dei tipi, una sola `categoryId`
  avrebbe spedito "Alimentari" dentro un'entrata. E le categorie caricate
  portano il tipo per cui sono state chieste.
- **Una volta che il movimento esiste** (in modifica, o creato da questo
  modale) il tipo è fissato: niente "indietro" fino alla griglia, niente
  "Ripeti", che trasformerebbe un aggiornamento in una regola nuova.
- ⚠️ **`createdId` si registra in un `finally`.** Stava dopo l'await dei
  caricamenti: un'azione che SOLLEVA invece di restituire `{ error }` usciva
  prima, e la riprova duplicava movimento e ricevuta. Non subito dopo il
  salvataggio, però: dare l'id al picker fa partire la sua rilettura, che
  correrebbe contro i caricamenti. Nel frattempo il bottone è spento.
  `uploadPending` ha un `try` per ogni ricevuta, `handleSave` un `catch`.
- **Chiudere dopo una scrittura aggiorna le liste**: `handleClose` chiama
  `notifyTransactionSaved()` se il form o il picker hanno scritto qualcosa.
  Prima, chiuso con la X dopo una ricevuta fallita, il movimento scritto non
  compariva fino al ricaricamento.
- **Salvataggio ed eliminazione falliti ora lo dicono** (era il primo punto
  degli "errori ingoiati" della #124): `if (result?.error) return` riaccendeva
  il bottone e basta.
- **Niente ricevute con "Ripeti" acceso**: una regola non è un movimento e
  `createRecurringRule` non restituisce un id, quindi la foto scelta spariva al
  salvataggio senza dirlo. Il picker resta montato ma nascosto, con una frase
  al suo posto, e spegnendo "Ripeti" le foto tornano.
- ⚠️⚠️ **Eliminare un conto da `/conti/[id]` non riportava a `/conti`.**
  `onClose()` smonta il foglio, e il cleanup di `useCloseOnBack` toglie la sua
  voce con `history.back()`: il `popstate` arriva al router di Next come un
  "indietro" vero (traverse alla pagina sotto) e scarta il `router.push` ancora
  in volo. Si restava sull'estratto di un conto cancellato. Ora
  `whenModalEntryGone()` aspetta che la voce sia tolta, e solo dopo si naviga,
  con `replace` — l'estratto eliminato non resta dietro il tasto indietro. Il
  nostro ascoltatore è registrato dopo quello di Next, quindi la navigazione
  arriva dopo il ritorno e vince. ⚠️ Riguarda **solo** chi naviga dopo aver
  chiuso un pannello: gli altri fogli fanno `refresh()` + chiusura, e il
  ritorno usa la cache già aggiornata dall'azione.
- **Il tipo di una categoria USATA non si cambia** (`updateCategory`, con
  movimenti o regole ricorrenti). Il tipo di un movimento è fissato, e i suoi
  movimenti restavano con una categoria di un altro tipo: "senza categoria"
  nel form, un obiettivo convertito spariva da `/risparmi`. Si rifiuta come
  `deleteCategory`: avvisare e lasciar fare scriverebbe proprio l'incoerenza.
- **`CategorySheet`: la lettura del budget ha uno stato suo.** Una lettura
  fallita appariva come "nessun limite", e cambiando tipo la lapide non veniva
  scritta. Ora i campi restano spenti finché la lettura non è finita, la
  fallita lo dice, e un cambio di tipo fuori dalle spese senza la lettura
  viene rifiutato prima di scrivere la categoria. Rinominare resta possibile.
- **La ricerca toglie gli spazi dall'ago**: "Revolut " (con lo spazio del
  suggerimento di iOS) non trovava niente.

#### Emerso dal code-review (8 rilievi + 1 al secondo giro, 7 applicati)

Quasi tutti nella stessa famiglia, ed è la lezione del giro: **tenere montato
un form che prima si smontava fa sopravvivere OGNI stato al cambio di tipo**,
non solo quelli per cui lo si è fatto. Ogni `useState` va riletto chiedendosi
se vale ancora per un tipo diverso.

- ⚠️⚠️ **La destinazione del trasferimento passava al risparmio.** Obbligatoria
  là, facoltativa qui: tornando ai tipi il denaro si sarebbe spostato su un conto
  che per quel risparmio nessuno aveva scelto. Ora si ricorda per tipo, come la
  categoria, e una destinazione uguale all'origine si DERIVA nulla invece di
  essere cancellata dall'handler — con una voce per tipo la collisione può
  nascere su un tipo che non è a schermo.
- ⚠️ **"Ripeti" era offerto sul disinvestimento**, già su master:
  `recurring_rules_type_check` lo esclude (21b), e il form escludeva a mano solo
  il trasferimento. Ora `canRepeat()` in `lib/recurring.ts` è lo specchio del
  CHECK, usato dal form e da `createRecurringRule`.
- **Le foto in coda si perdevano passando per il trasferimento**, che smontava
  il picker. Ora il picker si nasconde da sé (`hidden`) e, solo se ha foto in
  coda, dice che non verranno allegate (`hiddenNote`) — trovato al secondo
  giro: nascosto e muto, il salvataggio di un trasferimento le scartava senza
  dirlo.
- L'errore di salvataggio vale per il tipo con cui è nato; creato il movimento,
  il bottone dice "Salva modifiche".

Lasciati: `loadPage` di `/transazioni` senza `catch` (è nella #124); un
`SELECT` in più a ogni salvataggio di categoria (gesto raro, e il controllo
deve leggere il tipo vero dal server); e la proposta di spostare
`whenModalEntryGone` dentro l'hook, che non può sapere se dopo la chiusura
arriverà una navigazione.

#### ⚠️ Il terzo punto della issue non si riproduce, e va scritto

`/transazioni` non aveva la guardia `requestId` di `AccountDetailClient`, e la
issue descriveva risposte fuori ordine che mostrano un altro filtro. Collaudato
rallentando di 3,5 secondi la prima richiesta: **su master lo stato finale è
già giusto, e nemmeno un lampo** (campionato ogni 50 ms). Il motivo sta nei
documenti di questa versione di Next (`server-actions.md`): il client spedisce
le server action **una alla volta**, quindi le risposte arrivano in ordine — e
mentre arriva la vecchia la lista è ancora in caricamento. La guardia è entrata
lo stesso, con il commento che dice il vero: la documentazione chiama la
sequenza "un dettaglio d'implementazione che può cambiare". **Un difetto
PLAUSIBILE va provato prima di essere dichiarato chiuso** — qui la prova ha
detto che non c'era.

#### Il collaudo

2026-10-02, nell'app vera su un account di prova usa e getta (autorizzato da
Jomar, eliminato dall'app alla fine): **34 controlli su 34** col branch, i
rilievi della review compresi, ciascuno letto anche nel database col token
dell'account. I guasti: una ricevuta GIF
(rifiutata da `uploadAttachment` con `{ error }`) e un 500 sull'azione di
caricamento (il ramo dell'eccezione). **Controprova** col codice di master
(`git stash`): i campi si azzerano, il secondo "Salva" crea un duplicato (1 → 2)
in entrambi i rami, l'eccezione non dice niente, il movimento chiuso con la X non
compare, "Revolut " non trova niente, il tipo cambia sotto i movimenti, il budget
fallito sembra "nessun limite", e dopo l'eliminazione si resta su
`/conti/<id>`.

Tre trappole del driver, da ricordare:

- ⚠️ **"Alimentari" compare anche nelle righe della lista DIETRO il modale**: un
  selettore generico prendeva quella, coperta, e il clic andava in timeout. Il
  menu di `Select` è il fratello del bottone.
- ⚠️ **Il corpo di un'azione con un file è multipart, e `postData()` non lo dà
  come testo**: si legge `postDataBuffer()`. E i campi si chiamano
  `_1_transactionId`, non `transactionId`.
- Una nota fissa per movimento si somma fra un giro e l'altro: il conteggio
  diceva 2 per il residuo del giro prima. Note uniche per esecuzione.

