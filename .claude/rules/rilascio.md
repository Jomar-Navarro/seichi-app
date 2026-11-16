---
paths:
  - "supabase/migrations/**"
  - "supabase/config.toml"
---

# Rilasciare una migration

Si carica quando apri una migration. Deciso con Jomar nella #157; il perché
sta in `docs/storia/issue-157-supabase-cli`. Come SCRIVERE una migration:
`database.md`.

1. **Si rilascia con `npx supabase db push --remote`, mai dal SQL Editor.**
   Perché: `db push` applica ogni file in una transazione e lo scrive nella
   cronologia; dal SQL Editor la cronologia resta indietro, e il push
   successivo proverebbe a rieseguire il file.
2. **Prima `db push --remote --dry-run`**: deve elencare esattamente le
   migration della PR, e nessun'altra.
3. **L'ordine lo dice la PR** (`database.md`, regola 15): migration prima →
   `db push` dal ramo della PR, poi il merge; codice prima → il merge, il
   deploy di Vercel finito, poi `db push` da `master`.
4. **Dopo**: `npx supabase migration list --remote` allineata, e le verifiche
   che la PR indica, in sola lettura (`db query --remote --read-only`).
5. ⚠️ **L'integrazione GitHub di Supabase ha *Deploy to production* spento.**
   Riaccesa, applicherebbe le migration da sola al merge, insieme al deploy di
   Vercel: l'ordine dichiarato nella PR non conterebbe più.
6. ⚠️ **Mai `--remote` su `db reset`, `test db` o `migration up` di prova**:
   `reset` cancella la produzione, le suite pgTAP ci scrivono (in una
   transazione annullata, ma ci scrivono).
7. **Che il repo descriva la produzione lo dice `npx supabase db diff
   --remote`.** Il rumore noto: gli oggetti della piattaforma
   (`rls_auto_enable`, `ensure_rls`), `profiles_language_check` ristampato, e i
   fine riga delle funzioni incollate dal SQL Editor prima della #157. Ogni
   altra riga è da capire, prima di crederci. ⚠️ Rediretto su file, scrive
   JSON su una riga sola (il SQL sta in `"diff"`): letto per righe, sembra
   vuoto.
