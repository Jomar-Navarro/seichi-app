# Il flusso di autenticazione, com'era in CLAUDE.md fino al 2026-11-10

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

## Auth Flow

- `/welcome` → landing page pre-auth
- `/sign?tab=signup` → registrazione. `signup()` gestisce **entrambe** le configurazioni
  di Supabase (Authentication → Sign In / Providers → Email → *Confirm email*):
  - conferma **attiva** → `signUp` ritorna `session: null` → schermata "controlla la tua email"
  - conferma **disattiva** → `signUp` ritorna già una sessione → `redirect("/start")`

  Senza il controllo su `data.session` l'utente resterebbe fermo davanti a un
  messaggio che rimanda a un'email mai inviata. `emailRedirectTo` punta a `/callback`:
  senza, il link atterrerebbe sul Site URL (`/`), che non scambia il `code`.
- `/sign` → login → dopo login controlla `profiles.currency`: se NULL → `/start`, altrimenti → `/`
- `/callback` → gestisce OAuth (Google/Facebook) e verifica email → stesso check su `profiles.currency`
- Onboarding: `/start` → `/preference` → `/category` → `/`
- `savePreferences()` fa upsert su `profiles` (currency, language)
- `saveCategories()` **aggiunge** le categorie scelte che l'utente non ha già
  (stesso tipo, stesso nome) e **non ne cancella mai nessuna**. ⚠️⚠️ Fino alla
  #116 cancellava tutte le categorie dell'utente, di ogni tipo, e reinseriva le
  scelte: siccome `transactions_category_id_fkey` è `on delete cascade`, tornare
  su `/category` dopo mesi d'uso e toccare "Completa" cancellava ogni movimento
  tranne i trasferimenti, con budget, obiettivi e ricevute. Nessuna conferma.
  L'idempotenza ora viene dal confronto, non dalla cancellazione.
- **Il layout di `(onboarding)` rimanda in home chi ha già finito**: valuta
  **e** almeno una categoria. Non la sola `currency`, che si scrive al passo 2 e
  rimanderebbe in home a metà strada, prima di `/category`. ⚠️ È una comodità,
  non la protezione: un layout non si riesegue su navigazioni interne né su
  indietro/avanti dalla cache del router (guida autenticazione di Next 16). La
  garanzia è la action.
- ⚠️ **Login e `/callback` leggono il profilo con `maybeSingle()` e guardano
  l'`error`**: "la riga non c'è" porta a `/start`, "non sono riuscito a leggerla"
  porta in home. Prima un guasto passeggero mandava nell'onboarding un utente già
  configurato — cioè sulla strada della cancellazione qui sopra.
- **Collaudo della #116 (2026-09-28), su un account di prova usa e getta**,
  eliminato alla fine con `delete_current_user()`: registrazione → `/category`
  lasciata aperta → categorie e movimenti creati nel frattempo → "Completa" sulla
  pagina rimasta aperta. Codice nuovo: 2 movimenti → 2, una sola categoria
  aggiunta. **Controprova col codice vecchio: 2 → 0.** Due trappole della prova,
  da ricordare:
  - ⚠️ **il layout nuovo NASCONDE il difetto del login.** Col vecchio login e il
    guasto iniettato si finiva comunque in home, perché `/start` rimandava subito
    indietro un utente con categorie; e il redirect di una server action rende la
    destinazione nella stessa risposta, quindi il passaggio da `/start` non
    compare nemmeno come richiesta. Per isolare il login serve un utente con
    valuta e **zero** categorie: lì il vecchio codice resta su `/start`, il nuovo
    va in home;
  - il tab "Accedi" in cima al modulo ha lo stesso testo del bottone di invio: il
    selettore va ristretto al `form`.
  Non rifatto in inglese: la modifica non tocca la scelta della lingua.
- **Recupero password**: `/recupera-password` → `resetPasswordForEmail` con
  `redirectTo=/callback?next=/reimposta-password` → `/reimposta-password` →
  al termine `signOut()` + `/sign?reset=1` (il login mostra la conferma).
  Entrambe le route sono in `PUBLIC_PATHS` (`lib/supabase/proxy.ts`), altrimenti il
  proxy rimanderebbe a `/welcome` chi è sloggato. Il form risponde sempre "inviato",
  anche per indirizzi inesistenti, per non esporre chi ha un account.
