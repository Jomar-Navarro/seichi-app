# Fase 20b — trasferimenti, e il conto ricordato

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

#### Emerso implementando la 20b — migration `20260815_transfers.sql`

Migration **eseguita e collaudata il 2026-08-12**. Sei prove che dovevano
fallire, tutte fallite; il saldo si sposta di 100 fra due conti e il **totale non
si muove**; 23 righe prima, 23 dopo.

⚠️ **Le due prove che valgono sono b5 e b6** — un movimento verso, o da, il conto
di un ALTRO utente. Prima delle FK composite quegli insert **passavano**: nessuna
policy RLS guarda `account_id`. Sono anche le uniche che richiedono un secondo
utente nel database, quindi il collaudo dice esplicitamente `SALTATA` quando non
c'è: un test che si autoesclude in silenzio è peggio di un test assente.

- ⚠️ **`drop … if exists` NON è idempotenza.** Il file falliva alla *seconda*
  esecuzione con `2BP01: cannot drop constraint accounts_id_user_key … other
  objects depend on it`. Un vincolo con dipendenti **non si può droppare
  affatto**: la clausola `if exists` protegge solo l'esecuzione in cui il vincolo
  non c'è, cioè l'unica che non ne ha bisogno. E il guasto arriva **a metà file**,
  dopo che le sezioni precedenti hanno già scritto — esattamente ciò che le
  guardie in testa agli altri file esistono per impedire, solo che qui a rompersi
  era il file nuovo contro se stesso. Si chiude togliendo i dipendenti **per
  nome** prima del vincolo, non con `drop … cascade`: quello li rimuoverebbe
  senza ricrearli se il file si fermasse subito dopo, lasciando il database privo
  del vincolo di proprietà e senza che nulla lo segnali.
- ⚠️ **`user_id` NOT NULL era un prerequisito, non un extra.** Vedi lo schema: con
  `MATCH SIMPLE` una colonna NULL disattiva l'intero vincolo composito.
- **La FK ha un nome nuovo, e PostgREST se ne accorge.** Le relazioni embedded si
  chiamano come il VINCOLO (`accounts!transactions_account_owner_fkey(name)`):
  per questo i nomi dei conti nella lista si risolvono lato client da una mappa
  che il chiamante ha già, invece che con una join che si romperebbe in silenzio
  alla prossima rinomina.

**Il segno di un movimento dipende da CHI lo guarda** (`amountSign()` in
`lib/transaction-utils.ts`). Fino alla 20a stava in una riga — `type === "entrata"
? "+" : "−"` — perché ogni movimento aveva un conto solo e quindi un solo punto
di vista. Con i trasferimenti la stessa riga toglie denaro a un conto e lo dà a
un altro:

| vista | righe | segno |
|---|---|---|
| **un conto selezionato** | origine **o** destinazione | relativo a *quel* conto |
| **tutti i conti** | tutte | assoluto; il trasferimento è neutro, con la freccia |

Con un conto davanti la lista è il suo **estratto conto** e deve riconciliare col
saldo che `/conti` mostra tre tap più in là; senza filtro è il **diario di ciò che
hai fatto**, e lì il segno di un trasferimento non ha riferimento. ⚠️ Nella
funzione il ramo della destinazione viene **prima** del tipo: invertendoli, il
Libretto mostrerebbe "− € 200" per denaro appena arrivato.

⚠️ **La home e `/analisi` restano all'ORIGINE soltanto, e non vanno allineate per
simmetria.** Sono viste di FLUSSO: i trasferimenti non ci entrano affatto, perché
spostare denaro non è né guadagnarlo né spenderlo.

- **L'audit dei consumatori rifatto**, ed è la verifica che dice se la premessa
  della fase regge: `getGoals` (`risparmio`), `getInvestments` (`investimento`),
  trend di `/analisi` (`.in` su cinque nomi), torta (`spesa`), budget (`spesa`),
  uscite fisse (`abbonamento`), `deleteCategory` (per `category_id`, e un
  trasferimento non ne ha), `dashboard_totals()` (raggruppa per tipo, l'app legge
  per nome). **Nessuno somma "tutto ciò che c'è": nessun totale si muove.**
- ⚠️ **Un difetto che né `tsc` né il lint vedono**: la griglia dei tipi nel
  `TransactionModal` è `2×3` e la quinta card occupava **due colonne** per
  riempire la terza riga, con la condizione `i === length - 1`. Con sei tipi la
  griglia è esatta e quella riga avrebbe spinto il trasferimento su una quarta
  riga inesistente, dentro un `flex-1 min-h-0` che non può crescere. Ora la card
  larga esiste solo se il numero di tipi è **dispari** — che è ciò che ha sempre
  significato. Si vede solo aprendo il modale, e solo dopo aver aggiunto un tipo.
