# Fase 24b — il coach che non paga

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

#### 24b — il coach che non paga, ed è quasi tutto il coach

Deciso il 2026-08-27, chiedendo *«non c'è un modo per far sì che l'utilizzo sia
gratis?»*. La risposta ha cambiato la forma della fase, ed è la stessa che ha
prodotto la divisione 24a/24b portata un passo più in là: **quasi nulla di ciò
che un coach dice ha bisogno di un modello.**

Sono aritmetica, e quindi gratuite *e* incapaci di sbagliare una cifra:

- il consiglio d'apertura del pannello (disponibile, tasso di risparmio,
  variazione rispetto al periodo precedente);
- «hai sforato il budget X, sul globale ti restano Y»;
- «a questo ritmo l'obiettivo Z arriva a marzo»;
- «le uscite fisse si mangiano questa parte delle entrate».

⚠️ **Come si sceglie il ramo, senza classificare la domanda.** Un instradamento a
parole chiave sbaglierebbe in silenzio, e far classificare la domanda al modello
costerebbe la chiamata che si sta cercando di evitare. Quindi non si classifica
niente: **le risposte deterministiche sono DOMANDE PROPOSTE** (pastiglie sotto il
messaggio d'apertura), e la tastiera è l'altro ramo. Il ramo lo sceglie il gesto,
non un indovino.

Conseguenza voluta: il percorso **predefinito** è quello gratuito. Chi apre la
bolla, legge il consiglio e tocca due pastiglie non ha speso niente.

⚠️ **Le risposte deterministiche sono CORNICE, quindi stanno nei dizionari** —
frasi con `{segnaposto}` come ogni altra stringa dell'app. È il chiarimento che
il criterio *«nessuna stringa fuori dai dizionari»* dell'issue richiede: solo il
testo **generato** è un dato, e arriva nella 24c.

**Le due voci non possono contraddirsi**, e non per attenzione di chi scrive:
attingono agli stessi numeri e alle stesse etichette. È la ragione per cui questa
PR viene prima — quando arriva il modello, il vocabolario è già fissato.

##### La bolla, e le tre trappole che la circondano

Decisa il 2026-08-27: **galleggia sopra la card Investimenti**, ancorata al
contenuto e non alla finestra, quindi scorre con la pagina. Ingresso in home
perché è la pagina che si apre dieci volte al giorno.

- ⚠️ **NON dentro `HomeHero`**: quello è `overflow-x-auto`, e per specifica CSS
  un asse non `visible` ritaglia **anche l'altro**. È la trappola già pagata due
  volte in questo progetto — il `box-shadow` del carosello e le tendine della
  barra filtri. La bolla è sorella della griglia 2×2, dentro il contenitore
  `relative` della home.
- ⚠️ **NON dentro una card con `backdrop-filter`**: quello crea un **contesto di
  impilamento**, e nessuno z-index scritto dentro riesce a uscirne. È la ragione
  per cui `Select` da solo non poteva farcela (Fase 21).
- ⚠️ **Bersaglio ≥ 44×44px** e posizione da verificare a **375px**: sovrapponendo
  un angolo di card, l'offset sbagliato copre una cifra. Si vede solo guardando
  lo schermo, come la griglia del modale nella 21b.
- **Il pannello si MONTA, non si nasconde** — regola del progetto: niente
  `isOpen` con dentro `if (!isOpen) return null`, decide il chiamante.
- ⚠️ **La bottom nav resta a quattro voci più il FAB**, come deciso nella 20a. La
  bolla non è una quinta voce: sta nel contenuto, non nella navigazione.

⚠️ **Un fumetto di chat promette una conversazione**, ed è la stessa classe di
*«Seleziona dal conto»* — un'etichetta non si sceglie da sola, si sceglie insieme
a ciò che la seguirà. In 24b la promessa è mantenuta solo a metà (pastiglie, non
tastiera): **il campo di testo compare con la 24c**, e fino ad allora l'icona non
deve suggerire che si possa scrivere.

#### Emerso implementando la 24b (2026-09-01)

Implementata e collaudata nell'app vera. Nessuna chiamata API, nessuna chiave,
nessuna dipendenza: `package.json` non è stato toccato.

##### ⚠️ Prima del coach è servito estrarre la definizione di «uscita»

`getDashboardTotals` calcolava il flusso **inline** — `entrate − spese −
abbonamenti` — a partire dai bucket della RPC. Il coach parte dagli stessi
bucket e deve dire lo **stesso** numero: riscrivendo quella riga sarebbe nata la
**quinta** definizione di uscita, dopo le tre che la review della 20a ha dovuto
unificare in `sommaUscite()` e la quarta che la 23b ha evitato di proposito.

Ora sta in `lib/totals.ts` (`usciteDaTotali`, `flussoDaTotali`). ⚠️ Non è un
doppione di `sommaUscite()`: quella somma **righe di transazione**, queste
partono da **totali già aggregati per tipo**. Stessa definizione, due forme di
ingresso, e ciascuna ha un nome invece di essere ricopiata dove serve.

⚠️ In `lib/` e non accanto a `getDashboardTotals` perché da un file `"use
server"` si possono esportare **solo funzioni async** — la trappola già
registrata per `TRANSACTIONS_PAGE_SIZE` nella 21c, che né `tsc` né il lint
vedono.

##### `CoachSnapshot` esiste già adesso, ed è la frontiera della 24c

Lo stesso tipo che in 24c viaggerà verso il fornitore serve **oggi** alle
risposte deterministiche. Costruirlo qui non è anticipazione: è ciò che rende
vero *«quando arriva il modello, il vocabolario è già fissato»*.

Dentro non esiste un campo capace di contenere una nota o l'id di una riga:
l'errore non è mitigato, è **irrappresentabile**, come `ProfileHeader` senza
`email`. Restano i nomi di categorie e obiettivi, che sono testo dell'utente — ed
è la ragione per cui la 24c mostrerà il payload vero e non una sua descrizione.

##### La regola che è nata scrivendo le risposte

**Il coach mette in RELAZIONE i numeri, non li RIDEFINISCE.** Può dire che le
uscite fisse sono il tot per cento delle entrate — è un rapporto fra due numeri
che l'app già mostra — ma non può avere una propria idea di «uscita» o di
«flusso». Quelle stanno in `lib/totals.ts` e arrivano nello snapshot già
calcolate da `getAvailableThisMonth`, `getBudgetOverview` e `getGoals`.

##### ⚠️⚠️ «cioè il 0%» — l'articolo davanti a una cifra variabile

Visto **guardando lo schermo**, non da un controllo: il pannello scriveva *«stai
mettendo da parte € 0,00, cioè il 0% di quello che è entrato»*.

In italiano l'articolo cambia col numero che segue — *il* 4%, *l'*8%, *lo* 0% —
e il segnaposto non lo sa. È **letteralmente** la classe di «Nuova
investimento» e di «Seleziona dal conto» (Fase 19), e come quelle **in inglese
non esiste**: *«which is 0% of…»* è corretto sempre. È il motivo per cui un
template pensato in inglese la nasconde, e il motivo per cui va collaudato in
italiano.

Chiusa **togliendo la costruzione, non irrobustendola**: la percentuale sta fra
parentesi, «{fixed} su {income} entrati ({pct}%)», dove nessun articolo la
precede. La stessa mossa già usata per il conteggio degli obiettivi, che diceva
«hai 1 obiettivi»: la frase non lo conta più.

##### ⚠️ Una riga a zero è un non-fatto travestito da osservazione

*«Stai mettendo da parte € 0,00, cioè lo 0%»* è vero e inutile: un coach che
nota il nulla e lo enuncia come un dato smette di essere creduto. Con zero messo
da parte la frase cambia («non hai ancora messo niente da parte»), e se non ci
sono nemmeno entrate **tace**, perché la prima riga l'ha già detto.

È la stessa famiglia del caso «zero entrate» della 24a: non un numero sbagliato,
**un numero vero che si fa capire male**.

##### ⚠️ Il confronto col mese scorso mette un parziale accanto a un intero

Il primo del mese, «flusso di settembre» contro «flusso di agosto» direbbe un
crollo a chi semplicemente non ha ancora fatto niente. Non si nasconde con una
soglia arbitraria («solo dopo il quindici»): **lo dichiara la frase stessa** —
*finora* il flusso del mese è X, contro Y *dell'intero mese scorso*. È l'unica
forma onesta a qualunque giorno del mese, e non ha rami.

##### La bolla, e perché la griglia ha un contenitore in più

`<div className="relative">` attorno alla griglia 2×2 esiste per lei. Ancorata al
contenitore della pagina, la sua posizione dipenderebbe dall'altezza di tutto ciò
che le sta sopra — intestazione, selettore conti, carosello — e si sposterebbe
con esse.

Le due trappole previste in progettazione sono state rispettate e valgono ancora:
fuori da `HomeHero` (è `overflow-x-auto`, e un asse non `visible` ritaglia anche
l'altro) e fuori dalle card (hanno `backdrop-filter`, che crea un contesto di
impilamento da cui nessuno z-index esce).

⚠️ **L'icona è una bussola, non un fumetto di chat.** In 24b si tocca, non si
scrive: un fumetto prometterebbe la tastiera che arriva con la 24c. Quando
arriverà, l'icona va cambiata **nello stesso commit** — l'etichetta si sceglie
insieme a ciò che fa.

##### Il collaudo, e la verifica che ha sbagliato di nuovo

414px e 375px, zero errori console. Bolla 48×48, non ritagliata, dentro lo
schermo anche a 375. Le quattro domande rispondono. **Il confronto che conta**:
il disponibile dichiarato dal coach (€ 1241,10) è lo stesso della card in
impostazioni — le due schermate non si contraddicono, che è l'unica cosa che
questo progetto non perdona.

⚠️ E il driver ha sbagliato ancora: controllava che il testo del pannello
**crescesse** dopo un tocco, ma la risposta **sostituisce** la precedente —
quindi passando da una domanda lunga a una corta il pannello si accorcia. Due
pastiglie perfettamente funzionanti sono state dichiarate rotte. Ora si guarda il
blocco della risposta: deve esistere, non essere vuoto e **cambiare** fra una
domanda e l'altra.

#### Emerso dal code-review della 24b

Cinque rilievi, tutti applicati. Quattro sono rami degeneri — stati che i dati
di collaudo non attraversavano — e il quinto è una contraddizione fra due
schermate, cioè la cosa che questo progetto non perdona.

##### ⚠️⚠️ Il coach ignorava il filtro conto della home

La bolla galleggia su una home **filtrabile per conto**, ma lo snapshot chiede
`p_account_id: null`. Con un conto selezionato, `HomeHero` diceva «Flusso € 120»
e il coach un altro numero per lo stesso mese, sotto la stessa parola, a un
tocco di distanza. È **letteralmente** il difetto di «Flusso netto» su
`/analisi` (review della 20a), ricreato in verticale invece che in orizzontale.

⚠️ **La correzione NON è filtrare.** Il coach deve guardare tutto, e per tre
ragioni indipendenti: i budget valgono su tutti i conti *per costruzione* (17a —
«un budget è un limite su una CATEGORIA, non su un conto»), le uscite fisse
vengono da `recurring_rules`, e il disponibile deve coincidere con quello della
card in impostazioni. Filtrarlo spezzerebbe tutte e tre.

Quindi **si dichiara**, con la stessa mossa già fatta per i budget
(`acrossAllAccounts`): con un filtro attivo il pannello dice che i suoi numeri
valgono su tutti i conti. La regola sottostante è quella di sempre — *vietata la
contraddizione, non la differenza di ambito, purché l'ambito sia detto*.

##### ⚠️ «Ti restano X per le spese variabili» diventava falso spendendo

`available` è entrate − uscite fisse: **non** sottrae le spese variabili già
fatte. La frase d'apertura prometteva quindi un margine intatto a chi se l'era
già mangiato. La risposta lunga aggiungeva `{spent}` proprio per questo, ma
l'apertura no.

Ora la riga sul già speso c'è anche in apertura, **e solo se qualcosa è stato
speso**: «ne hai già usati € 0,00» sarebbe di nuovo un non-fatto enunciato come
osservazione.

##### Tre andate e ritorni ridondanti a ogni apertura

`getAvailableThisMonth()` rifaceva `dashboard_totals` per il mese corrente — che
è già il bucket 1 della chiamata del coach — e rifaceva le uscite fisse, che
`getBudgetOverview()` restituisce già in `fixedOutflowsThisMonth` e che venivano
scartate. **È la stessa duplicazione per cui `getFixedOutflows()` era stata
cancellata nella 24a, ricreata un livello più su.**

⚠️ Togliendola si rischiava di riscrivere `entrate − uscite fisse` in un secondo
posto. Chiusa spostando anche quella sottrazione in `lib/totals.ts`
(`disponibileDaTotali`): banale, e proprio per questo da scrivere una volta
sola.

##### I due rami degeneri che i dati di collaudo non toccavano

- **Il «più vicino» al traguardo poteva essere un obiettivo COMPLETO**: con un
  obiettivo al 100% la risposta diceva «€ 500,00 di € 500,00, ne mancano
  € 0,00», nascondendo proprio quello che aveva ancora bisogno di attenzione.
  Ora si sceglie fra gli aperti, e se sono tutti raggiunti lo dice.
- **Al primo mese di utilizzo**: «contro € 0,00 dell'intero mese scorso», cioè
  un'**assenza di dati enunciata come misura**. La riga ora tace. Le due frasi
  sopra erano già ramificate per i loro casi degeneri; questa no.

##### La controprova a schermo

Il pannello funziona ancora dopo la rimozione della chiamata; senza filtro
l'avviso **non** compare; con «Conto principale» selezionato **compare**; la
risposta sugli obiettivi non è un obiettivo già chiuso. Zero errori console.

⚠️ La prova del filtro tocca uno stato dell'utente — il cookie del conto
selezionato — e finisce rimettendo «Tutti i conti». Nessuna scrittura sul
database, e lo stato è come è stato trovato: la stessa disciplina del collaudo
della 24a.

