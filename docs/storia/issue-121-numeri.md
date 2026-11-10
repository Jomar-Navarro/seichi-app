# #121 — letture troncate, senza categoria, confronti

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Numeri che mentivano: letture troncate, senza categoria, confronti (issue #121)

Dalla review completa del 2026-09-28 (#128). Nessuna migration. Numeri
sbagliati, o testi accanto ai numeri che affermavano il falso.

- ⚠️⚠️ **La classe "letture troncate a 1000 righe" NON era chiusa "per tutti i
  periodi"**, come diceva la 23b: era stata convertita la sola
  `getAnalyticsData`. `getBudgetOverview`, `getGoals` e `getInvestments`
  leggevano senza paginazione e senza `order`: con un budget annuale il globale
  perdeva spese a caso (barra verde su un limite sforato, coach tranquillo), e
  `/investimenti` perdeva le righe più vecchie — un estratto Trade Republic ne
  aggiunge centinaia. Ora passano tutte da `readAll()` (`lib/read-all.ts`),
  ordinate per `id`. **Una correzione dichiarata "per tutti" va verificata su
  tutti i chiamanti, non sul primo.**
- ⚠️ **I movimenti senza categoria sparivano da due totali** che altrove li
  contano: il donut delle spese di `/analisi` (la torta sommava meno della card
  Uscite) e `/investimenti` (un import senza categorie dava "Investimenti € 300"
  in home e "Nessun investimento ancora" lì). Ora una fetta e una posizione
  **"Senza categoria"** (`t.common.uncategorized`) — mai sparire da un totale
  che un'altra schermata include.
- ⚠️ **Il confronto col periodo precedente mentiva nei periodi in corso.** Il 2
  del mese, con l'affitto già uscito e lo stipendio non ancora arrivato,
  `/analisi` mostrava "↓ 139%" in rosso: un mese appena iniziato accanto a uno
  intero. **Deciso con Jomar il 2026-10-01: parità di giorni.** Mese e anno si
  confrontano sullo stesso tratto — dal 1° a oggi contro dal 1° allo stesso
  giorno del periodo prima, fermato alla sua fine (il 31 marzo contro tutto
  febbraio) — la frase accanto lo dice ("rispetto allo stesso periodo del mese
  scorso"), e il colore è **neutro**: a parità di giorni resta un'indicazione,
  non un giudizio. La settimana resta colorata, perché sono già due finestre
  intere. Stessa cosa su `/investimenti`. Il coach non cambia: la sua frase
  dichiarava già l'asimmetria (24b), e la scelta là era stata un'altra.
- **"Uscite fisse"** su `/analisi` ora si chiama "Uscite fisse di questo mese"
  (la card vive sotto tab di altri periodi) e, con un conto selezionato, dice
  "Su tutti i conti".

I bassi: "— primo mese" compare solo sul tab Mese e solo se prima non c'è
**alcun** movimento (una query, con lo stesso filtro conto — prima bastava un
flusso precedente pari a zero, e nel 2026 ogni utente lo leggeva sul tab Anno);
il budget confrontava `transactions.date` e i confini come **stringhe**, e
`2026-10-01T00:00:00` è "minore" di `2026-10-01T00:00:00.000Z` pur essendo lo
stesso istante — con fuso UTC+0 ogni spesa del primo giorno restava fuori
(`dbInstant()` in `lib/dates.ts`); il coach scriveva "ti restano € -45,00"
quando le uscite fisse superano entrate non nulle (terzo ramo,
`availableShort`); "N posizioni attive" contava le liquidate; un obiettivo
completato diceva "Raggiunto · <scadenza>", ora la data del versamento che ha
superato il target (`reached_at`, calcolata in `getGoals`). E, visto guardando
lo scatto: la variazione di `/investimenti` scriveva "↓ -33.3%", freccia e
segno insieme e il punto decimale anche in italiano.

Collaudo del 2026-10-01 nell'app vera, su un account di prova usa e getta
(autorizzato da Jomar, eliminato alla fine): dati costruiti perché ogni difetto
desse un numero diverso — 24 controlli su 24, fra cui **home == `/analisi` sul
Flusso** (−130), le 20 letture **identiche a blocchi da 5 e da 500**, e il
budget in un browser in **fuso UTC** (135 contro i 130 del codice vecchio).
**Controprova** col codice di master, stessi dati: variazione −117% col mese
intero invece di −333% a parità di giorni, nessuna fetta "Senza categoria",
"— primo mese" sul tab Anno, capitale versato 390 invece di 490, variazione
investimenti −100%, "3 posizioni attive", "Raggiunto · dic 2026", e il coach
"ti restano € -45,00".

#### Emerso dal code-review della PR #136 (14 rilievi, 11 applicati)

- ⚠️⚠️ **"Fino a oggi" non è il tratto che il Flusso copre.** Il form accetta
  date future: con lo stipendio già registrato al 27, il KPI lo comprende, e il
  primo confronto — fermato a oggi — metteva accanto a "+ € 20" un "↓ 333%"
  calcolato senza di lui. Una percentuale che descrive un altro numero. Ora il
  tratto arriva all'**ultimo giorno con un movimento** se è oltre oggi, e il
  confronto è sempre fatto sul numero che gli sta accanto. Attenua anche
  l'orologio del server in UTC: un movimento registrato oggi porta il proprio
  giorno. **La regola: un numero di confronto si calcola sullo stesso insieme
  del numero che affianca, non su un insieme vicino.**
- **Il confine "stesso giorno, fermato alla fine del mese"** era scritto a mano
  tre volte, e la versione dell'anno non era fermata: il 29 febbraio di un
  bisestile confrontava fino al 2 marzo dell'anno prima. Ora è
  `endOfDayInMonth()` in `lib/dates.ts`.
- **"— primo mese" faceva cadere `/analisi`** — e il report — se la sua query
  falliva: ora degrada a "non dirlo", e non interroga il database se le righe
  già lette mostrano un movimento prima del mese.
- ⚠️ **I residui in virgola mobile.** 100,10 + 200,20 − 300,30 fa −5,7e-14: la
  posizione mostrava "€ -0,00" e la nota "hai liquidato più di quanto versato";
  e lo stesso residuo come denominatore della variazione passava il `> 0`. Ora
  totali e contributi sono al centesimo — con `|| 0`, perché arrotondare un
  residuo negativo dà `-0` e `Intl` lo scrive "-0,00". Il coach confronta il
  disponibile al centesimo. Lo stesso per le tipologie nell'intestazione, che
  ora contano solo quelle con capitale.
- Il donut aggrega per **id** di categoria, non per nome: una categoria
  chiamata davvero "Senza categoria" si fondeva con i movimenti che non ne
  hanno. `getGoals` ordina per data solo gli obiettivi completati, e un ramo
  irraggiungibile (`reachedNoDate`) è stato tolto.

Non applicati: la lettura fallita di `/investimenti` mostrata come "nessun
investimento" è già nella #124; e la data di "Raggiunto" ricavata con
`slice(0, 10)` resta così, perché è il giorno che la lista mostra per lo
stesso versamento — il caso al confine della mezzanotte è il debito dichiarato
di `transactions.date`, non di questa sezione.

Secondo collaudo, su un altro account usa e getta: 15 controlli su 15, con
un'entrata datata al 12 (Flusso +20, variazione ↑167% sul tratto 1-12 — la
prima versione della PR metteva ↓333%) e la posizione 100,10 + 200,20 − 300,30
a zero, senza nota. Le 22 letture identiche a blocchi da 5 e da 500.

