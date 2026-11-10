# Fase 20 — progetto dei conti, e la 20a

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 20 — conti multipli e trasferimenti

Progettata per intero il 2026-08-13 prima di scrivere codice, come la Fase 17.
**Non ancora implementata.** Consegna in due PR: **20a** conti (issue #34),
**20b** trasferimenti (issue #49) — dipendenza a senso unico, la 20a è un
prodotto finito da sola.

```sql
accounts: id (UUID), user_id (UUID NOT NULL), name (VARCHAR 50 NOT NULL),
          type (VARCHAR 20), icon (VARCHAR 50), color (TEXT),
          initial_balance (DECIMAL 10,2 NOT NULL default 0),
          archived (BOOL NOT NULL default false), created_at

transactions: + account_id (UUID NOT NULL), to_account_id (UUID, nullable)
recurring_rules: + account_id (UUID NOT NULL)
-- type acquisisce 'trasferimento'
```

#### ⚠️ Il vincolo che rende praticabile tutto il resto

Prima di progettare è stato fatto l'audit di **ogni** consumatore di
`transactions`: `dashboard_totals()` (l'app legge per nome — `somma(b,"entrata")`),
il grafico mensile (`.in("type", [...5 nomi...])`), la torta (`spesa`), i budget
(`spesa`/`abbonamento`), gli obiettivi (`risparmio`), gli investimenti
(`investimento`). **Nessuno somma "tutto ciò che c'è".**

Quindi un tipo nuovo è invisibile a ogni totale esistente **per costruzione, non
per attenzione di chi scrive** — ed è ciò che rende sicuro modellare il
trasferimento come transazione invece che come tabella separata. Se anche uno
solo di quei punti avesse sommato indiscriminatamente, la conclusione sarebbe
stata l'opposta. L'audit va rifatto prima di aggiungere altri tipi.

#### Le decisioni

- **`initial_balance` è una COLONNA, non una transazione di apertura.** Quando si
  aggiunge "Conto corrente" ci sono già 2.400 € dentro, e l'app non ha quella
  storia. Modellarli come `entrata` li farebbe comparire fra i redditi del mese e
  gonfierebbe ogni grafico: **è lo stesso difetto del trasferimento, in versione
  una-tantum.** Una colonna dice "il conto parte da qui" senza affermare che quei
  soldi siano un reddito.
- ⚠️ **`transactions.account_id` è `on delete RESTRICT`, non `cascade`.** La
  cascade su `categories` è deliberata — serve a eliminare un obiettivo — ma qui
  cancellare un conto cancellerebbe anni di movimenti reali. Un conto chiuso in
  banca non fa sparire ciò che ci hai speso. Da qui `archived`: si archivia, non
  si elimina.
- **`account_id` NOT NULL**, con migration che crea un conto per ogni utente
  esistente e fa il backfill. Nullable era la scelta comoda, ma
  `categories.user_id` nullable è già un debito aperto per esattamente questo
  motivo: il DB permette uno stato che l'app dà per impossibile. L'onboarding
  crea il primo conto, come già crea le categorie.
- ⚠️ **`recurring_rules.account_id` serve anche lei**, e
  `generate_recurring_transactions()` va aggiornata per copiarlo sulla
  transazione generata. Dimenticarlo produrrebbe righe senza conto — cioè
  violerebbe il NOT NULL e fermerebbe il job notturno per tutti (la #47 insegna
  che un guasto lì è per-utente solo se qualcuno lo isola).

#### Il trasferimento: UNA riga, non due

`type='trasferimento'`, `account_id` = origine, `to_account_id` = destinazione.

L'alternativa — due righe legate da un `transfer_group_id` — è quella che questo
progetto ha già scartato tre volte con lo stesso ragionamento: niente `valid_to`
sui budget, nessuna colonna `spent`, nessun `saved_amount` memorizzato. **Due
righe per un evento sono due punti di scrittura da tenere allineati**, e basta
cancellarne una per ottenere mezzo trasferimento: una somma che sparisce da un
conto senza comparire nell'altro, senza alcun errore e senza che nulla lo
segnali.

Con una riga sola lo stato illegale è **irrappresentabile**, e lo impone il DB:

```sql
check (to_account_id is null or type in ('trasferimento','risparmio','investimento'))
check (type <> 'trasferimento' or to_account_id is not null)
check (type <> 'trasferimento' or category_id is null)
check (to_account_id is null or to_account_id <> account_id)
```

⚠️ **Qui si rompe l'accoppiamento 1:1 fra tipo di transazione e tipo di
categoria** (`TransactionForm` filtra con `.eq("type", selectedType.id)`): il
trasferimento non ha categoria, e nel form il selettore categoria lascia il posto
al conto di destinazione. È il punto di rottura, ed è deciso adesso invece di
essere scoperto a metà implementazione.

#### ⚠️ `risparmio` e `investimento` possono avere una destinazione

Deciso il 2026-08-13. È la collisione che il progetto non aveva mai dovuto
affrontare: oggi `risparmio` e `investimento` **tolgono** soldi dal saldo e non
li mettono da nessuna parte. Con i conti, mettere 200 € da parte diventa
esprimibile due volte — una transazione `risparmio` verso un obiettivo **oppure**
un trasferimento verso il conto "Libretto" — e chi facesse entrambi vedrebbe
uscire 400 € dal conto corrente.

Soluzione: `to_account_id` è **facoltativo** su `risparmio` e `investimento`. Un
versamento verso l'obiettivo "Vacanza" può dire anche "i soldi sono finiti sul
Libretto": avanza l'obiettivo **e** sposta il denaro, in un gesto solo. Il doppio
conteggio diventa **impossibile**, non sconsigliato — la stessa preferenza per
l'irrappresentabile che regge `ProfileHeader` senza `email` nella Fase 19.

#### Il saldo si CALCOLA

Nessuna colonna `balance`, per la stessa ragione di `spent` e `saved_amount`:
avrebbe quattro punti di scrittura da tenere allineati, inclusi gli insert di
pg_cron.

```
saldo(X) = initial_balance(X)
         + Σ amount dove type='entrata' e account_id = X
         − Σ amount dove type <> 'entrata' e account_id = X
         + Σ amount dove to_account_id = X
```

#### ⚠️ La home perde "Saldo totale" — deciso il 2026-08-10 sul mockup `Seichi Conti.dc.html`

Oggi la home mostra `saldoTotale` = entrate − spese − risparmi − investimenti −
abbonamenti **su tutta la storia**. Con i conti quel numero entra in
contraddizione con la pagina conti, che alla stessa domanda ("quanto ho")
risponde con la somma dei saldi — diversa, perché `saldoTotale` **sottrae i
risparmi**, che sono ancora soldi tuoi solo altrove, e **ignora
`initial_balance`**.

⚠️ **La prima stesura rimandava la riconciliazione** ("la 20a non li
riconcilia"). Sbagliato, e vale registrare perché: rimandare non è *non
decidere*, è **spedire la contraddizione**. È la 20a a creare l'ambiguità —
prima non esisteva, perché non c'era un secondo numero — quindi è la 20a a
doverla chiudere. Due schermate della stessa app che rispondono diversamente a
"quanto ho" sono il difetto già elevato a regola nella 17a: *un numero sbagliato
che sembra giusto è peggio di un numero assente*.

La chiusura non lascia due numeri concorrenti perché ne toglie uno:

| | oggi | dalla 20a |
|---|---|---|
| cifra grande | `saldoTotale`, "Saldo totale" | **"Flusso · <mese>"** |
| formula | entrate − spese − risparmi − investimenti − abbonamenti, **su tutta la storia** | **entrate − spese − abbonamenti, del mese** |
| riga sotto | "↑ + € X questo mese" | *"entrate meno uscite di questo mese — non il saldo dei conti"* + *"i saldi reali sono nella pagina conti"* |

⚠️ **"Flusso" NON è `saldoMese`, ed è un errore già commesso una volta** (questa
riga diceva "è una rinomina, non un calcolo nuovo"). Va scritta una formula
nuova, e le due sottrazioni che cambiano hanno ragioni opposte:

- **risparmi e investimenti NON si sottraggono più.** Investire e risparmiare non
  è *consumare*, è **spostare**: con i conti quel denaro è ancora tuo, solo
  altrove. Sottrarlo lo farebbe sembrare speso — la premessa stessa della fase.
  La sottrazione di oggi era corretta solo finché quei soldi sparivano dalla
  vista, perché non c'era un posto dove metterli.
- ⚠️ **gli abbonamenti SÌ, e questo il mockup lo sbagliava.** I suoi numeri —
  2.400 − 1.240 = 1.160 — sottraggono le sole spese. Ma la home mostra quattro
  card (entrate, spese, investimenti, risparmi) e `abbonaMese` **non è fra
  quelle**: l'affitto sarebbe invisibile *e* non conteggiato, e il numero
  direbbe "ti restano 1.160" mentre deve ancora uscire. È la trappola già
  elevata a regola nella 17a ("spese variabili", mai "spese totali"). Nel
  mockup non si vede perché il mese di esempio non ha abbonamenti — **il difetto
  è nei dati d'esempio, non nel disegno**, ed è la ragione per cui i mockup vanno
  letti anche sui numeri e non solo sul layout.

Da qui anche il sottotitolo: **"uscite"**, non "spese", perché comprende gli
abbonamenti che nella tassonomia dell'app sono un tipo a sé.

**La home resta una vista di FLUSSO, i saldi stanno nella pagina conti** — la
divisione non cambia, cambia il fatto che ora la home lo *dice*. `saldoTotale`
non era una vista di patrimonio: era un **surrogato** costruito senza conti, e i
conti sono la versione vera della stessa domanda. Tenerlo significherebbe due
risposte, che è la configurazione peggiore.

⚠️ **Conseguenza sul costo**: `saldoTotale` è l'**unico** consumatore del bucket
`null` di `dashboard_totals()` — l'aggregazione su tutta la storia dell'account,
rifatta a ogni vista della home. Togliendo il numero il bucket diventa morto e va
rimosso nella stessa migration che tocca la funzione, o resta una scansione
dell'intero storico per un valore che nessuno mostra.

#### ⚠️ …e il saldo TORNA in home, in un carosello — deciso il 2026-08-11

La sezione qui sopra dice che la home perde la giacenza. **Non è più vero, e la
distinzione è precisa**: quello che è stato cancellato è `saldoTotale`, che dava
un numero **diverso** da `/conti`; quello che torna è la **somma dei saldi**,
cioè lo stesso identico numero, dalla stessa vista `account_balances`.

**La regola fissata dalla fase vieta la CONTRADDIZIONE, non la ripetizione.**
Due schermate non possono rispondere *diversamente* a "quanto ho". Rispondere
allo stesso modo è un'altra cosa — e affiancare i due numeri, ciascuno con la
propria spiegazione, è il modo più diretto di insegnare la differenza fra ciò
che si è *mosso* e ciò che *c'è*. Erano già dovute convivere in due pagine
diverse; il carosello le mette a confronto invece di sperare che l'utente le
colleghi da sé.

⚠️ **Va registrato che il primo tentativo era un'applicazione TROPPO LARGA della
regola.** Aggiungendo la riga "Saldo · € …" sotto il selettore l'avevo mostrata
solo con un conto singolo, motivando che "mostrarla su tutti i conti rimetterebbe
in home il numero che la fase ha tolto". Sbagliato: confondeva *un numero
sbagliato che contraddice* con *il numero giusto che concorda*. Una regola
applicata senza rileggere il motivo per cui esiste diventa superstizione.

Le decisioni del carosello:

- **"Saldo · N conti attivi"**, mai "Saldo totale" — il mockup scriveva la
  seconda, e sarebbe stata la parola falsa di sempre: gli archiviati restano
  fuori. Stesso titolo della pagina conti, o lo stesso numero avrebbe due nomi.
- **Con un conto selezionato la card mostra il saldo di QUEL conto**, non il
  totale. Le due pagine devono parlare dello stesso insieme, o sarebbe un flusso
  filtrato accanto a una giacenza globale — il difetto già corretto su
  "Risparmi · N%".
- ⚠️ **L'importo del saldo è NEUTRO** (`--color-yoru`), non verde come il flusso,
  e il mockup ha ragione. Un flusso è positivo o negativo — hai guadagnato o
  speso; **una giacenza semplicemente è**. Colorarla direbbe che avere 800 € è
  "buono" e un conto in rosso un fallimento: affermazioni che la card non ha
  titolo per fare.
- **Lo stato dell'occhio sta in `HomeHero`**, non nelle card: restando in
  `FlowCard` si poteva nascondere il flusso lasciando il saldo accanto in chiaro,
  cioè non nascondere niente.
- **Il link "i saldi reali sono nella pagina conti" è sparito dalla FlowCard.**
  Mandava per la strada lunga a una cosa distante uno swipe, ed era diventato
  incompleto al punto di sviare. La riga di spiegazione ne ha preso il posto e
  ora fa due lavori: dice cosa il numero **non** è *e* insegna che si scorre —
  che è il difetto tipico dei caroselli, metà del contenuto invisibile a chi non
  sa del gesto.

⚠️ **Due trappole di CSS, entrambe scoperte guardando lo schermo:**

- **`overflow-x-auto` RITAGLIA il `box-shadow`.** Per specifica, se un asse non è
  `visible` non lo è nemmeno l'altro: il taglio avviene su tutti e quattro i
  lati, e la card sembra piatta pur avendo le stesse classi di prima. Non ha
  perso l'ombra, ha perso lo spazio dove disegnarla. `card-shadow` è
  `0 8px 24px`, quindi si estende **32px sotto**, 16 sopra e 24 ai lati: il
  padding va dimensionato leggendo la definizione, non a occhio — il primo
  tentativo con `py-4` dava metà dello spazio necessario proprio sotto, dove
  quell'ombra si vede di più.
- **Il padding va sulle PAGINE, non sul contenitore.** Messo sul track, ogni
  pagina risultava più stretta della vista: si vedeva sbucare la card successiva
  e il bordo sembrava tagliato comunque. Il contenitore va a tutta larghezza
  (`-mx-5`, fino ai bordi dello schermo) e sono le pagine a portare `px-5`, gli
  stessi 20px del resto della home — così la card è allineata alle quattro sotto.

#### ⚠️ `accounts.type` è DECORATIVO, mai semantico — deciso il 2026-08-10

La domanda che l'ha sollevato: un conto "Portafoglio investimenti" **collide con
la pagina Investimenti**? No, e il test che lo dimostra è *"esiste un caso reale
in cui i due numeri devono divergere?"*. Ce ne sono tre, tutti normali:

1. **Liquidità non investita** — 1.000 € trasferiti sul conto titoli e non ancora
   impiegati: il conto ha giacenza, il *totale investito* non si muove. La
   differenza è un'informazione, non un errore.
2. **Investimento da un altro conto** — un PAC addebitato sul corrente è
   `type='investimento'` a pieno titolo, e il conto titoli non lo vede.
3. **Plusvalenze** — il totale investito è per definizione la somma dei
   versamenti (Seichi non ha quotazioni); il saldo di un conto un domani potrebbe
   essere allineato al valore reale. Allora divergono *strutturalmente*.

Sono due **dimensioni**: `transactions.type` dice **che cosa** hai fatto (flusso,
alimenta la pagina Investimenti), il conto dice **dove si trova** il denaro
(giacenza, alimenta la pagina Conti). Formule diverse su insiemi diversi: non
possono essere lo stesso numero, e non devono.

⚠️ **Ma regge solo se `accounts.type` non decide niente.** Nel momento in cui
facesse qualcosa — "i movimenti su un conto investimento sono investimenti", o
"il saldo del conto entra nel totale investito" — la domanda *"questo movimento è
un investimento?"* avrebbe **due risposte**, quella di `transactions.type` e
quella di `accounts.type`. È la classe di difetto già pagata tre volte:
`hasPasswordIdentity` derivato in due punti (→ account impossibile da eliminare),
`getAccountContext()` che serviva due bisogni con freschezze diverse, `currency
default 'EUR'` che affermava "onboarding finito". Vale la regola già scritta:
**un campo che serve a disegnare e un campo che serve a decidere hanno bisogni
diversi anche quando contengono la stessa stringa.**

Quindi `accounts.type` sceglie **icona ed etichetta, nient'altro**. La natura del
movimento la decide sempre e solo `transactions.type`. Se un domani servirà far
comportare l'app diversamente su un conto, sarà una decisione nuova presa in
chiaro, non una conseguenza scivolata dentro da un'etichetta.

**Lo stesso vale per "Fondo risparmio" contro gli obiettivi**: l'obiettivo è un
**traguardo**, il conto è un **luogo**. Un obiettivo si finanzia da qualunque
conto; un conto può contenere denaro di più obiettivi o di nessuno. Il saldo non
è la somma degli obiettivi. È la ragione per cui `to_account_id` facoltativo su
`risparmio` (20b) è la forma giusta: un gesto solo che avanza il traguardo *e*
sposta il denaro.

**Conseguenza sui nomi, come "spese variabili" nella 17a**: la pagina Conti parla
di **giacenza**, la pagina Investimenti di **investito**. Se entrambe li
chiamassero "investimenti", l'utente non saprebbe a quale credere e smetterebbe
di fidarsi di tutti e due.

#### I filtri per conto — deciso il 2026-08-10

Due, non uno solo come prevedeva la prima stesura:

- **nella lista movimenti**, accanto ai filtri esistenti;
- **in home**, il selettore "Tutti i conti" in cima al mockup.

⚠️ **Il filtro in home non è gratis**: i totali della home li calcola
`dashboard_totals()`, quindi la funzione acquisisce un parametro conto e **cambia
firma**. Valgono le due trappole già documentate — i cast espliciti su ogni
colonna (`RETURN QUERY` di plpgsql pretende i tipi esatti, e fallisce solo a
runtime) e l'**ordine di deploy vincolante**: migration prima del codice, o la
home risponde 404 sulla RPC. È anche la migration in cui togliere il bucket
`null` rimasto senza consumatori.

**Filtrando per conto la home resta una vista di FLUSSO**, quindi i trasferimenti
continuano a non comparire: spostare denaro non è né guadagnarlo né spenderlo, e
il filtro cambia *quali* righe si guardano, non *che cosa* la pagina afferma. Per
la stessa ragione il filtro agisce su `account_id` (l'origine del movimento): un
`risparmio` fatto dal corrente verso il Fondo è un atto compiuto **dal corrente**.

#### Emerso rileggendo i mockup, prima di scrivere codice (2026-08-10)

##### `Seichi Conti.dc.html`

L'audit contro le regole già scritte qui. Oltre al difetto sugli abbonamenti
(sopra), quattro cose:

- ⚠️ **"Saldo totale · 4 conti attivi" non era un totale.** 3.240 + 180 + 3.400 +
  8.600 = 15.420, e il conto archiviato da 1.150 resta fuori. Il sottotitolo
  correggeva a voce bassa una parola falsa in cifre grandi — di nuovo la 17a.
  **Deciso: gli archiviati restano fuori e il numero si chiama "Saldo · N conti
  attivi".** Le altre due strade erano peggiori: includerli fa contribuire al
  patrimonio un conto chiuso in banca; vietare l'archiviazione con saldo ≠ 0
  rende irrappresentabile lo stato illegale ma **richiede un trasferimento per
  svuotare il conto, che arriva solo con la 20b** — in 20a un conto con soldi
  dentro non sarebbe archiviabile affatto.
- ⚠️ **`initial_balance` era modificabile solo alla creazione, e questo rende un
  refuso irreparabile.** Il conto non si cancella (per decisione presa), il saldo
  deriva da lì, e l'unico rimedio sarebbe una transazione fittizia — cioè
  sporcare i movimenti reali per riparare un campo di configurazione. **Deciso:
  modificabile**, con il testo che dice cosa fa ("cambiarlo sposta il saldo, non
  crea né entrate né spese"). Vale il precedente della 17a: *correzione e cambio
  sono la stessa operazione*.
- **"riattiva" usava `--color-ao` come colore del testo** a 11,5px: ~3,2:1,
  sotto AA. Va `--ink-ao` (`text-ao-ink`). ⚠️ Notare che è l'**unico** caso in
  tutto il file — il mockup rispetta accento≠inchiostro ovunque, quindi è una
  svista isolata e non un pattern da correggere a tappeto.
- **Sei neutri fuori dai token**, il più diffuso `#5A5548` (32 usi, stroke delle
  icone SVG); poi `#E6DFD1`, `#F2F5FA`, `#D7DEEA`, `#A9B0BF`, `#7C766A`. Tutto il
  resto mappa **esattamente** sulla palette — i cinque accenti, gli inchiostri, i
  neutri chiari e scuri — il che è ciò che rende visibili i pochi fuori elenco.
  Vanno ricondotti a un token, o restano colori fissi che non si spostano fra i
  temi.

##### `Seichi Dashboard.dc.html`

⚠️ **Le quattro card mescolavano flusso e giacenza senza dirlo, e questo riapriva
il conflitto da cui è nata l'intera discussione su `accounts.type`.**

Entrate `2.400` e Spese `1.240` sono flussi del mese; Investimenti `8.600` e
Risparmi `3.400` **coincidono esattamente con i saldi** di `Portafoglio
investimenti` e `Fondo risparmio` in `Seichi Conti.dc.html`. Quattro card
identiche, due semantiche temporali, sotto un'intestazione che dice "Questo
mese". Tre contraddizioni in un colpo:

- **con la card tre centimetri sopra**, che dichiara *"non il saldo dei conti —
  i saldi reali sono nella pagina conti"*;
- **con l'altro mockup**, la cui home mostra le stesse due card come `€ 300
  investiti / € 200 risparmiati`, cioè i flussi;
- ⚠️ **con la separazione giacenza/investito appena decisa**: se la card
  "Investimenti" della home è il *saldo del conto* mentre la pagina Investimenti
  mostra l'*investito*, la home rimette sotto la stessa parola i due numeri che
  `accounts.type` decorativo esiste per tenere distinti.

**Deciso: restano flussi del mese**, come oggi (`investimentiMese`,
`risparmiMese`, con la sparkline del trend). L'intestazione "Flusso" promette
flusso; quattro card che parlano dello stesso arco di tempo sono la sola forma
che non ha bisogno di essere spiegata.

Da qui anche **"Risparmi · N%"**: il `%` è il progresso verso la somma dei target
degli obiettivi, quindi l'importo accanto dev'essere il risparmiato — non il
saldo di un conto, che un target non ce l'ha. Accostarli metteva un *luogo* e un
*traguardo* nella stessa card.

- ⚠️ **`risparmio` col `+` e `investimento` col `−` a due righe di distanza.**
  Oggi il codice è netto (`sign = type === "entrata" ? "+" : "−"`), e due atti
  della stessa natura non possono avere segni opposti. **Deciso: entrambi `−`** —
  dal punto di vista del conto di origine il denaro esce, e l'origine è sempre
  valorizzata perché `account_id` è NOT NULL. Il **trasferimento resta l'unico
  caso neutro** (20b), ed è coerente: là il segno dipenderebbe da quale dei due
  conti stai guardando.
- ⚠️ **Nessuna porta d'ingresso alla pagina Conti**, in nessuna delle due nav.
  **Deciso: dal selettore "Tutti i conti" della home** — il tap apre un pannello
  coi conti e i loro saldi, più una voce "gestisci conti". Nessuna quinta voce
  nella bottom nav, che con il FAB centrale è già a quattro, e l'ingresso sta
  dove l'utente sta già pensando ai conti. Scartato `/impostazioni`: i conti non
  sono una configurazione, sono dove vivono i saldi.
- **Le due bottom nav del mockup non coincidono fra loro**: la chiara dice
  "Risparmi" e "Impostazioni", la scura "Obiettivi" e "Investimenti". Ha ragione
  la scura, che è anche ciò che l'app fa già (`nav.goals: "Obiettivi"`). Nessuna
  decisione, solo un difetto del mockup chiaro.

#### La divisione in due PR

- **20a — conti**: tabella, `account_id` NOT NULL + backfill, conto in
  onboarding, `recurring_rules.account_id` + funzione SQL, pagina conti con
  saldo, selettore conto nel form, **filtro per conto nella lista e in home**,
  **home da "Saldo totale" a "Flusso · <mese>"** + `dashboard_totals()` con
  parametro conto e senza bucket `null`.
- **20b — trasferimenti**: tipo `trasferimento`, `to_account_id` e i quattro
  CHECK, destinazione su `risparmio`/`investimento`, form e resa nella lista.

#### Il collaudo dello schema — `20260814_accounts.sql` eseguita il 2026-08-10

Migration **eseguita e verificata**. Otto controlli strutturali (utenti/righe
senza conto, quattro policy su `accounts`, zero policy con `auth.uid()` nudo,
`security_invoker` sulla vista, **una sola** firma di `dashboard_totals`, due FK
`NO ACTION`) più quattro prove di comportamento:

| prova | esito |
|---|---|
| cancellare un conto con movimenti | `23503 … violates foreign key constraint` — **fallimento atteso** |
| chiamare la vecchia `dashboard_totals(timestamptz[])` | `42883 … does not exist` — **fallimento atteso** |
| `account_balances` come `authenticated` senza JWT | **0 righe** |
| job con tre regole scadute | `saltate: 0`, `transazioni 20 → 23` |

⚠️ **Le prime due sono le uniche che dimostrino qualcosa**, ed è la regola già
scritta per la #47: *un registro di guasti non è collaudato finché non ha
registrato un guasto*. Solo righe verdi non distinguono "funziona" da "non ha
guardato".

⚠️ **La prova RLS va eseguita cambiando ruolo**, con `set local role
authenticated` dentro un blocco, non dal ruolo `postgres` del SQL Editor: quello
ha `BYPASSRLS` e restituisce tutte le righe **anche se `security_invoker`
mancasse**. Al primo tentativo è stata letta come superata mentre non aveva
testato nulla.

⚠️ **La prova del job dimostra la copia di `account_id` solo leggendo tre numeri
insieme.** `transactions.account_id` è NOT NULL: se la funzione non copiasse
`r.account_id`, ogni insert verrebbe rifiutato, il gestore per-regola della #47
lo catturerebbe, e il risultato sarebbe `saltate: 3` con `delta 0`. Un
`saltate: 0` da solo è compatibile con "nessuna regola è stata elaborata" — che è
esattamente com'era andato il primo tentativo.

⚠️ **E il primo tentativo era rotto per `now()` contro `clock_timestamp()`.**
Contava le righe generate con `created_at >= clock_timestamp()` letto a inizio
blocco; ma `created_at` ha default `now()`, che è `transaction_timestamp()` —
**congelato per tutta la transazione**, quindi *precedente* a un
`clock_timestamp()` valutato qualche istruzione dopo. Le righe appena scritte
risultavano vecchie e il conteggio dava zero. Contare le righe prima e dopo non
dipende da alcun orologio, e per questo è la forma giusta.

#### Emerso dal code-review della 20a (2026-08-11)

Quindici rilievi, quattordici applicati. I quattro che valgono una regola:

- ⚠️⚠️ **La 20a ha RICREATO ALTROVE il difetto che esisteva per chiudere.**
  `saldoTotale` è stato cancellato dalla home perché due schermate non possono
  rispondere diversamente a "quanto ho". Ma `/analisi` mostrava — e mostra
  ancora — un KPI etichettato **"Flusso netto"**, la stessa parola, calcolato
  come `entrate − (tutto ciò che non è entrata)`: quindi sottraeva anche
  risparmi e investimenti. Home € 1.540,70, `/analisi` € 1.060,70 per lo stesso
  mese, e il collegamento "Analisi" sta **due righe sotto la card**.

  **La lezione: togliere un'affermazione da una schermata non basta se un'altra
  la ripete.** Prima di cambiare che cosa significa una parola va cercata
  *ovunque compaia*, non solo dove la si sta cambiando. La definizione ora vive
  in `sommaUscite()` (`app/(main)/action.ts`), condivisa da KPI, variazione e
  grafico mensile: tre `filter` scritti a mano erano tre occasioni di
  divergere, e infatti divergevano già fra loro.

- ⚠️ **Un gate autorizza l'ingresso, e presuppone invarianti che nessuno gli ha
  detto.** `profiles.currency` è il flag dell'onboarding e viene scritto a
  `/preference`; il primo conto nasceva a `/category`, un passo dopo. Chi
  abbandonava in mezzo entrava nell'app **senza conti**, e con
  `transactions.account_id` NOT NULL il bottone di salvataggio restava spento
  per sempre, senza un messaggio. Il conto ora si crea in `savePreferences`,
  *prima* dell'upsert che apre il cancello: **l'invariante va stabilita dove il
  gate scatta, non dove sarebbe comodo scriverla.**

- ⚠️ **Correggere un numero può rendere FALSA l'etichetta che lo descriveva.**
  La legenda del grafico di `/analisi` diceva "Uscite totali", vero finché la
  serie conteneva tutto. Rendendo il calcolo più corretto — via risparmi e
  investimenti — quella parola è diventata una bugia: la stessa di "spese
  totali" nella 17a, prodotta questa volta *da un miglioramento*. Ora è
  "Uscite". Quando cambia una formula va riletto il testo che le sta accanto.

- ⚠️ **Il collaudo va fatto nella lingua in cui il difetto è VISIBILE, che non
  è quella di default.** Il primo conto prende il nome da un dizionario, e in
  `savePreferences` il `t` di `requireUser()` viene dal cookie **precedente** —
  `setLocaleCookie` non è ancora stato chiamato. In italiano il difetto è
  invisibile (vecchio e nuovo danno entrambi "Conto principale"); solo
  registrandosi in inglese si vede la differenza fra "Conto principale" e "Main
  account". Verificato così il 2026-08-11: `dictionaryFor(locale)` risolve.
  È il gemello della regola della Fase 19 — *una regressione che si vede solo
  nella lingua di default* — con i ruoli invertiti.

Il resto: guardia mancante sulla `20260810` (la regola dell'autosufficienza
vale anche per i file che si superano); chip del selettore che mentiva su un
conto archiviato mentre restava selezionato; `?conto=abc` che sostituiva
l'intera home con "Errore"; conto archiviato che spariva dal form di un
movimento esistente; tipo "corrente" assegnato in silenzio a un conto che non
ne aveva; "Risparmi · N%" con importo filtrato e percentuale globale;
`reactivate()` che ingoiava l'errore; `updateAccount` che azzerava `icon`; otto
voci di dizionario mai usate.

⚠️ **E una sopravvalutazione corretta nella migration**: il commento della
sezione 8 diceva che togliere il bucket `null` eliminava la scansione
dell'intero archivio a ogni vista della home. Falso — `account_balances` ne fa
una identica. Il guadagno è qualitativo, non di costo: **stessa scansione, ma
per numeri che l'utente legge invece che per uno che nessuno mostrava.**

#### La 20a è verificata su tutti i rami (2026-08-11)

Dieci controlli automatici col driver Playwright, zero errori console, più
quattro prove a mano per i rami che un driver con sessione riusata non può
raggiungere: **ultimo conto non archiviabile** (serve un utente con un conto
solo — quello appena registrato), **percorso di login** (il driver lo salta per
non far transitare la password), **tema scuro** e **lingua inglese**.

⚠️ La prova che vale più delle altre è una sola: **home € 1.540,70 ==
`/analisi` € 1.540,70**. Prima della correzione differivano di € 480, cioè
esattamente risparmi + investimenti — e nessun controllo automatico l'avrebbe
detto, perché entrambi i numeri erano "corretti" secondo il proprio codice.

