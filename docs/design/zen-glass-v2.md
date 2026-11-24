# Zen Glass v2 — i principi

> **Bozza** della Fase 30 (#225), passo 2: la direzione. Sostituisce le sezioni
> 0 e 0c del prompt originale, conservato in `docs/storia/zen-glass-origine.md`.
> Si incolla in Claude Design prima di ogni scheda di schermata.
> Le undici scelte che erano aperte sono decise (2026-11-24): Jomar ha chiesto
> di sceglierle guidati dalla filosofia del progetto, e il perché di ognuna è in
> fondo, sotto «Le decisioni». I mockup possono ancora smentirle: si cambia una
> decisione scrivendo perché, non disegnando diversamente.
> A fase chiusa, ciò che resta diventa `.claude/rules/stili.md`.

---

## 1. Che cos'è Seichi

整地, *seichi*, è il lavoro che si fa su un terreno prima di costruirci: si
toglie ciò che ingombra, si livella, si tracciano i confini. L'app fa la stessa
cosa con i soldi di una persona. Non consiglia, non prevede, non gioca:
registra, somma e mostra.

Chi la usa la apre più volte al giorno, spesso in piedi, con una mano, per
scrivere una spesa o guardare un numero. Due conseguenze guidano tutto il resto:

- **un numero si legge in un secondo**: niente lo copre, lo anima o lo
  circonda di rumore;
- **la calma viene dall'ordine, non dal vuoto**: una schermata calma è una in
  cui ogni cosa sta sempre nello stesso posto e ha sempre la stessa forma.

Non è un'app di trading, di cripto o una banca. Non ha l'aria da cruscotto.

## 2. La tesi: progettata, non generata

Un'interfaccia sembra generata quando ogni schermata è bella da sola e nessuna
somiglia all'altra. Sembra progettata quando le stesse poche decisioni si
ripetono ovunque. Quindi:

- **una cosa, una forma**: un bottone principale, una riga di lista, un modo di
  intitolare una sezione. Una seconda variante si giustifica per iscritto, o non
  esiste;
- **la stessa forma a ogni larghezza**: il computer aggiunge colonne, non
  varianti;
- **ogni elemento ha un lavoro**: se togliendolo non si perde un'informazione o
  un comando, si toglie.

## 3. Materiali

Tre materiali, ognuno con un ruolo:

| materiale | cos'è | dove |
|---|---|---|
| **carta** | il fondo, caldo e opaco | la pagina |
| **pietra** | una superficie piena e appena rialzata | le card, cioè gli oggetti |
| **vetro** | una superficie satinata che lascia intravedere | solo ciò che galleggia sopra la pagina: barra di navigazione, pannelli, modali, menu |

- **Tre livelli, mai sette card uguali** (D12). Quando ogni superficie ha lo
  stesso raggio e la stessa ombra niente spicca, ed è il segno più
  riconoscibile del design generato.
  - **Vetro**: la cosa più importante della schermata, una sola (in home,
    saldo e flusso). Più luminoso, raggio 28, un riflesso in alto e l'unica
    ombra della pagina.
  - **Pietra piatta**: i gruppi (una lista, «Messi da parte», Analisi). Solo un
    anello sottile, nessuna ombra, raggio 24.
  - **Nessuna superficie**: titoli di sezione e intestazioni stanno sul fondo.
- **Una superficie è un oggetto o un gruppo**, mai una sezione.
- **Ombre soffuse e calde**, mai nere: una per il vetro della pagina, una per
  ciò che galleggia (barra in basso, pannelli, menu).
- **Gli aloni che respirano solo dove l'app si presenta**: benvenuto, accesso,
  onboarding, sblocco. Dentro l'app il fondo è fermo (D8).

## 4. Tipografia

- **Geist, per tutto** (D1), applicato davvero: oggi il font caricato non arriva
  a schermo. Si verifica con `getComputedStyle`, non leggendo l'import. I due
  ideogrammi 整地 restano al font giapponese del sistema: da guardare nei mockup.
- **Sei misure, non una di più**:

  | ruolo | misura / interlinea | peso |
  |---|---|---|
  | cifra protagonista (il saldo) | 40 / 44 | 600 |
  | titolo di pagina | 28 / 34 | 600 |
  | titolo di sezione | 18 / 24 | 600 |
  | testo e righe di lista | 16 / 22 | 400 e 500 |
  | testo secondario | 14 / 20 | 400 |
  | didascalia | 12 / 16 | 500 |

  Niente mezzi pixel. Sul computer le misure non scendono: lo spazio in più va
  in colonne, non in testo più piccolo.
- **Un'eccezione sola: l'importo che si scrive** nel pannello del movimento,
  **76/80 a 700** sul tastierino e **56/62 a 700** nel riepilogo in cima ai
  dettagli, **centrato** in entrambi, con «€» a metà misura in testo
  secondario e **i centesimi più piccoli** della parte intera (44 sul
  tastierino, 32 nel riepilogo), nello stesso colore. Deciso da Jomar
  guardando i mockup (2026-11-24): è il numero che si sta registrando, l'unico
  momento in cui l'app parla a voce alta, e com'era prima «è più bello».
- **Tre pesi**: 400, 500, 600. Il 700 c'è solo per l'importo qui sopra.
- **Minuscolo di frase ovunque**, anche nei bottoni e nelle etichette:
  «Modifica», «Elimina», «Tema scuro». Niente maiuscolo spaziato: le etichette
  di sezione sono titoli di sezione.
- **La spaziatura fra le lettere** non si tocca, tranne un leggero stringimento
  sulle cifre protagoniste.
- **Le cifre sono tabellari** dove si incolonnano.

## 5. Numeri

- **Formattati sempre da `formatMoney()`**: valuta e decimali del profilo.
- **I centesimi si riducono solo sulla cifra protagonista**; altrove hanno la
  misura del resto.
- **Il segno dice la direzione**: «−» per ciò che esce, «+» per ciò che entra,
  nessun segno per un trasferimento.
- **Il colore dice il tipo**, nell'inchiostro del tipo. Un saldo è neutro, mai
  colorato.
- **Una variazione nulla non ha freccia**: «0%», non «↑ 0%».
- **Il confronto fra periodi sta in Analisi.** La home dice com'è il mese, non
  come va rispetto al precedente.

## 6. Colore

- **Neutri**: carta e pietra, con una punta di calore. Nessun grigio puro.
- **Cinque accenti, cinque significati**: midori entrate, aka spese, ao
  investimenti, kin risparmi, murasaki ricorrenti e abbonamenti. Un accento non
  decora: se compare, dice un tipo o uno stato.
- **Accento ≠ inchiostro**: l'accento per riempimenti, icone e grafici;
  l'inchiostro per il testo colorato; `on-accent` sopra un riempimento d'accento.
- **I comandi non sono colorati.** Link e azioni di testo sono nell'inchiostro
  principale, riconoscibili dalla forma (peso, freccia, posizione). Il colore
  resta per i significati.
- **Il rosso del pericolo** è solo per ciò che perde dati e non si annulla
  (eliminare l'account, un conto, un import). Uscire non è pericoloso.
- **Il tema scuro è inchiostro** (D2): *sumi*, la stessa carta con la luce
  spenta. Fondo bruno quasi nero, superfici di pietra scura, testo color carta;
  gli accenti sono gli stessi del chiaro, schiariti quanto basta per il
  contrasto, senza cambiare tinta (il verde resta salvia, non diventa menta).
  Valori indicativi, da fissare nel mockup misurando il contrasto: fondo
  `#1b1a18`, superficie `#24221f`, testo `#ece6da`, testo secondario `#a59d8e`.

## 7. Ritmo

- **Una scala di spaziature in multipli di 4**: 4, 8, 12, 16, 24, 32, 48.
- **Margine di pagina**: 20 sul telefono, 40 sul computer.
- **Fra una sezione e l'altra**: 32. Fra il titolo di sezione e il suo
  contenuto: 12.
- **Dentro una card**: 20 sul telefono, 24 sul computer.
- **Raggi, tre in tutto**: 24 per card, pannelli e modali; 12 per gli elementi
  interni (campi, icone, tasti); pieno per pastiglie e chip.
- **Bersagli di tocco** di almeno 44×44, anche quando il disegno è più piccolo.

## 8. I pezzi, uno per tipo

Ogni pezzo qui sotto esiste in una forma sola. Una schermata li compone; non ne
inventa.

- **Bottone principale**: pieno, nell'inchiostro principale (scuro sul chiaro,
  chiaro sullo scuro), testo nel colore della carta, raggio pieno, alto 52 sul
  telefono e 44 sul computer. **Uno per schermata al massimo.**
- **Bottone secondario**: pietra con anello, stesso raggio e stessa altezza.
- **Azione di testo**: testo da 14 o 16, peso 500, inchiostro principale,
  eventualmente con una freccia. Mai colorata, mai spaziata.
- **Lista** (D3): un foglio solo, cioè un gruppo di pietra piatta con le righe
  separate da una linea sottile, raggruppate per giorno sotto un titolo
  («Oggi», «Ieri», «22 novembre»). È la stessa lista in home, in Movimenti e
  nel dettaglio di un conto; in home è solo più corta.
- **Riga** (D9): l'icona della categoria a 22, al tratto, nel colore del tipo e
  **senza pastiglia dietro** (D13); a destra l'importo in cifre tabellari. Il titolo è la categoria (per un trasferimento,
  «Origine → Destinazione»). Il sottotitolo è la nota; senza nota, il nome del
  conto quando la lista mostra tutti i conti; altrimenti la riga ha una linea
  sola. Il giorno non si ripete: lo dice il gruppo.
