# Scheda — il pannello del movimento

> Fase 30 (#225), passo 3. Si incolla in Claude Design **dopo**
> `docs/design/zen-glass-v2.md`, che ha la precedenza su tutto ciò che qui non
> è detto. I rimandi «v2 §n» e «Dn» puntano a quel file. Il riferimento visivo
> è la home approvata (A2) e Movimenti.
> Il contenuto descritto è quello dell'app di oggi (2026-11-24); le differenze
> volute sono segnate **[cambia]**, e quelle che cambiano cosa fa l'app, non
> solo come appare, **[cambia cosa fa]**: si confermano guardando il mockup.

---

## 1. A cosa serve

È il gesto più frequente dell'app: **registrare un movimento in pochi
secondi**, spesso in piedi alla cassa. Il secondo uso è **correggerne uno**
toccato in una lista. Le due cose hanno ritmi diversi:

- **registrare** va dall'ignoto al noto: che tipo, quanto, poi il resto;
- **correggere** parte da un movimento intero, e quasi sempre si cambia la
  categoria, la data o la nota, raramente l'importo.

Il pannello si apre dal «+» (barra in basso o «Nuovo movimento» sul computer)
e da ogni riga di movimento.

## 2. La forma

- **Sul telefono** un pannello dal basso alto quasi quanto lo schermo, con la
  maniglia in cima; **sul computer** un dialogo centrato largo 560, sopra la
  pagina velata (v2 §8, pannelli).
- È **vetro** (v2 §3): galleggia sopra la pagina. Raggio 28 in alto sul
  telefono, 28 tutto intorno sul computer.
- In alto a sinistra il titolo («Nuovo movimento» o «Modifica movimento»), in
  alto a destra la chiusura (44, icona sola, senza fondo). Dal secondo passo,
  prima del titolo, la freccia indietro.
- **Il bottone principale sta in fondo**, fisso, sopra la safe area: uno solo
  per passo (v2 §8).

## 3. Passo 1, il tipo (solo per un movimento nuovo)

**[cambia]** Oggi sono sette card alte 180 px in una griglia 2×2, metà vuote,
ognuna con una freccia nell'angolo anche se tutta la card è il bottone
(ricognizione D2). Diventano **una lista di sette righe in tre gruppi**, con
gli stessi nomi della home:

| gruppo | righe |
|---|---|
| **Nel flusso** | Spesa · Entrata · Abbonamento |
| **Messi da parte** | Risparmio · Investimento · Disinvestimento |
| **Fra i tuoi conti** | Trasferimento |

- I gruppi dicono una cosa vera: i primi tre cambiano il flusso del mese (la
  card di vetro della home), i secondi tre sono «Messi da parte», l'ultimo
  sposta denaro e basta. Sono gruppi di pietra piatta (D12) con il titolo di
  sezione da 14 in testo secondario.
- **Una riga**: l'icona del tipo a 22 nel suo colore, senza pastiglia (D13); il
  nome a 16/500; sotto, una frase da 14 in testo secondario («Acquisti di ogni
  giorno», «Stipendio, rimborsi, regali», «Pagamenti che si ripetono», «Verso
  un obiettivo», «Mercati, fondi, portafoglio», «Vendi: il capitale torna sul
  conto», «Da un tuo conto a un altro»). Nessuna freccia.
- **[cambia]** Due nomi: «Uscita» diventa **«Spesa»**, perché il glossario
  chiama «uscite» spese e abbonamenti insieme e questa è solo la spesa;
  «Ricorrente» diventa **«Abbonamento»**, perché la ricorrenza è l'interruttore
  «Ripeti» del passo 3 e vale per ogni tipo.
- Il titolo del passo: «Nuovo movimento», e sotto, in testo secondario, «Che
  tipo di movimento vuoi registrare?».

## 4. Passo 2, l'importo

- Sopra il titolo il nome del tipo scelto, 12/500, nell'inchiostro del tipo
  («Spesa»): l'unico punto di colore del passo.
- **La cifra** al centro, grande e piena come oggi: **76/80 a 700**, con «€» a
  36 in testo secondario e i centesimi a 44. È l'unica eccezione alla scala della v2 (§4), decisa
  da Jomar guardando i mockup.
- **Importi rapidi**: chip da 36 su una riga (€ 5, € 10, € 20, € 50, € 100);
  toccarne uno somma all'importo.
- **Il tastierino**: dodici tasti in una griglia 3×4 (1-9, la virgola, 0, la
  cancellazione). **[cambia]** Oggi ogni tasto è una card con il suo anello:
  dodici superfici. Diventano **tasti senza fondo**, cifre a 28/400, alti 64,
  con il riscontro al tocco (un fondo di pietra che compare e sparisce). La
  griglia si legge da sola.
- In fondo il bottone principale **«Continua»**, spento finché l'importo è zero.
- Sul computer si scrive anche dalla tastiera (già oggi).

## 5. Passo 3, i dettagli

In cima, **il riepilogo**, centrato: tipo (12/500, inchiostro) e sotto
l'importo (**56/62 a 700**, «€» a 28 in testo secondario, centesimi a 32: la
stessa cifra del passo 2, appena più piccola). Toccare l'importo riporta al passo 2.

