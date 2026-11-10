# Fase 16 — Storage, avatar ed eliminazione dell'account

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Storage & funzioni (Fase 16)

- Bucket `avatars` — pubblico in LETTURA, path `{user_id}/{uuid}.{ext}`. Il segmento
  casuale rende l'URL non ricostruibile dal solo user_id; le policy su
  `storage.objects` limitano ogni utente alla propria cartella — **anche in SELECT**.
  Nessuna policy di select aperta a `public`: il bucket è pubblico, quindi
  `/object/public/...` non passa da RLS e le immagini si vedono comunque, mentre una
  select pubblica autorizzerebbe `list()` e chiunque abbia la anon key potrebbe
  enumerare cartelle (= tutti gli user_id) e nomi file, annullando la non
  ricostruibilità dell'URL.
- L'upload dell'avatar passa da una server action: il limite di 2 MB regge solo perché
  `next.config.ts` alza `experimental.serverActions.bodySizeLimit` (default 1 MB).
  Cambiando uno dei due limiti vanno allineati anche l'altro, il `file_size_limit` del
  bucket, `AVATAR_MAX_BYTES` e il testo nella UI.
- `delete_current_user(dry_run boolean default false)` — funzione `SECURITY DEFINER`
  con `SET search_path = ''`, eseguibile solo da `authenticated`. Cancella
  esclusivamente `auth.uid()`, così non serve tenere la `service_role` key nel backend.
  Le FK verso `auth.users` sono `ON DELETE CASCADE`. `deleteAccount()` la chiama due
  volte: prima con `dry_run: true` (non tocca niente, ma verifica funzione, grant e
  sessione) e solo dopo cancella l'avatar e chiama quella vera — la rimozione dei file
  è irreversibile e deve precedere la RPC, quindi non può basarsi sulla speranza che la
  RPC poi funzioni.
- **I file dello Storage non si cancellano in SQL.** Supabase rifiuta il `DELETE`
  diretto su `storage.objects` ("Direct deletion from storage tables is not allowed.
  Use the Storage API instead") e farebbe fallire l'intera funzione. La rimozione
  dei file avviene lato app in `deleteAccount()` con `storage.from(...).remove()`,
  **prima** della RPC. Vale per qualsiasi cleanup futuro (es. ricevute, Fase 22).

