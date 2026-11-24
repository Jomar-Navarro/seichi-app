# Scheda — la home

> Fase 30 (#225), passo 3. Si incolla in Claude Design **dopo**
> `docs/design/zen-glass-v2.md`, che ha la precedenza su tutto ciò che qui non
> è detto. I rimandi «v2 §n» e «Dn» puntano a quel file.
> Il contenuto descritto è quello dell'app di oggi (2026-11-24); le differenze
> volute sono segnate **[cambia]**, e quelle che cambiano cosa fa l'app, non
> solo come appare, **[cambia cosa fa]**: si confermano guardando il mockup.

---

## 1. A cosa serve

La home è la schermata che si apre più spesso: in piedi, con una mano, per
pochi secondi. Risponde a tre domande, in quest'ordine:

1. **Quanto ho, e dove?** Il saldo dei conti.
2. **Come sta andando il mese?** Il flusso: entrate meno uscite.
3. **Cosa è successo di recente?** Gli ultimi movimenti.

E offre un gesto: **registrare un movimento**, il «+».

Tutto il resto (analisi, investimenti, obiettivi) è una porta verso un'altra
pagina, non un contenuto da leggere qui.

## 2. Cosa c'è, dall'alto in basso (telefono, 414 px)

### Intestazione

- **A sinistra**: l'avatar con le iniziali (o la foto), sopra il nome un saluto.
  Tutto il gruppo apre il menu del profilo (tema chiaro/scuro, Impostazioni,
  Esci).
  **[cambia]** Il saluto oggi è «Bentornato», che ha un genere. Diventa un
  saluto per ora del giorno, neutro: «Buongiorno», «Buon pomeriggio»,
  «Buonasera» (#172). Nel mockup: «Buonasera».
- **A destra**, due pastiglie rotonde da 44: il **coach** (una bussola: apre un
  pannello di domande sui propri numeri) e le **notifiche** (una campanella,
  con un numero quando ce ne sono di non lette, «9+» oltre nove).
- **Sotto**, il **selettore del conto**: un chip «Tutti i conti ⌄» che filtra
  tutta la pagina. Misura dei chip della v2 (§8): 36 di altezza, testo da 14,
  con un pallino del colore del conto quando ne è scelto uno.

### Primi passi (solo per chi ha appena iniziato)

Una card con quattro passi: imposta il saldo iniziale del conto, registra il
primo movimento, imposta un budget, dai un traguardo a un obiettivo. Mostra
«2 su 4», il passo successivo con una frase sul perché e il suo bottone.
Sparisce per sempre con «Ho capito», o da sola quando i quattro passi sono
fatti.

- **[cambia]** Il comando della card è un **bottone secondario** (v2 §8): il
  principale della schermata è il «+».
- **[cambia]** I quattro passi sono quattro segni allineati su una riga, non
  sfalsati in altezza.

### Saldo e flusso

**[cambia]** Oggi sono due card in un carosello: si vede il saldo, il flusso sta
dietro uno scorrimento. Diventano **una card sola**, senza carosello, con i due
numeri uno sotto l'altro: un numero nascosto dietro un gesto non si legge in un
secondo.

- **Saldo · 3 conti attivi**: l'etichetta, poi la cifra protagonista (40,
  centesimi ridotti, v2 §5). Neutra, mai colorata.
- Una linea sottile.
- **Flusso · novembre**: l'etichetta, poi la cifra con il segno, a 28. Il
  colore lo dà il segno: inchiostro midori se positivo, aka se negativo.
- **In alto a destra**, un occhio: nasconde e mostra tutti gli importi della
  pagina (al posto delle cifre, dei punti).
- **[cambia]** Le due spiegazioni oggi scritte sotto i numeri («somma dei saldi
  sui conti attivi — gli archiviati restano fuori», «entrate meno uscite di
  questo mese — non il saldo dei tuoi conti») **si tolgono**. Quella del saldo
  sta dietro un tocco sull'etichetta (D5): una frase sola, in un piccolo
  riquadro sotto l'etichetta. Quella del flusso non serve più: lo spiegano le
  sue parti, scritte sotto (D14). L'etichetta che si tocca deve sembrarlo senza diventare un link
  colorato: per esempio una sottolineatura punteggiata leggera. Da disegnare.
- **[cambia]** Sparisce l'area grafica dentro il flusso (sul computer) e il
  link «Vedi il dettaglio dei conti»: Conti ora è nella barra in basso (D11).
- **[cambia]** Sotto il flusso, **le sue parti in riga** (D14): Entrate «+
  2.150,00», Spese «− 742,35», Abbonamenti «− 63,97», ciascuna con un pallino
  del colore del tipo e l'etichetta da 12. Si legge da dove viene il totale
  proprio sotto il totale.
  **[cambia cosa fa]** Ogni voce apre Movimenti già filtrato su quel tipo.
- È **l'unica superficie di vetro** della pagina (D12): più luminosa, raggio
  28, l'unica ombra.

### Messi da parte

**[cambia]** Oggi sono due delle quattro card del mese, in una griglia 2×2 con
le icone dentro un quadratino colorato. La griglia sparisce (D14). Risparmi e
investimenti diventano un gruppo di pietra piatta (D12) con il titolo di
sezione «Messi da parte» e due righe:

- **Risparmi**: l'icona kin al tratto, senza pastiglia (D13), l'importo del
  mese, una **barra sottile kin** (D10) e sotto «46% dei traguardi». Solo se
  esistono obiettivi con un traguardo, e solo su tutti i conti.
- **Investimenti**: l'icona ao al tratto e l'importo del mese.
- **[cambia cosa fa]** Le righe sono porte: Risparmi apre Obiettivi,
  Investimenti apre Investimenti.
- Via le linee senza scala (D6).

### Analisi

**[cambia]** Oggi è una riga con una linea di tendenza senza scala. Diventa un
gruppo di pietra piatta che si legge (v2 §9): titolo «Analisi», sotto **il flusso degli ultimi sei
mesi** in sei barre sottili, con il mese abbreviato sotto ciascuna (Giu, Lug,
Ago, Set, Ott, Nov) e il valore in euro sopra; la barra del mese in corso
nell'inchiostro principale, le altre in un tono spento; a destra del titolo la
freccia. Tutta la card apre Analisi. Il dato
esiste già (`flussoTrend`), non serve una lettura nuova.

### Movimenti recenti

- Titolo di sezione **«Movimenti recenti»** e a destra l'azione di testo
  **«Vedi tutti →»** (D4; oggi «Transazioni recenti», «Vedi tutte →»).
- **[cambia]** La lista è il **foglio unico** di Movimenti (D3): un gruppo di
  pietra piatta, icone al tratto senza pastiglia (D13), righe divise da una
  linea sottile, raggruppate per giorno («Oggi», «Ieri», «22
  novembre»), cinque righe in tutto.
- **[cambia]** La riga è quella della v2 §8 (D9): titolo la categoria,
  sottotitolo la nota; senza nota, il conto. Oggi il sottotitolo dice «Uscite ·
  Oggi»: il tipo lo dicono già icona e colore, il giorno il gruppo.
- Una riga con una ricevuta allegata ha una piccola graffetta accanto al titolo,
  come in Movimenti.

### Barra in basso

Vetro, sospesa sopra il fondo, con la safe area sotto.
**[cambia cosa fa]** Le voci diventano **Home, Movimenti, «+», Conti,
Obiettivi** (D11; oggi Home, Transazioni, «+», Obiettivi, Investimenti).
Il «+» è il bottone principale della schermata: pieno, nell'inchiostro
principale (v2 §8), al centro, un poco più grande delle voci. La voce attiva si
riconosce dal fondo e dal peso del testo, senza pallini.

## 3. Sul computer (1440 px)

Stessi pezzi, più colonne (v2 §2). Niente forme nuove.

- **Barra laterale** a sinistra: l'**ensō** e «Seichi» in alto (D7), il bottone
  principale **«Nuovo movimento»**, poi le voci Home, Movimenti, Conti,
  Obiettivi, Investimenti, Analisi, Impostazioni; in fondo il profilo (avatar,
  nome, «3 conti attivi»), che apre lo stesso menu del telefono.
- **Intestazione** su una riga: saluto e nome, il chip del conto, e a destra
  coach e notifiche. Senza avatar: il profilo sta nella barra laterale.
- **Saldo e flusso**: la **stessa card di vetro**, con il saldo a sinistra e
  il flusso con le sue parti a destra, separati da una linea verticale.
- **Movimenti recenti** a sinistra (circa tre quinti); a destra **Messi da
  parte** e sotto **Analisi**,
  allineate in alto.
- **Primi passi**, quando c'è, a tutta larghezza in cima, con i quattro passi
  come elenco a sinistra e il passo successivo a destra (come oggi).
- Contenuto largo al massimo 1070 px, centrato nello spazio a destra della
  barra; margini della v2 §7.

## 4. I dati del mockup

Coerenti fra loro: il flusso deve tornare con le card, e il saldo con i conti.
Novembre 2026, oggi è il 24.

**Conti** (3 attivi): Conto corrente € 3.214,60 · Contanti € 85,00 · Conto
risparmio € 6.400,00 → **Saldo € 9.699,60**.

**Il mese**:

| | importo |
|---|---|
| Entrate (stipendio 1.950,00 + rimborso 200,00) | € 2.150,00 |
| Spese | € 742,35 |
| Abbonamenti (non hanno una card: stanno nel flusso) | € 63,97 |
| **Flusso** = 2.150,00 − 742,35 − 63,97 | **+ € 1.343,68** |
| Investimenti | € 300,00 |
| Risparmi | € 150,00 |

**Obiettivi**: Viaggio in Giappone € 1.200 di € 3.000 · Fondo emergenza
€ 2.500 di € 5.000 → **46%**.

**Flusso degli ultimi sei mesi** (giu → nov): 1.120 · 980 · 410 · 1.260 ·
870 · 1.344 (euro, arrotondati per le barre).

**Movimenti recenti**, tutti i conti:

| gruppo | categoria | sottotitolo | importo |
|---|---|---|---|
| Oggi | Alimentari | Spesa della settimana | − € 42,80 |
| Oggi | Ristoranti | Pranzo con Marta | − € 18,50 |
| Ieri | Conto corrente → Conto risparmio | (una riga sola) | € 200,00 |
| Ieri | Trasporti | Contanti | − € 2,20 |
| 22 novembre | Abbonamenti | Spotify | − € 11,99 |

Il trasferimento non ha segno e non ha colore. La spesa di «Trasporti» non ha
nota, quindi il sottotitolo è il conto. Una delle righe (Alimentari) ha la
graffetta.

## 5. Le tavole da consegnare

| # | larghezza | tema | stato |
|---|---|---|---|
| 1 | telefono 414 | chiaro | tutti i conti, i dati qui sopra |
| 2 | telefono 414 | scuro (*sumi*, D2) | come la 1 |
| 3 | telefono 414 | chiaro | un conto scelto: «Conto corrente» nel chip con il suo pallino; l'etichetta diventa «Saldo · Conto corrente»; Risparmi senza percentuale (gli obiettivi non appartengono a un conto) |
| 4 | telefono 414 | chiaro | spiegazione aperta sotto «Saldo» (D5): «Somma dei saldi dei conti attivi. Quelli archiviati restano fuori.» Il flusso non ne ha bisogno: le sue parti stanno sotto il totale (D14) |
| 5 | telefono 414 | scuro | importi nascosti dall'occhio |
| 6 | telefono 414 | chiaro | account nuovo: Primi passi «1 su 4» con il passo «Registra il primo movimento», un conto solo con saldo iniziale € 1.500,00, flusso, sue parti e «Messi da parte» a zero, lista vuota: «Ancora nessun movimento» e il bottone secondario «Nuovo movimento» |
| 7 | computer 1440 | chiaro | come la 1 |
| 8 | computer 1440 | scuro | come la 1 |
| 9 | telefono 414 | chiaro | caricamento: lo scheletro con le stesse forme della tavola 1, blocchi pieni nel tono della pietra, senza luccichio |

## 6. Da controllare guardando le tavole

- Il saldo e il flusso si leggono in un secondo, senza scorrere e senza toccare.
- Una sola cosa piena nell'inchiostro principale per schermata: il «+» (o
  «Nuovo movimento» sul computer).
- Nessun testo sotto i 12, nessun maiuscolo spaziato, nessun comando colorato.
- Una sola superficie di vetro; i gruppi sono pietra piatta, senza ombra.
- Nessuna icona dentro un quadratino colorato.
- Le voci che sono porte (le parti del flusso, le righe di «Messi da parte»)
  sembrano toccabili.
- Il tema scuro è la stessa app: la tavola 2 accanto alla 1 deve sembrare la
  stessa carta con la luce spenta.
- Sul computer non resta un buco: la colonna di destra (Messi da parte e
  Analisi) è alta quanto basta, non quanto la lista.

## 7. Cosa resta fuori

- Il pannello del coach, il pannello delle notifiche e il menu del profilo:
  si aprono dalla home ma non fanno parte di questa scheda.
- Il modale «Nuovo movimento»: ha la sua scheda.
- Il movimento delle animazioni (Fase 29).
