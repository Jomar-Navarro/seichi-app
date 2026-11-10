---
paths:
  - "lib/coach.ts"
  - "components/features/CoachBubble.tsx"
  - "app/**/coach-actions.ts"
---

# Coach

Storia: `docs/storia/fase-24a-disponibile`, `fase-24b-coach`,
`fase-24c-chat-progetto`.

1. **Il coach mette in relazione i numeri, non li ridefinisce.** Legge lo
   snapshot calcolato dalle funzioni esistenti (`lib/totals.ts`,
   `getBudgetOverview()`, `getGoals()`), mai un filtro proprio: sarebbe un'altra
   definizione di «uscita».
2. **Guarda tutti i conti, e lo dichiara** quando la home è filtrata: budget,
   uscite fisse e disponibile valgono su tutti i conti.
3. **Le risposte sono domande proposte**: frasi del dizionario con segnaposto, e
   il percorso predefinito non chiama nessun modello. L'icona è una bussola, non
   un fumetto di chat: la chat non c'è.
4. **Le frasi tacciono sui non-fatti.**
   - Niente «hai messo da parte € 0,00».
   - Niente confronto con un mese precedente vuoto.
   - Il «più vicino al traguardo» si sceglie fra gli obiettivi aperti.
   - Un mese in corso si dichiara: «finora», contro «l'intero mese scorso».
5. **`CoachSnapshot` non ha campi per note o id di righe**: ciò che un giorno
   uscirà verso un fornitore è limitato dal tipo, non dall'attenzione.
6. **La 24c (la chat aperta) è l'ultima della roadmap**: non proporla prima. Il
   suo progetto sta in `fase-24c-chat-progetto`:
   - il modello non scrive mai una cifra, solo segnaposto validati;
   - il consenso mostra il payload vero;
   - nessun piano gratuito;
   - i tetti stanno nel database.
