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
`fase-21b-disinvestimento`, `fase-23-export-report`, `issue-155-test-unitari`,
`issue-162-archivio`.

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
6. **Le righe del CSV le scrive `transactionCsvRows()`** (`lib/export/`), per
   l'export e per l'archivio: due copie della stessa tabella divergono alla
   prima correzione.
7. ⚠️ **Un download su `<a>` nudo non risponde mai con un errore in testo.**
   Risponde con un 303 alla pagina dell'export e un codice di un elenco chiuso
   (`exportErrorRedirect()`, `lib/export/download-error.ts`); la frase la
   compone la pagina dal dizionario, e un codice sconosciuto si ignora. Perché:
   il browser naviga verso la rotta, e un testo diventa una pagina bianca, che
   nella PWA installata su iOS non ha un tasto indietro. La sessione scaduta
   resta un rinvio a `/sign`.

## Archivio completo

Rotta `/impostazioni/esporta/archivio`, ZIP scritto a mano in
`lib/export/zip.ts`, contenuti in `lib/export/archive.ts`.

1. **Prima tutto il database, poi lo stream.** Dopo la prima voce lo stato 200
   è partito e un errore non può più diventare una risposta: una tabella letta
   male sarebbe un `[]` scritto in un file. I limiti dello ZIP senza ZIP64
   (`fitsInZip()`) si controllano nello stesso punto.
2. **Ordine nella rotta**: `requireLiveUser()` (l'email finisce nel file), poi
   il tetto `archive`, poi le letture, perché le letture sono il lavoro.
3. **Una ricevuta che non si scarica si riprova una volta, poi si salta e si
   dichiara**: `manifest.json`, `LEGGIMI.txt`, `file: null` in
   `attachments.json`. Mai una voce vuota, mai la connessione troncata.
4. **I file per i programmi hanno nomi fissi** (`data/<tabella>.json`,
   `manifest.json`, colonne del database); quelli per la persona seguono la
   lingua (dizionario `t.export.archive.files`).
5. **Ogni tabella si legge con `*`**, profilo compreso (meno `id`): un elenco
   di colonne lascerebbe fuori in silenzio quella aggiunta domani. **Restano
   fuori `user_id`, `storage_path`, `rate_events`, `job_runs` e il PIN.** Una tabella nuova dell'utente va aggiunta qui, al README e al
   manifest (`ARCHIVE_TABLES`), o la portabilità torna incompleta.
6. **L'avatar si scarica solo se è un file nostro nella cartella dell'utente**
   (`avatarStoragePath()`): `avatar_url` lo scrive l'utente.
7. **Le ricevute vanno «store», i JSON «deflate»**, e lo scrittore non
   comprime ciò che il deflate non riduce.
