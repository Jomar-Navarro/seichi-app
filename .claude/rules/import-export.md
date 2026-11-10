---
paths:
  - "lib/import/**"
  - "lib/export/**"
  - "app/**/impostazioni/importa/**"
  - "app/**/impostazioni/esporta/**"
  - "components/features/ImportFlow.tsx"
  - "components/features/ExportPanel.tsx"
---

# Import ed export

Storia: `docs/storia/fase-21-import`, `issue-118-import`,
`fase-21b-disinvestimento`, `fase-23-export-report`, `issue-155-test-unitari`.

## Import

1. **Un import è un lotto** (una riga di `imports`): annullarlo vuol dire
   eliminare quella riga, e la cascata su `import_id` toglie i movimenti. Lo
   storico con «annulla» sta in `/impostazioni/importa`.
2. **Reimportare non duplica, per costruzione**: `import_key` è unica con
   `user_id`, e si inserisce con `on conflict do nothing` (`importKeyFor()`).
   - La chiave del profilo generico porta il conto del FILE
     (`generico:<conto>:…`).
   - Quella di Trade Republic no: è l'id dell'evento, e legarla al conto
     permetterebbe di contare due volte lo stesso denaro.
3. **Il movimento di cassa è `amount + fee + tax`**, e un netto zero vuol dire
   nessun movimento. Il netto si arrotonda al centesimo PRIMA del controllo.
4. **Si decide per gruppo, non per riga**, e la direzione fa parte dell'identità
   del gruppo. I bersagli si filtrano con un solo insieme (`IN_ENTRATA`).
5. **Le vendite prendono una categoria di tipo `investimento`**
   (`categoryTypeFor("disinvestimento")`), anche nella validazione del server.
6. **Il flusso protegge dal conto sbagliato**:
   - il conto si sceglie al passo 1;
   - l'analisi parte alla scelta del file;
   - gli estratti di broker hanno un avviso;
   - `AccountPicker` crea un conto senza uscire dal flusso.
7. **Date**: ISO in uscita; un giorno che non esiste (31/02) è una riga
   illeggibile, non un errore dell'intero lotto.
8. **`IMPORT_MAX_BYTES` è un anello della catena dei limiti** insieme a
   `bodySizeLimit`.
9. **Il riepilogo prima dell'import dice solo ciò che si sa prima**: da
   importare, ignorate, illeggibili. I «già presenti» arrivano dopo.

## Export

1. **È un Route Handler** (`/impostazioni/esporta/download`) con
   `Content-Disposition`, `requireUser()` e `Cache-Control: private, no-store`.
   Una server action non scarica un file in modo affidabile su iOS.
2. **I filtri si validano per forma e per proprietà**: un conto non tuo risponde
   404, non un CSV vuoto. Tipo e categoria incompatibili non partono.
3. **Il file parla alla persona**:
   - nomi, non uuid;
   - BOM UTF-8, separatore e decimali della lingua, date ISO;
   - il tipo da `t.transactionTypes`;
   - il numero di ricevute da `getAttachmentCountsChecked()`: in un file un dato
     mancante si archivia, quindi una lettura fallita ferma l'export.

   La re-importabilità non è promessa.
4. ⚠️ **Un campo di testo libero che comincia con `=`, `+`, `-` o `@` è una
   formula per Excel.** La difesa vale sulle sole colonne di testo libero, mai
   su quelle numeriche.
5. **Si pagina, non si tronca**: blocchi con ordinamento totale.
   - Il nome del file porta periodo e conto.
   - Un trasferimento esportato senza un conto scelto resta col segno positivo:
     limite dichiarato.
