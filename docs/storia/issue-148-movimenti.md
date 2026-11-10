# #148 — Movimenti: conto ricordato, una richiesta, lista ricordata

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Movimenti — conto ricordato, una richiesta sola, lista ricordata (#148)

Chiesto usando l'app il 2026-11-03: Movimenti ripartiva sempre da "Tutti i
conti" ed era lenta. Nessuna migration. La causa più grossa della lentezza era
la regione delle funzioni, ed è in "Costo delle richieste a Supabase"; qui
c'è ciò che riguarda la pagina.

- **Il conto ricordato.** `page.tsx` è un server component sottile che legge
  `getSelectedAccount()` e passa il conto a `MovimentiClient`. La scelta nella
  barra filtri scrive la stessa memoria della home (`rememberAccount`), e "Tutti
  i conti" e "Azzera" la cancellano: **una memoria sola**, deciso da Jomar.
  L'alternativa (Movimenti legge ma non scrive) lasciava home e Movimenti su
  conti diversi. Un conto che non è fra quelli dell'utente si dimentica, ma
  solo se veniva dal cookie: un `?conto=` sbagliato è un'istruzione di quella
  pagina e non cancella la scelta fatta in home.
- ⚠️ **Il server component non legge niente dalla rete**: si rende a ogni
  navigazione, e tutto ciò che aspetta ritarda il tocco sulla bottom nav.
  ⚠️ E **niente `key`** sul client component: un `revalidatePath` dopo un
  salvataggio lo rende di nuovo, e una `key` legata al conto rimonterebbe la
  lista perdendo i filtri appena scelti.
- ⚠️ **Una richiesta sola all'apertura** (`getMovimentiData`). Next spedisce le
  server action una alla volta, e la pagina ne lanciava quattro con la lista in
  coda **dietro** ai conti e alle categorie del filtro. Ora le tre letture
  partono insieme sul server; conti e categorie degradano, i movimenti no.
  Dopo, un cambio di filtro chiede solo i movimenti, e i dati del filtro tornano
  insieme a loro solo dopo un salvataggio (`optionsLoadedFor`).
- **Le ricevute nella stessa query**: `getTransactions({ withAttachmentCounts })`
  aggiunge `attachments(count)`, che PostgREST risolve dalla FK composita senza
  nominarla. Verificato prima di scrivere: `transactions?select=id,
  attachments(count)` risponde 200, un nome inventato `PGRST200`. Usata da
  Movimenti e da `/conti/[id]`; `getAttachmentCounts` è sparita. L'export resta
  su `getAttachmentCountsChecked`, che distingue "zero" da "lettura fallita".
  ⚠️ Una query sola fallisce intera: un guasto delle ricevute ora dice "non è
  stato possibile caricare i movimenti", invece di togliere solo la graffetta.
- ⚠️ `select()` di postgrest-js analizza il testo **a livello di tipi**: una
  select scelta a runtime produce un `ParserError` al posto delle righe. Si
  dichiara la riga, `.select<string, Transaction & {…}>(columns)`.
- **La lista ricordata** (stale-while-revalidate). La prima pagina di ogni
  combinazione di filtri (le ultime 8), i dati dei filtri e i budget restano in
  una variabile del modulo di `MovimentiClient`: rientrando si mostrano subito,
  senza scheletro, e si richiedono comunque. Le regole:
  - ⚠️ **si riaggiorna SEMPRE**: i movimenti cambiano anche dove la pagina non
    lo sa (import, job notturno, cascata di una categoria eliminata, un altro
    dispositivo), e `transactionSavedAt` copre solo i salvataggi del form;
  - ⚠️ **è legata all'utente**: un modulo client sopravvive alle navigazioni, e
    un cambio d'accesso nella stessa scheda è una navigazione;
  - ⚠️ **e all'ultimo salvataggio** (`transactionSavedAt`): dopo una modifica
    fatta nell'app, anche da un'altra pagina, le pagine ricordate si buttano.
    Trovato rileggendo, prima di provarla: un movimento appena **eliminato**
    sarebbe ricomparso per un istante dalla copia. Una risposta partita prima di
    un salvataggio non viene ricordata, per lo stesso motivo;
  - ⚠️ **si scrive solo nel browser**: sul server una variabile di modulo è
    condivisa fra tutte le richieste di tutti gli utenti;
  - vive nella memoria della scheda, non sul disco: un ricaricamento la svuota;
  - se l'aggiornamento fallisce le righe restano, e la pagina dice che
    potrebbero essere vecchie (`t.transactions.refreshFailed`), con "Riprova".
    Una copia presentata come attuale sarebbe la classe della #124.
- ⚠️ **Il collaudo**: "aprire Movimenti" non è più uno stato determinato. Il
  passo 5 di `collauda-app` apre `/transazioni?conto=`, la trappola già pagata
  dalla 20b su home e `/analisi`.

Collaudo del 2026-11-03 su una build di produzione locale, con un account di
prova usa e getta (autorizzato da Jomar, registrato dall'app ed eliminato
dall'app alla fine; il login successivo risponde `invalid_credentials`): **28
controlli su 28**. La lista ricordata si prova **trattenendo 3 secondi** la
richiesta dei movimenti: se le righe sono a schermo prima della risposta,
vengono dalla memoria. L'aggiornamento fallito si prova rispondendo 500 alla
sola azione dei movimenti (il corpo contiene `periodo`, quello dei budget no).
**Controprova** sul deploy, cioè master, con lo stesso account: 13 KO, fra cui
5 server action all'apertura, lo scheletro al rientro, il chip su "Tutti i
conti" e il form che propone il primo conto.

⚠️ Al primo giro di ciascuno dei due account di prova un KO del FAB: il form
non aveva **nessun** conto ("Serve un conto per registrare un movimento"). Sul
percorso vero, dal secondo giro in poi, propone Revolut ogni volta (cinque su
cinque). La spiegazione più probabile è quella già registrata nella 20b e
nella #117: il form legge i conti dal browser e mostra quella frase **anche
mentre stanno ancora arrivando**, oltre che su una lettura fallita (`if
(!data) return`, il residuo della #124). Preesistente, da una issue a sé: il
form non distingue "sto caricando" da "non ce ne sono". — **Chiuso dalla
#150**: vedi «Form — conti e categorie in tre stati».

#### Emerso dal code-review della PR #149 (10 rilievi, 9 applicati)

- ⚠️⚠️ **"Carica altri" durante l'aggiornamento silenzioso.** Con la copia a
  schermo `loading` è falso, quindi il bottone era vivo: il tocco numerava una
  richiesta nuova, che scartava **per sempre** la risposta dell'aggiornamento, e
  la pagina successiva — letta all'offset dei dati veri — si appendeva a una
  prima pagina vecchia. Righe doppie o mancanti. Ora c'è `refreshing`, e il
  bottone è spento finché la versione aggiornata non è arrivata.
- ⚠️⚠️ **Solo il form segnalava i cambiamenti.** Eliminare un obiettivo (che in
  cascata toglie i versamenti), importare e annullare un import cambiano i
  movimenti senza passare dal form, e la copia li avrebbe mostrati ancora
  rientrando. Ora chiamano anche loro `notifyTransactionSaved()`
  (`GoalSheet`, `ImportFlow`, `ImportHistory`). La frase dell'aggiornamento
  fallito dice "potrebbe non essere attuale" e non "potrebbe non mostrare gli
  ultimi": dopo un'eliminazione fatta altrove la copia ha righe in PIÙ, non in
  meno.
- ⚠️ **Conti e categorie segnati come arrivati anche quando non lo erano**:
  "Riprova" non li avrebbe più richiesti. E un conto ricordato che non si sa
  nominare (conti non arrivati, nessuna copia) avrebbe fatto dire al chip
  "Tutti i conti" sopra una lista filtrata: ora la pagina dice che non si è
  caricata.
- **Il conteggio delle ricevute dentro la query rompeva una promessa della Fase
  22**: un guasto del solo embed faceva cadere l'intera lista. Ora
  `getTransactions` riprova una volta **senza** il conteggio. Provato iniettando
  il guasto (nome della relazione rotto, `PGRST200`): lista e conto restano
  leggibili, senza graffette, e il log lo dice. **Controprova** col ripiego
  spento e lo stesso guasto: entrambe le liste cadono su `LoadError`.
- **La memoria si modificava durante il render** (`recall()` svuotava le pagine
  scadute dentro un inizializzatore di `useState`). Ora le letture non hanno
  effetti — saltano ciò che è scaduto — e lo butta via `memoryFor`, che gira
  solo in callback. Scaduti con un salvataggio ora anche i **budget**: una barra
  appena sforata non torna verde dalla copia.
- Il ramo di fallimento a tre vie era scritto due volte: ora è `fail()`.
- Il passo 5 di `collauda-app` sceglieva un conto in Movimenti, che ora scrive
  la memoria condivisa: lo salva prima e lo rimette dopo.
- Il commento dell'export citava `/transazioni` come precedente per non leggere
  il cookie: corretto, la ragione dell'export è sua.

Non applicato: le tre server action che `getMovimentiData` compone fanno
ciascuna il proprio `requireUser()`. Con le chiavi ES256 le claims si
verificano in locale, quindi è il costo di tre client, non di tre giri di
rete; renderle funzioni interne che ricevono il client è un refactoring di tre
file per un guadagno che oggi non si misura.

Ricollaudo dopo la review, su un secondo account usa e getta (eliminato): **35
controlli**, fra cui "Carica altri" spento durante l'aggiornamento e il
versamento di un obiettivo eliminato che non ricompare. ⚠️ E un controllo era
cieco: cercava la vecchia frase dell'avviso, quindi "l'avviso sparisce dopo
Riprova" passava senza guardare niente. Corretto, poi verde.

