# Splash di apertura e lampi bianchi all'avvio

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Splash di apertura (2026-09-10)

Richiesta senza issue, non una fase numerata. Progettato con Claude Design
(due artboard chiaro/scuro) prima di scrivere codice, poi implementato in
`components/UI/BootSplash.tsx` + `app/layout.tsx` + i keyframe `zg-boot-out`
in `globals.css`.

- **Nessun JavaScript.** Le pagine di questa app sono Server Component: il
  contenuto vero arriva GIÀ nell'HTML del server, nello stesso payload —
  non c'è un vero stato "sto caricando" lato client da aspettare per il
  boot. Un'animazione CSS pura (`zg-boot-out`, 900ms: ferma al 55%, poi
  dissolvenza con `visibility` che scatta a `hidden` esattamente al 100%)
  copre l'istante dell'assestamento visivo senza poter mai "sbagliare"
  aspettando un evento che non arriverebbe.
- ⚠️ **Root layout, NON `app/loading.tsx`.** Questo repo non ha MAI avuto un
  `loading.tsx` (vedi "Cosa NON era il problema" più sotto, sezione Costo
  delle richieste a Supabase): aggiungerne uno accende il prefetch
  automatico delle rotte dinamiche, un costo mai misurato per questo
  progetto. Il velo va nel root layout come elemento sempre presente,
  invece — si dissolve da sé in CSS, non è un fallback di Suspense.
- **Si vede solo al caricamento a FREDDO**, non per costruzione esplicita ma
  per una proprietà di Next.js App Router: il root layout non si
  ri-esegue su una navigazione client-side (soft), quindi `<BootSplash />`
  non rimonta mai passando da una pagina all'altra dentro l'app — resta
  nell'albero, nella sua posizione finale (`visibility:hidden`), e basta.
  ⚠️ Verificato, non supposto: un primo giro di collaudo contava la
  presenza del nodo nel DOM dopo una navigazione soft e la trovava sempre
  "presente" — falso allarme del test stesso, che misurava la cosa
  sbagliata (presenza invece di visibilità). Corretto misurando
  `isVisible()`: il velo resta davvero nascosto.
- **Badge, aloni e anello sono RIUSATI**, non nuovi: lo stesso Sprout in
  pastiglia di vetro di `AppLockScreen`, gli stessi `.circle-1`/`.circle-3`,
  lo stesso `zg-ring` già in uso per l'attesa sull'avatar
  (`ProfileEditor`) — un colore OPACO (`--color-midori`) come bordo, quindi
  immune al bug Firefox dell'issue #81 (`border` vero, non un anello a
  `box-shadow`, e va bene così).
