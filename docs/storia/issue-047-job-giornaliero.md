# #47 — sorveglianza del job giornaliero

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Sorveglianza del job giornaliero (2026-08-09, issue #47)

Il guasto è emerso guardando a occhio una data in `/impostazioni/ricorrenti`: una
regola con `next_run` al 3 luglio che non aveva generato nulla.

⚠️ **L'ipotesi iniziale — "il cron non gira" — era SBAGLIATA**, e vale
registrarlo perché il modo in cui si è sbriciolata è il punto di questa sezione.
`cron.job_run_details` diceva `succeeded` ogni notte. La causa vera erano tre
difetti sovrapposti (migration `20260810_recurring_fixes.sql`):

1. **`transactions_type_check` non ammetteva `abbonamento`**, mentre
   `categories_type_check` e `recurring_rules_type_check` sì. Una categoria e una
   regola potevano essere `abbonamento`, la transazione che ne deriva **no**:
   nessun abbonamento ricorrente si è mai potuto materializzare, da quando quel
   tipo esiste. Difetto invisibile per la issue **#43** — nessun file descrive
   quei vincoli, quindi la divergenza fra tabelle sorelle non era leggibile.
2. ⚠️ **Una regola guasta abortiva TUTTE le altre.** `for r in … loop` non aveva
   `exception` per singola regola, quindi la prima che falliva fermava l'intera
   funzione — ecco perché non usciva nulla, nemmeno l'ETF che era valido. E dal
   cron `auth.uid()` è NULL: i dati di un utente potevano fermare le ricorrenti
   di **tutti**.
3. **`run_daily_jobs()` trasformava l'errore in `succeeded`.** L'`exception`
   della 17b protegge gli insert finanziari, ma catturando il guasto fa ritornare
   la funzione normalmente, quindi pg_cron registra successo. Prima del
   2026-08-04 `job_run_details` almeno diceva `failed`; dopo ha smesso.

**La lezione, e vale oltre questo caso: isolare un guasto senza registrarlo lo
rende invisibile.** Per questo `generate_recurring_transactions()` ora
**restituisce il numero di regole saltate** invece di `void`: senza quel valore,
l'isolamento per-regola avrebbe ricreato lo stesso silenzio un livello più in
basso.

Due cose trovate per strada, entrambe dai vincoli reali:

- ⚠️ **`transactions.type` è `character varying`, non `text`.** È la **conferma
  retroattiva** che i cast espliciti in `dashboard_totals()` non erano una
  precauzione ma una necessità.
- ⚠️ **`transactions.frequency` esiste e non è documentata qui**, con vocabolario
  inglese (`weekly/monthly/yearly`) mentre `recurring_rules.frequency` usa
  l'italiano. Residuo pre-Fase 14. La riga di DETAIL dell'errore mostra 13 valori
  dove questo documento elenca 10 colonne: ce ne sono altre due da mappare.
  **Chiuso dalla issue #43 il 2026-08-12**: le altre due erano `is_ricurrent` e
  `parent_id`, tutte e tre residui pre-Fase 14 e tutte NULL, rimosse dalla
  `20260813`. Che il conteggio delle colonne di un messaggio d'errore fosse
  l'unico modo per accorgersene è precisamente ciò che la #43 esisteva per
  chiudere.
- ⚠️ **`generate_recurring_transactions()` non aveva grant espliciti** e si
  affidava al default su PUBLIC — di cui `anon` è membro. Chiunque con la chiave
  pubblicabile poteva invocare una funzione SECURITY DEFINER che con
  `auth.uid()` NULL scrive per tutti gli utenti. Ora ha la coppia
  revoke/grant come ogni altra funzione dalle Fasi 16-17.

- ⚠️ **L'allarme NON può essere una notifica, né un secondo cron.** Le notifiche
  le genera il job: se è morto non può annunciarlo. E un cron di sorveglianza
  soffrirebbe lo stesso guasto — se pg_cron non gira, non gira nemmeno lui.
  L'unica posizione sana è **alla lettura**, su una traccia che il job lascia.
- **`job_runs`** (migration `20260809_job_runs.sql`): una riga per passo per
  esecuzione, con `run_at` uguale per tutti i passi dello stesso giro — è ciò che
  permette di chiedere "l'ultima esecuzione è andata bene *per intero*". Gli
  `insert` nei rami `exception` **persistono**: `begin … exception … end` apre una
  sottotransazione, e il gestore gira in quella esterna.
- ⚠️ **RLS abilitata e NESSUNA policy**, deliberatamente. In scrittura è un
  registro del server come `notifications`; in lettura è un dato **globale**, e
  un errore prodotto dai dati di un utente non deve comparire sullo schermo di un
  altro. Si legge solo da `daily_job_health()`, che restituisce **tre fatti e
  nessun testo d'errore** — `details` resta nel database.
- **La soglia sta in TypeScript** (`DAILY_JOB_STALE_HOURS = 36`), non in SQL: è
  una decisione di prodotto e cambiarla non deve richiedere una migration.
  36 ore e non 24 perché il cron gira alle 03:00 e un singolo ritardo non è un
  guasto.
- **Un seme all'installazione.** Senza righe, `last_run_at` è NULL e "mai girato"
  va trattato come il caso peggiore — giusto, ma appena eseguita la migration il
  job non ha *ancora* avuto occasione di girare, e l'avviso comparirebbe a torto.
  La migration inserisce una riga con `step = 'installed'` che fa partire il
  cronometro: non dichiara che un lavoro è stato svolto, dichiara "da qui mi
  aspetto un giro al giorno".
- ⚠️ **L'avviso sta in `/impostazioni` e `/impostazioni/ricorrenti`, NON in home.**
  Scelta di costo: la home è appena passata da 12 a 6 richieste, e un controllo
  di salute lì sarebbe una richiesta REST in più **a ogni vista**, pagata sempre,
  anche a job sano. Le ricorrenti sono la pagina i cui dati *sono* sbagliati
  quando il job è fermo, quindi è là che l'avviso ha significato. La riga in
  impostazioni compare solo in caso di problema: una spia sempre verde smette di
  essere guardata.
- **Ambra, non rosso**: in questa app il rosso significa "uscite", e prestarlo a
  un allarme di sistema confonderebbe i due. L'ambra è già il livello
  "attenzione" delle barre budget all'80%.
- `daily_job_health()` è **`language sql`** e con cast espliciti su ogni colonna:
  vedi la trappola di `dashboard_totals()` qui sotto — `RETURN QUERY` di plpgsql
  pretende i tipi esatti e falliva solo a runtime.

#### Il collaudo — migration eseguite e verificate il 2026-08-09

`20260809_job_runs.sql` e `20260810_recurring_fixes.sql` **eseguite** (in
quest'ordine, che è vincolante). Verifica end-to-end superata, idempotenza
inclusa. Le righe di `job_runs` raccontano la vicenda intera e vanno lette in
sequenza, perché è la seconda a dare valore a tutte le altre:

| quando | passo | esito |
|---|---|---|
| 08/08 12:32 | `installed` | il seme che avvia il cronometro |
| 08/08 12:34 | `recurring` | **`error`** — `transactions_type_check`, catturato |
| 08/08 12:46 | entrambi | `ok` — dopo la `20260810` |
| **09/08 03:00** | entrambi | `ok` — **il cron vero**, non una corsa a mano |
| 09/08 15:14 | entrambi | `ok` — corsa manuale, nessun insert |

⚠️ **La riga in `error` è la prova che conta, e serviva vederla.** Solo righe
verdi non avrebbero distinto "il meccanismo funziona" da "il meccanismo è cieco
quanto pg_cron": quel guasto era rimasto invisibile per cinque settimane proprio
perché `job_run_details` diceva `succeeded`. Vale come regola di metodo — **un
registro di guasti non è collaudato finché non ha registrato un guasto.**

Gli arretrati sono stati recuperati in **un solo giro** (i `created_at` delle tre
transazioni generate sono identici): `Orange palestra` 39,90 datata **3 luglio** e
3 agosto, `Spotify` 12,00 datata 5 agosto, tutte con `recurring_rule_id`
valorizzato. La prima è letteralmente la riga del `DETAIL:` dell'errore citato in
testa alla migration. I `next_run` sono ora tutti al futuro (03/09, 05/09, 08/09).

⚠️ **`details` NULL con `status = 'ok'` significa zero regole saltate**, non
"nessuna informazione": se ce ne fossero state, `run_daily_jobs()` avrebbe scritto
`error` col conteggio. È il valore di ritorno di `generate_recurring_transactions()`
che rende leggibile la differenza.

I passi registrati sono **due** — `recurring` e `notifications`. La "pulizia"
nominata nella 17b non esiste più: cancellare le notifiche era il bug documentato
là sopra (libera la `dedup_key` e il generatore rifà la notifica).

⚠️ **Il collaudo dal SQL Editor è rappresentativo del cron**, e non per caso: in
quella sessione non c'è JWT, quindi `auth.uid()` è NULL esattamente come
dall'esecuzione notturna, e la funzione lavora su tutti gli utenti. Se l'avesse
lanciata un utente autenticato via RPC, avrebbe toccato solo i propri dati e non
avrebbe detto nulla sul comportamento del job.

#### Emerso dal code-review — la sorveglianza affermava più di quanto sapeva

✅ **Migration `20260811_job_health_fixes.sql` ESEGUITA** (dopo la `20260809` e
la `20260810`). Cambia il tipo di ritorno di `daily_job_health()`: senza, le due
pagine impostazioni chiamerebbero una firma che non esiste più.

⚠️ **Questa riga ha detto "DA ESEGUIRE" per una settimana mentre non era vero**,
e vale registrarlo perché è la stessa classe di difetto che questo documento
insegue altrove: *una fonte che afferma qualcosa sul mondo senza che nessuno
l'abbia verificata*. Il codice aveva già smesso di essere compatibile con la
firma vecchia — `lib/jobs.ts` legge `failed_steps` e `watching_since`, che solo
la nuova produce — quindi le due affermazioni si contraddicevano **dentro il
repo**, e dal repo non era decidibile quale fosse giusta. Verificato il
2026-08-20 interrogando il catalogo:

```
last_run_at   2026-08-20 03:00   ← il cron della notte
last_ok_at    2026-08-20 03:00   ← andato a buon fine
had_error     false
failed_steps  []                 ← array vuoto, mai NULL, come prescritto
watching_since 2026-08-08 12:32  ← il seme `installed`
```

⚠️ Il guasto che sarebbe seguito **non era un errore**: con la firma vecchia i
due campi tornano `undefined`, `failed_steps` diventa `[]` e `watching_since`
`null` — e in TypeScript `lastOkAt === null` significa `stale`. Cioè l'avviso
"job fermo" a torto, dal primo minuto: proprio ciò che il seme esiste per
impedire. **Il marcatore stantio era più pericoloso della migration mancante**,
perché mandava a cercare il difetto dalla parte sbagliata.

Il guasto era chiuso, ma il meccanismo costruito per sorvegliarlo diceva il falso
in tre casi. **Sono lo stesso difetto in tre travestimenti**, ed è la classe già
elevata a regola nella Fase 18 — *un lampo di colore era messo in conto, una
dichiarazione falsa no.*

- ⚠️ **Il seme `installed` era scritto `status = 'ok'`**, quindi finiva in
  `last_ok_at`: l'app annunciava "ultimo controllo riuscito: 3 giorni fa" per un
  job che non aveva eseguito un solo passo. E siccome la tabella non è mai vuota,
  `t.jobHealth.never` era **irraggiungibile**: l'unico messaggio che descriveva
  davvero quello stato era codice morto in due lingue.
  ⚠️ **La correzione ovvia era sbagliata.** Togliere il seme da `last_ok_at` e
  basta lo rende NULL su un database appena migrato, e in TypeScript
  `lastOkAt === null` significa `stale` → l'avviso a torto dal primo minuto,
  cioè proprio ciò che il seme esisteva per impedire. Servono **due fatti
  distinti**: `watching_since` (l'inizio del cronometro) e `last_ok_at` (una
  riuscita). Erano stati confusi in una colonna sola.
- ⚠️ **Il verdetto schiacciava i due passi in un booleano e buttava via `step`.**
  Un guasto nelle sole notifiche faceva scrivere "i movimenti ricorrenti non
  vengono registrati" mentre erano stati registrati. La tabella sapeva quale
  passo era fallito; la funzione lo perdeva. Ora `failed_steps` esce dalla RPC e
  `DailyJobScope` (`lib/jobs.ts`) sceglie quale delle due frasi è lecita.
- ⚠️ **`job_runs` è GLOBALE**, quindi una regola saltata di un utente marcava
  `recurring / error` per l'intera esecuzione e l'allarme compariva sulle
  impostazioni di **tutti gli altri**, le cui ricorrenti erano state generate
  perfettamente. Non si chiude rendendo la tabella per-utente — è globale per la
  stessa ragione per cui `details` non esce verso il client — ma **abbassando la
  pretesa dell'affermazione**: terzo stato `partial`, che resta registrato senza
  alzare un allarme che parlerebbe a nome di chi non c'entra.
  Buco dichiarato: l'utente della regola saltata non riceve alcun segnale. Là una
  *notifica* sarebbe la sede giusta — il job è vivo, quindi può generarla, a
  differenza dell'allarme "job morto" che per costruzione non può esserlo.

**E un silenzio che sarebbe tornato da solo:** fino alla `20260811` i file con
`cron.schedule` erano la `20260809` e la `20260804` (qui c'era scritto "l'unico
file era la `20260809`", ed era falso — vedi la #123: la `20260804` rieseguita
cancellava le notifiche), quindi era là che si tornava per riagganciare il job —
ma la `20260809` contiene anche la **propria** versione di
`run_daily_jobs()`, quella che scarta il conteggio delle regole saltate.
Rieseguirlo dopo la `20260810` avrebbe restaurato il difetto originale senza un
errore e senza traccia. Due difese: una **guardia** in testa alla `20260809` che
si rifiuta di girare fuori ordine (riconosce la `20260810` dal tipo di ritorno di
`generate_recurring_transactions()`, che passa da `void` a `integer`), e la
regola che ne discende — **il file più recente dev'essere autosufficiente**, così
non c'è mai motivo di tornare indietro.

Tre correzioni di testo, tutte della stessa famiglia:

- **`hint` diceva "Controlla lo stato del database"** — in entrambe le lingue,
  tre righe sotto un commento che vieta di nominare il meccanismo. Era anche
  l'**unica** frase azionabile dell'avviso, rivolta a un utente che non ha né
  database né credenziali. Ora l'azione è quella vera: inserire a mano nel
  frattempo.
- ⚠️ **`formatRelativeTime` oltre i 7 giorni perde l'anno**: il default
  (`{day, month}`) è tarato sul campanello, dove le righe sono recenti per
  costruzione. Questo avviso si vede **solo da fermo**, quindi "3 luglio" non
  distingue cinque settimane da diciassette mesi — cioè l'unica cosa che quel
  testo esiste per dire. Il formato è ora un parametro opzionale.
- La riga del job era l'**unica `href` senza `chevron`** della pagina: si leggeva
  come un'etichetta di stato invece che come l'ingresso alla spiegazione.

Restano aperti, come commit separati: `createRecurringRule()` che scarta errore e
conteggio dell'RPC (`app/(main)/action.ts`), `details` che porta il conteggio ma
non gli id delle regole, ~~`search_path to 'public'` in
`generate_recurring_transactions()` dove tutte le altre usano `''`~~ (chiuso
dalla `20260821`, #123), `logged_at` che nessuno legge, e il `Promise.all` di `/impostazioni` che affianca una
funzione capace di `redirect()` a una promise che resterebbe non osservata.

