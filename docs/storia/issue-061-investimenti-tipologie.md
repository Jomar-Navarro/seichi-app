# #61, #56, #55 — tipologie degli investimenti e indici

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Investimenti — la tipologia contata e mai mostrata (#61 + #56), e i tre indici (#55)

Chiuse insieme il 2026-08-25, e insieme **di proposito**: #56 e #61 sono lo stesso
difetto visto da due lati. Nessuna decisione nuova sullo schema; la #55 è una
migration di soli indici (`20260819_fk_indexes.sql`).

#### ⚠️ Un dato per-riga schiacciato in un posto solo

`getInvestments()` calcolava `byType` **per intero** — etichetta, colore, totale,
percentuale, col denominatore separato che la 21b aveva introdotto apposta — e
`InvestimentiTab` ne usava **soltanto `.length`**, per scrivere «N tipologie».
L'app conosceva la ripartizione, **la contava ad alta voce e poi la buttava via**.

La radice è nella Fase 21: la decisione dell'import è per **GRUPPO** mentre
`investment_type` sta sulla **RIGA**, perché il file di Trade Republic distingue
l'asset movimento per movimento. Quindi una categoria sola contiene davvero asset
diversi — e la pagina aveva un solo posto dove dirlo, il badge, che finiva per
descrivere la prima riga d'acquisto invece dell'insieme (#56: la card "ETF"
dichiarava "Crypto").

⚠️ **E la partizione buttata era proprio quella informativa dopo un import**: le
posizioni tendono a una voce sola, quindi la vista per categoria collassa
esattamente quando l'altra diventa interessante.

Chiuse così: `catMap` raccoglie un **insieme** di tipologie per posizione; il
badge compare solo quando ne esiste una sola; e una sezione **«Per tipologia»**
sotto le posizioni mostra `byType` per intero. Niente secondo donut — una fetta
al 100% non è una composizione, e il problema non era il numero di fette.

Verificato sui dati veri, filtrando su Trade Republic: «1 posizione · 3
tipologie», nessun badge sulla card mista, e sotto ETF € 2.549,00 · Azioni
€ 643,85 · Crypto € 385,65 — che sommano esattamente al capitale versato.

#### Emerso dal code-review — 4 rilievi, tutti applicati

- ⚠️⚠️ **I pallini della sezione nuova erano INVISIBILI.**
  `INVESTMENT_TYPE_COLOR` contiene **nomi di token** (`"ao"`, `"kin"`), non colori
  CSS: `background: ao` è una dichiarazione invalida, e il pallino semplicemente
  non si disegna. È la famiglia di difetti che questo progetto insegue dalla Fase
  18 — *una variabile CSS inesistente non fa rumore* — **in una veste che
  `audit:tokens` NON copre**: lo script confronta le `var(--…)` scritte e le
  classi Tailwind generate, e qui non c'era né l'una né l'altra. Vale come limite
  dichiarato dello script, non come sua colpa.
- ⚠️ ***Sconosciuta* non è *diversa*.** Il ripiego `"altro"` entrava
  nell'insieme, e siccome il `TransactionForm` non scrive mai `investment_type`
  (lo fa solo l'import), bastava **un movimento aggiunto a mano** a una posizione
  importata tutta ETF perché `typeCount` diventasse 2: il badge corretto sarebbe
  sparito e sarebbe comparsa una riga "Altro" che descrive un dato mancante, non
  un asset. Era l'istinto della vecchia guardia *"solo un acquisto fissa la
  tipologia"*, conservato senza il difetto che aveva.
- **La JSDoc descriveva ancora la guardia cancellata**, e si leggeva come un
  invito a rimetterla — cioè a riaprire la #56.
- **La controprova commentata della migration testava la cosa sbagliata**:
  `indexdef !~ '\((col)\)'` verifica che l'indice sia a colonna **singola**, non
  che cominci con quella colonna — un legittimo `(user_id, active)` sarebbe
  risultato sbagliato. Tolta: il controllo posizionale su `pg_index.indkey[0]`
  c'era già ed è quello giusto.

⚠️ E il driver ha sbagliato una volta: cercava il conto con `/^Trade Republic$/`,
ma il bottone contiene nome, tipo e saldo **concatenati**
(`"Trade RepublicConto€ 864,33"`). È la trappola che lo skill documenta per le
righe conto, ripresentata su un altro componente.

