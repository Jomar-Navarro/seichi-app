# #120 — ricevute orfane nello Storage

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Ricevute orfane nello Storage (issue #120)

Dalla review completa del 2026-09-28 (#128), trovato da quattro revisori
indipendenti. Nessuna migration. Documenti con IBAN, nomi e importi restavano
nel bucket dopo che l'utente li aveva cancellati, irraggiungibili e non più
cancellabili da nessuno — per tre strade diverse.

- ⚠️ **`deleteTransaction` e `deleteGoal` non chiamavano `storage.remove()`.** La
  FK di `attachments` in cascata toglieva le righe e lasciava i file. Ora
  raccolgono i path PRIMA del delete con `receiptPathsOf()`
  (`lib/attachment-paths.ts`) e rimuovono i file dopo, con la politica di
  `undoImport`: un fallimento della RIMOZIONE si registra con i path e non
  annulla la cancellazione avvenuta. `deleteGoal` rimuove i file dei
  versamenti **subito dopo il loro delete**, non in fondo: se il passo delle
  regole o della categoria fallisse, il secondo tentativo non li troverebbe più.
- ⚠️⚠️ **`purgeUserFiles` si fermava a 100 file.** `list()` senza opzioni usa
  `{ limit: 100, offset: 0 }`: eliminando un account con 250 ricevute ne
  restavano 150. Ora `purgeStorageFolder()` (`lib/storage-files.ts`) legge la
  prima pagina, rimuove ciò che trova e ricomincia finché la cartella è vuota —
  l'ultimo giro È la verifica, e un giro che non toglie niente è un errore.
  Vale anche per gli avatar.
- **`removeStorageFiles()` a blocchi da 1000**, usato da tutti i chiamanti,
  `undoImport` compreso: l'API Storage rifiuta più di 1000 oggetti per
  richiesta (`MAX_OBJECTS_PER_REQUEST` del server, letto il 2026-10-01).
  ⚠️ Il modulo sta in `lib/` e non in un file `"use server"`: là ogni funzione
  esportata diventa una server action, e "rimuovi questi path" senza toccare le
  righe non deve essere raggiungibile con una POST.
- **Il picker diceva niente sugli errori.** `getAttachments(...).then` senza
  `.catch` lasciava "Caricamento…" per sempre su una promise rifiutata, e
  `remove` aveva solo `try/finally`. Ora lettura e rimozione hanno una frase
  propria (`attachments.errors.loadFailed`/`removeFailed`).

#### Emerso dal code-review della PR #134 (15 rilievi, 13 applicati)

La prima versione passava tutti e quattro i criteri e la sua controprova. La
review ha trovato difetti veri lo stesso, e quasi tutti nella stessa famiglia:
**un ambito più stretto di quello che la cascata cancella davvero**.

- ⚠️⚠️ **`deleteGoal` raccoglieva le ricevute dei soli versamenti**, ma la
  categoria fa cascata su TUTTI i movimenti che la usano, e il tipo di una
  categoria si può cambiare quando ha già dei movimenti: una "spesa" diventata
  obiettivo portava con sé spese con ricevute, i cui file restavano. Ora due
  insiemi — versamenti, rimossi dopo il loro delete; il resto, dopo quello della
  categoria.
- ⚠️ **`undoImport` leggeva gli id del lotto con una select senza limite**, che
  PostgREST taglia in silenzio a 1000 righe: un import generico da 1500 righe
  lasciava orfane le ricevute oltre la millesima. La correzione per
  `deleteGoal` c'era già nella stessa PR, applicata a un chiamante e non
  all'altro — la "migrazione a campione" della Fase 18, di nuovo.
  `receiptPathsOf()` legge ora da `attachments` attraverso la transazione
  (`transactions!inner`), a blocchi: una query sola invece di id + `.in()`, e
  `getAttachmentPaths` è sparita insieme alla sua `.in()` da 100 id.
- ⚠️ **Il lettore a blocchi era scritto tre volte.** `leggiTutte` di `/analisi`
  è ora `readAll()` in `lib/read-all.ts`, con fusibile e ordinamento dichiarati
  una volta; la copia nata in questa PR (`goalReceiptPaths`) non aveva il
  fusibile. Collaudato confrontando `/analisi` con blocchi da 2 e da 500.
- ⚠️ **Una lettura dei path fallita non deve far cancellare.** La prima versione
  registrava e proseguiva, come `undoImport` faceva da sempre; ma prima del
  delete niente è ancora stato toccato, e un guasto passeggero si riprova
  gratis — mentre cancellando lo stesso diventava un orfano per sempre. Ora
  tutti e tre si fermano con `errors.receiptsReadFailed` ("…non è stato
  eliminato niente"). **La politica "registra e prosegui" vale per ciò che
  succede DOPO il gesto, non per ciò che lo precede.**
- **Lo svuotamento paginava con un offset**, e una pagina corta veniva presa
  per l'ultima: un tetto del server sotto i 1000 avrebbe fermato l'elenco al
  primo giro. Il ciclo sulla prima pagina non dipende da nessun tetto.
- **Le sottocartelle venivano saltate** con una riga di log e l'eliminazione
  dell'account dichiarava successo. Ora si svuotano (fino a 5 livelli).
- **`remove()` restituisce gli oggetti cancellati davvero** — verificato con una
  sonda: 3 path di cui 1 assente → 2 oggetti. `removeStorageFiles` lo usa per
  dire quando ne ha tolti meno di quelli chiesti, invece di tacere.
- **Svuotate le foto, una cartella ricevute che non si svuota** lasciava
  `avatar_url` puntato a un file cancellato: ora la stessa compensazione del
  ramo in cui fallisce la RPC.
- **Il picker**: la lettura fallita è uno stato a parte (`loadError`), che un
  caricamento riuscito non cancella — prima il primo gesto riuscito azzerava il
  messaggio e "1 ricevuta" si leggeva come l'elenco intero; il conteggio sparisce
  finché l'elenco non è noto. E una ricevuta già sparita (altra scheda, cascata)
  esce dall'elenco invece di rispondere "Riprova" all'infinito.

Scartati: una coda di cancellazione alimentata da un trigger su `attachments`
— coprirebbe ogni cascata futura, ma è una tabella e una migration nuove, e lo
svuotamento dovrebbe comunque passare dall'app (in SQL lo Storage non si
tocca): una decisione di schema a sé. E la lettura in più a ogni cambio di
avatar: è la verifica, ed è il punto.

⚠️⚠️ **Una rete caduta NON fa rifiutare una server action**, ed è ciò che il
collaudo doveva rispettare. Con `experimental.useOffline` (Fase 25) l'azione
resta in sospeso e riparte alla riconnessione: un `route.abort()` avrebbe
provato un'altra cosa. Le azioni rifiutano su un errore del SERVER — un 500,
un'eccezione, un deploy che cambia l'id dell'azione — e il guasto si inietta
così: Playwright risponde 500 alla sola azione chiamata con quell'argomento.

⚠️ **E il primo giro iniettava troppo.** Cercando l'id del movimento nel corpo
della richiesta colpiva anche il conteggio delle graffette della lista, che
porta lo stesso id dentro un array: i due `pageerror` non venivano dal picker.
Il criterio ora confronta il corpo esatto (`["<id>"]`). La diagnosi ha mostrato
un difetto vero fuori perimetro: `loadPage` in `/transazioni` ha `try/finally`
senza `catch`, quindi un conteggio rifiutato è un errore non gestito.

Collaudo del 2026-10-01 nell'app vera, su due account di prova usa e getta
(autorizzati da Jomar per il collaudo della #120, entrambi eliminati dall'app):

- **prima versione**: criteri 1, 2 e 4 — 9 su 9, tre volte su dati nuovi;
  account eliminato con 13 ricevute e 7 avatar a pagina da 2, e la query su
  `storage.objects` per la sua cartella restituisce **zero righe**.
  **Controprova** col codice di master: i 4 file restano nel bucket, il picker
  resta su "Caricamento…" senza messaggio, la rimozione fallita tace, e con la
  pagina a 2 gli avatar restano in 6;
- **dopo la review**: 12 su 12 a blocchi da 500 e di nuovo a blocchi da 2
  (spesa nella categoria-obiettivo, lettura fallita seguita da un'aggiunta,
  ricevuta già sparita), annullamento di un import con 3 ricevute in entrambe
  le misure, `/analisi` identica a blocchi da 2 e da 500, l'arresto con la
  lettura dei path guastata (movimento e obiettivo intatti, il messaggio lo
  dice), e l'account eliminato con 24 ricevute, 2 avatar e un file in una
  sottocartella.

