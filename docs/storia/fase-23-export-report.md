# Fase 23 — export CSV e report stampabile

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 23 — export CSV e report mensile (issue #37)

Progettata il 2026-08-25 prima di scrivere codice. **Nessuna migration: lo schema
non cambia.** Due PR — **23a** export CSV, **23b** report stampabile — con la
dipendenza a senso unico di sempre: la 23a è un prodotto finito da sola.

⚠️ **Zero dipendenze nuove**, ed è una scelta, non un vanto: vale la regola in
testa a `lib/import/csv.ts` — *una dipendenza si aggiunge quando serve, non
quando è comoda*.

#### Il CSV parla alla PERSONA, e la re-importabilità NON è promessa

Colonne leggibili — nomi, non uuid: data, tipo, categoria, conto, conto di
destinazione, importo, note, **numero di ricevute**. Un CSV non può portare i
file allegati, e tacerlo lascerebbe credere che l'export sia completo: la colonna
dice "2" e non porta niente, che è la verità. Riusa `getAttachmentCounts()`.

La strada "esporta ciò che il tuo import rilegge" è stata **scartata**, e i tre
motivi vanno tenuti perché sembra sempre una buona idea:

- una riga inserita a mano ha `import_key` **NULL**, e lì i NULL restano
  *distinti* (all'opposto di `budgets`) → reimportando il proprio export quelle
  righe si duplicherebbero mentre le altre no. **Metà file idempotente è peggio
  di nessuna idempotenza**;
- l'import non crea le categorie mancanti: su un altro account i nomi non
  risolvono;
- per essere rileggibile il file dovrebbe portare uuid, cioè diventare
  illeggibile nel foglio di calcolo, che è l'uso reale.

⚠️ Il rischio non è tecnico ma di **aspettativa**: un file con esattamente le
colonne che l'import chiede *invita* a reimportarlo. La pagina non dice mai
"backup" — dice "esporta i tuoi movimenti" e rimanda a `/impostazioni/importa`
per la strada opposta.

**Formato**: date sempre **ISO** (`parseDate` ha già pagato l'ambiguità di
`03/04/2026`); separatore e decimali **secondo il locale** (`;` + virgola in
italiano), perché lo scopo del file è aprirsi bene nel foglio di calcolo di
*quell'* utente. Residuo dichiarato: un file italiano in un Excel inglese chiede
la procedura guidata.

⚠️ **Il BOM va scritto.** Excel su Windows apre un UTF-8 senza BOM come latin-1:
"Caffè" → "CaffÃ¨". È il mojibake che `repairMojibake()` esiste per *riparare*
nei file altrui, prodotto stavolta da noi. `parseCsv` il BOM lo toglie già.

⚠️⚠️ **Un campo che inizia con `=`, `+`, `-` o `@` è una FORMULA per Excel.**
`notes` e i nomi di categoria e conto sono testo dell'utente: è il **terzo** punto
dell'app in cui quel testo diventa sintassi, dopo `.or()` in `getTransactions`
(da cui `isAccountId()`) e la query string della Fase 22. La difesa sta sulle
sole colonne di **testo libero**, mai su quelle numeriche — un importo `-12,50`
comincia con un meno legittimamente.

#### Il download è un Route Handler, e non viola la regola

`/impostazioni/esporta/download`, accanto alla pagina che lo comanda. La regola
*"Server Actions per tutte le operazioni DB — mai chiamate API REST dirette"*
vieta al **client** di parlare con Supabase, non a noi di avere una rotta nostra
(ce ne sono già quattro, tutte auth). Scritto qui, o alla rilettura sembra uno
strappo.

⚠️ **Il fattore decisivo è il telefono.** Una server action dovrebbe
materializzare il file come stringa, rispedirlo nel canale RSC e farlo scaricare
da un `<a download>` su un `blob:` — inaffidabile su iOS Safari. Un
`Content-Disposition: attachment` lo scarica il browser da sé.

Tre obblighi del handler: `requireUser()` (è un URL pubblico), validazione dei
filtri dalla query string (`isAccountId()` sul conto, insiemi noti per gli
altri), e **`Cache-Control: private, no-store`** — contiene l'intera storia
finanziaria di una persona; il precedente sta in `next.config.ts`.

**Il tetto si pagina, non si tronca**: blocchi da 1000 finché la risposta è
piena. Qui non c'è una schermata dove scrivere "ho guardato N righe" come in 21c
— un file che finisce prima non ha modo di dirlo.

#### Il report: lo stampa il BROWSER

`/analisi/report`, raggiungibile da `/analisi` — è una vista del mese, non una
configurazione. `window.print()` e nient'altro: i grafici Recharts sono già SVG
nel DOM, quindi restano **vettoriali** (html2canvas li rasterizzerebbe), e su iOS
si salva con Condividi → Stampa. Rinuncia dichiarata: **niente report generato
dal server**, quindi un PDF spedito per email sarebbe un lavoro nuovo.

Tre trappole, tutte figlie di fasi precedenti:

- ⚠️ **il tema scuro stampa un foglio nero** — `@media print` forza i token
  chiari a prescindere da `.dark`;
- ⚠️⚠️ **il browser non stampa gli sfondi** salvo spunta esplicita: ogni
  pastiglia d'accento con sopra `--on-accent` diventa **bianco su bianco**. In
  stampa si usano gli inchiostri `--ink-*` su fondo bianco, mai il riempimento.
  È la trappola accento/inchiostro della Fase 18 in una veste dove il colore non
  è sbagliato ma **assente**;
- ⚠️ **Recharts anima al mount**: stampando subito si cattura un grafico a metà.
  `isAnimationActive={false}` nella vista report.

#### ⚠️ Il report non introduce un solo numero nuovo

Ogni cifra viene da `getDashboardTotals`/`getAnalyticsData` e da `sommaUscite()`.
Non si riscrive un filtro: la 20a ha già registrato che tre `filter` scritti a
mano erano tre occasioni di divergere, e divergevano. I nomi restano quelli
corretti a caro prezzo — **"Flusso"**, **"Uscite"**, **"Capitale versato"** — e i
trasferimenti non entrano nel flusso.

⚠️ **Qui conta più che altrove perché un PDF si ARCHIVIA.** Una parola sbagliata
su una schermata si corregge col deploy successivo; la stessa parola su un file
salvato resta per sempre, e nessuna correzione la raggiunge.

Per lo stesso motivo, se il report è filtrato per conto **deve scriverlo
nell'intestazione**: sullo schermo lo spiega il chip accanto, un foglio stampato
viaggia da solo. E il nome del file porta periodo e conto
(`seichi-movimenti-2026-08.csv`) — tre export nella cartella Download devono
essere distinguibili senza aprirli.

#### Emerso implementando la 23a (2026-08-25)

Implementata e collaudata: 31 prove sul serializzatore, 25 nel browser, zero
errori console. Cinque rilievi dal code-review, quattro corretti.

- ⚠️⚠️ **La paginazione poteva PERDERE righe, e il difetto era PREESISTENTE.**
  `getTransactions` ordinava per `date desc` e basta, ma `date` non è univoca —
  sui dati veri **162 righe su 242** la condividono, fino a 8 nello stesso giorno,
  perché l'import della Fase 21 scrive movimenti datati al giorno. Con un solo
  criterio Postgres è libero di ordinare le righe a pari merito diversamente a
  ogni query, e **le pagine sono query distinte**: basta che due giri non
  concordino a cavallo di un confine perché una riga compaia due volte e un'altra
  mai. Chiuso con `id` come secondo ordinamento — una riga, e vale anche per
  `/transazioni`, dove il difetto vive dalla 21c.
  ⚠️ Non si vede sui dati di prova, dove una pagina basta a coprire tutto: si
  vede solo con più pagine **e** con date ripetute.

- ⚠️ **Due volte la stessa classe: una lettura fallita travestita da fatto.** Il
  `count` dei movimenti scartava l'errore, quindi un guasto di rete faceva
  sparire il comando dicendo "non c'è niente da esportare"; e il conteggio delle
  ricevute degradava a mappa parziale, che nel file diventa uno **zero scritto in
  una colonna e salvato su disco**. È la classe già corretta in Fase 22 su
  `getAttachments`, e la differenza fra i due contesti è ciò che detta la cura:
  in una lista un dato mancante si ricarica, **in un file si archivia**. Da qui
  `getAttachmentCountsChecked()` accanto a `getAttachmentCounts()`: i due
  chiamanti hanno bisogni opposti davanti allo stesso guasto, e nessuno dei due
  comportamenti è giusto in assoluto.

- ⚠️ **`t.typesSingular` non contiene `trasferimento` né `disinvestimento`**, e
  `lookup()` ha come ripiego l'**id del database**: la colonna Tipo usciva mista,
  cinque etichette e due id minuscoli — e in un file INGLESE con due parole
  italiane dentro. Trovato leggendo l'output, non da un controllo: ogni riga era
  sintatticamente perfetta. Si usa `t.transactionTypes[…].label`, che i tipi di
  MOVIMENTO li ha tutti e sette. **La regola: prima di indicizzare un dizionario
  con un valore del database, verificare che quel dizionario copra tutti i valori
  possibili — un ripiego silenzioso non è una difesa, è un difetto rinviato.**

- ⚠️ **Un filtro VALIDO poteva produrre un file vuoto.** Cambiando tipo, la
  categoria selezionata restava e veniva spedita: tipo e categoria incompatibili
  danno zero righe, cioè un CSV con la sola intestazione — l'affermazione falsa
  che il rifiuto dei filtri malformati esiste per impedire, ottenuta però con
  parametri legittimi. Qui la scelta è **opposta** a quella della barra filtri, di
  proposito: là il chip nomina la categoria e la lista dice "nessun movimento con
  questi filtri", quindi lo scarto è visibile e correggibile; un file no.

- **Il segno dei trasferimenti resta positivo senza conto scelto, ed è un
  compromesso dichiarato.** Sommare la colonna Importo sovrastima. Non è
  risolvibile lì dentro: senza un punto di vista il segno di un trasferimento non
  esiste — è la stessa ragione per cui la lista lo lascia neutro — e sia azzerarlo
  sia svuotare la cella perderebbe un dato vero. Chi vuole un totale sommabile
  esporta **un conto per volta**: verificato che lo stesso trasferimento esce
  `−400` guardando Trade Republic e `+400` guardando il Conto principale.

#### ⚠️ Il collaudo: settima e ottava volta che a sbagliare è la VERIFICA

- **Playwright non traduce il `locale` del contesto in `Accept-Language` per
  `context.request`.** Il giro inglese scaricava quindi un file *italiano* e il
  KO dichiarava rotto il codice mentre a non parlare inglese era la richiesta. Il
  file inglese va preso con un **click vero** nella pagina.
- **Il confronto fra le due lingue misurava due filtri diversi**: l'italiano su
  "tutto", l'inglese sul default a 30 giorni — 20 righe contro 242.

Il metodo che ha retto, e che vale la pena riusare:

- ⚠️ **il referto verde è stato messo alla controprova** disattivando la guardia
  sulle formule e togliendo il BOM: sette controlli sono diventati rossi, poi
  ripristinati. *Un elenco di soli OK non distingue passato da non eseguito*;
- ⚠️ **la paginazione si prova abbassando la soglia**, non sperando che i dati
  bastino: 242 righe stanno sotto `EXPORT_CHUNK = 500`, quindi il ciclo girava
  una volta sola. Con blocchi da 7 (35 giri) escono le stesse 242 righe. È lo
  stesso gesto con cui la Fase 22 ha provato il rifiuto degli allegati abbassando
  `ATTACHMENT_MAX_BYTES`;
- **il giro completo**: ciò che l'export scrive viene riletto da `parseCsv()` e
  `parseAmount()` dell'import, in entrambe le lingue, con accenti, `;` e
  virgolette dentro i campi. Non promette la re-importabilità — promette che le
  due metà del progetto non si contraddicono sul formato.

#### Emerso implementando la 23b (2026-08-25)

Nessuna migration, **zero dipendenze**. `/analisi/report` + `window.print()`.

##### ⚠️ Stampare un'app che può essere in tema scuro

La via ovvia — un `@media print` che ridichiara i token chiari — significava una
seconda lista di **43 valori** da tenere allineata a mano: esattamente ciò che la
Fase 18 rifiutò quando scelse due soli blocchi invece di duplicare la palette
dentro una media query.

La soluzione è **condividere il selettore**, non i valori: `:root, .paper { … }`.
Funziona per come cascatano le custom properties — `.dark` le imposta su `<html>`
e i figli le ereditano, ma una dichiarazione su un elemento più interno vince per
quel sottoalbero. `.paper` sul contenitore del report riporta al chiaro tutto ciò
che sta dentro, **senza un solo valore duplicato**. E vale sempre, non solo in
stampa: un documento è color carta, così ciò che vedi è ciò che stampi.

Due trappole dentro quella soluzione, e nessuna delle due era prevedibile
leggendo il codice:

- ⚠️⚠️ **Ridefinire i token NON basta per il testo.** La proprietà `color` il
  documento se l'è già risolta più in alto (il contenitore di `(main)` fa
  `color: var(--text-primary)` con il valore del tema scuro), e l'eredità porta
  giù il **colore calcolato**, non la variabile. Ogni elemento senza un colore
  proprio finiva con l'inchiostro chiaro su carta bianca: luminanza 0,91 su 1,00.
  Serve `.paper { color: var(--text-primary) }` — il token si condivide nel
  blocco comune, la **proprietà** va dichiarata a parte. ⚠️ Non si può metterla
  nel blocco condiviso: là finirebbe anche su `<html>` e forzerebbe l'inchiostro
  chiaro sull'intera app in tema scuro.
- ⚠️⚠️ **Un documento non può essere di VETRO.** `--card` è
  `rgba(255,255,255,0.45)`: il vetro funziona solo sopra la superficie per cui è
  tarato, e sopra la pagina scura quel 45% diventa **grigio medio**, con i testi
  `--text-muted` quasi invisibili. Il fondo del foglio è ora `--color-tsuki`, che
  è la carta del progetto e **non è ridefinita in `.dark`**: un foglio è un
  foglio in entrambi i temi.

##### ⚠️ La verifica che passava sopra un difetto vero

Il controllo del tema scuro leggeva `backgroundColor` e ne calcolava la luminanza
con `match(/\d+/g)`, cioè prendendo i primi tre numeri e **buttando via
l'alpha**: su `rgba(255,255,255,0.45)` vedeva bianco pieno e dichiarava «fondo
chiaro». Il difetto si è visto **guardando lo screenshot**.

**La regola: un controllo che misura la proprietà giusta nel modo sbagliato non
fallisce mai — e quindi non protegge da niente.** Ora il controllo confronta
anche `alpha === 1`, ed è stato messo alla controprova rimettendo il vetro:
diventa rosso, mentre «fondo chiaro» continua a passare. È la dimostrazione in
una riga di cosa fosse cieco.

##### Il report non introduce un solo numero — e proprio per questo ne ha corretto uno

`entrate` e `uscite` escono ora da `getAnalyticsData()`, che le calcolava già:
ricalcolarle avrebbe creato la **quarta** definizione di "uscita" dopo le tre che
la review della 20a ha dovuto unificare.

⚠️ E mettendole sul foglio è comparsa una collisione che nessuno vedeva: la card
diceva **«Uscite € 785,30»** e il donut, due dita più sotto, **«Uscite
€ 733,40»**. La differenza sono esattamente i **51,90 di abbonamenti** — la card
somma `spesa + abbonamento` (come il Flusso e la legenda del grafico), il donut
solo `spesa`, ma al centro portava `t.types.spesa`, che in italiano rende
"Uscite": **la parola larga sopra il numero stretto**, mentre dalla 20a "uscite"
significa deliberatamente l'insieme che comprende gli abbonamenti.

Corretto in `t.analytics.spendingLabel` ("Spese"), quindi **anche su `/analisi`**,
dove il difetto viveva da sempre invisibile perché niente gli stava accanto. È il
gemello della regola della #9: *aggiungere un elemento accanto a un testo può
rendere quel testo ambiguo senza toccarlo.*

##### Il quarto periodo — «tutto», chiesto usando l'app

Notato dopo il merge della 23a: **l'export CSV accettava `periodo=tutto`, il
report no.** Le due liste di finestre restano diverse di proposito — l'analisi
ragiona per periodi di CALENDARIO (settimana, mese, anno), la lista per finestre
MOBILI (7g, 30g, 3m) — ma la stessa fase offriva l'intera storia in un formato e
non nell'altro. Aggiunto a `ANALYTICS_PERIODS`, quindi **quarto tab su
`/analisi`** e non solo nel report: una finestra che il report ha e la pagina no
contraddirebbe la regola per cui il report è *la vista che stavi guardando*.

- Il trend di «tutto» si raggruppa **per ANNO** (su una storia lunga i mesi sono
  illeggibili) e parte dalla data del **primo movimento**, chiesta al database:
  un inizio fisso riempirebbe il grafico di anni vuoti precedenti all'utente.
- Nessun periodo precedente con cui confrontarsi → `variazionePct` esce `null`,
  che la UI già sa mostrare.

##### ⚠️⚠️ …e «tutto» ha fatto emergere un troncamento SILENZIOSO

Fino a qui ogni query dell'analisi aveva un limite inferiore di data. «Tutto» lo
toglie, e **PostgREST tronca a 1000 righe senza dirlo**: i grafici avrebbero
mostrato le prime mille righe con un totale più basso del vero e nessun errore.
Il rischio è arrivato col periodo nuovo ma **non era nato lì** — anche un anno
molto movimentato poteva superarle. Chiuso paginando la lettura
(`leggiTutte`, blocchi da 500 — dalla #120 `readAll()` in `lib/read-all.ts`) per **tutti** i periodi, non solo per quello nuovo. ⚠️ "Tutti i periodi" di `/analisi`, non tutte le letture: budget, obiettivi e investimenti sono rimasti fuori fino alla #121.

⚠️⚠️ **E la prima versione del lettore paginato aveva il difetto che il
code-review della 23a aveva appena fatto correggere**: paginava **senza
ordinamento totale**. Senza `order by` ogni pagina è una query a sé, Postgres può
ordinare diversamente a ogni giro, e con gli offset una riga finisce in due
blocchi e un'altra in nessuno.

Misurato abbassando `ANALYTICS_CHUNK` a 5: il Flusso di «tutto» usciva
**€ 2.766,12** invece di € 6.068,95. Con `.order("id")` i due valori coincidono a
blocchi da 5 (49 giri) e da 500 (1 giro), su tutti e tre i periodi.

**La lezione, e vale più della correzione: il difetto non stava in
`getTransactions`, stava nella PAGINAZIONE.** Averlo corretto là non ha protetto
il lettore scritto poche ore dopo — è la "migrazione a campione" che questo
documento registra dalla Fase 18, applicata a se stessi nella stessa giornata.
Chi scrive una nuova lettura a blocchi in questo progetto se lo ritrova identico.

⚠️ Nota di metodo: **il difetto l'ha trovato l'iniezione del guasto, non un
controllo**. Abbassare la soglia è ormai il gesto standard di questo progetto
(`ATTACHMENT_MAX_BYTES` in Fase 22, `EXPORT_CHUNK` in 23a) e qui ha pagato per la
terza volta.

⚠️ E un OK **vuoto**: la prova che l'asse del trend mostrasse gli anni faceva
`assi.every(…)` su un array **vuoto**, che in JavaScript è `true`. Passava senza
guardare niente. Che l'asse dica davvero 2023-2026 si è visto **guardando lo
screenshot**. Un insieme vuoto soddisfa qualunque `every`: un controllo che può
ricevere zero elementi deve pretendere `length > 0` prima di dichiararsi
superato.

##### La seconda code-review — quella sul periodo «tutto» (6 rilievi, tutti applicati)

⚠️ Il batch di «tutto» era stato collaudato ma **non ancora passato da una
review**, ed è quello in cui mi ero già infilato il difetto della paginazione.
Vale come regola di processo: *una review copre il diff che esisteva quando è
stata eseguita*, esattamente come una guardia di migration copre i successori che
esistevano quando è stata scritta.

- ⚠️ **`analytics.windows` non aveva la chiave `tutto`**, quindi
  `SpendingPieChart` ripiegava su `mese`: sotto l'intestazione "Tutto lo storico"
  compariva **"Nessuna spesa questo mese"**. Terza volta in questa fase che una
  frase falsa finirebbe **stampata e archiviata**, e la seconda che nasce da un
  ripiego silenzioso di un dizionario indicizzato con un valore variabile.
- ⚠️ **L'errore della query d'ancoraggio veniva scartato.** Su una lettura
  fallita `primoAnno` ripiegava sull'anno corrente: «tutto» diventava in silenzio
  «quest'anno» per KPI, trend e torta. Ogni altra query della funzione l'errore
  lo restituisce — questa era l'unica a non farlo.
- ⚠️ **«— primo mese» su un arco di quattro anni.** Con `variazionePct` null per
  costruzione, `/analisi` cadeva nel ramo di ripiego e mostrava quella frase. Il
  commento in `action.ts` diceva "nessuna freccia": **descriveva un
  comportamento che la pagina non aveva**. Su «tutto» ora non si mostra nulla.
- **L'ancora non filtrava per tipo** mentre trend e torta escludono
  `trasferimento`/`disinvestimento`: un trasferimento più vecchio di tutto il
  resto avrebbe aggiunto colonne d'anno strutturalmente vuote — proprio ciò che
  partire dal primo movimento serve a evitare.
- **Una data futura** (il form la accetta) dava `anni = 0` e una finestra
  `rangeStart > rangeEnd`: pagina di zeri su un archivio pieno. Chiuso con
  `Math.min(primoAnno, anno corrente)`.
- **Il lettore a blocchi non distingue "fine dati" da "pagina tagliata dal
  server"**: se il *Max rows* di PostgREST scendesse sotto 500, il primo blocco
  tornerebbe già corto e la lettura si fermerebbe lì, reintroducendo il
  troncamento silenzioso che il lettore esiste per impedire. Il vincolo è ora
  scritto sulla costante, insieme al fusibile `ANALYTICS_MAX_CHUNKS` che l'export
  aveva già.

⚠️ Effetto collaterale dell'`.order("id")`: la legenda del donut ha ora un ordine
**deterministico** dove prima dipendeva da come il database restituiva le righe.
Resta un ordine arbitrario (per id del movimento più vecchio) e non per importo:
è una scelta di prodotto preesistente, non toccata qui.

##### Due rifiniture chieste guardando l'app, non un controllo

- ⚠️ **La bottom nav non deve esserci sul report, non solo in stampa.** `no-print`
  la toglie dalla carta ma non dallo schermo, e siccome è `fixed` galleggiava
  sopra il documento mentre si scorre — coprendo proprio il donut delle spese,
  cioè la parte che un'anteprima serve a controllare. Ora `BottomNav` restituisce
  `null` sulle rotte che sono un DOCUMENTO (`DOCUMENT_ROUTES`), e il report ha
  perso i 144px che le riservava: spazio vuoto per un elemento inesistente.
  ⚠️ Nascondere lì è più economico che spostare il report fuori dal gruppo
  `(main)`, che vorrebbe un layout proprio e un secondo controllo di
  autenticazione per ottenere la stessa cosa.
- **Il comando "Report stampabile" sta sulla riga del selettore conti.** Stava su
  una fascia propria sotto i tab, per una parola sola, mentre accanto al chip
  restava metà riga vuota: su un telefono lo spazio verticale è la risorsa
  scarsa, e un comando secondario si mette dove uno spazio esiste già invece di
  aprirne uno nuovo. ⚠️ `ml-auto` e non `justify-between`: senza conti il
  selettore non viene reso affatto, e `justify-between` con un figlio solo lo
  appoggerebbe a sinistra — il comando cambierebbe lato a seconda di quanti conti
  hai.

##### Emerso dal code-review — 8 rilievi, 7 applicati

I due che valgono una regola:

- ⚠️ **Un documento che non sa dichiarare il proprio ambito non si stampa.** Con
  `getAccounts()` fallita l'intestazione scriveva "Tutti i conti" — perché il
  nome non si risolveva — sopra numeri che restavano filtrati sul conto
  ricordato. Su `/analisi` degradare è giusto (sparisce il chip, i dati restano);
  qui l'affermazione finisce **stampata e archiviata**. Ora, se un conto è
  selezionato e i conti non si leggono, la pagina si ferma.
- ⚠️ **`--background` è un `radial-gradient`, non un colore**, applicato con uno
  stile inline che nessuna classe scavalca: con «Grafica di sfondo» attiva
  finiva stampato dietro il foglio, su ogni pagina. In stampa si spengono le sole
  `background-image`, così i colori — e la carta — restano.

Il resto: `pb-36` (lo spazio della bottom nav) che poteva generare un foglio
bianco in più; `-webkit-backdrop-filter` non azzerato, cioè la card del grafico
ancora sfocata **proprio su iOS**, che è il percorso per cui la fase esiste; il
ritorno a `/analisi` che perdeva il conto e poteva mostrarne un altro;
`getAccounts()` (aggregazione dei saldi su tutto l'archivio) usata per ricavare
un nome, al posto di `getAccountOptions()`; e `AnalyticsTabs` che teneva la
propria copia dei tre periodi nella stessa PR che ha estratto `ANALYTICS_PERIODS`.

##### La stampa vera — fatta il 2026-08-25, ed è ciò che chiude la fase

Tre criteri su otto non erano raggiungibili da `localhost` con un browser
headless, e sono stati verificati **a mano dal telefono sull'IP di LAN**:
stampa partendo dal tema scuro, resa con «Grafica di sfondo» disattivata, e il
percorso reale Condividi → Stampa → Salva su File.

⚠️ **Con essa si chiude anche l'unico residuo del code-review**:
`ResponsiveContainer` di Recharts si dimensiona da un `ResizeObserver`, e non era
dimostrato che rimisurasse prima dello scatto di stampa a larghezza di pagina —
sotto emulazione lo faceva (svg 290 → 340px), ma l'emulazione non è la stampa.
Sulla carta i grafici escono corretti, quindi il `beforeprint` che era stato
tenuto pronto **non serve** e non è stato aggiunto.

⚠️ Vale come metodo, e conferma la nota della Fase 22: `collauda-app` gira su
`localhost` e **non stampa**. Ogni fase che tocca un'API del browser — la stampa
quanto `crypto.randomUUID()` — ha una parte di collaudo che nessun driver può
fare, e va prevista dall'inizio invece di scoprirla alla fine.