- `z-70`: sopra il velo di blocco PIN (`AppLockScreen`, `z-65` dalla #125) — su un
  dispositivo con blocco attivo la sequenza resta splash → schermata di
  sblocco, mai il contrario.
- **`aria-hidden="true"`**: è decorativo e sparisce da solo in meno di un
  secondo, non contenuto da annunciare — e senza, uno screen reader lo
  leggerebbe PRIMA della pagina vera a ogni apertura. Chi naviga con
  tecnologie assistive non subisce comunque il ritardo: la pagina reale è
  già nell'albero di accessibilità dal primo istante, il velo copre solo
  la vista.
- ⚠️⚠️ **Beneficio non cercato, trovato collaudando**: alla primissima
  visita senza cookie tema (Fase 18) il server rende scuro per default e
  `ThemeProvider` corregge al mount se il sistema dice altro — "un lampo,
  una volta sola", già accettato per tutta l'app. Misurato con
  screenshot a intervalli di 100ms: quella correzione scatta entro i primi
  100ms, cioè ben dentro la finestra in cui il velo è ancora
  completamente opaco (0-495ms). Il velo non crea il lampo — lo NASCONDE,
  cosa che nessuna pagina senza velo poteva fare.
- Collaudato in entrambi i temi (screenshot a t=0 e dopo la dissolvenza),
  zero errori console. Font, colori e gradiente di sfondo letti dai token
  reali di `globals.css`, non ricordati — stesso principio della sezione
  "Design well" del canvas: non si inventa una palette quando ne esiste
  già una.

#### ⚠️⚠️ Il collaudo in Chromium non poteva vedere il vero difetto

Provato dal telefono il 2026-09-10: prima dello splash comparivano un
fotogramma nero (la transizione di sistema di iOS) e poi uno **bianco**,
entrambi prima che una sola riga del nostro HTML arrivasse. Il velo
funzionava — si vedeva, ma "troppo veloce" — il problema vero stava
PRIMA di lui, in una zona che nessun driver headless su `localhost` può
raggiungere per costruzione: **iOS non legge `background_color` dal Web
App Manifest per lo splash nativo di una PWA** (a differenza di Android),
e senza il meccanismo proprietario Apple (`apple-touch-startup-image`,
mai implementato) lo schermo vuoto è l'unica cosa che iOS può mostrare.

Chiuso con `scripts/generate-pwa-splash.mjs` (`npm run generate:pwa-splash`)
+ i `<link rel="apple-touch-startup-image">` in `generateMetadata()`
(`app/layout.tsx`, via `icons.other` — l'unico campo tipizzato di `Metadata`
che supporta `media` su un `<link>` arbitrario).

- **Le dimensioni non sono a memoria.** Un primo giro cercando "la lista
  delle media query" a naso ha trovato solo un gist fermo a iPhone 11: la
  fonte usata è `apple-fallback-data.json` di `elegantapp/pwa-asset-generator`
  (MIT, mantenuto, aggiornato a iPhone 17/Air) — la stessa disciplina già
  scritta per lo schema del database nella #43: **una tabella copiata da
  un posto qualunque è peggio di una che manca**, perché sembra completa e
  non lo è.
- ⚠️ **Copertura deliberatamente parziale, su richiesta esplicita**:
  iPhone 12 → 17/Air (8 dimensioni logiche distinte × 2 temi = 16
  immagini), non l'intera matrice storica Apple (oltre 20 combinazioni).
  Ogni voce è un numero che, se sbagliato, non dà errore — rende
  l'immagine silenziosamente invisibile per quel modello soltanto, lo
  stesso genere di difetto muto che questo documento incontra sempre
  quando un valore sbagliato non fallisce rumorosamente. Solo ritratto:
  l'app non supporta l'orizzontale.
- **Contiene solo sfondo + badge, non "Seichi"/整地.** `sharp`/librsvg
  rasterizza con i font di SISTEMA della macchina che esegue lo script,
  non con il fallback CJK affidabile di un browser vero — un rischio non
  verificabile senza generare e guardare pixel per pixel. Il testo arriva
  un istante dopo con `BootSplash` (browser reale): l'immagine nativa
  esiste solo per non mostrare NULLA nell'istante prima, non per essere
  la schermata completa.
- **Il badge è centrato al 46% dell'altezza, non al 50%.** È dove si trova
  DAVVERO dentro `BootSplash.tsx` una volta che il gruppo badge+testo
  (quello sì centrato per intero) si assesta — allinearli evita un salto
  verticale visibile nel passaggio immagine nativa → componente.
- ⚠️ **`prefers-color-scheme` risponde al tema di SISTEMA**, mai al cookie
  di Seichi (Fase 18): a quello stadio non esiste ancora una richiesta da
  cui leggere un cookie. Chi ha Seichi su scuro con il sistema su chiaro
  vedrà lo splash nativo chiaro e poi `BootSplash` scuro — lo stesso
  "lampo, una volta sola" già accettato per tutta l'app, in una nuova sede.
- **La lista dei dispositivi è DUPLICATA** fra lo script (Node puro, non
  può importare `app/layout.tsx`) e `generateMetadata()`: stesso
  compromesso già accettato per i percorsi dell'icona Sprout fra
  `lib/pwa-icon.ts` e `generate-pwa-icons.mjs`.

⚠️⚠️ **Lezione di metodo, la stessa di sempre in una veste nuova**: il
collaudo con l'autenticatore virtuale e gli screenshot Playwright di
questa stessa sezione avevano dichiarato lo splash "collaudato in
entrambi i temi" — vero, ma solo per la parte che un browser Chromium su
`localhost` può vedere. Il difetto vero viveva un livello più in basso,
nella cerimonia nativa di avvio di iOS, che nessun driver headless
raggiunge per definizione — la stessa classe già scritta per
`crypto.randomUUID()` (Fase 22), la stampa (23b) e il service worker
(Fase 25): *ogni fase che tocca un'API o una cerimonia nativa del
dispositivo ha una parte di collaudo che nessun driver può fare*, e qui
si è vista solo perché l'utente ha guardato lo schermo vero e ha
insistito quando "si vede ma è veloce" non spiegava per intero quello che
stava vedendo.

#### Il debito della Dynamic Island (Fase 18/issue #86) era la STESSA causa

Chiuso lo stesso giorno, e riapre la diagnosi originale invece di
confermarla: la zona attorno alla Dynamic Island, dichiarata "non
risolvibile via codice" dopo tre tecniche verificate dal vivo, è tornata
omogenea da sola **disinstallando e reinstallando la PWA** — nessuna riga
di codice nuova per quel debito specifico. La diagnosi di allora
concludeva un limite strutturale di iOS da un "zero su tre" che in realtà
misurava una PWA che eseguiva ancora una versione precedente. Corretto il
commento in `app/layout.tsx` con la spiegazione vera. Vale come regola
per ogni debito futuro simile: su una PWA installata, *un cambiamento che
"non si vede sul telefono" va sempre escluso come cache — disinstallare e
reinstallare — prima di concludere che il codice non basta*.

#### ⚠️⚠️ Un secondo lampo bianco, distinto dal primo: dopo lo splash nativo, prima del contenuto

Corretta l'immagine di avvio nativa, il telefono mostrava ancora un
istante bianco fra quella e il contenuto vero — un difetto **diverso**
dal precedente, non lo stesso non ancora chiuso. Il primo era "iOS non sa
disegnare nulla di suo prima che arrivi l'HTML"; questo è "l'HTML è
arrivato, ma il CSS che gli dà colore no ancora".

**Comportamento nativo documentato di WKWebView, non un difetto nostro**:
prima che un foglio di stile ESTERNO venga scaricato e applicato, il
motore dipinge sempre BIANCO, in qualunque tema — verificato sui forum
sviluppatori Apple, non supposto. La regola già scritta in `globals.css`
(`html { background-color: var(--background-secondary) }`, issue #86) non
arriva in tempo per QUESTO istante: vive in `globals.css`, caricato via
`<link rel="stylesheet">`, cioè dopo un giro di rete — esattamente la
finestra che il difetto occupa.

Chiuso con uno `style` **inline** su `<html>` in `app/layout.tsx`, stessi
due hex di `--background-secondary` ma letterali, non `var(--…)`: un
attributo dell'elemento si applica leggendo l'HTML stesso, senza aspettare
alcun file esterno. Il colore resta quello giusto per il tema scelto
(`resolved`, già calcolato lì per la classe `.dark`) fin dal primo byte.

⚠️ **Non elimina il ritardo, lo rende invisibile.** Il badge/anello/testo
di `BootSplash` dipendono comunque dalle classi Tailwind del foglio
esterno e "compariranno" solo quando quello arriva — ma ora su uno sfondo
già del colore giusto, non su un lampo bianco che sembra un guasto. È lo
stesso principio già scritto per lo splash nativo: non serve rendere tutto
istantaneo, serve che ogni istante intermedio dica la verità sul tema
scelto invece di una bugia (bianco) o un'assenza (nero).

⚠️⚠️ **Non verificabile da qui.** È un difetto di **tempistica di rete
reale su un motore di rendering reale** — esattamente la classe già
scritta più volte in questo documento (`crypto.randomUUID()`, la stampa,
il service worker, lo splash nativo stesso): `curl` e Playwright su
`localhost` non vedono alcun ritardo di rete per il CSS, quindi non
possono confermare né smentire che il lampo sparisca davvero. Verificato
qui solo che l'attributo `style` compaia nell'HTML grezzo (`curl` sulla
risposta) e che build/lint/tsc restino puliti — la prova che conta resta
da fare **dal telefono**.

#### ⚠️⚠️ Lo `style` inline NON bastava — la diagnosi era incompleta, non sbagliata nel merito

Provato dal telefono dopo la correzione sopra, **con la PWA reinstallata e i
dati cancellati** (per escludere la cache, prima di dubitare del codice — la
stessa disciplina già applicata al debito della Dynamic Island): il lampo
bianco fra lo splash nativo e il contenuto **restava**.

La diagnosi "WKWebView dipinge bianco finché il CSS esterno non arriva" era
vera ma **incompleta**: uno `style` sull'elemento `<html>` si applica solo
quando il parser HTML raggiunge quel tag — cioè comunque DOPO che WKWebView
ha già composto il primo fotogramma sul cold start di una PWA, con lo sfondo
di DEFAULT del motore (bianco), indipendentemente da qualunque colore
l'autore dichiari un istante dopo. Un attributo dell'elemento arriva prima
di un foglio esterno, ma non prima del primo paint del motore stesso.

**La correzione che manca**: `<meta name="color-scheme">`. È un meccanismo
diverso da un `background-color` d'autore — dice al motore stesso quale
sfondo usare per il canvas iniziale, PRIMA che un qualunque valore d'autore
si applichi. È lo stesso meccanismo per cui i siti scuri che non lo
impostano mostrano un lampo bianco anche a CSS già scaricato e in cache: non
è specifico a questa app, è un difetto notissimo dei siti "dark mode" che
non l'hanno mai impostato.

Chiuso con `generateViewport()` (`app/layout.tsx`) — non l'oggetto statico
`viewport`, perché il valore dipende dal cookie del tema come tutto il resto
di questo file. La stessa risoluzione (`choice`/`resolved` dai due cookie di
Fase 18) serviva ora in due punti — qui e nel corpo di `RootLayout` — quindi
è stata estratta in `resolveServerTheme()` una volta sola: **copiarla due
volte avrebbe potuto farle divergere**, lasciando il meta `color-scheme`
discorde dalla classe `.dark` effettivamente applicata, lo stesso genere di
bug silenzioso già registrato più volte in questo documento per ogni
duplicazione "a campione".

⚠️ **Residuo dichiarato, anche con `color-scheme` presente**: il valore
(`"dark"`/`"light"`) fa scegliere al motore un default GENERICO — tipicamente
nero pieno o bianco puro, non i nostri hex `#1a2232`/`#e2ded4` — perché la
specifica non prevede un modo di dire "usa esattamente questo colore" per
quel primissimo fotogramma. Lo `style` inline sull'`<html>` **resta**: copre
l'istante subito dopo, quando l'HTML è parsato ma il CSS esterno ancora no.
I due meccanismi si completano — canvas del motore, poi attributo
d'autore, poi foglio esterno — nessuno dei tre da solo copre l'intera
finestra.

⚠️⚠️ **Di nuovo non verificabile da qui, e per lo stesso motivo di sempre**:
è un comportamento del motore di rendering nativo su un cold start reale.
Verificato qui solo che il meta compaia nell'HTML grezzo con il valore giusto
per entrambi i temi (`curl`, con e senza i cookie del tema) e che
build/lint/tsc/`audit:tokens`/`audit:pwa-cache` restino puliti — **il
telefono resta l'unico giudice**, e la lezione di metodo è che anche una
correzione "verificata quanto si può da qui" può essere incompleta: la
prova reale non è opzionale nemmeno quando ogni controllo statico è verde.

*(Scoperto lo stesso giro: 16 file `public/splash/*.png` — aggiunti per lo
splash nativo, sezione sopra — non erano nell'allow-list di
`audit:pwa-cache`, quindi lo script falliva silenziosamente non eseguito
finché nessuno lo rilanciava dopo una build. Corretto aggiungendo il
prefisso `/splash/` — non i 16 nomi esatti, perché quella lista è
dichiaratamente destinata a crescere. Nessun rischio: sono immagini statiche
versionate, zero dati dell'utente, stessa categoria delle icone già
presenti.)*

#### ⚠️⚠️ Sospeso il 2026-09-10, in attesa di un deploy reale: il lampo residuo è misurato, non isolabile da qui

Nemmeno il meta `color-scheme` ha eliminato il lampo — provato dal telefono
**con la PWA reinstallata e i dati cancellati**, identico a prima. A quel
punto restavano due sole spiegazioni possibili, e andavano distinte con
numeri veri invece che con un'altra correzione alla cieca.

**Prima esclusione: non è la cache/rete di `next dev`.** Costruita
un'istanza di produzione separata sulla LAN (porta dedicata, server di
sviluppo intatto) e confrontate le intestazioni dello stesso file CSS:

| | `next dev` | `next start` (produzione) |
|---|---|---|
| `Cache-Control` | `no-cache, must-revalidate` — rete obbligatoria a ogni apertura | `public, max-age=31536000, immutable` — zero rete dopo il primo caricamento |
| dimensione | 80,5 KB | 63,7 KB |

Il metodo di collaudo di questo debito — disinstalla, cancella i dati,
reinstalla — elimina la cache del *browser*, ma contro il server di sviluppo
quella richiesta di rete sarebbe avvenuta comunque, sempre: quell'header non
permette mai di saltarla. Testando la build di produzione, con lo stesso CSS
già immutabile in cache, **il lampo è rimasto identico fra la prima e la
seconda apertura**. Se fosse stato un costo di rete, la seconda apertura
(zero richieste per il CSS) sarebbe stata diversa dalla prima. Non lo è
stata: la causa non è la rete.

**Seconda esclusione: non è il nostro codice a essere lento.** Senza un Mac
per Safari Web Inspector, la misura è arrivata comunque: uno script
temporaneo (rimosso subito dopo, mai finito in un commit) leggeva
`performance.getEntriesByType("paint")` e `"navigation"` dal telefono vero e
li spediva via `fetch()` a una rotta temporanea sulla stessa LAN, scritti su
un file leggibile da qui — lo stesso principio dell'autenticatore virtuale
della Fase 26b: quando manca lo strumento giusto, se ne costruisce uno
ad-hoc invece di continuare a dedurre dai sintomi.

Tre riaperture reali della PWA installata:

| tentativo | `first-contentful-paint` |
|---|---|
| 1 | 176 ms |
| 2 | 115 ms |
| 3 | 181 ms |

Il nostro contenuto (l'icona/testo di `BootSplash`) è disegnato entro **115-
181 ms dall'inizio della navigazione** — veloce, non il collo di bottiglia.
La stima precedente di "~350-400ms" veniva dal conteggio a occhio dei
fotogrammi di un video a 12fps: un'approssimazione, non una misura.

**La lettura più probabile**: se il nostro contenuto è già pronto a ~150ms
dall'inizio della cronologia di navigazione, il resto del lampo percepito
avviene quasi certamente **prima che quella cronologia inizi a contare** —
durante l'avvio del processo dell'app e l'inizializzazione della WebView da
parte di iOS, la stessa finestra che l'immagine di lancio nativa dovrebbe
coprire. Se è così, è zona che nessuna riga di HTML/CSS/JS può raggiungere,
perché accade prima che una sola riga della nostra pagina venga letta — lo
stesso limite già registrato per la dissolvenza di sistema, questa volta
con un numero a sostegno invece che un'ipotesi.

⚠️ **Ma è una lettura, non una certezza, e per questo il debito resta
APERTO invece che chiuso.** Ogni misura di questa sezione è stata presa
contro il server di sviluppo o una build locale sulla LAN — mai contro un
vero dominio HTTPS servito da un CDN. Un deploy reale cambia variabili che
da qui non si possono isolare (negoziazione TLS, HTTP/2 o HTTP/3, tempi di
edge cache, latenza reale invece che quella di un Wi-Fi domestico), e
potrebbe spostare i numeri misurati qui in un senso o nell'altro. **Vale la
pena rimisurare con lo stesso metodo — build di produzione, tre riaperture,
`first-contentful-paint` reale dal telefono — il giorno in cui Seichi avrà
un deploy vero**, prima di considerare la domanda davvero risposta.

⚠️ **Nel frattempo, cosa NON si è fatto, e perché**: non si è continuato a
modificare `app/layout.tsx` o `globals.css` dopo questa misura. Le due
correzioni precedenti (`style` inline, meta `color-scheme`) restano — sono
comunque corrette in astratto e proteggono dal caso in cui il CSS/JS
impieghi più di ~150ms su una rete o un dispositivo peggiori di quello di
prova — ma un terzo intervento senza un numero che ne mostri il bisogno
sarebbe stato l'ennesimo tentativo alla cieca contro un problema che i dati
attuali dicono non stare più lì. **Un lampo di ~150-200ms, sempre del
colore giusto attorno, non giustifica altri interventi ciechi ORA — ma
merita una rimisurazione vera in produzione prima di essere archiviato.**

#### ✅ Chiuso il 2026-09-14: rimisurato in produzione — è latenza di trasporto pura, non correggibile da qui

Rimisurato con lo stesso metodo promesso sopra, contro il deploy vero
(`seichi-app.vercel.app`, disponibile dall'11/9). Stavolta senza un Mac né una
rotta temporanea sulla LAN: una diagnostica ad-hoc analoga
(`components/debug/PerfDebugOverlay.tsx`, mai rimasta nel repo più di
qualche commit — vedi sotto) mostrava l'FCP direttamente sullo schermo del
telefono.

⚠️ **Primo tentativo sprecato, e vale la pena registrare perché**: la
diagnostica armava un flag in `localStorage` visitando l'URL da Safari, con
l'idea che l'icona già installata lo trovasse alla riapertura. Non
succedeva — **iOS non condivide la `localStorage` fra Safari e un'app
aggiunta alla home screen per lo stesso dominio**. Fatto nuovo, mai
verificato prima in questo progetto: smentisce l'assunzione implicita di
tutta la sezione "Fase 26a/26b" qui sopra, dove PIN e biometrico vivono
"solo in `localStorage`, per dispositivo" — è per dispositivo, ma **anche
per contesto** (Safari vs. standalone), non solo per origine. Le prime tre
misure sono finite per sbaglio in un tab Safari (visibile dalla barra degli
indirizzi negli screenshot: 427/474/535ms) e sono state scartate — utili
solo a confermare che pure lì l'FCP reale è molto più alto che in LAN, ma
Safari non passa mai dallo splash nativo, quindi non è il test giusto.
Chiuso rendendo la diagnostica sempre attiva (senza gating) per il breve
tempo della misura.

Tre riaperture reali dell'icona standalone (schermo intero, nessuna barra
Safari negli screenshot):

| tentativo | `first-contentful-paint` |
|---|---|
| 1 (a freddo, app appena evitta dalla memoria) | 1056 ms |
| 2 | 448 ms |
| 3 | 409 ms |

**E il bianco è tornato visibile** — confermato a voce guardando il
telefono, non dedotto dai numeri: "appare dopo lo splashscreen per un
attimo e poi appare il login/home". La lettura di sospensione ("il nostro
contenuto è pronto in ~150ms, il resto è fuori portata") puntava nella
direzione giusta, ma i numeri di allora — 115-181ms, contro `localhost`/LAN
— non erano quelli di un utente vero: è esattamente la ragione per cui il
debito era rimasto aperto invece che chiuso su quella base.

**La causa: tempo di trasporto prima che arrivi un solo byte, non un costo
del nostro codice.** Isolata confrontando via `curl` il TTFB di `/welcome`
(pagina Server Component completa, passa dal proxy e da `getClaims()`) con
quello di richieste che il proxy non tocca nemmeno (escluse dal matcher):

| richiesta | TTFB (sei tentativi) |
|---|---|
| `/welcome` (SSR, passa dal proxy) | 260-425 ms |
| `icon-512.png` (statico) | 111-353 ms |
| `manifest.webmanifest` (dinamico, bypassa il proxy) | 227-547 ms |

Stesso ordine di grandezza per richieste che non hanno NULLA in comune a
livello applicativo — una passa dal render SSR e dal controllo di sessione,
le altre no. Se il costo fosse nel nostro rendering o in `getClaims()`, il
file statico sarebbe stato sistematicamente più veloce. Non lo è: è
varianza di rete/edge, uguale per qualunque risposta — esattamente le
variabili che la sezione precedente non poteva isolare da una LAN
domestica (negoziazione TLS, instradamento, tempi di edge).

Controllato anche che `style` inline e meta `color-scheme` siano davvero
nel primo blocco di byte che arriva (`curl` sull'HTML grezzo): ci sono,
corretti, nello stesso chunk iniziale della risposta — quindi una volta
che il primo byte arriva, vengono applicati pressoché subito. **Il bianco
che si vede sta PRIMA di quel primo byte**, nella finestra in cui
letteralmente non esiste ancora nulla della nostra pagina da far leggere al
motore: nessuna riga di HTML, CSS o JS può coprire un istante in cui non è
ancora arrivata.

**Chiuso così, e non con un'altra correzione al buio**: è lo stesso limite
già scritto per la dissolvenza di sistema e per lo schermo bianco nativo di
iOS — zona strutturalmente fuori portata da qui — confermato adesso con
numeri di produzione invece che di LAN, invece di restare un'ipotesi.
L'unica strada che lo eliminerebbe davvero è precaricare un app-shell
statico da servire dalla cache del service worker anche al primissimo
avvio, il che contraddice la decisione esplicita della Fase 25 ("nessuna
pagina applicativa nel precache", ogni pagina di Seichi è dinamica) e non è
giustificato da mezzo secondo di attesa su un'icona, non un'app nativa.
Restano `style` inline e meta `color-scheme`: coprono l'istante subito dopo
il primo byte, che è tutto quello che dal browser si può coprire.

⚠️ **La diagnostica non resta nel repo.** Tre commit (`e16bf6f`, `3d2679f`,
`daeefd8`, PR #92/#93/#94) l'hanno portata e corretta in produzione per la
durata della misura; un quarto la rimuove non appena raccolti i dati —
stesso principio dello script ad-hoc della sezione precedente, applicato
stavolta a un vero deploy invece che alla LAN.