- **Tre voci di dizionario aggiunte e poi TOLTE.** `typesSingular`, `newByType` e
  `typesShort` servono solo alla UI delle categorie, e una categoria
  `trasferimento` non può esistere: sarebbero state codice morto in due lingue —
  il difetto che il code-review della 20a ha trovato otto volte. Al loro posto c'è
  scritto *perché* mancano, o la prossima persona le rimette per simmetria.
  `t.types` e `t.transactionTypes` invece ce l'hanno, perché descrivono i tipi di
  MOVIMENTO e vengono resi davvero.
- ⚠️ **`isAccountId()` (`lib/accounts.ts`) perché `.or()` è SINTASSI, non un
  parametro.** `getTransactions` interpola il conto in
  `` `account_id.eq.${conto},to_account_id.eq.${conto}` ``: lì `.eq()` non fa da
  parametro, e una virgola dentro il valore aggiungerebbe condizioni al gruppo OR.
  È l'unico punto dell'app dove un valore dell'utente diventa sintassi. La regex
  era già in `page.tsx` per un motivo diverso (`?conto=abc` uccideva la home con
  `22P02`): ora è una sola, ed è il modo in cui il secondo chiamante non se la
  dimentica.
- **I due debiti della 20a sono chiusi entrambi.** La FK composita ha eliminato
  `assertOwnAccount()`; le ricorrenti su conto archiviato sono chiuse in tre pezzi
  che dovevano andare **insieme**: `setAccountArchived()` rifiuta se ci sono
  regole attive, `updateRecurringRule()` accetta il conto, `RecurringSheet` espone
  il campo. ⚠️ Rifiutare **senza** la via d'uscita sarebbe stato un vicolo cieco —
  `recurring_rules.account_id` era a scrittura unica, quindi l'unico rimedio
  sarebbe stato cancellare la regola. Un avviso ignorabile invece lascerebbe
  accadere proprio ciò che il controllo esiste per impedire: pg_cron continua a
  scrivere su un conto escluso da ogni totale mostrato, senza errori e senza
  segnali.
- **`RecurringRule` non aveva `account_id` nel tipo TypeScript**, pur essendo NOT
  NULL dalla 20a. Un tipo incompleto non produce un errore: produce una
  funzionalità che non viene scritta perché il dato **sembra non esserci**.

#### La verifica visiva — 25 controlli, e due cose che solo lo schermo dice