- **Titolo di sezione**: 18/600 a sinistra, un'azione di testo facoltativa a
  destra sulla stessa linea.
- **Intestazione di pagina**: titolo di pagina a sinistra, al massimo un comando
  a destra. La freccia indietro solo nelle pagine di secondo livello.
- **Progresso** (D10): una barra orizzontale sottile, nell'accento del tipo,
  per obiettivi e budget. Sopra un traguardo la barra resta piena e lo dice il
  testo, non un colore più acceso.
- **Chip e filtri**: pastiglie da 36 di altezza (44 di bersaglio), testo da 14,
  su una riga che scorre in orizzontale invece di andare a capo.
- **Pannelli**: dal basso sul telefono, centrati sul computer; titolo in alto a
  sinistra, chiusura in alto a destra, il bottone principale in fondo.
- **Campi**: alti 52, testo da 16 (o iOS ingrandisce), etichetta sopra da 14.
  Lo stato (fuoco, errore) riscrive l'anello, non aggiunge un bordo.

## 9. Grafici

- **Un grafico c'è se si legge**: ha valori o una scala, o non c'è. Le linee
  senza scala nelle card della home si tolgono (D6).
- **Le categorie di un solo tipo stanno in un colore solo**: un arcobaleno
  inventerebbe una differenza di natura. Le sfumature però si distinguono:
  al massimo cinque gradini ben distanti, poi «Altro», e il nome accanto alla
  sua parte.
