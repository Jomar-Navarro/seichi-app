# #161 — limiti di frequenza: ricevute, import, export, avatar

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Il progetto (2026-11-17, deciso con Jomar)

Caricare una ricevuta, importare un estratto, scaricare l'export e cambiare
l'avatar non avevano un tetto. Con le registrazioni aperte un client può
martellarli, e il costo lo pagano Storage, funzioni e database.

**Soglie strette**, scelte da Jomar fra due proposte, per utente e su una
finestra che scorre:

| azione | tetto | finestra |
|---|---|---|
| ricevute | 30 | 1 ora |
| import | 10 | 24 ore |
| export | 10 | 1 ora |
| avatar | 5 | 1 ora |

Scartate le «larghe» (60, 20, 30, 10). Il criterio della issue resta
soddisfatto: dieci ricevute di fila e un import passano.

**Il perimetro**, scelto fra tre:

- ricevute e avatar nelle server action, prima del caricamento;
- l'export nella sua rotta, dopo i filtri e prima di leggere i movimenti;
- l'import **dentro `import_transactions()`**: la funzione è eseguibile da
  `authenticated`, e una RPC diretta avrebbe saltato la action.

L'anteprima dell'import (`analyzeImport`) non ha tetto: legge il file, fino a
`IMPORT_MAX_BYTES`, e non scrive niente. Il costo vero è la scrittura.

⚠️ **Ciò che resta fuori, deliberatamente**: le policy dello Storage lasciano
caricare nella propria cartella con il client dell'utente, senza passare dalle
action. Quel percorso lo limitano la cartella, la dimensione del bucket e i
limiti della piattaforma. Scartata una policy di INSERT che contasse i file
recenti: un ciclo carica-elimina la aggira, e rallenta ogni upload. Scartate
anche le regole del firewall di Vercel: contano per indirizzo, non per utente.

### Il meccanismo — migration `20261119_rate_limits`

- **Un registro di eventi, non il conteggio delle righe.** La 24c aveva
  progettato i suoi tetti «contati sulle righe». Qui non basta: export e avatar
  non lasciano righe, e una ricevuta o un import annullati sparirebbero dal
  conteggio dopo che Storage e database li hanno già pagati. `rate_events`
  registra il tentativo, e non si cancella con ciò che ha prodotto.
- **`rate_events` ha RLS accesa e zero policy**, come `job_runs`, più il revoke
  da `authenticated`: un client non deve poter azzerare il proprio tetto. La
  scrive solo `consume_rate_limit()`, `security definer`. La FK verso
  `auth.users` è in cascata: `delete_current_user()` la svuota senza essere
  ridefinita.
- **`consume_rate_limit(azione)`** restituisce 0 e registra, oppure i secondi da
  aspettare. Le soglie stanno solo lì: l'app non le conosce, e le frasi dicono
  la finestra ma non il numero, che diventerebbe falso al primo ritocco.
  - Un lock per utente e azione (`pg_advisory_xact_lock`) serializza le
    chiamate simultanee, che altrimenti leggerebbero entrambe «29».
  - L'attesa si calcola dall'evento in posizione «tetto» dal più recente, non
    dal più vecchio: regge anche se una soglia scende sotto gli eventi già
    registrati. La prova lo misura: 600 secondi, dove il più vecchio direbbe 300.
  - Gli eventi usciti dalla finestra si cancellano a ogni chiamata.
- **L'import rifiuta con un codice proprio, `SR429`**, e i secondi nel
  `detail`. Un codice standard (`54000`) l'avrebbe confuso con un guasto vero,
  e l'app avrebbe detto «riprova fra 3 ore» a un errore che riprovare non
  risolve. L'evento si registra nella transazione dell'import: un import che
  fallisce dopo non consuma il tetto.
- **`import_transactions()` ridefinita dal catalogo**: identica in produzione e
  in locale a parte i fine riga (CRLF in produzione, incollata dal SQL Editor
  prima della #157). L'hash era diverso, e tolti i `\r` coincideva: verificato,
  non dato per scontato.
- **Un guasto del contatore ferma l'azione**: un limite che si spegne quando il
  database ha problemi non limita niente.

### L'app

- `lib/rate-limit.ts`: `consumeRateLimit()`, `retryAfterFromError()` (un
  `SR429` senza un numero valido non inventa un'attesa) e `rateLimitMessage()`.
- `formatRetryIn()` in `lib/i18n/format.ts`: «tra 13 minuti», «tra 2 ore»,
  sempre per eccesso. Un'attesa detta più corta manda a riprovare troppo presto.
- Le frasi stanno in `errors.rateLimit`, con le parole dell'interfaccia
  («file CSV», «foto profilo»). «Nelle ultime 24 ore» e non «oggi»: la finestra
  scorre, e alle 00:05 «oggi» sarebbe falso.
- Ogni tetto sta **dopo** i controlli che non costano niente: un file troppo
  grande, un filtro sbagliato o un conto archiviato non consumano un posto.
- L'export risponde `429` con la frase e `Retry-After`. `requireLiveUser()`
  dell'account ora restituisce anche la lingua.
- La coda delle ricevute in attesa regge il tetto a metà: la prima frase
  d'errore si mostra, e le ricevute non caricate restano in coda.

### Collaudo

- `supabase/tests/limiti.test.sql`, 21 prove: privilegi del registro e della
  funzione, il tetto per utente e per azione, l'attesa esatta, la finestra che
  scorre, gli errori, l'import con `SR429`, la cascata.
- Mutazioni dichiarate prima:

  | mutazione | cadute attese e viste |
  |---|---|
  | attesa contata dal più vecchio | l'attesa esatta (600) |
  | niente pulizia della finestra | le 2 prove della finestra |
  | import senza tetto (il corpo di prima) | il conteggio e il rifiuto `SR429` |
  | lock tolto | nessuna: la concorrenza vuole due sessioni, e non è provata |

- `tests/e2e/limiti.spec.ts`: un export vero, poi il registro riempito con la
  RPC dell'utente stesso. L'undicesimo export risponde `429` in italiano e, col
  cookie della lingua, in inglese; l'avatar caricato dalla pagina del profilo
  mostra la frase. Controprova: con la rotta che non consuma il suo posto, il
  test cade su «atteso 429, ricevuto 200». Il primo tentativo di controprova
  non era partito affatto: la mutazione non compilava, e il rosso era della
  build. Riscritta con il tipo giusto.
- pgTAP 83/83, Vitest 427, lint, `tsc`, `db:types:check`, end-to-end 13/13.