- ⚠️⚠️ **"Seleziona dal conto".** Le due estremità del trasferimento si
  chiamavano "Dal conto" e "Al conto", che lette da sole sono le parole giuste.
  Ma `Select` compone il segnaposto come `` `Seleziona {etichetta minuscola}` ``,
  quindi i campi vuoti dicevano **"Seleziona dal conto"** e **"Seleziona al
  conto"** — due mezze frasi. In inglese identico: *"Select to account"*.

  **È letteralmente la trappola documentata per la Fase 19** ("Seleziona
  category", "Nuova investimento"), reintrodotta da chi l'aveva scritta, in un
  file che la descrive dodici righe più su. Non l'ha vista `tsc`, non l'ha vista
  il lint, non l'ha vista la rilettura del codice: si è vista **aprendo il
  form**. Ora sono "Conto di partenza" / "Conto di arrivo" (EN "Source account" /
  "Destination account"). La regola: **un'etichetta di campo non si sceglie da
  sola, si sceglie insieme alla frase che la conterrà** — e in questo progetto
  quella frase esiste sempre, perché la costruisce `Select`.
- ⚠️ **Un falso allarme che somigliava moltissimo a un difetto vero**: al primo
  scatto il form trasferimento mostrava i conti vuoti, il bottone spento e
  l'avviso rosso *"serve un conto per registrare un movimento"* — su un utente
  che i conti ce li ha. Era l'attesa troppo corta: i conti arrivano da una query
  Supabase e alla prima apertura c'è anche la compilazione del chunk. Nel driver
  l'attesa dei form è ora 2500ms, con scritto perché.
- Il selettore delle ricorrenti punta a **"modifica"**, non a un bottone che
  contenga `€`: l'importo sta in un *fratello* della riga. È la stessa trappola
  già annotata per le righe conto, e si ripresenta ovunque il markup
  interattivo annidato sia stato sciolto.

Le prove 8-11 del driver sono la parte 20b e stanno nello skill `collauda-app`,
quindi si rieseguono. **Restano fuori**, da provare a mano: il percorso di login
(il driver riusa una sessione) e il **rifiuto di archiviare un conto con regole
ricorrenti attive** — entrambi verificati a mano il 2026-08-12, insieme al primo
trasferimento reale.

#### Il conto selezionato si RICORDA — deciso usando l'app (2026-08-12)

Emerso da chi la usava, non da un controllo: *"al click della home il filtro per
conto si resetta e torna a tutti i conti"*. La causa è che la selezione viveva
**solo** in `?conto=`, e "Home" nella bottom nav punta a `/`: ogni giro fuori e
ritorno la azzerava. Su un'app che si apre dieci volte al giorno è la differenza
fra uno strumento e un fastidio.

Ora c'è un cookie (`seichi-account`), stesso meccanismo di tema e lingua e per le
stesse ragioni: viaggia con la richiesta, quindi il server sa già cosa rendere e
il primo byte è quello giusto.

- ⚠️ **L'URL è un'ISTRUZIONE, il cookie è una MEMORIA**, e la distinzione decide
  cosa fare quando il conto non esiste più. `?conto=` che punta a un conto non
  tuo va **corretto** (`redirect("/")`), o il chip direbbe "Tutti i conti" sopra
  dati filtrati su un id fantasma. Un cookie stantio va invece **dimenticato**:
  col redirect si tornerebbe su `/`, dove il cookie verrebbe riletto, e da lì di
  nuovo su `/` — **un ciclo infinito innescato dall'archiviazione di un conto**.
  `getSelectedAccount()` (`lib/accounts-server.ts`) restituisce `fromUrl` proprio
  perché il chiamante non debba riscoprire questo ragionamento.
- ⚠️ **Un filtro appiccicoso è di norma una trappola** — dati parziali senza che
  l'utente sappia perché. Regge qui solo perché la selezione è **sempre visibile
  e sempre annullabile**: il chip porta scritto il nome, la prima voce del
  pannello è "Tutti i conti", e scegliere quella *cancella* il cookie invece di
  lasciarlo fermo. Il giorno in cui una pagina leggesse il cookie senza mostrare
  il chip, il cookie va tolto da quella pagina.
- **Il selettore è ora anche in `/analisi`**, e non è una comodità in più: senza,
  per analizzare un conto servivano tre passaggi — tornare in home, selezionarlo,
  ripartire dalla scorciatoia "Analisi". Tre passaggi per cambiare una variabile
  sono il modo più affidabile di far smettere qualcuno di usare un filtro.
  `keepParams` conserva il periodo, o un tocco ne cambierebbe **due**.
- **Il nome del conto sotto il periodo è sparito** da `/analisi`. Non perché la
  regola "se la pagina è filtrata deve dirlo" sia decaduta, ma perché a dirlo è
  ora il chip, che porta lo stesso nome ed è pure il comando per cambiarlo.
- ~~⚠️ **`/transazioni` NON eredita la memoria, deliberatamente.** Il cookie segue
  le due viste che rispondono a *"come sto andando"*; la lista movimenti risponde
  a *"cosa è successo"* e ha la propria barra filtri sempre a schermo, dove la
  selezione è visibile e si cambia sul posto. Ricordarla là aggiungerebbe uno
  stato invisibile senza togliere un passaggio.~~ — **rovesciato dalla #148**
  (2026-11-03): usando l'app il passaggio c'era, il filtro andava rimesso a ogni
  visita. Ora Movimenti eredita la memoria **e la scrive**: una sola scelta di
  conto per tutta l'app. La condizione qui sopra regge, perché il chip del conto
  in Movimenti è sempre a schermo e annullabile. Vedi la sezione della #148.
- ⚠️ `keepParams` è un **oggetto di stringhe, non una funzione** che costruisce
  l'URL: `AccountSelector` è un client component istanziato da un server
  component, e una prop funzione fa fallire la serializzazione RSC — l'errore che
  né `tsc` né `next build` vedono e che compare solo aprendo la pagina.

⚠️⚠️ **La memoria ha rotto il COLLAUDO, ed è così che si è vista funzionare.**
Il driver sceglie un conto al passo 2. Prima quella scelta moriva al `goto("/")`
successivo; da adesso sopravvive, quindi:

- il **confronto 6** ("home non filtrata == /analisi") ha continuato a passare
  misurando due numeri **filtrati** — € 2.334,10 invece di € 2.740,70. Un
  controllo verde che dichiara una cosa e ne misura un'altra;
- il **confronto 7** e il **controllo 12** cercavano il chip per il testo "Tutti
  i conti", che ora porta il nome del conto: sono stati **saltati in silenzio**,
  sparendo dal referto senza che nulla lo dicesse.

Due lezioni, e la seconda vale oltre questo progetto:

1. **Da quando esiste una memoria, "aprire la home" non è più uno stato
   determinato.** Un collaudo che ha bisogno di uno stato preciso deve
   **chiederlo**: `?conto=` vuoto è un'istruzione ("nessun conto") e batte il
   cookie, quindi è il modo di dire "tutti i conti" senza toccare l'interfaccia.
2. ⚠️ **Un `if` senza `else` in un collaudo è un buco.** Un elenco di soli OK non
   distingue *passato* da *non eseguito*, ed è la stessa regola già scritta per
   la #47 (*un registro di guasti non è collaudato finché non ha registrato un
   guasto*) applicata al collaudo stesso. Ogni ramo di scarto ora scrive un KO
   che dice **quale** controllo non è stato eseguito.