- **Entrate e uscite** sempre nei loro accenti, tratto sottile, griglia appena
  accennata.
- **Niente grafico per un numero solo**: un numero si scrive.

## 10. Navigazione

- **I nomi delle pagine** (D4): Home, **Movimenti**, Conti, Obiettivi,
  Investimenti, Analisi, Impostazioni. Lo stesso nome in navigazione, nel
  titolo della pagina e nei comandi («Nuovo movimento», «Importa movimenti»,
  «Movimenti ricorrenti»).
- **La barra in basso** (D11): Home, Movimenti, il «+», Conti, Obiettivi.
  Investimenti e Analisi si raggiungono dalle loro card in home: Analisi lo fa
  già, la card Investimenti oggi è solo un numero e deve diventare un link.
- **La barra laterale del computer** ha tutte le pagine, nello stesso ordine.
- **La voce attiva** si riconosce dal fondo, senza altri segni.

## 11. Parole

- **Il glossario di `CLAUDE.md` vale anche per l'interfaccia**, insieme ai nomi
  delle pagine della sezione 10.
- **Un comando dice cosa succede**: «Salva movimento», «Elimina il conto».
- **Niente doppioni**: un comando compare una volta per schermata; un dato una
  volta per schermata.
- **Le spiegazioni stanno dietro un tocco** (D5): l'etichetta di un numero è la
  parola del glossario («Saldo», «Flusso», «Disponibile»); toccandola si apre
  una frase sola che dice cosa contiene. Sotto il numero non c'è niente.
