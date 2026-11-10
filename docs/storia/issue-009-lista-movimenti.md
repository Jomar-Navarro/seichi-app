# #9 — lista movimenti: filtro categoria, azzera, paginazione

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Lista movimenti — filtro categoria, reset, paginazione (issue #9)

Chiusa il 2026-08-20. Nessuna migration: è tutto codice.

#### ⚠️ Paginare ROMPE la ricerca, e questa è la decisione della issue

La ricerca di `/transazioni` filtra **lato client** e confronta nome categoria,
note **e nome conto** — i secondi due stanno su altre tabelle e sono risolti
dalle righe già caricate. Paginando e basta cercherebbe dentro le sole righe
scaricate: *"nessun movimento"* comparirebbe mentre la riga cercata sta nella
pagina successiva. Un risultato **falso che sembra vero**, cioè la regola della
17a applicata a una lista invece che a un numero.

**Deciso: si pagina solo quando NON si cerca.** Appena c'è del testo nella
ricerca la pagina carica l'intero periodo, come faceva prima della issue.
Nessuna capacità persa — la ricerca continua a trovare per conto e categoria — e
il caso comune, sfogliare, smette di scaricare tutto.

Le due strade scartate: spostare la ricerca sul server avrebbe perso il nome del
CONTO (terza tabella) e aggiunto un secondo punto in cui il testo dell'utente
diventa sintassi PostgREST; rimandare la paginazione avrebbe lasciato aperto
proprio ciò per cui la issue è stata scelta.

⚠️ La dipendenza dell'effetto è il **booleano** `searching`, non il testo: con
`search` fra le dipendenze ogni tasto premuto sarebbe una richiesta.

#### Le scelte minori, e perché non sono arbitrarie

- **`hasMore` lo decide il SERVER**, chiedendo una riga in più di quelle che
  servono. Dedurlo dal client (`length % 50 === 0`) sarebbe giusto quasi sempre
  e falso esattamente quando il totale è un multiplo della pagina: un "carica
  altri" che non carica niente. E niente `count: "exact"`, che costerebbe una
  scansione completa a ogni pagina — sulla stessa tabella che la issue esiste
  per smettere di scandire — per rispondere a una domanda che la UI non pone.
- **L'offset è `transactions.length`**, non un contatore di pagina: un secondo
  stato che dice la stessa cosa del primo diverge al primo caso non previsto.
- **`TRANSACTIONS_PAGE_SIZE` sta in `lib/transaction-utils.ts`**, non accanto
  alla server action. ⚠️ Da un file `"use server"` si possono esportare **solo
  funzioni async**: una costante lì fa fallire `next build` con *"Only async
  functions are allowed to be exported"*, e **né `tsc` né il lint la vedono**.
- **Opzioni nominate al posto dei parametri posizionali** in `getTransactions`:
  erano quattro, sarebbero diventati sei, e `limit`/`offset` sono due numeri
  adiacenti che si scambiano senza che nulla se ne accorga — non un guasto, una
  pagina di risultati sbagliata.
- **"Azzera" compare solo quando c'è qualcosa da azzerare**, e a deciderlo è la
  PAGINA: `FilterBar` vede i filtri ma non i loro default. Un comando sempre
  presente e inerte per metà del tempo insegna a ignorarlo — la stessa ragione
  per cui l'avviso del job compare solo in caso di problema.
- **`resetFilters` riporta il periodo a "30d", non a "tutto"**: il default della
  pagina non è "nessun filtro", è "l'ultimo mese". Azzerare verso "tutto"
  cambierebbe lo stato invece di ripristinarlo.

#### ⚠️ `flex-wrap`, mai `overflow-x-auto`

Con quattro chip la barra non entra in 414px. Lo scorrimento orizzontale è la
soluzione istintiva ed è una **trappola**: le tendine sono `absolute` dentro
quel contenitore, e per specifica CSS un asse non `visible` ritaglia anche
l'altro — ogni menu verrebbe tagliato dal bordo invece di aprirsi sopra la
lista. È la stessa regola già pagata dal carosello della home, dove
`overflow-x-auto` ritagliava il `box-shadow`.

Verificato: il menu categoria sporge **262px sotto la barra** senza essere
ritagliato.

#### Due difetti di TESTO trovati aggiungendo un chip

- ⚠️ **"Tutte" è diventato ambiguo.** Accanto al chip nuovo si leggeva
  `[Tutte] [Tutte le categorie]`, e il primo non diceva più di cosa parlasse.
  Ora è **"Tutti i tipi"**. Un chip non ha un'etichetta accanto che lo spieghi —
  *è* l'etichetta — quindi deve nominare da sé la propria dimensione.
- ⚠️ **"fisse del mese € 52"** — fisse *cosa*? Preesistente, e la stessa
  famiglia: la forma breve aveva perso il sostantivo. Ora "uscite fisse del
  mese". In inglese identico (*"fixed this month"*).

**La regola: aggiungere un elemento accanto a un testo può rendere quel testo
ambiguo senza toccarlo.** È il gemello di quella già scritta per la 20a —
*correggere un numero può rendere falsa l'etichetta che lo descriveva*.

#### `categoryTypeFor()` — la mappatura era scritta a mano in due punti

Filtrando per **"Disinvestimenti"** la tendina categoria si svuotava: cercava
categorie di un tipo che `categories_type_check` non ammette, perché le vendite
usano quelle degli investimenti (#52). La mappatura esisteva già in
`TransactionForm` e in `ImportFlow`, copiata; il terzo chiamante è quello che ha
reso visibile il problema. Ora è una funzione sola in `lib/transaction-utils.ts`.

È la "migrazione a campione" che questo documento registra dalla Fase 18: una
regola applicata dove ci si è pensato e non dove serviva.

#### ⚠️ Il tetto di PostgREST — verificato e chiuso

**Max rows = 1000** su questo progetto (*Settings → Data API*, verificato il
2026-08-20). Sfogliare è al sicuro — 50 righe per volta — ma **cercare** carica
il periodo in un colpo solo, e oltre il tetto PostgREST tronca **in silenzio**:
la ricerca guarderebbe le prime mille righe e direbbe "nessun movimento" per una
che sta alla millesima seconda.

⚠️ **Non è teorico**: l'import della Fase 21 ha aggiunto **216 righe in un colpo
solo**. Due o tre estratti così e il tetto è raggiunto.

Chiuso con `SEARCH_SCAN_LIMIT = 500` (`lib/transaction-utils.ts`) più una riga
in fondo alla lista che dice quante righe ha guardato. Il troncamento resta
possibile ma **smette di essere silenzioso**.

⚠️ **Il tetto nostro è deliberatamente più BASSO di quello di PostgREST**, e non
per prudenza: `getTransactions` scopre se c'è dell'altro chiedendo **una riga in
più**, e a ridosso del limite esterno quella riga verrebbe tagliata insieme alle
altre — `hasMore` risulterebbe falso proprio nel caso in cui deve essere vero.
Il meccanismo che rende visibile il troncamento si romperebbe esattamente dove
serve. Un tetto interno che coincide con quello esterno non è un tetto: è lo
stesso silenzio scritto due volte.

⚠️ E la frase parla di quante righe ha **guardato**, non di quante ne ha
**trovate**: cercando, il limite vale sulle righe scandite e non sulle
corrispondenze. "Altri risultati" sarebbe falso proprio quando non ce n'è
nemmeno uno.