#### Emerso dal code-review della 20b (2026-08-12)

Tre rilievi, e tutti e tre stanno nella **relazione fra due punti**, non dentro
l'uno o l'altro — cioè invisibili leggendo un file per volta.

- ⚠️⚠️ **La memoria in cookie ha RIAPERTO il difetto che il redirect esisteva per
  chiudere.** La guardia della home scattava solo con `fromUrl`, per non entrare
  in ciclo. Ma un id che arriva dal *cookie* e non è fra i conti dell'utente non
  veniva né corretto né annullato: la pagina restava **filtrata su un id
  fantasma** (totali a zero) mentre il chip, non trovandolo, scriveva "Tutti i
  conti". Etichetta e dati che si contraddicono.
  La via d'uscita è `redirect("/?conto=")`: un parametro **presente ma vuoto** è
  un'istruzione ("nessun conto") e batte il cookie, quindi la destinazione non
  può rimbalzare indietro. Lo stesso buco esisteva su `/analisi`, dove in 20a non
  serviva alcuna guardia perché l'id arrivava solo dal link della home.
  **La lezione: aggiungere una fonte a un dato riapre ogni domanda già risposta
  sull'altra fonte.** Non basta che la nuova fonte funzioni.
- ⚠️ **`contoError()` diceva "Conto non trovato" anche per un `check_violation`.**
  Un trasferimento verso se stessi o con categoria non ha niente a che vedere coi
  conti: il messaggio avrebbe mandato a controllare una cosa sana. È la stessa
  classe corretta nella review della 20a — `assertOwnAccount` che rispondeva
  "Conto non trovato" a un guasto di rete. **Due cause diverse non possono avere
  lo stesso messaggio solo perché arrivano dalla stessa `catch`.**
- ⚠️ **Home "Flusso", `/analisi` "Flusso netto": lo stesso numero con due nomi**,
  e la review della 20a l'ha *creato correggendo*. Finché i due valori
  divergevano, due nomi erano coerenti con due cose; allineandoli si è lasciata
  una differenza di parola su una identità di sostanza. Vale la regola già
  scritta per i conti — *stesso titolo, o lo stesso numero ne avrebbe due* — ed è
  il **gemello** dell'altra già registrata (*correggere un numero può rendere
  falsa l'etichetta che lo descriveva*): qui l'etichetta non è diventata falsa, è
  diventata **superflua e divergente**. Ora entrambe dicono "Flusso".
  ⚠️ Il driver cercava `/Flusso netto|Net flow/`: senza i rami `else` aggiunti
  poco prima, i confronti 6 e 7 sarebbero **spariti dal referto** invece di
  fallire.

Segnalato e **non corretto**, perché precedente alla fase e difendibile:
`RecurringManager` usa `type === "entrata" ? "+ " : ""`, quindi una regola in
uscita non ha segno mentre la transazione che ne deriva mostra `− € 12,00`. Una
regola è un importo futuro, non un movimento avvenuto.

#### E il trasferimento non entra nel flusso — la domanda che lo conferma

Chiesto usando l'app: *"non segna il flusso, ma il trasferimento alla fine è un
flusso o sbaglio?"*. È la domanda giusta, e la risposta è la premessa dell'intera
fase: **"Flusso" è entrate − uscite, cioè quanto è entrato e uscito dal
patrimonio.** Spostare 500 € fra due conti non rende né più ricchi né più poveri:
cambia *dove* sta il denaro. Se entrasse nel flusso, l'app affermerebbe un
guadagno o una perdita per un gesto che non è né l'uno né l'altro.

Il posto dove quel movimento si vede è il **saldo** — seconda pagina del
carosello — e nella lista, che filtrata sul conto di arrivo scrive `+ € 500,00`
mentre senza filtro lo lascia neutro con la freccia. Che la domanda sia sorta
guardando la home è la prova che la separazione va **detta**, non dedotta: è
esattamente il lavoro che fanno il sottotitolo "entrate meno uscite di questo
mese" e la riga che insegna a scorrere.

