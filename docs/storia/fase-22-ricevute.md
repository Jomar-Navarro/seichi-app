# Fase 22 — allegati e ricevute

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 22 — allegati / ricevute (issue #36)

Implementata il 2026-08-21. Migration `20260818_attachments.sql`.

#### ⚠️ Il bucket è PRIVATO — qui NON si copia il precedente degli avatar

`avatars` è pubblico in lettura perché l'avatar compare su ogni pagina e conviene
servirlo dalla CDN; l'unica protezione è un path non indovinabile.

Per una ricevuta quel calcolo si **rovescia**: si apre una alla volta su
richiesta — nessun guadagno dalla cache — e contiene cosa hai comprato, dove e
quando, a volte le ultime cifre della carta. Un URL non indovinabile è sicurezza
per oscurità: accettabile per una foto profilo, non per un documento
finanziario. Bucket privato, **URL firmati** con TTL di 10 minuti generati a ogni
apertura.

⚠️ Le firme stanno su `/object/sign/`, non su `/object/public/`, mentre
`next.config.ts` autorizza a `next/image` solo `/object/public/avatars/**`.
Sembra che serva un `remotePattern` nuovo. **Non serve, e per un giro questo
documento ha affermato il contrario**: le miniature passano `unoptimized`, e in
quel caso `remotePatterns` non viene mai consultato — `generateImgAttrs` esce
prima di chiamare il loader (`shared/lib/get-img-props.js`) e il controllo
sull'host vive **dentro** il loader (`shared/lib/image-loader.js`).

La riga era quindi configurazione morta che *sembrava* una difesa, ed è stata
tolta dal code-review pre-merge — con la spiegazione al suo posto, o la prossima
persona la rimette. ⚠️ `unoptimized` a sua volta è deliberato: l'URL di una
ricevuta è una **firma a scadenza**, quindi cambia a ogni apertura; ottimizzare
significherebbe una sorgente nuova ogni volta, cache che non colpisce mai e una
trasformazione fatturata per ogni sguardo, su un'immagine che l'app ha già
ridotto a 1600px prima di caricarla.

**La lezione, che è quella di sempre in un'altra veste: una difesa va provata
DISATTIVANDOLA.** Qui non lo si è fatto — il pattern è stato aggiunto e le
anteprime funzionavano, il che è compatibile sia con "serviva" sia con "non è
mai stato letto". Un controllo verde non distingue le due cose.

#### Una TABELLA e non una colonna

Il test è quello già usato per `accounts.type`: *esiste un caso reale in cui ne
servono due?* Tre risposte sì — ristorante (scontrino fiscale + ricevuta carta),
fattura multipagina in due scatti, acquisto + garanzia.

Con una colonna quei casi sono **irrappresentabili** e costringono a scegliere
quale ricevuta perdere. È il rovescio della regola solita: di norma si rende
irrappresentabile lo stato ILLEGALE, qui una colonna renderebbe irrappresentabile
uno stato perfettamente legale.

#### ⚠️ Il percorso è PIATTO, e lo decide la cancellazione

`{user_id}/{uuid}.{ext}`, non `.../{transaction_id}/...`. `purgeUserFiles()` fa
`list(userId)`, che è **piatta**: con un livello in più restituirebbe le
sottocartelle e non i file, e l'eliminazione account lascerebbe ogni ricevuta nel
bucket. Il legame con la transazione vive nel database, che è dove va una
relazione.

#### ⚠️ Il nodo vero: la cascade tiene pulito il DB e PERDE i file

Supabase **vieta il DELETE diretto su `storage.objects`**, quindi la pulizia non
può stare in SQL né nel job notturno: è per forza lato app. E la cascade che
cancella la riga è proprio ciò che impedisce all'app di sapere quali file
orfanare. I cinque percorsi, mappati prima di scrivere:

| percorso | come arrivano i path |
|---|---|
| `deleteTransaction` | ⚠️ cascade su `attachments` — i path si raccolgono PRIMA (#120) |
| `deleteGoal` | ⚠️ cascade dai versamenti — idem, per tutti i versamenti (#120) |
| `deleteCategory` | ✅ **rifiuta** se ci sono movimenti collegati |
| `undoImport` | ⚠️ cascade — i path si raccolgono PRIMA |
| `deleteAccount` | ⚠️ cascade nella RPC — la cartella si svuota prima |

⚠️⚠️ **Fino alla #120 la prima colonna diceva "l'app vede le righe?" e i primi
due percorsi risultavano ✅ — ed era la domanda sbagliata.** `deleteTransaction`
e `deleteGoal` le righe le vedevano eccome, ma non chiamavano `storage.remove()`:
la FK di `attachments` in cascata toglieva le righe e i file restavano nel
bucket, documenti con IBAN e nomi che nessuna schermata mostrava più e nessuna
cancellazione poteva più trovare. **Vedere le righe non è rimuovere i file**:
l'unica domanda che conta è *chi chiama `remove()`, e con quali path*. Trovato
da quattro revisori indipendenti nella review completa del 2026-09-28.

⚠️ E `deleteAccount` si fermava a **100 file**: `list()` senza opzioni usa il
default di storage-js `{ limit: 100, offset: 0 }`, quindi con 250 ricevute ne
rimuoveva 100 senza errore e la RPC cancellava utente e righe lasciando le
altre 150 per sempre. Il troncamento non è un fallimento, quindi il "se
fallisce ci fermiamo" non scattava. Ora tutti e cinque passano da
`lib/storage-files.ts` — vedi "Ricevute orfane (#120)" più sotto.

⚠️ **I chiamanti scelgono in modo OPPOSTO sul fallimento, ed è deliberato:**

- in `undoImport`, `deleteTransaction` e `deleteGoal` un errore di rimozione
  **non** annulla l'operazione. Le righe sono già sparite e non tornano:
  rispondere "errore" farebbe credere il contrario, e il secondo tentativo non
  troverebbe nulla da cancellare. Restano al più file orfani — un costo di
  spazio, non una bugia — e i loro path finiscono nei log;
- in `deleteAccount` un errore **ferma tutto**. Là i file sono documenti
  personali di chi ha chiesto di sparire, e abbandonarli nel bucket è peggio che
  non cancellare l'account.

#### Prima il FILE, poi la riga

In `deleteAttachment` l'ordine rende ogni fallimento recuperabile. Al contrario
la riga sparirebbe e il file resterebbe **irraggiungibile per sempre**: nessuna
schermata lo mostra, nessuna cancellazione lo trova. Così invece, se fallisce il
file non è cambiato niente; se fallisce la riga, resta una riga visibilmente
rotta e il secondo tentativo la toglie (`remove()` su un file assente non è un
errore).

#### ⚠️ Le firme si riabbinano per PATH, non per posizione

`createSignedUrls` restituisce un elemento per input, ma ciascuno può portare un
proprio errore. Fidandosi dell'indice, un solo elemento fallito sposterebbe tutti
quelli dopo di lui: **ogni ricevuta mostrerebbe l'immagine di un'altra**. Un
difetto che non produce errori e che si nota solo se conosci le tue ricevute.

#### La riduzione lato client è il PREREQUISITO, non un'ottimizzazione

La foto di un telefono pesa 3-8 MB: senza ridimensionare, **ogni upload verrebbe
rifiutato** e la funzione sarebbe inutilizzabile sul caso normale. Lato lungo a
1600px — è il testo stampato di uno scontrino a dettare il minimo, non
l'estetica — e uscita sempre in JPEG, anche da PNG.

Verificato con una foto **da 4,80 MB generata in un canvas 3000×2000**:
l'anteprima risultante ha `naturalWidth = 1600`, cioè esattamente
`ATTACHMENT_MAX_EDGE`. Un file già piccolo non avrebbe dimostrato niente.

⚠️ `ATTACHMENT_MAX_BYTES` è il **quinto** membro della catena da tenere allineata
a mano: `bodySizeLimit` (3 MB) → `file_size_limit` del bucket (2 MB) → la
costante → il testo nella UI, che prende `{max}` dalla costante e non lo riscrive.

#### ⚠️ "Solo in modifica" era una limitazione INVENTATA

La prima stesura permetteva di allegare solo a un movimento già salvato, e la
difendeva così: *un allegato ha bisogno di un `transaction_id`, che in creazione
non esiste ancora*. La premessa è vera; la conclusione — **quindi si allega
dopo** — no.

La via d'uscita saltata è la più semplice: **tenere il file nel browser e
caricarlo appena l'id c'è**, dentro lo stesso gesto di salvataggio. Il caso reale
è fotografare lo scontrino *mentre* si registra la spesa, quindi l'obbligo di
salvare e riaprire metteva un ostacolo proprio sul percorso più frequente.

Emerso da chi usa l'app — *"perché devo prima salvare? Se un utente vuole
allegarla subito?"* — non da un controllo. **La lezione: quando una limitazione
si spiega con un vincolo tecnico vero, il vincolo va confermato ma la
conclusione va cercata daccapo.** Le due alternative peggiori restano scartate
(percorso temporaneo da spostare; salvataggio di nascosto per ottenere l'id).

⚠️ Conseguenze, entrambe necessarie perché il rimedio non introduca un difetto
peggiore:

- **`saveTransaction()` restituisce l'`id`.** Stesso precedente di
  `createCategory()` nella 17a: senza, l'unica strada sarebbe ritrovare la riga
  appena scritta cercandola per campi che non la identificano — due movimenti
  identici nello stesso giorno sono indistinguibili.
- ⚠️ **`createdId` in stato, e `handleSave` guarda quello invece di
  `isEditing`.** Se il salvataggio riesce ma un caricamento fallisce, il modale
  resta aperto: da quel momento il movimento ESISTE, e un secondo tocco su
  "Salva" deve aggiornarlo. Continuando a guardare `isEditing` — che dipende
  dalla prop e non cambia mai — ogni riprova creerebbe **un movimento
  duplicato**, difetto che si scopre contando i soldi invece che leggendo un
  errore. ⚠️ Non bastava: lo stato stava nel FORM, che il wizard smontava a
  ogni "indietro", e un'eccezione nel caricamento usciva prima di registrarlo.
  Dalla #122 vive in `TransactionModal` e si scrive in un `finally` — vedi la
  sezione della #122.
- **Su un caricamento fallito il modale NON si chiude**: chiudere lascerebbe
  l'utente convinto di avere una prova che non ha.

Niente ricevute su un `trasferimento`: non c'è uno scontrino per aver spostato
denaro fra due conti propri.

#### ⚠️⚠️ `crypto.randomUUID()` non esiste sul telefono — e falliva in SILENZIO

Il difetto che ha fatto sembrare l'allegatura in creazione semplicemente non
funzionante, e vale come classe nuova per questo progetto.

`crypto.randomUUID()` è disponibile **solo in contesto sicuro**. Su `localhost`
c'è; su `http://192.168.1.224:3000` — l'IP di LAN che `next.config.ts` autorizza
**apposta** per provare l'app dal telefono — è `undefined`.

⚠️ **E il sintomo era muto.** La funzione che sceglie il file aveva `try` con il
solo `finally` e **nessun `catch`**: l'eccezione spariva, il file non veniva
aggiunto, non compariva alcun errore. Un gesto che non fa niente e non dice
niente è il peggior modo di fallire — chi lo usa conclude che la funzione non
esista, non che sia rotta.

⚠️ **Invisibile a ogni verifica automatica.** `tsc`, lint e build non vedono un
requisito di contesto; il driver Playwright gira su `localhost`, dove l'API
c'è. È il primo difetto di questo progetto che **dipende dall'URL da cui si apre
l'app** — quindi nessuna prova fatta sulla macchina di sviluppo poteva
intercettarlo.

Due correzioni, perché i difetti erano due:

- `chiaveLocale()` con ripiego (`Math.random()`): quella chiave serve a React per
  un elenco che vive qualche secondo, non ha bisogno di unicità crittografica;
- il **`catch`**, che resta anche ora che la causa è chiusa: qualunque altra cosa
  vada storta lì deve DIRLO.

⚠️ Nota lasciata su `receiptPath()` in `lib/attachments.ts`: il file è per il
resto client-safe, ma quella funzione **non lo è** per la stessa ragione. È
chiamata solo dal server, e senza la nota il prossimo che la riusa nel browser
ricadrebbe esattamente qui.

**La regola: un'API del browser va verificata anche per il CONTESTO in cui gira,
non solo per l'esistenza.** E su questo progetto il contesto reale è un telefono
su HTTP in LAN, non `localhost`.

Corretto e riprovato **dal telefono** il 2026-08-21: l'allegatura in creazione
funziona, e non nasce alcun movimento duplicato (l'altra invariante introdotta
nello stesso giro, vedi `createdId`).

⚠️ Conseguenza sul METODO, e vale oltre questa fase: lo skill `collauda-app` gira
su `localhost` e **non può** intercettare questa classe. Ogni volta che una fase
tocca un'API del browser, la prova finale va fatta **sull'indirizzo di LAN dal
telefono** — è l'unico ambiente in cui l'app viene davvero usata. La Fase 27
(mobile nativo) è il posto dove questa verifica diventerà sistematica; fino ad
allora è una cosa da ricordarsi a mano.

#### Due sorgenti immagine, due componenti diversi

Le miniature già caricate usano `next/image` con `unoptimized` (URL firmato); le
anteprime locali e il visore a schermo intero usano `<img>`. Non è incoerenza:
un `blob:` l'ottimizzatore non sa né scaricarlo né validarlo, e il visore deve
reggere **entrambe** le sorgenti — quindi non può usare quello che ne accetta
una sola.

#### ⚠️ Una guardia si era SCADUTA

La `20260816` diceva esplicitamente *"nessuna guardia nuova da aggiungere"*, e il
ragionamento era corretto — **finché quel file era l'ultimo a definire
`delete_current_user()`**. Ora la catena si è allungata: rieseguirla
ripristinerebbe una versione che non conosce `attachments`, lasciando righe con
nomi di file e date di un utente cancellato, **senza alcun errore**.

**La regola: una guardia protegge dai successori che ESISTEVANO quando è stata
scritta.** Chi allunga la catena deve guardare daccapo invece di fidarsi della
copertura ereditata.

#### Il collaudo — 6 prove su 6

`a1` allegato valido, `b1` path duplicato rifiutato, `b3` dimensione zero
rifiutata, `a2` cascade che toglie le righe, `c1` bucket presente e privato, e
**`b2` allegato su transazione ALTRUI rifiutato dalla FK composita**.

⚠️ **`b2` è la prova che conta, ed è rimasta SALTATA per un giorno** — richiede
un secondo utente con movimenti, e finché non c'è non è dimostrabile: un insert
con uno `user_id` inventato fallirebbe sulla FK verso `auth.users`, cioè
**passerebbe per il motivo sbagliato** (la trappola già registrata nella Fase
21). Nel frattempo valeva solo la verifica strutturale, che dice che il vincolo
c'è — **non che rifiuta**. Eseguita il 2026-08-21 appena il secondo utente ha
avuto movimenti: *"allegato su transazione ALTRUI rifiutato dalla FK
composita"*.

Vale come metodo: **una prova che si autoesclude va lasciata dichiarata e
ripresa**, non archiviata come superata perché tutto il resto è verde.

#### La verifica visiva

Foto **da 4,80 MB generata in un canvas 3000×2000**, caricata dall'app vera:
l'anteprima risultante ha `naturalWidth = 1600`, cioè esattamente
`ATTACHMENT_MAX_EDGE`. Un file già piccolo non avrebbe dimostrato niente, perché
il ridimensionamento non sarebbe partito. Più: URL firmato che si carica davvero,
graffetta nella lista, primo tocco che arma senza cancellare, secondo che
rimuove. Zero errori console.

⚠️ E la prova che il codice non può fare da sé: **una ricevuta vera**, aperta a
schermo intero. Fatta a mano il 2026-08-21 su una distinta di bonifico —
`ATTACHMENT_MAX_EDGE = 1600` regge, ogni campo resta leggibile senza sforzo. È
il numero che va rialzato se un domani un documento più fitto non si legge: non
è una scelta estetica, la detta il testo stampato.

⚠️ **Ed è la stessa prova che conferma il bucket privato.** Quella distinta porta
nome dell'ordinante, nome del beneficiario, **IBAN completo**, importo e causale.
La decisione — presa in astratto all'inizio della fase, contro il precedente
degli avatar — si legge molto diversamente guardando cosa ci finisce dentro
davvero: un URL non indovinabile su un documento del genere sarebbe stato
sicurezza per oscurità su dati bancari.

#### Emerso dal code-review PRIMA del merge (2026-08-21)

Quattro rilievi, tutti applicati, tutti su codice che `tsc`, lint, build e
`audit:tokens` davano per buono. Nessuno tocca lo schema: la migration era
corretta, a sbagliare era il codice attorno.

- ⚠️⚠️ **La coda delle ricevute aveva DUE proprietari, e il ramo d'errore la
  perdeva in silenzio.** Il picker teneva `pendenti`, il form una copia derivata
  (`File[]` via `onPendingChange`), e il flusso era a senso unico: quando il form
  svuotava la propria copia dopo un caricamento fallito, **il picker non lo
  sapeva**. Le miniature restavano a schermo, un secondo "Salva" non ricaricava
  niente e chiudeva — la ricevuta spariva *mentre lo schermo diceva che c'era*.
  Con due foto di cui una riuscita se ne vedevano tre, perché nel frattempo la
  rilettura aggiungeva la caricata accanto alle due in attesa.

  ⚠️ **È lo stesso difetto di forma corretto poche ore prima** — un gesto che
  sembra compiuto e non lo è — riapparso di un ramo più in là. La chiusura non è
  un `else` in più: la coda ha ora **un proprietario solo** e il form la *chiede*
  (`AttachmentPickerHandle.uploadPending()`), che lascia in coda le sole ricevute
  non passate. Lo stato incoerente non è mitigato, è irrappresentabile.
- ⚠️ **Un commento descriveva una difesa che non esisteva.** La revoca dei
  `blob:` allo smontaggio leggeva `pendenti` con dipendenze `[]`, cioè la closure
  del **montaggio**, quando l'array è vuoto: revocava zero URL a ogni chiusura, e
  tornare indietro alla griglia dei tipi smontava il form (fino alla #122: ora
  lo smonta solo la chiusura del modale), quindi capitava a ogni ripensamento. A nasconderlo era l'`eslint-disable` scritto due righe sopra.
  Ora si legge da un ref, che non è una closure e non invecchia.

  **La regola: un `eslint-disable` su `exhaustive-deps` va giustificato dicendo
  quale valore si sta congelando**, perché è esattamente la cosa che il commento
  accanto darà per scontata.
- ⚠️⚠️ **`.in()` viaggia nella query string, e 216 uuid sono una URL rifiutata.**
  Il conteggio delle graffette chiedeva gli id di tutte le righe arrivate — fino
  a `SEARCH_SCAN_LIMIT = 500` quando si cerca — cioè ~19 KB di URL contro gli ~8
  KB che il proxy accetta: **oltre le ~215 righe la lista avrebbe dichiarato
  "nessuna ricevuta" su movimenti che ce l'hanno**, perché la funzione degrada a
  `{}` di proposito. Un solo estratto Trade Republic ne produce 216: la soglia è
  già raggiungibile con i dati di oggi, non è teorica.
  Chiuso spezzando in blocchi da 100 (`IN_CHUNK`), **sotto** il limite esterno e
  non a ridosso — stessa ragione per cui `SEARCH_SCAN_LIMIT` sta sotto il tetto
  di PostgREST. Stesso difetto in `undoImport()`, che in più **scartava l'errore
  della select**: non potendo rimediare, ora almeno lascia nei log l'id del lotto.
- ⚠️ **Una difesa va provata DISATTIVANDOLA**, o "funziona" e "non è mai stata
  letta" sono indistinguibili. Vedi il `remotePattern` delle ricevute qui sopra:
  aggiunto, anteprime funzionanti, conclusione sbagliata.

Più: `getAttachments` fallita mostrava un elenco vuoto, che si legge come
"nessuna ricevuta" — una lettura fallita travestita da fatto, la stessa famiglia
della graffetta mancante.

##### Il ramo d'errore, collaudato per davvero (2026-08-21)

Il guasto si inietta abbassando `ATTACHMENT_MAX_BYTES` a 60 KB: così il rifiuto
arriva dal controllo **vero** in `uploadAttachment()` e non da un ramo scritto
per il test. Prove superate: l'errore viene detto, il modale resta aperto, la
miniatura resta ("1 ricevuta" nel contatore), **un solo movimento creato**.

⚠️⚠️ **Ma la prova che la riprova RICARICHI non si può fare leggendo lo schermo,
e la prima versione infatti non dimostrava nulla.** `attachmentError` non viene
azzerato prima del secondo tentativo, quindi il messaggio è ancora lì comunque:
vederlo è compatibile sia con "ha ritentato e fallito di nuovo" sia con "non ha
fatto niente" — cioè proprio il difetto che si sta cercando. Un controllo che
passa in entrambi i mondi non è un controllo.

Si dimostra **contando le chiamate**: una server action è una POST, e la riprova
ne fa **due** (update + upload) dove la versione difettosa ne avrebbe fatta
**una**. Misurato: 2.

**La regola: quando lo stato dell'interfaccia SOPRAVVIVE al gesto, l'interfaccia
non può testimoniare sul gesto.** Va misurato un effetto che nasce solo se il
gesto è avvenuto — qui il traffico, altrove una riga in più nel database.

⚠️ E il driver ha sbagliato **due volte prima di funzionare**, entrambe nella
prova e non nella pagina: cercava una card `/^Spesa$/` (l'etichetta è
**"Uscita"** — `spesa` è l'id nel database, e il bottone contiene anche la
descrizione, quindi l'ancoraggio `$` non aggancia), e componeva il selettore del
tastierino con `"\\" + "0"`, che in una regex è **`\0`, il carattere nullo**.
Quinta e sesta volta in questo progetto che a sbagliare è la verifica.

I due movimenti di prova (€ 0,01 e € 0,02) sono stati **cancellati dall'app**,
con il conteggio prima e dopo: 1+1 → 0+0. Il database è di produzione, quindi il
collaudo non finisce quando il referto è verde ma quando i dati sono come li ha
trovati.

