# Fase 24 — progetto del coach, e la 24a (disponibile)

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 24 — AI Financial Coach (issue #66)

Progettata per intero il 2026-08-27 prima di scrivere codice, come la 17, la 20 e
la 23. **Tre PR**, ciascuna un prodotto finito, con la dipendenza a senso unico
di sempre:

| | cosa consegna | costa |
|---|---|---|
| **24a** | *disponibile* — entrate del mese − uscite fisse previste | niente |
| **24b** | la bolla, il pannello e le risposte che l'app sa già dare | niente |
| **24c** | la chat aperta: chiave, SDK, fornitore, le tre guardie | meno di $1 / mese |

⚠️ **Che la parte a pagamento sia l'ULTIMA non è un ordine di comodo.** Fino alla
24b compresa il coach funziona senza una chiave API, senza una dipendenza nuova e
senza che un solo dato lasci l'app. Se la 24c non venisse mai scritta, quello che
resta è comunque un coach: è la stessa proprietà che rende la 20a un prodotto
senza la 20b.

#### 24a — «disponibile» non ha bisogno di un modello

La 17a aveva rimandato qui *«stipendio − uscite fisse = disponibile»* e il
suggerimento dell'importo di budget. **È aritmetica**: `getFixedOutflows()` somma
già gli abbonamenti registrati nel mese *e* le occorrenze ancora da generare, e
`dashboard_totals()` dà le entrate.

Sta in una PR sua non per comodità di consegna, ma perché così **i numeri
esistono prima del modello**. Quando arriva la 24c non c'è più niente da
calcolare, e la decisione 4 dell'issue — *può il testo generato contenere cifre?*
— è già risposta dalla struttura invece che da una convenzione.

⚠️ **«Stipendio» è una parola che Seichi non può usare.** L'app non sa quale
`entrata` sia lo stipendio: non c'è una colonna che lo dica, e una regola
ricorrente di tipo `entrata` è un indizio, non un fatto. Il numero disponibile è
quindi **entrate del mese − uscite fisse previste**, e va chiamato così. È la
correzione già fatta tre volte — *«spese totali» → «spese variabili»*, *«Saldo
totale» → «Saldo · N conti attivi»*, *«Valore portafoglio» → «Capitale
versato»* — applicata prima di sbagliare invece che dopo.

- **Il suggerimento sta dove si prende la decisione**, cioè accanto a
  `GlobalBudgetSection` in `/impostazioni`: un importo consigliato in una
  schermata diversa da quella dove si imposta il budget è un numero che non si
  può accettare con un tocco.
- ⚠️ **`ClientClock`, non `new Date()` sul server.** Il server è in UTC su
  Vercel e fra mezzanotte e le 2 sbaglierebbe mese — la trappola già documentata
  nella 17a, e questo calcolo vive esattamente sui confini di mese.
- **Il suggerimento è un tetto, non una raccomandazione con una percentuale.**
  Vedi «Le rinunce dichiarate»: le percentuali di metodo non sono calcolabili
  onestamente su questo schema.

#### Emerso implementando la 24a (2026-08-31)

Implementata sul branch `72-fase-24a-disponibile-e-budget-suggerito` e collaudata
**nell'app vera**, non solo compilata. `tsc`, lint, `next build` e
`npm run audit:tokens` verdi; sui dati veri **Entrate € 5907,58 − uscite fisse
€ 51,90 = Disponibile € 5856**, zero errori console.

- **`getFixedOutflows()` è sparita, sostituita da `getAvailableThisMonth()`.**
  Era chiamata solo da `GlobalBudgetSection`, e la funzione nuova quel numero lo
  restituisce già: tenerle entrambe avrebbe calcolato le uscite fisse **due
  volte nella stessa schermata, in due richieste**. Le entrate arrivano da
  `dashboard_totals()` con due soli confini — cioè un bucket — quindi non nasce
  una seconda definizione di «entrata» accanto a quella della home.

- ⚠️ **Il caso «zero entrate» era una trappola non prevista in progettazione.**
  Il 2 del mese, con lo stipendio che arriva il 27, `entrate = 0` e il
  disponibile è **− € 52**: vero, ma si legge come un buco nei conti invece che
  come *«lo stipendio non è ancora arrivato»*. E nei primi giorni del mese è il
  caso **normale**, non l'eccezione. Il sottotitolo cambia frase quando le
  entrate sono zero (`availableNoIncome`). È la regola della fase in una veste
  nuova: non un numero sbagliato che sembra giusto, ma **un numero vero che si
  fa capire male**.

- **Il suggerimento compare SOLO quando un limite non c'è.** Proporlo a chi ne ha
  già impostato uno più basso significa invitarlo ad **alzarlo**, cioè a
  spendere di più, e quel limite più basso è una scelta deliberata, non una
  svista da correggere. Il disponibile è un tetto, non un obiettivo da
  raggiungere.

- ⚠️⚠️ **Il suggerimento si arrotonda per DIFETTO, e la ragione si è vista solo
  guardando lo schermo.** La card arrotonda gli importi all'euro — 51,90 diventa
  «€ 52» — quindi col valore esatto il bottone avrebbe detto *«Imposta il limite
  a € 5856»* e scritto nel campo **5855,68**: un comando che dichiara un numero
  e ne applica un altro. Per **difetto** e non al più vicino, perché
  arrotondando si proporrebbe un tetto *più alto* del disponibile reale — un
  limite che, se speso tutto, manda il mese in negativo. **Un tetto si abbassa,
  non si alza.**

- **L'icona del suggerimento è una lampadina, non una scintilla.** Quel numero è
  aritmetica, non un modello: un'icona che promette l'AI su un calcolo
  deterministico è la stessa classe del fumetto di chat sopra un referto —
  *l'icona si sceglie insieme a ciò che fa*. Vale anche al contrario, quando
  arriverà la 24c.

##### ⚠️ Quattro volte a sbagliare è stata la VERIFICA, in un giro solo

Nessuna delle quattro era un difetto dell'app, e tutte hanno prodotto un KO
credibile:

| | il driver | perché era falso |
|---|---|---|
| 1 | indicizzava le righe per `lines[0]` | la pastiglia icona contiene il glifo **`€` come testo**, quindi la prima riga è `"€"` e «Limite mensile» risultava MANCANTE mentre era a schermo |
| 2 | `toNumber` pretendeva `,\d{2}` | la card scrive **«€ 52»**, non «€ 52,00» → `NaN` su un importo sano |
| 3 | cercava un testo che *iniziasse* con «Entrate» | la card della home mette **l'importo sopra l'etichetta** |
| 4 | confrontava i valori come esatti | erano **già arrotondati**: `5907,58 − 52 = 5855,58` contro «5856» dava uno scarto di 0,42 su un'app corretta |

La regola nuova che ne esce, e vale per ogni collaudo futuro di questo repo:
**un controllo che legge numeri FORMATTATI non può confrontarli come esatti.**
Il confronto giusto è l'appartenenza all'intervallo degli arrotondamenti
possibili — che un errore vero di qualche euro fa comunque fallire, mentre uno
di centesimi non lo inventa.

⚠️ E il quarto è quello che ha pagato: andando a capire *perché* diceva rosso è
uscito il difetto vero dell'arrotondamento del suggerimento. È la regola già
scritta due volte qui dentro — *un controllo che segnala un guasto va
diagnosticato prima di crederci* — con il suo corollario di sempre.

⚠️ **E il driver ha dovuto chiedere `/?conto=` esplicitamente.** Il conto scelto
vive in un cookie (20b), quindi «aprire la home» non è uno stato determinato:
senza il parametro vuoto avrebbe letto le entrate di **un conto** confrontandole
con un disponibile calcolato su **tutti**. Un KO inventato dal collaudo, sulla
stessa trappola che la 20b aveva già registrato.

##### La prova che si autoescludeva, dichiarata e poi chiusa

⚠️ Il ramo **positivo** del suggerimento non era provabile dal driver: l'account
di collaudo ha un limite globale, quindi il bottone correttamente non compariva
e restava verificato solo il ramo che lo **nasconde** — non quello per cui la
funzione esiste. Provarlo richiedeva di azzerare il limite, cioè scrivere su un
database di **produzione**, e il driver è sola lettura per scelta.

È rimasta dichiarata come la prova `b2` della Fase 22 — *una prova che si
autoesclude va lasciata dichiarata e ripresa, non archiviata come superata
perché tutto il resto è verde* — ed è stata **chiusa a mano lo stesso giorno**
svuotando il limite dall'app:

- il campo mostra il segnaposto «nessuno» e il bottone **compare**;
- dice **«Imposta il limite a € 5855»** mentre la riga sopra dice **«€ 5856»**,
  che è l'arrotondamento per difetto documentato qui sopra visto funzionare: il
  disponibile esatto è 5855,68;
- il sottotitolo *«un tetto, non un consiglio»* è leggibile e la lampadina non
  somiglia a un'icona di AI.

⚠️ **E la prova a mano è arrivata in TEMA SCURO**, che il driver non rende mai
(non ha il cookie del tema): pastiglia icona, inchiostri e contrasto reggono
anche là. È la stessa lezione della Fase 22 — *ogni fase ha una parte di
collaudo che nessun driver può fare*, e va prevista invece di scoprirla.

⚠️ **Ne è nata una domanda di prodotto**, non un difetto: «Disponibile € 5856» e
«Imposta il limite a € 5855» sono due numeri adiacenti che differiscono di un
euro, e rispondono a due domande diverse (*quanto ho* contro *quanto imposto*).
Segnalata anche dal code-review, e **chiusa il 2026-09-01** mostrando i
centesimi su questa card — vedi «Il quarto» più sotto.

#### Emerso dal code-review della 24a

Quattro rilievi. Tre corretti, e sono **lo stesso difetto in tre punti**: un
gesto che non fa niente e non dice niente — la classe già pagata in Fase 21
(server action senza `try/finally`) e in Fase 22 (`crypto.randomUUID()` che
falliva in silenzio).

- ⚠️⚠️ **Il tocco sul suggerimento veniva ingoiato, e salvava il valore
  SBAGLIATO.** Con del testo digitato nel campo, toccare il bottone fa emettere
  al browser prima `blur` → `commit()`, che con `setSaving(true)` **disabilita
  il bottone**: veniva scritto il valore *digitato* invece di quello *toccato*,
  cioè l'opposto del gesto. E con tempi di flush diversi le due `setBudget` si
  accavallano, lasciando il campo a mostrare un numero mentre il database ne
  contiene un altro.

  La regola che ne esce: **due strade che scrivono lo stesso campo devono avere
  una precedenza DICHIARATA, non dedotta dall'ordine degli eventi del browser.**
  Il ref `suggerimentoPremuto` segna l'intenzione prima che il blur parta.

- ⚠️ **Il suggerimento falliva in silenzio**: `save()` aveva `try/finally` senza
  `catch` e l'`onClick` faceva `void` della promise, quindi una `setBudget`
  rifiutata non arrivava mai a `setError`. Ora c'è il ramo, con una voce nuova
  nei dizionari — **una scrittura fallita deve dirlo quanto una lettura**, e
  finora solo la lettura ce l'aveva (`readFailed`).

- ⚠️ **Un caricamento rifiutato bloccava la card per sempre**:
  `Promise.all(...).then(...)` senza `.catch` lasciava `loading` a `true`, il
  campo disabilitato, le due righe ferme su "…" e `loadFailed` mai alzato.
  Un'attesa che non finisce e non si spiega.

##### Il quarto: segnalato due volte, per strade indipendenti

«Disponibile **€ 5856**» tre righe sopra «Imposta il limite a **€ 5855**». Se ne
sono accorti sia chi guardava l'app sia la review, il che dice che l'attrito è
reale e non una pignoleria: due numeri adiacenti che differiscono di un euro.

Non è un difetto — rispondono a due domande diverse (*quanto ho* contro *quanto
imposto*) e il secondo è arrotondato per difetto apposta.

**Chiuso il 2026-09-01 mostrando i centesimi su questa card**: «€ 51,90» e
«€ 1241,10» accanto a «Imposta il limite a € 1241», e il floor si legge da sé.
⚠️ Le due righe non sono decorazione: sono i **due addendi di una sottrazione**
che l'utente deve poter rifare a mente, e arrotondate non tornavano con le
entrate. La riga «uscite fisse» della **home** resta a euro interi ed è corretto
così: là è uno sguardo, qui è un conto — il resto dell'app continua a usare il
`decimals = 0` di `formatMoney`.

##### Le tre correzioni, provate iniettando il guasto (2026-09-01)

Erano rami difensivi: si vedono solo quando qualcosa fallisce, e per un giorno
sono rimasti **dichiarati non provati**, perché *la differenza fra «corretto» e
«corretto e verificato» non si deduce dal diff*. Accesi uno per uno con il gesto
standard di questo repo — la 22 abbassò `ATTACHMENT_MAX_BYTES`, la 23a
`EXPORT_CHUNK`:

| guasto iniettato | cosa doveva succedere | esito |
|---|---|---|
| `setBudget` che solleva | il tocco sul suggerimento **dice** l'errore invece di tacere | *«Impossibile salvare il budget: guasto iniettato»*, e il campo NON si riempie di un valore mai salvato |
| il caricamento che rifiuta | la card non resta appesa su «…» | messaggio mostrato, campo disabilitato, `loadFailed` alzato |
| nessuno — si digita e poi si tocca | il **tocco** vince sul `blur` | nel campo *e nel database* finisce la proposta, non il valore digitato |

⚠️ La terza è l'unica che scrive, ed è l'unica che conta davvero: verificata
**dopo un ricaricamento**, perché lo stato dell'interfaccia sopravvive al gesto
e quindi non può testimoniare sul gesto — la regola già scritta nella Fase 22
per la riprova degli allegati. Il collaudo finisce rimettendo il limite globale
al valore che l'utente aveva, e il database resta come è stato trovato.