- **Niente precisazioni dopo un trattino lungo**, frasi corte, voce attiva,
  niente punti esclamativi, niente «Ops».

## 12. Movimento

Rimanda alla Fase 29 (#71), che viene dopo questa. Il principio che vale già:
si muove solo ciò che risponde a un gesto dell'utente, e i numeri non si
animano mai. Ogni animazione dichiara cosa fa con `prefers-reduced-motion`.

## 13. Il marchio

Il marchio è **l'ensō** (D7), disegnato come segno di Seichi e non preso da
una libreria. Compare dove l'app si presenta: icona della PWA, splash, accesso,
onboarding, sblocco, barra laterale. Il germoglio esce dall'app.

## 14. Cosa non fare

Ogni voce viene dalla ricognizione del 2026-11-24.

- Una linea di tendenza senza scala in un angolo della card.
- Una freccia «›» dentro una card che è già tutta un bottone.
- Un pallino accanto alla voce di navigazione già evidenziata.
- Lo stesso comando due volte nella stessa schermata («Nuovo conto» in alto e in
  fondo).
- Testo maiuscolo spaziato come etichetta; spaziatura su un link in minuscolo.
- Una misura di testo a mezzo pixel, o una sotto i 12.
- Un raggio fuori dai tre.
- Una card per ogni sezione, o una card per ogni riga.
- Lo stesso raggio e la stessa ombra su ogni superficie.
- Un'icona dentro un quadratino colorato.
- La griglia di riepiloghi 2×2 con icona, cifra ed etichetta: è il riquadro di
  ogni app finanziaria. I numeri che compongono un totale stanno accanto al
  totale.
- Un colore su un comando.
- Una precisazione dopo un trattino lungo sotto un numero.
- La stessa informazione in due forme fra telefono e computer (un anello qui,
  una barra là).
- Una pagina larga con una card in un angolo e il resto vuoto: le pagine con
  poco contenuto restano in una colonna di lettura.

---

## Le decisioni

Prese il 2026-11-24. Jomar le ha affidate alla filosofia: per ognuna vince
l'opzione più coerente con la sezione 1 (registra, somma e mostra; un numero in
un secondo; la calma viene dall'ordine; non un cruscotto).

| | domanda | scelta | perché, dalla filosofia | scartate |
|---|---|---|---|---|
| **D1** | Quale carattere? | **Geist**, una famiglia sola | Un carattere quieto: il carattere di Seichi viene dal ritmo e dalla misura, non da un titolo che alza la voce. È già nel progetto e ha cifre tabellari pulite | Inter: è il default di ogni app generata, cioè l'aspetto da cui la fase vuole uscire. Una coppia titolo + testo: una seconda voce dove la filosofia chiede silenzio |
| **D2** | Di che colore è il buio? | **Inchiostro caldo** (*sumi*) | La stessa carta con la luce spenta: un'app sola in due luci. Il blu notte è il colore dei cruscotti finanziari, cioè proprio ciò che Seichi dice di non essere | Il blu notte del prompt originale |
| **D3** | Quanto è densa una lista? | **Un foglio solo**, righe con divisori, gruppi per giorno | Un registro: è ciò che l'app è («registra»). Il doppio delle righe per schermata, e la card torna a voler dire «oggetto» | Una card con ombra per ogni movimento |
| **D4** | Come si chiamano? | **Movimenti** | È la parola dell'estratto conto, e comprende i trasferimenti, che non sono transazioni con qualcuno | Transazioni |
| **D5** | Dove vivono le spiegazioni? | **Dietro un tocco sull'etichetta** | Il numero si legge da solo; la spiegazione resta a portata senza ingombrare la decima apertura | Sotto ogni numero (oggi); solo per i nuovi utenti, che chiederebbe di sapere chi è «nuovo» |
| **D6** | Le linee nelle card della home? | **Tolte**, senza sostituto | Ogni elemento ha un lavoro, e la home «mostra» il mese. Il confronto con il mese scorso ha già una pagina, Analisi | Sostituirle con la variazione in cifre: era la mia prima proposta, ma aggiunge un secondo numero a ogni card proprio dove ne serve uno |
| **D7** | Quale marchio? | **L'ensō** | Un solo gesto, intenzionale, con lo spazio lasciato vuoto di proposito: è la filosofia in un segno. Jomar l'ha già scelto due volte (26b, 28e) | Il germoglio: un'icona di libreria che qualunque app può avere. Un segno nuovo: un lavoro da grafico, mentre l'ensō c'è già |
| **D8** | Gli aloni che respirano? | **Solo dove l'app si presenta** | Fuori dall'app sono atmosfera; dentro sono movimento senza un gesto, sotto numeri che devono stare fermi | Ovunque (oggi); da nessuna parte |
| **D9** | Cosa dice il sottotitolo di una riga? | **La nota**; senza nota il conto, se la lista è su tutti i conti | Una cosa, una forma: lo stesso sottotitolo in ogni lista. Il giorno lo dice già il gruppo | Tipo e giorno (home oggi): il tipo lo dicono già icona e colore |
| **D10** | Che forma ha un progresso? | **La barra** | Una linea orizzontale: il terreno livellato. Si allinea in una lista e regge un budget sforato | L'anello: occupa un quadrato, non si incolonna |
| **D11** | Conti nella navigazione? | **Sì**: Home, Movimenti, +, Conti, Obiettivi | Prima si vede dove sta il denaro, poi si decide cosa costruirci: Conti è il terreno stesso. Investimenti riguarda una parte del denaro, e come Analisi si apre dalla sua card in home (che quindi diventa un link) | Investimenti nella barra al posto di Conti (oggi); Conti solo sul computer |

D11 è l'unica che cambia dove stanno le cose, non solo come appaiono: va
guardata nel mockup della home prima di confermarla.

### Dai mockup della home (2026-11-24)

La prima versione dei mockup (A) piaceva a Jomar ma sapeva ancora di generato.
Indicati da lui i colpevoli, la A2 li toglie restando dentro Zen Glass; la A2
è approvata.

| | domanda | scelta | perché | scartate |
|---|---|---|---|---|
| **D12** | Che superfici ha una schermata? | **Tre livelli**: un vetro, gruppi di pietra piatta, nessuna superficie | La gerarchia la fa il materiale, non la ripetizione: una cosa spicca perché è l'unica di vetro | Sette card con lo stesso raggio e la stessa ombra (A) |
| **D13** | Come sta un'icona in una riga? | **Al tratto, nel colore del tipo, senza pastiglia** | Il colore dice già il tipo; il quadratino lo ripeteva nove volte per schermata | La pastiglia tinta da 40 (A) |
| **D14** | Dove stanno entrate, spese e abbonamenti in home? | **Dentro la card del flusso**, in riga, col loro segno; risparmi e investimenti nel gruppo «Messi da parte» | «Registra, somma e mostra»: le parti di un totale si leggono sotto il totale, e la spiegazione del flusso (D5) è già lì | La griglia 2×2 di riepiloghi (A) |

Provata e scartata, sempre il 2026-11-24: una direzione «registro» (carta
piatta, nessuna superficie, l'addizione incolonnata, righe da libro mastro).
Coerente con la filosofia scritta, ma senza il vetro e il calore che fanno
Seichi: Jomar l'ha bocciata senza appello. L'effetto generato si toglie
dentro Zen Glass, non buttandolo.