I campi (v2 §8: alti 52, testo da 16, etichetta da 14 sopra, raggio 16), in
quest'ordine:

1. **Categoria**, solo quelle del tipo scelto. Per un trasferimento non c'è: al
   suo posto **Conto di partenza** e **Conto di arrivo**.
2. **Conto** (non per un trasferimento).
3. Solo per risparmio e investimento: **Sposta su un conto**, facoltativo
   («Nessuno» di default), con sotto la frase in testo secondario «Il denaro si
   sposta davvero su quel conto, e l'obiettivo avanza lo stesso.»
4. **Descrizione**, con «Es. Trenord, Esselunga…» come segnaposto; il contatore
   dei caratteri compare solo vicino al limite di 255.
5. **Data**, il selettore di data dell'app (non il calendario del browser).
6. **Ripeti**, una riga con l'interruttore. Acceso, sotto compare la frequenza:
   un selettore a tre voci (Ogni settimana, Ogni mese, Ogni anno).
   **[cambia]** Oggi sopra la riga c'è l'etichetta «Ricorrenti» per un solo
   interruttore: sparisce, la riga si spiega da sé.
7. **Ricevute**: una casella tratteggiata «Aggiungi ricevuta» (il tratteggio è un
   SVG, mai un bordo, v2 e #81) e le miniature di quelle allegate, ognuna con
   la sua «×». Sotto, in testo secondario: «JPG, PNG o WebP, massimo 2 MB».
   **[cambia]** Oggi l'etichetta «Ricevute» è in grassetto e le altre no: tutte
   le etichette hanno la stessa forma. Le ricevute non ci sono per un
   trasferimento né con Ripeti acceso (lo dice una frase al loro posto).

**In fondo**, fisso:

- **nuovo movimento**: il bottone principale «Salva movimento»; con Ripeti
  acceso, «Crea ricorrenza»;
- **modifica**: a sinistra l'azione di testo **«Elimina»** nell'inchiostro aka,
  a destra il bottone principale **«Salva modifiche»**;
- **conferma eliminazione** (dopo il primo tocco su Elimina, nello stesso
  posto): «Annulla» come bottone secondario e **«Elimina movimento»** come
  bottone pieno aka, testo `on-accent`. È l'unico bottone pieno rosso
  dell'app: eliminare un movimento non si annulla (v2 §6).

Un movimento generato da una ricorrenza mostra, sopra il fondo, l'azione di
testo «Modifica la ricorrenza» e la frase «Le modifiche alla ricorrenza valgono
per i prossimi movimenti: questo resta com'è.»

## 6. Correggere un movimento

**[cambia cosa fa]** Oggi toccare una riga apre il pannello **sul tastierino**,
e per correggere la categoria si attraversa l'importo (ricognizione B6). Si
apre invece **sul passo 3**, con il riepilogo in cima: l'importo resta a un
tocco, sul riepilogo. Il tipo di un movimento esistente non cambia (come oggi).

## 7. Gli stati

| stato | cosa si vede |
|---|---|
| **categorie e conti in arrivo** | il campo dice «Caricamento…» e non si apre; mai «Nessuna categoria» prima che la lettura sia arrivata (#150) |
| **nessun conto** | sopra il bottone spento, la frase aka «Serve un conto per registrare un movimento. Creane uno dalla pagina conti.» (testo di oggi) |
| **salvataggio in corso** | il bottone dice «Salvataggio…» ed è spento |
| **salvataggio fallito** | sopra il bottone, una frase nell'inchiostro aka con il motivo leggibile; il pannello resta aperto con tutto ciò che c'era |
| **ricorrenza salvata, movimento dovuto non generato** | sopra il bottone, la frase nell'inchiostro kin: «Ricorrenza salvata, ma il movimento già dovuto non è stato registrato. Ci riproviamo stanotte; se non riesce, riceverai una notifica.» |
| **ricevuta non allegata** | sotto la casella, la frase aka «Non è stato possibile allegare la ricevuta a questo movimento.» |

## 8. I dati del mockup

Gli stessi della home e di Movimenti, oggi lunedì 24 novembre 2026.

- **Nuovo**: Spesa, € 42,80, categoria Alimentari, Conto corrente, «Spesa della
  settimana», oggi.
- **Modifica**: lo stesso movimento, già salvato, con una ricevuta (una
  miniatura di scontrino).
- **Trasferimento**: € 200,00, da Conto corrente a Conto risparmio, ieri.
- **Risparmio**: € 150,00, Viaggio in Giappone, Conto corrente, spostato su
  Conto risparmio, 20 novembre.
- **Abbonamento con Ripeti**: € 11,99, Abbonamenti, Conto corrente, «Spotify»,
  Ogni mese, dal 22 novembre.

## 9. Le tavole da consegnare

Il telefono è 414 × 896, il pannello sopra la home velata. Il computer è
1440 × 900, il dialogo sopra Movimenti velata.

| # | larghezza | tema | stato |
|---|---|---|---|
| 1 | telefono | chiaro | passo 1, il tipo |
| 2 | telefono | chiaro | passo 2, Spesa, € 42,80 scritto |
| 3 | telefono | chiaro | passo 3, nuova spesa compilata, Ripeti spento, nessuna ricevuta |
| 4 | telefono | chiaro | modifica della stessa spesa, con la ricevuta: «Elimina» e «Salva modifiche» |
| 5 | telefono | chiaro | conferma eliminazione |
| 6 | telefono | chiaro | trasferimento, passo 3 |
| 7 | telefono | chiaro | risparmio spostato su un conto, con la frase sotto |
| 8 | telefono | chiaro | abbonamento con Ripeti acceso: frequenza, ricevute sostituite dalla frase, «Crea ricorrenza» |
| 9 | telefono | chiaro | salvataggio fallito |
| 10 | telefono | scuro | come la 4 |
| 11 | computer | chiaro | dialogo, passo 1 |
| 12 | computer | scuro | dialogo, modifica (come la 4) |

## 10. Da controllare guardando le tavole

- Un solo bottone pieno per passo; il rosso pieno solo nella conferma.
- Il passo 1 si legge come la home: «Nel flusso», «Messi da parte».
- Il tastierino non è una griglia di dodici card.
- Tutte le etichette dei campi hanno la stessa forma.
- Il fondo con il bottone resta visibile mentre il form scorre.
- Il pannello in scuro è la stessa carta con la luce spenta.

## 11. Cosa resta fuori

- Il visore a schermo intero di una ricevuta.
- Le tendine aperte (categoria, conto, data): si disegnano come il selettore del
  conto della home.
- Il movimento di apertura e chiusura del pannello (Fase 29).
