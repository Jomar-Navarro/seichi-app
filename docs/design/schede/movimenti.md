# Scheda — Movimenti

> Fase 30 (#225), passo 3. Si incolla in Claude Design **dopo**
> `docs/design/zen-glass-v2.md`, che ha la precedenza su tutto ciò che qui non
> è detto. I rimandi «v2 §n» e «Dn» puntano a quel file. Il riferimento visivo
> è la home approvata (A2, canvas «Seichi · Home (Fase 30)»): stessi materiali,
> stessa riga, stessi gruppi.
> Il contenuto descritto è quello dell'app di oggi (2026-11-24); le differenze
> volute sono segnate **[cambia]**, e quelle che cambiano cosa fa l'app, non
> solo come appare, **[cambia cosa fa]**: si confermano guardando il mockup.

---

## 1. A cosa serve

Movimenti è il registro: la pagina dove si cerca, si controlla e si corregge.
Si apre per tre ragioni, in quest'ordine di frequenza:

1. **Ritrovare un movimento** per controllarlo o correggerlo («quanto avevo
   pagato dal dentista?»).
2. **Guardare un pezzo di registro**: un periodo, un conto, un tipo, una
   categoria.
3. **Sapere come sta il budget** delle categorie che ne hanno uno.

Il gesto principale è **toccare una riga** per aprire il movimento. Il «+»
resta nella barra in basso, come in home.

## 2. Cosa c'è, dall'alto in basso (telefono, 414 px)

### Titolo

«Movimenti», titolo di pagina (28/600, v2 §4), a sinistra. Nessun comando a
destra: il «+» sta nella barra.

### Ricerca

Un campo della v2 §8: alto 52, testo da 16 (o iOS ingrandisce), la lente a
sinistra, «Cerca movimenti» come segnaposto, una «×» per svuotarlo quando c'è
del testo. Cerca nelle note e nei nomi delle categorie.

### Filtri

Quattro chip (v2 §8: alti 36, bersaglio 44, testo 14), ognuno apre la sua
tendina: **Periodo** («30 giorni», poi 7 giorni, 3 mesi, Tutto), **Conto**
(«Tutti i conti»), **Tipo** («Tutti i tipi»), **Categoria** («Tutte le
categorie»; elenca solo le categorie del tipo scelto).

- **[cambia]** Oggi vanno a capo su due righe e spingono giù il primo dato.
  Diventano **una riga sola che scorre in orizzontale** (v2 §8), con il margine
  di pagina a sinistra e a destra. Ordine: Periodo, Conto, Tipo, Categoria.
- **[cambia]** Un filtro diverso dal suo valore iniziale si riconosce: chip con
  il fondo di pietra più scuro (lo stesso della voce attiva della barra) e il
  testo a 500, e dentro il valore scelto («Spese», «Conto corrente»). Non è
  pieno nell'inchiostro: il pieno è solo il «+».
- **[cambia]** Con almeno un filtro attivo compare, in fondo alla riga dei chip,
  l'azione di testo «Azzera filtri».
- Il filtro del conto è lo stesso ricordato dalla home (il conto guardato): se
  in home è scelto «Conto corrente», qui il chip lo dice già.

### Budget

Compare solo se esiste almeno un budget.

**[cambia]** Oggi ha due forme: sul telefono tessere in un nastro che scorre,
sul computer righe dentro una card. Diventa **una forma sola**, a ogni
larghezza (v2 §2): un gruppo di pietra piatta (D12) con il titolo di sezione
«Budget» e, accanto, «questo mese» in testo secondario. Dentro, una riga per
budget:

- il nome («Spese variabili» per il budget globale, che sta sempre per primo,
  poi le categorie), a sinistra;
- a destra «€ 265 di € 300»;
- sotto, la **barra** della v2 §8 (D10), a tutta larghezza.

Gli stati della barra restano quelli di `budgetColor()` (`lib/budget.ts`):
**neutra** (kiri) a riposo, **kin dall'80%**, **aka oltre il 100%**, con il
testo «sforato di € 11,50» al posto di «di € 120». La cifra spesa prende
l'inchiostro dello stesso stato (`budgetInk()`), mai l'accento. Il tempo («questo mese», «questa settimana») è scritto sulla
riga quando un budget ha un periodo diverso da quello del titolo.

Con più di tre budget se ne vedono tre, e un'azione di testo «Mostra tutti i
budget» apre il resto nello stesso gruppo.

Con un conto scelto nel filtro, sotto il titolo una riga di testo secondario
dice «su tutti i conti»: il budget non appartiene a un conto, e la pagina lo
dichiara (CLAUDE.md, «un numero mostrato in due posti»).

### La lista

È **la stessa lista della home** (D3), più lunga.

- Un gruppo di pietra piatta (D12) con dentro i giorni: il titolo del giorno
  («Oggi», «Ieri», «22 novembre», da 12/500 in testo secondario) e sotto le
  sue righe, divise da una linea sottile.
  **[cambia]** Oggi ogni movimento è una card con la sua ombra.
  **[cambia]** Oggi sul computer il giorno è in maiuscolo spaziato («OGGI»):
  diventa come sul telefono.
- **La riga** (v2 §8, D9, D13):
  - l'icona della categoria a 22, al tratto, nel colore del tipo, **senza
    pastiglia**; per un trasferimento le due frecce, nel neutro;
  - il titolo: la categoria; per un trasferimento «Conto corrente → Conto
    risparmio»;
  - il sottotitolo: la nota. **[cambia]** Senza nota, oggi c'è il nome del tipo
    («Uscite»); diventa il conto quando la lista mostra tutti i conti, e
    altrimenti la riga ha una linea sola. Un risparmio o un investimento
    spostato su un conto aggiunge «→ Conto risparmio» dopo la nota (o da solo,
    senza nota);
  - la graffetta accanto al titolo se c'è una ricevuta;
  - a destra l'importo, in cifre tabellari, nell'inchiostro del tipo, con il
    segno: «+» per entrate e disinvestimenti, «−» per ciò che esce, nessun
    segno per un trasferimento su tutti i conti. Con un conto scelto, un
    trasferimento prende il segno dal punto di vista di quel conto.
- **[cambia]** Sul computer oggi le entrate hanno un velo verde: sparisce. Il
  tipo lo dicono l'icona, il colore dell'importo e il segno, come sul telefono.
- Ogni riga apre il movimento (il pannello ha la sua scheda).

### In fondo alla lista

- **«Carica altri»**: un bottone secondario (v2 §8) a tutta larghezza, che
  diventa «Caricamento…» mentre legge.
- Con una ricerca attiva, sotto la lista una riga di testo secondario: «La
  ricerca ha guardato i 500 movimenti più recenti del periodo. Restringi il
  periodo per cercare più indietro.»

### Barra in basso

Quella della home, con **Movimenti** attiva.

## 3. Gli stati

| stato | cosa si vede |
|---|---|
| **caricamento** | lo scheletro: titolo, campo, chip e un gruppo con righe vuote, nelle forme vere |
| **errore di lettura** | al posto della lista, la frase «Non è stato possibile caricare i movimenti.» e il bottone secondario «Riprova» (CLAUDE.md: una lettura fallita non è uno stato vuoto) |
| **aggiornamento fallito** | la lista di prima resta, e sopra una riga d'avviso nell'inchiostro aka: «Non è stato possibile aggiornare la lista: quella a schermo potrebbe non essere attuale.», con «Riprova» a destra |
| **nessun movimento** | dentro il gruppo, «Ancora nessun movimento» e sotto «Le tue entrate e uscite compariranno qui dal primo movimento.»; il bottone secondario «Nuovo movimento» e l'azione di testo «Importa un estratto conto». **[cambia]** Oggi il titolo dice «Nessuna transazione ancora» (D4) |
| **nessun risultato con i filtri** | «Nessun movimento con questi filtri» e «Prova ad allargare il periodo, o a scegliere un altro conto o tipo.», con il bottone secondario «Azzera filtri» |

## 4. Sul computer (1440 px)

Stessi pezzi, più colonne (v2 §2).

- **Barra laterale** della home, con **Movimenti** attiva.
- **Due colonne**, allineate in alto, nel contenitore largo al massimo 1070:
  - **a sinistra** (circa due terzi): titolo, ricerca e la lista. Righe larghe
    così si leggono ancora: titolo e importo restano vicini;
  - **a destra** (circa un terzo): **i filtri**, uno sotto l'altro come righe
    di un gruppo di pietra piatta («Periodo · 30 giorni» con la freccia della
    tendina) e «Azzera filtri» in fondo; sotto, il gruppo **Budget**.
- **[cambia cosa fa]** Sul computer i filtri passano dalla riga di chip a una
  colonna fissa: si vedono tutti insieme, con il valore scelto, mentre la lista
  scorre. Sono gli stessi quattro e aprono le stesse tendine.

## 5. I dati del mockup

Gli stessi della home: novembre 2026, oggi è il 24, tre conti (Conto
corrente, Contanti, Conto risparmio). Filtri: **30 giorni, tutti i conti**.

**Budget**, questo mese:

| budget | speso | limite | stato |
|---|---|---|---|
| Spese variabili | € 742,35 | € 1.200 | 62%, normale |
| Alimentari | € 265,40 | € 300 | 88%, ambra |
| Ristoranti | € 131,50 | € 120 | sforato di € 11,50 |

**Movimenti** (i primi quattordici; la lista continua con «Carica altri»):

| giorno | categoria | sottotitolo | importo |
|---|---|---|---|
| Oggi | Alimentari (con ricevuta) | Spesa della settimana | − € 42,80 |
| Oggi | Ristoranti | Pranzo con Marta | − € 18,50 |
| Ieri | Conto corrente → Conto risparmio | (una riga sola) | € 200,00 |
| Ieri | Trasporti | Contanti | − € 2,20 |
| 22 novembre | Abbonamenti | Spotify | − € 11,99 |
| 21 novembre | ETF (investimento) | PAC mensile | − € 300,00 |
| 20 novembre | Viaggio in Giappone (risparmio) | → Conto risparmio | − € 150,00 |
| 18 novembre | Rimborsi | Spese mediche | + € 200,00 |
| 16 novembre | Alimentari | Mercato del sabato | − € 38,60 |
| 15 novembre | Abbonamenti | Palestra | − € 39,00 |
| 12 novembre | Ristoranti | Cena di compleanno | − € 64,00 |
| 9 novembre | Alimentari | Conto corrente (senza nota) | − € 78,30 |
| 5 novembre | Abbonamenti | iCloud | − € 2,99 |
| 3 novembre | Stipendio | Novembre | + € 1.950,00 |

Le entrate del mese tornano con la home: 1.950,00 + 200,00 = 2.150,00.

## 6. Le tavole da consegnare

| # | larghezza | tema | stato |
|---|---|---|---|
| 1 | telefono 414 | chiaro | i dati qui sopra |
| 2 | telefono 414 | scuro (*sumi*, D2) | come la 1 |
| 3 | telefono 414 | chiaro | filtri attivi: Conto «Conto corrente» e Tipo «Spese», «Azzera filtri» visibile; il budget con «su tutti i conti»; nella lista solo le spese di quel conto, senza la riga in contanti |
| 4 | telefono 414 | chiaro | ricerca «ristor»: le tre righe di Ristoranti del periodo (18,50 di oggi, 64,00 del 12 novembre e 49,00 del 2 novembre, «Pizza con i colleghi»: insieme fanno i 131,50 del budget), la nota sul limite della ricerca in fondo |
| 5 | telefono 414 | chiaro | nessun risultato con i filtri (Periodo «7 giorni», Tipo «Disinvestimenti») |
| 6 | telefono 414 | chiaro | account nuovo: nessun movimento, nessun budget |
| 7 | telefono 414 | chiaro | errore di lettura |
| 8 | computer 1440 | chiaro | come la 1, filtri e budget nella colonna di destra |
| 9 | computer 1440 | scuro | come la 8 |
| 10 | telefono 414 | chiaro | caricamento |

## 7. Da controllare guardando le tavole

- La lista è la stessa della home: stessa riga, stesso gruppo, stessi titoli
  dei giorni.
- Il primo movimento si vede senza scorrere, anche con il budget.
- I chip stanno su una riga; un filtro attivo si distingue da uno a riposo
  senza diventare un bottone pieno.
- Il budget ha una forma sola, uguale sul telefono e sul computer.
- Nessuna icona dentro un quadratino, nessuna card per riga, nessun maiuscolo
  spaziato.
- Gli stati vuoti non si confondono con l'errore.

## 8. Cosa resta fuori

- Il pannello del movimento (apertura, modifica, ricevute): ha la sua scheda.
- Le tendine dei filtri aperte: si disegnano come il selettore del conto della
  home.
- Il movimento delle animazioni (Fase 29).
- Nel codice, non nel disegno: i filtri scritti nell'URL, perché un link o il
  tasto indietro ritrovino la stessa vista (linee guida web). Oggi l'URL tiene
  solo il conto.