- **Cambio email**: `updateUser({ email })` con `emailRedirectTo=/email-confermata`,
  **non** `/callback`. Non è un flusso PKCE — la sessione esiste già, quindi nessun
  `code_verifier` viene generato e Supabase reindirizza senza `code`. `/callback` lo
  pretende e manderebbe su `/auth/auth-code-error`: l'utente leggerebbe "accesso non
  riuscito" a fronte di un cambio andato perfettamente a buon fine. La rotta è in
  `PUBLIC_PATHS` perché il link può essere aperto da un browser senza sessione.
- **Marcatore di recupero** (`lib/recovery.ts`): la sessione creata dal link è una
  normale sessione Supabase, indistinguibile da un login. `/callback` emette un
  cookie httpOnly di 15 minuti quando `next=/reimposta-password`; la pagina e
  `resetPassword()` lo esigono, e viene bruciato dopo il cambio. Senza, chi trova un
  dispositivo già loggato reimposta la password saltando la verifica di quella attuale.

  ⚠️ **Residuo di sicurezza accettato**: su `/callback` arriva un `code` opaco, quindi
  il marcatore si basa sul solo `next` — un login OAuth costruito a mano con
  `next=/reimposta-password` lo otterrebbe. La chiusura pulita è far passare il
  recupero da `/auth/confirm` (già pronta: emette il marcatore solo per
  `type === "recovery"`), ma richiede un template email custom, e **Supabase permette
  di modificare i template solo con SMTP personalizzato**. Quando si configurerà
  l'SMTP — necessario comunque in produzione, l'email integrata è limitata a pochi
  invii/ora — cambiare `redirectTo` in `/auth/confirm?next=/reimposta-password` e
  impostare il template:

  ```html
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reimposta-password">Reimposta la password</a>
  ```
- **Cancellare un cookie in una server action fa ri-renderizzare la pagina**: per
  questo `resetPassword()` fa `redirect()` invece di tornare al client — altrimenti
  la guardia di `/reimposta-password`, ormai senza marcatore, rimbalzerebbe l'utente.
- **`profiles`: sempre `upsert`, mai `update`**. Gli utenti registrati prima del
  trigger `on_auth_user_created` che non hanno finito l'onboarding non hanno la riga:
  un `UPDATE` su zero righe non è un errore, e l'app direbbe "salvato" a vuoto.
- **Operazioni sensibili** (cambio email, cambio password, eliminazione account):
  richiedono sempre la riautenticazione con `signInWithPassword`. Supabase non la
  impone, ma senza di essa un dispositivo sbloccato basterebbe a prendere l'account.
  Il controllo va rifatto a ogni server action: lo stato del passo precedente vive sul
  client e non è affidabile.
- **Ogni server action che legge dati apre con `requireUser()` (`lib/auth.ts`)**,
  che dà client, utente (dalle claims) e dizionario in un colpo solo. Non
  `auth.getUser()` — quest'ultima è una chiamata di rete a ogni invocazione.
  Le eccezioni sono le operazioni sensibili qui sopra, `resetPassword`, il gate
  di `/reimposta-password`, il `/callback` **e tutto ciò che passa da
  `getAccountContext()`**: là serve la verifica lato server, perché le claims
  non vedono né una sessione revocata né un'email appena cambiata. Motivi e
  trappole nella sezione "Costo delle richieste a Supabase".
- Gli account solo-OAuth non hanno `identities` con provider `email`:
  per loro cambio email e cambio password sono disabilitati (`hasPasswordIdentity`).
  ⚠️ Quel predicato lo calcolano **sia** `getAccountContext()` (per mostrare o
  nascondere i campi) **sia** `deleteAccount()` (per pretenderli): devono venire
  dalla stessa fonte viva, o la UI nasconde un campo che il server poi esige.

  ⚠️ **Eccezione nota**: per questi account l'**eliminazione** non ha riautenticazione
  — non esiste una password da verificare, e resta solo la digitazione dell'indirizzo.
  La chiusura corretta è `supabase.auth.reauthenticate()`, che invia un nonce a 6 cifre
  e funziona anche senza password; non è stata implementata perché aggiunge un passo
  al flusso e dipende dall'invio email (vedi debito SMTP). Da fare prima di aprire le
  registrazioni OAuth al pubblico.
- ⚠️ **Limite PKCE cross-browser**: i link di recupero password e di conferma
  registrazione passano da `/callback`, che chiama `exchangeCodeForSession` e ha
  bisogno del cookie `code_verifier` creato al momento della richiesta. Chi apre
  l'email in un browser diverso da quello da cui ha chiesto il reset finisce su
  `/auth/auth-code-error`. Si risolve con lo stesso intervento del debito SMTP: il
  flusso `token_hash` su `/auth/confirm` non usa PKCE e funziona da qualsiasi
  dispositivo.

