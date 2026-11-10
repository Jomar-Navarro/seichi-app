# #124 — errori nascosti

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Errori nascosti — messaggi grezzi, letture fallite, rete (issue #124)

Dalla review completa del 2026-09-28 (#128). Nessuna migration. La classe è una
sola, in tre travestimenti: **un guasto che l'interfaccia racconta come un'altra
cosa** — un testo inglese di Postgres, un "nessun…" che è una lettura fallita,
una rete caduta che diventa "credenziali errate".

#### Il testo del server non arriva mai a schermo — `lib/errors.ts`

57 punti restituivano `{ error: error.message }`: l'app in italiano mostrava
`new row violates row-level security policy for table "categories"`, una frase
in inglese che racconta pure la forma dello schema. Ora:

- **`genericError(scope, error, t)`** registra codice e messaggio con l'etichetta
  `[scope]` e restituisce `t.common.genericError`. È la regola di
  `contoError()` (20b) estesa a tutte le action: il motivo vero non si butta, va
  nei log, perché è l'unica cosa che dice QUALE vincolo ha parlato.
- ⚠️ **Gli helper interni restano grezzi, e li traduce il chiamante**: `readAll`,
  `countActiveAccounts`, `lib/storage-files.ts`, `receiptPathsOf` non hanno un
  dizionario. `readBudgetsAt`, `readFixedOutflows`, `hasAnyMovement` e
  `ensureFirstAccount` lo ricevono come parametro. Il controllo è un grep: nessun
  `.message` dentro un `return { error: … }` in `app/` e `components/`.
- ⚠️ **Anche le `raise exception` di `set_budget()` passano dalla frase
  generica**: sono in italiano e parlano allo sviluppatore ("categoria
  inesistente o non di tipo spesa"), e i controlli che le fanno scattare li
  applica già il form.
- **`{reason}` tolto** da `t.budget.readFailed`/`saveFailed` e `t.coach.readFailed`:
  incollava il motivo grezzo, o il `message` di un'eccezione — che in produzione
  Next sostituisce con un testo generico in inglese.

#### Un guasto di rete non è una password sbagliata — `authErrorMessage()`

Il login traduceva ogni errore di `signInWithPassword` in "credenziali errate":
un GoTrue che non risponde, troppi tentativi e un'email non confermata — il caso
normale il giorno in cui si riattiva *Confirm email* (#40) — mandavano tutti a
ridigitare una password giusta. La funzione legge i codici di GoTrue (rete via
`isAuthRetryableFetchError`, 429, `invalid_credentials`, `email_not_confirmed`,
`same_password`, `weak_password`, `email_exists`…) e la frase per le
credenziali e per un indirizzo già usato la sceglie il chiamante, perché cambia
col contesto. La usano login, registrazione, riautenticazione, cambio email e
password, reimpostazione.

- **`requireLiveUser()` restituisce `denied`**: la frase da usare quando `user`
  manca, che non è sempre "non autenticato". **`getAccountContext()` solleva**
  su un guasto di `getUser()` o del profilo invece di rimandare a /sign o di
  inventare "EUR" — e la pagina mostra **`app/(main)/error.tsx`**, che prima non
  esisteva (c'era la pagina di Next, in inglese e senza comando). ⚠️ In Next 16
  la prop è `retry`, non `reset`.
- `/reimposta-password` su un GoTrue irraggiungibile dice cosa è successo invece
  di rimandare a chiedere un link nuovo, che incontrerebbe lo stesso guasto.
- ⚠️⚠️ **Nel recupero password si dice SOLO `status === 0`** — una richiesta mai
  partita. Trovato dalla review: `isAuthRetryableFetchError` copre anche i 5xx, e
  GoTrue risponde 500 quando non riesce a SPEDIRE l'email, cosa che tenta solo
  per un indirizzo registrato. Dirlo rifaceva del form un oracolo per scoprire
  chi ha un account, attraverso un guasto del mailer. Per la stessa ragione un
  429 resta muto: GoTrue lo applica dopo aver trovato l'utente.

#### Una lettura fallita non è uno stato vuoto — `LoadError`

`components/UI/LoadError.tsx`: una frase che dice cosa non è arrivato e un
"Riprova" (`router.refresh()` se la pagina è server, la funzione di ricarica se
è client). ⚠️ Niente icona zen e niente invito: **esiste per non somigliare a
`EmptyState`**, il cui comando — "aggiungi", "crea" — su una lettura fallita
porta a duplicare dati che esistono già.

| dove | prima | ora |
|---|---|---|
| `/investimenti` | "Nessun investimento ancora — aggiungi…" | `LoadError` |
| categorie, ricorrenti | lista vuota con l'invito a crearne | `LoadError` |
| `/impostazioni` | "Gestisci categorie **0**" | "non disponibile" |
| import | "non hai conti", storico sparito | `LoadError` sul flusso / al posto dello storico |
| `/transazioni`, `/conti/[id]` | "Nessuna transazione ancora" | `LoadError` (`page`) o riga sotto la lista (`more`) |
| home, `/analisi`, report | "Errore", nudo | `LoadError` (`t.home.error` tolto) |

- ⚠️ **Nella lista il conteggio delle ricevute ha un `try` SUO.** Degrada a `{}`
  su un errore di query (Fase 22), ma un'azione che SOLLEVA usciva come errore
  non gestito; e le righe, arrivate, non devono diventare "non riesco a
  caricarle". Anche i `.then` dei filtri hanno ora un `.catch`.
- `hasMore` si azzera su una prima pagina fallita e resta su un "carica altri"
  fallito, dove il bottone È il riprova (review: altrimenti la riga "la ricerca
  ha guardato N movimenti" del filtro precedente restava sotto l'errore).
- **Preferenze**: la riga mostrava la scelta nuova mentre il database teneva la
  vecchia. Su un salvataggio fallito si rimette com'era e lo si dice, e le
  tendine sono spente durante il salvataggio — due salvataggi sovrapposti
  facevano cancellare al ripristino del primo la scelta riuscita del secondo.
- **Export**: un conto o una categoria ben formati ma non tuoi passavano il
  controllo di forma e la RLS restituiva zero righe — un CSV vuoto. Ora 404 con
  `badFilter`. E il nome del file porta il periodo, come prometteva la Fase 23
  (`seichi-movimenti-30-giorni-revolut-2026-10-06.csv`).
- La campanella: `catch` su "segna tutte" e su "segna letta", e `aria-label` e
  "riprova" nei dizionari (erano cablati in italiano).

#### Il collaudo, e il metodo che vale riusare

⚠️ **I guasti stavano fra il server Next e Supabase, dove il browser non
arriva**: `page.route` vede solo le richieste del browser. Si collauda con un
**proxy che inietta guasti** (`fault-proxy.mjs`, nello scratchpad): inoltra a
Supabase e, per le regole che riceve su `/__faults`, risponde un JSON a scelta
(500, 429, un `error_code` di GoTrue) o chiude la connessione (`reset` →
`AuthRetryableFetchError` con `status 0`). Una build di produzione con
`NEXT_PUBLIC_SUPABASE_URL=http://localhost:8787` — è inlinizzata, quindi serve
una build, non basta l'env a runtime — servita con `next start -p 3100`, accanto
al dev server senza toccarlo. ⚠️ Il cookie di sessione prende il nome
dall'host (`sb-localhost-auth-token`): si entra dal modulo di login, non coi
cookie del dev server. Finito il giro, una build normale riporta `.next` a
posto (controllare che `localhost:8787` non compaia più).

2026-10-06, su un account di prova usa e getta (autorizzato da Jomar, eliminato
dall'app alla fine): **12/12** su login, registrazione e recupero senza account
— le registrazioni le intercetta il proxy, nessuna scrittura — e **39/39** sulle
pagine autenticate, zero errori non gestiti. **Controprova** con la build di
master, stessi gesti: 8 KO su 11 e 32 KO su 39, 4 errori non gestiti. La guardia
`status === 0` del recupero è stata provata **disattivandola**: la prova del 500
del mailer diventa rossa.

Due falsi segnali, da ricordare:

- ⚠️ **Un controllo era cieco.** Cercava "Nessun movimento", ma lo stato vuoto
  dice **"Nessuna transazione ancora"**: sul branch passava perché nessuno dei due
  testi c'era, non perché avesse guardato. L'ha mostrato la controprova, il cui
  screenshot aveva lo stato vuoto e il controllo diceva "vuoto=false".
- **"Minified React error #441"** in console è `resolveErrorProd` del client RSC:
  l'errore di un server component che solleva, cioè proprio il percorso di
  `error.tsx` (che lo registra di proposito). Gestito, non un difetto.

#### Residui dichiarati

- ~~`TransactionForm` e `RecurringSheet` leggono conti e categorie dal client
  senza guardare l'`error`: un conto non letto mostra "serve un conto per
  registrare un movimento". Stessa classe, fuori dall'elenco della issue.~~ —
  chiuso dalla #150.
- `/transazioni` e `AccountDetailClient` hanno la stessa gestione degli errori
  di pagina scritta due volte: un hook condiviso è un refactor a sé (review).
- `importa/actions.ts` registra ancora a mano i propri errori (frase già del
  dizionario): forma diversa, stesso effetto.

