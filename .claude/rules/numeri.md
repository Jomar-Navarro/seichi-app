---
paths:
  - "lib/totals.ts"
  - "lib/dates.ts"
  - "lib/amount.ts"
  - "lib/thousands.ts"
  - "lib/transaction-utils.ts"
  - "lib/budget.ts"
  - "lib/recurring.ts"
  - "lib/read-all.ts"
  - "lib/analytics.ts"
  - "app/**/action.ts"
  - "app/**/analisi/**"
  - "app/**/investimenti/**"
  - "app/**/risparmi/**"
  - "app/**/conti/**"
  - "app/**/transazioni/**"
  - "components/features/HomeHero.tsx"
  - "components/features/FlowCard.tsx"
  - "components/features/BudgetCards.tsx"
  - "components/features/GlobalBudgetSection.tsx"
  - "components/features/InvestimentiTab.tsx"
  - "components/features/*Chart.tsx"
  - "components/UI/SummaryCard.tsx"
  - "components/UI/TransactionForm.tsx"
---

# Numeri, date e importi

Storia: `docs/storia/fase-20a-conti`, `fase-20b-trasferimenti`,
`fase-21b-disinvestimento`, `issue-121-numeri`, `issue-119-importi`,
`fase-17-budget-notifiche`, `fase-24a-disponibile`, `issue-009-lista-movimenti`.

## Che cosa conta un numero

1. **Ogni definizione sta in un posto solo.** Flusso, uscite e disponibile stanno
   in `lib/totals.ts` (da totali aggregati) e in `sommaUscite()` (da righe).
   Prima di scrivere un filtro sui tipi, cerca se la definizione esiste già: tre
   `filter` scritti a mano erano tre numeri diversi.
2. **I tipi e il saldo**:
   - `entrata` e `disinvestimento` aumentano il saldo del conto;
   - gli altri tipi lo diminuiscono;
   - un trasferimento lo sposta da un conto all'altro.

   Home e `/analisi` sono viste di flusso: i trasferimenti non ci entrano, e il
   filtro conto guarda l'origine (`account_id`).
3. **Il segno dipende da chi guarda** (`amountSign()`).
   - Con un conto davanti la lista è un estratto conto, e il ramo della
     destinazione viene prima del tipo.
   - Senza un conto il trasferimento è neutro, con la freccia.
4. **Un movimento senza categoria non sparisce da un totale** che un'altra
   schermata include: c'è una fetta e una posizione «Senza categoria», aggregate
   per id.
5. **Investimenti** (capitale versato netto, per posizione):
   - `investment_type` lo scrive solo l'import, quindi la tipologia si prende
     dagli acquisti;
   - una tipologia ignota non è una tipologia diversa: il ripiego `altro` non
     conta;
   - una posizione negativa si mostra, ma il donut vede solo le positive;
   - posizioni e tipologie hanno due denominatori diversi.
6. **Un disinvestimento prende una categoria di tipo `investimento`**
   (`categoryTypeFor()`), ovunque: form, import, filtri e server.
7. **I residui si arrotondano al centesimo, con `|| 0`**: 100,10 + 200,20 −
   300,30 non fa zero, e `-0` diventa «-0,00».
8. **Un tipo di movimento nuovo vuole prima l'audit di ogni consumatore** di
   `transactions` (vedi `database.md`).

## Confronti e periodi

1. **Un confronto si calcola sullo stesso tratto del numero che affianca.**
   - Mese e anno si confrontano a parità di giorni, fino all'ultimo giorno con un
     movimento se è oltre oggi (`endOfDayInMonth()`), con il colore neutro.
   - La settimana è già intera, e resta colorata.
   - «— primo mese» compare solo se prima non c'è nessun movimento.
2. **I periodi dei budget sono di calendario**: la settimana da lunedì, il mese
   dal 1°, l'anno solare.
   - La data la manda il client.
   - `set_budget()` calcola `valid_from`.
   - Un cambio di periodo vale subito.
3. **Le date**:
   - `transactions.date` è un timestamp senza fuso;
   - l'oggi e i confini dei periodi vengono dal client (`ClientClock` porta la
     data e lo scostamento del fuso);
   - i confronti passano da `dbInstant()`, mai come stringhe: `2026-10-01T00:00:00`
     è «minore» di `…00.000Z`.
4. **Ricorrenti**:
   - la prima esecuzione di una regola con partenza passata è l'occorrenza più
     recente già dovuta, alla sua data (`firstRunForNewRule`);
   - «Ripeti» solo sui tipi ammessi da `recurring_rules_type_check`
     (`canRepeat()`);
   - riprendere una regola su un conto archiviato si rifiuta.
5. **Un tetto suggerito si arrotonda per difetto**, e la card che lo affianca
   mostra i centesimi: un tetto si abbassa, non si alza.

## Importi scritti a mano

1. **O si legge il numero che la persona intendeva, o si dice che non si legge**
   (`parseAmountInput()` in `lib/amount.ts`):
   - virgola e punto sono entrambi decimali;
   - l'ambiguo («1.200») lo decide la lingua;
   - tre decimali sono un errore;
   - uno zero davanti non è mai un gruppo di migliaia.
2. **Un campo importo**:
   - è `type="text"` con `inputMode="decimal"`;
   - distingue vuoto da illeggibile;
   - si valida PRIMA di qualunque scrittura.
3. **I due parser divergono di proposito.** Quello dell'import (`parseAmount`)
   legge sempre come migliaia un separatore seguito da tre cifre, perché un file
   arriva da chiunque. Condividono solo `couldBeThousandsGroup()`
   (`lib/thousands.ts`).
4. **Il tastierino è un campo vincolato** (`applyAmountKey`): non entrano né il
   terzo decimale né la nona cifra intera.

## Letture lunghe

1. **`readAll()` per ogni lettura che può superare 1000 righe**, con ordinamento
   totale su `id`. Il blocco interno (500) resta sotto il tetto di PostgREST, o
   una pagina tagliata dal server sembrerebbe la fine dei dati.
2. **Le liste paginano chiedendo una riga in più**, così `hasMore` lo decide il
   server; si ordina per `date` e poi per `id`.
3. **La ricerca carica il periodo fino a `SEARCH_SCAN_LIMIT`**, e dice quante
   righe ha guardato.
