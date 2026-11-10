---
paths:
  - "lib/attachments.ts"
  - "lib/attachment-paths.ts"
  - "lib/storage-files.ts"
  - "app/**/attachment-actions.ts"
  - "app/**/impostazioni/account/**"
  - "app/**/impostazioni/profilo/**"
  - "components/features/AttachmentPicker.tsx"
  - "components/features/ProfileEditor.tsx"
  - "components/features/DeleteAccountFlow.tsx"
---

# Storage: ricevute e avatar

Storia: `docs/storia/fase-22-ricevute`, `issue-120-ricevute-orfane`,
`fase-16-storage`.

1. **Avatar pubblici, ricevute private.**
   - Il bucket `avatars` è pubblico in lettura, con path `{user_id}/{uuid}.{ext}`
     e nessuna policy di select pubblica, che autorizzerebbe `list()` a
     chiunque.
   - Il bucket delle ricevute è privato: URL firmati di 10 minuti, generati a
     ogni apertura. Una ricevuta può contenere un IBAN, e un path non
     indovinabile sarebbe sicurezza per oscurità.
2. **Il percorso è piatto**, `{user_id}/{uuid}.{ext}`: il legame col movimento
   vive nel database. Si salva il path, mai l'URL firmato, che scade.
3. ⚠️ **Prima di una cancellazione che fa cascata su `attachments`, raccogli i
   path** con `receiptPathsOf()` e togli i file dopo. La cascata cancella le
   righe e lascia i file nel bucket per sempre.
   - Vale per movimento, obiettivo, import e account.
   - Per un obiettivo valgono TUTTI i movimenti della categoria, non solo i
     versamenti: il tipo di una categoria può cambiare quando ha già movimenti.
4. **Le due metà di una cancellazione hanno politiche opposte.**
   - Se la lettura dei path fallisce, non cancellare niente
     (`errors.receiptsReadFailed`): prima del gesto un guasto si riprova gratis.
   - Se fallisce la rimozione DOPO il delete, registra i path e non annullare:
     le righe non tornano.
   - In `deleteAccount` invece un errore sui file ferma tutto: sono documenti di
     chi ha chiesto di sparire.
5. **Cancella con `removeStorageFiles()` e svuota con `purgeStorageFolder()`**
   (`lib/storage-files.ts`).
   - `remove()` accetta al massimo 1000 oggetti per richiesta.
   - `list()` senza opzioni restituisce 100 elementi, e un troncamento non è un
     errore: la cartella si svuota a giri sulla prima pagina finché è vuota,
     sottocartelle comprese.
   - Il modulo sta fuori da `"use server"`: là ogni export diventerebbe una
     POST.
6. **In `deleteAttachment`, prima il file e poi la riga**: così ogni fallimento
   resta recuperabile.
7. **Le firme si riabbinano per path, non per posizione**: un elemento in errore
   sposterebbe tutti gli altri, e ogni ricevuta mostrerebbe quella di un'altra.
8. **Eliminare l'account**: `delete_current_user(dry_run: true)`, poi i file,
   poi la RPC vera. La rimozione dei file è irreversibile e deve precedere la
   RPC.
9. **La foto si riduce nel browser** a 1600px sul lato lungo, in JPEG: senza,
   ogni foto di un telefono supererebbe il limite.
10. **La catena dei limiti si tiene allineata a mano**: `bodySizeLimit` in
    `next.config.ts`, `file_size_limit` del bucket,
    `ATTACHMENT_MAX_BYTES`/`AVATAR_MAX_BYTES`, e il testo, che legge la
    costante.
11. **`receiptPath()` non è client-safe.** `crypto.randomUUID()` esiste solo in
    un contesto sicuro, e sul telefono in LAN su HTTP non c'è. Nel browser si
    usa un ripiego, e ogni gestore che sceglie file ha il suo `catch`.
12. **Le miniature passano `unoptimized` a `next/image`**: l'URL firmato cambia a
    ogni apertura, e per questo `remotePatterns` non serve.
13. **La coda delle ricevute in attesa ha un proprietario solo**,
    `AttachmentPicker`: il form gliela chiede con `uploadPending()`.
