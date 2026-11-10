# Fase 21b — disinvestimento e conto su /investimenti

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 21b — disinvestimento e conto su /investimenti (#52 + #53)

Implementata il 2026-08-20. Migration `20260817_disinvestment.sql`.

#### L'audit dei consumatori, che è il prerequisito e non una formalità

Rifatto per intero **prima** di scrivere una riga, come per la 20a e la 20b.
Sedici consumatori di `transactions`, e la conclusione è la stessa che rese
sicuro `trasferimento`: **nessuno somma "tutto ciò che c'è"**, quindi un settimo
tipo è invisibile a ogni totale esistente *per costruzione, non per attenzione
di chi scrive*. I quattro che cambiano sono quelli che **devono** cambiare:
`account_balances`, `getInvestments`, `amountSign()`, `TransactionForm`.

⚠️ **`account_balances` è il punto più consequenziale dell'intera issue**, e non
è ovvio. La vista sottrae tutto ciò che non è `entrata`: senza toccarla,
registrare una vendita **abbasserebbe** il conto invece di alzarlo — il difetto
opposto a quello che la fase chiude, per giunta silenzioso, perché nessun
vincolo lo segnalerebbe. Perché il saldo sale lo decide la Fase 20: nel modello
di Seichi il denaro investito **esce** dal conto, e il saldo di un conto titoli è
la sua *liquidità non investita*. Vendere è quel denaro che rientra.

#### Le tre decisioni che la issue lasciava aperte

- **Un tipo nuovo, non `to_account_id` sull'`investimento`.** Le due forme non
  sono simmetriche: in un acquisto `account_id` è il conto da cui il denaro
  ESCE, in una vendita quello in cui ARRIVA. E la destinazione facoltativa su
  `risparmio`/`investimento` esiste per impedire un **doppio conteggio** — lo
  stesso atto esprimibile in due modi; qui quella collisione non c'è, perché
  vendere e poi spostare il contante sono due eventi **sequenziali**, non due
  modi alternativi di dire la stessa cosa.
  ⚠️ Conseguenza utile: `to_account_id` su un disinvestimento è **già vietato**
  da `transactions_dest_type_check` della 20b, che non lo elenca. Nessun vincolo
  nuovo — ma la controprova lo verifica invece di dedurlo.
- **`/investimenti` diventa NETTO** (acquisti − vendite), per posizione e per
  tipologia.
- **Tasse e plusvalenze restano fuori, e non serviva una decisione nuova**: la
  regola `netto = amount + fee + tax` della Fase 21 fa già arrivare l'importo al
  netto delle tasse.

#### ⚠️ "Valore portafoglio" era falso da sempre

L'etichetta di `/investimenti` diceva **"Valore portafoglio"**, ma Seichi non ha
quotazioni: quel numero è la somma dei versamenti. La #52 non ha creato la
bugia, l'ha **resa visibile** — finché il totale poteva solo crescere, "valore"
e "versato" sembravano la stessa cosa. Ora è **"Capitale versato"**.

È la stessa correzione già fatta su *"spese totali" → "spese variabili"* (17a),
*"Saldo totale" → "Saldo · N conti attivi"* (20a) e *"Uscite totali" →
"Uscite"* (review 20a): **quando cambia una formula va riletto il testo che le
sta accanto.**

#### ⚠️ La categoria è presa IN PRESTITO — la seconda rottura dell'1:1

`TransactionForm` filtra le categorie con `.eq("type", selectedType.id)`. Un
disinvestimento usa una categoria di tipo **`investimento`** — vendi "ETF", non
"disinvestimento ETF" — o le due righe non si compenserebbero sulla stessa
posizione, che è l'intero scopo della issue.

Rompe l'accoppiamento 1:1 tipo↔categoria come già fece `trasferimento`, ma **nel
verso opposto**, e vale tenere distinte le due ragioni: il trasferimento la
categoria non ce l'ha affatto (un CHECK la vieta), il disinvestimento la prende
in prestito da un altro tipo. Da qui anche perché `categories_type_check` resta
**deliberatamente più stretto** di `transactions_type_check`: è scritto in
entrambi i file, o alla prossima rilettura sembrerà il difetto della #47.

#### Il netting è per POSIZIONE, non per riga

⚠️ `investment_type` lo scrive **solo l'import**, mai il `TransactionForm`. Una
vendita inserita a mano lo avrebbe `null` e finirebbe nel secchio "altro" mentre
gli acquisti che liquida stanno in "etf": la compensazione per tipologia darebbe
**due numeri sbagliati invece di uno giusto**. La tipologia si prende quindi
dalla posizione, decisa dalle righe di **acquisto** — le uniche che possano
averla — e solo se non è già fissata, perché le righe arrivano in ordine di data
decrescente e una vendita recente la sovrascriverebbe.

#### Una posizione può andare NEGATIVA, e si mostra

Hai liquidato più di quanto versato perché c'erano plusvalenze. Deciso il
2026-08-20: **si mostra col suo segno**, con una frase che dice perché.
Azzerarla direbbe *"qui non hai mai versato niente"*, che è falso — e un numero
negativo senza spiegazione si legge come un guasto dell'app, non come un fatto
sul portafoglio.

⚠️ Ma **il donut vede solo le posizioni positive**, e non è una preferenza
estetica: una fetta di torta non sa rappresentare un valore negativo, e Recharts
la disegnerebbe comunque con un angolo negativo che si somma agli altri. Le
percentuali si calcolano sul solo capitale positivo, o con un totale vicino allo
zero uscirebbero valori come 1.400%. **Il grafico tace, l'elenco parla.**

#### `recurring_rules` resta fuori, deliberatamente

Un piano di decumulo automatico non è esprimibile. Ammetterlo allargherebbe la
superficie da collaudare a `generate_recurring_transactions()` senza un caso
d'uso che lo chieda; aggiungerlo dopo costa **una riga di CHECK e nessun
backfill**, al contrario di una colonna, che va messa subito.

#### ⚠️⚠️ La controprova va COMMENTATA, o annulla la migration che collauda

Sbagliato alla prima esecuzione, il 2026-08-20, e vale come regola per ogni
migration futura di questo repo.

Il blocco di collaudo termina con un `raise exception` deliberato — è l'unico
modo di garantire insieme che il referto si veda (il SQL Editor mostra sempre
l'errore, i `notice` no) e che le righe di prova non restino su un database di
produzione. Ma **il SQL Editor di Supabase esegue lo script come UNA SOLA
TRANSAZIONE**: lasciato eseguibile in fondo al file, quel `raise` fa rollback
anche delle sezioni precedenti, cioè **della migration stessa**.

⚠️ **Il sintomo è ingannevole, ed è la parte che costa.** L'editor stampa
`ROLLBACK VOLUTO — tutte le prove superate, niente è stato scritto` — cioè
esattamente il messaggio di successo previsto — mentre in realtà è appena stato
annullato tutto. Letto in fretta sembra la conferma che ha funzionato. L'unico
indizio è il `Failed to run sql query` che lo precede, e riguarda l'intero
script, non il solo blocco.

La `20260815` la teneva **interamente commentata** proprio per questo: si copia
in una query nuova, si tolgono i `--`, si esegue a parte. Averla ricopiata come
codice vivo è stato l'errore — e il modo in cui si è scoperto è la regola già
scritta due volte qui dentro: *un controllo che segnala un guasto va
diagnosticato prima di crederci*, con il corollario che vale anche al contrario
— **un controllo che segnala successo va diagnosticato prima di crederci**,
perché il messaggio giusto può arrivare dal percorso sbagliato.

#### ⚠️ Due partizioni, non la stessa somma fatta due volte

Emerso **guardando lo schermo**, non leggendo il codice, ed è la correzione di un
errore fatto scrivendo questa fase.

La prima stesura aggregava le TIPOLOGIE per categoria, per far quadrare le
vendite (che `investment_type` non ce l'hanno). Ma la decisione dell'import è
per **gruppo** mentre `investment_type` sta sulla **riga**: una sola categoria
"ETF" contiene davvero righe di asset diversi, perché il file di Trade Republic
li distingue e la scelta dell'utente no. Aggregando per categoria quelle righe
collassavano tutte sulla tipologia della prima — `/investimenti` diceva
**"2 tipologie"** dove ce n'erano **4**, cancellando una distinzione vera.

La chiusura è far portare `investment_type` **anche alle vendite** dell'import,
che l'asset lo conosce riga per riga. Così le tipologie tornano per-riga e le
vendite si compensano lo stesso. Restano fuori le righe inserite a mano, che la
tipologia non ce l'hanno in nessuno dei due versi — acquisti compresi — quindi
finiscono in "altro" insieme e si compensano fra loro.

⚠️ Conseguenza: **due denominatori**, non uno. Posizioni e tipologie sono due
partizioni diverse dello stesso capitale e i loro totali positivi non
coincidono; un denominatore solo darebbe percentuali che non sommano a 100 in
una delle due liste.

#### Difetto PREESISTENTE trovato guardando, non corretto qui

La posizione "ETF" mostra il badge **"Crypto"**. Non è una regressione della
fase: il badge prende la tipologia della **prima riga di acquisto** della
categoria, e con categorie miste quella riga può descrivere un altro asset. Il
numero è giusto, l'etichetta accanto no.

Non corretto perché la scelta non è ovvia — mostrare la tipologia dominante,
mostrarne più di una, o togliere il badge dalle posizioni miste sono tre
prodotti diversi — e perché è precedente alla #52. Da aprire come issue a sé.

#### ⚠️ La griglia del modale: il numero di righe si CALCOLA

`grid-rows-3` era cablato. Con sei tipi la griglia 2×3 era esatta e il numero
fisso coincideva; col settimo servono quattro righe, e le card in eccesso
finivano in una riga **implicita** dentro un contenitore `flex-1 min-h-0` che
non può crescere. Ora è `gridTemplateRows` inline, derivato da
`TRANSACTION_TYPES.length` — inline e non una classe Tailwind, perché le classi
sono statiche e `grid-rows-${n}` non verrebbe generata.

Verificato su 414×896 **e su 375×667**: `minmax(0, 1fr)` stringe le righe a
128px, la griglia finisce a 641 su 667 e **nessuna card ha il testo tagliato**.

⚠️ **E il collaudo ha mentito due volte prima di dire il vero**, entrambe per
difetti nella prova e non nella pagina:

- il selettore del driver era `.grid.grid-cols-2.grid-rows-3`; togliendo solo
  `grid-rows-3` è diventato abbastanza generico da agganciare **la griglia delle
  card della home**, che sta dietro al modale aperto. Il KO dichiarava la card
  fuori dal riquadro misurando due elementi che non c'entrano nulla fra loro.
  **Un selettore va reso PIÙ specifico, non meno, quando la classe su cui si
  appoggiava sparisce** — qui `.min-h-0`, che il modale ha e la home no;
- il donut è stato dichiarato "non disegnato" leggendo uno screenshot a bassa
  scala. Il DOM diceva sei fette con `fill` risolto a colori veri, e un
  ritaglio ingrandito lo ha confermato: c'era, ed era corretto.

Terza e quarta volta che in questo progetto **a sbagliare è la verifica e non il
codice** (le prime tre nella Fase 21). Il corollario è ormai una regola:
*qualunque cosa dica un controllo — rosso o verde — va diagnosticata prima di
crederci.*

#### L'import: le vendite ora hanno una proposta

Il gruppo `vendite` era l'unico con `suggested: null` per un motivo che è
decaduto — fra due modi sbagliati la scelta non poteva essere dell'app. Ora il
tipo giusto esiste, quindi proporlo non è indovinare.

⚠️ `fits()` classifica i bersagli per **direzione**, e confrontava con la sola
`entrata`: senza aggiungere `disinvestimento` all'insieme dei bersagli *in
entrata*, il tipo nuovo non sarebbe mai stato proponibile su una vendita — cioè
esattamente le righe per cui esiste. L'insieme sta in un punto solo
(`IN_ENTRATA`), che è ciò che impedisce alla direzione di essere reinterpretata
a ogni ramo: il difetto già corretto una volta in questa funzione.

⚠️ E lo stato `null` di `suggested` **resta**, non è un residuo: serve al gruppo
`altro`, dove nessuna proposta è possibile. Toglierlo significherebbe inventare
un bersaglio per righe che non si sono capite.

