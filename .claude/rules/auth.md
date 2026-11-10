---
paths:
  - "app/**/welcome/**"
  - "app/**/sign/**"
  - "app/**/signout/**"
  - "app/**/callback/**"
  - "app/**/recupera-password/**"
  - "app/**/reimposta-password/**"
  - "app/**/email-confermata/**"
  - "app/auth/**"
  - "app/**/start/**"
  - "app/**/preference/**"
  - "app/**/category/**"
  - "app/**/impostazioni/account/**"
  - "app/**/impostazioni/email/**"
  - "app/**/impostazioni/password/**"
  - "app/**/impostazioni/elimina/**"
  - "lib/supabase/**"
  - "lib/auth.ts"
  - "lib/account.ts"
  - "lib/recovery.ts"
  - "lib/safe-redirect.ts"
  - "lib/errors.ts"
  - "components/LoginForm.tsx"
  - "components/SignUpForm.tsx"
  - "proxy.ts"
---

# Accesso, sessione, onboarding

Storia: `docs/storia/auth-flusso` (il flusso completo e il collaudo della #116),
`costo-richieste-supabase` (claims e header di cache),
`issue-043-ricostruzione-schema` (`currency`), `issue-124-errori`.

## Il flusso

1. **Il percorso**: `/welcome`, poi `/sign` (login, o registrazione con
   `?tab=signup`), poi `/callback` per OAuth e conferme, poi l'onboarding
   `/start` → `/preference` → `/category`, infine `/`.
2. **Il cancello dell'onboarding è `profiles.currency`** (NULL = da fare). Un
   cancello presuppone ciò che sta dietro: il primo conto nasce in
   `savePreferences()`, PRIMA dell'upsert che apre il cancello.
3. ⚠️ **`saveCategories()` aggiunge e non cancella mai.**
   `transactions.category_id` è in cascata, e la versione che cancellava e
   reinseriva ha portato via tutti i movimenti di un utente (#116). Il layout di
   `(onboarding)` che rimanda in home è una comodità, non la protezione.
4. **Login e `/callback` leggono il profilo con `maybeSingle()` e guardano
   l'errore**: «la riga non c'è» porta a `/start`, «non l'ho letta» porta in
   home.
5. **`signup()` regge entrambe le configurazioni di *Confirm email***: senza
   sessione mostra «controlla l'email», con la sessione va a `/start`.
   `emailRedirectTo` punta a `/callback`.

## Sessione e identità

1. **Due fonti, due tipi.**
   - `getProfileHeader()` legge le claims: è una fotografia, non espone né email
     né provider, e serve solo a disegnare.
   - `getAccountContext()` e `requireLiveUser()` interrogano GoTrue: sono vivi, e
     servono a decidere.
   - `hasPasswordIdentity`, per la UI e per il server, viene dalla stessa fonte
     viva.
2. **`requireUser()` (claims) e `requireLiveUser()` (vivo) non sono
   intercambiabili**: i nomi sono diversi apposta.
3. **Il risparmio delle claims regge solo con le chiavi ES256** (JWKS): con
   HS256 `getClaims()` ripiega in silenzio su `getUser()`. La card Auth del
   pannello Supabase deve restare piatta.
4. **`createClient()` sta in `cache()`**: un client per render, quindi un solo
   rinnovo del refresh token, che è monouso.
5. **Le risposte che scrivono cookie di sessione non sono memorizzabili.** Il
   proxy applica gli header di `setAll` anche ai redirect; le rotte fuori dal
   proxy (`/callback`, `/auth/confirm`, i signout) hanno la regola in
   `next.config.ts`.
6. **Il proxy**:
   - su un errore di rete lascia passare: un redirect a `/welcome` dichiarerebbe
     il falso;
   - una rotta pubblica nuova va in `PUBLIC_PATHS`;
   - le richieste che il browser fa da sé (manifest, icone, service worker) si
     escludono dal matcher, ancorate al confine di segmento.

## Password, email, eliminazione

1. **Recupero password.**
   - Il form risponde sempre «inviato».
   - Dice un guasto solo con `status === 0`: GoTrue risponde 500 solo per gli
     indirizzi registrati, e dirlo farebbe del form un oracolo.
   - Il marcatore di recupero (`lib/recovery.ts`, cookie httpOnly di 15 minuti)
     lo pretende `/reimposta-password`, e si brucia dopo.
   - `resetPassword()` fa `redirect()` invece di tornare al client.
2. **Cambio email**: `emailRedirectTo` è `/email-confermata`, non `/callback`,
   perché non è un flusso PKCE.
3. **Operazioni sensibili**: riautenticazione in ogni action. Gli account
   solo-OAuth non cambiano email né password, e per eliminarli resta solo
   l'indirizzo digitato (debito, #40).
4. **Limiti noti** (#40): un link aperto in un altro browser fallisce (PKCE), e
   il marcatore si basa sul solo `next`. Si chiudono entrambi con un SMTP
   personalizzato e `/auth/confirm` con `token_hash`.
5. **Gli errori di GoTrue passano da `authErrorMessage()`**: rete, troppi
   tentativi, email non confermata e credenziali sbagliate sono frasi diverse.
