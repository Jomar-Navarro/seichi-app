# #162 — l'archivio completo: tutti i dati in uno ZIP

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Il problema

Il diritto alla portabilità (art. 20 GDPR, la #135 §2) copre tutti i dati
forniti dall'utente. L'export CSV della 23a copriva solo i movimenti: restavano
fuori profilo, conti, categorie, budget con la storia, obiettivi, ricorrenti,
notifiche, import e i file delle ricevute.

### Il progetto (2026-11-18, deciso con Jomar)

Un archivio ZIP da `/impostazioni/esporta`, sotto il CSV, con una rotta sua:
`/impostazioni/esporta/archivio`. Quattro decisioni, ciascuna fra due o tre
proposte:

| domanda | scelta | scartato |
|---|---|---|
| come si scrive lo ZIP | **a mano**, `lib/export/zip.ts`, con `zlib.crc32` e `deflateRawSync` di Node 24 | `fflate` (piccola, ma una dipendenza per ciò che la libreria standard fa già), `archiver` (una catena di stream) |
| una ricevuta che non si scarica | **un secondo tentativo, poi la si salta e la si dichiara** | troncare la connessione: un file corrotto che alcuni browser salvano lo stesso |
| il tetto | **un'azione nuova, `archive`, 3 al giorno** (`20261120_rate_limit_archive`) | riusare `export` (10 l'ora): un archivio costa circa cento volte un CSV, e un'ora di CSV avrebbe bloccato l'archivio |
| l'email nel profilo | **`requireLiveUser()`**, spostata in `lib/auth.ts` | le claims, che dopo un cambio portano l'indirizzo vecchio per un'ora |

### Cosa c'è dentro

- `data/<tabella>.json` per profile (tutte le colonne di `profiles` tranne
  `id`, più email e metodi di accesso), accounts, categories, transactions,
  recurring_rules, budgets, notifications, imports, attachments: i nomi delle
  colonne del database, fissi in ogni lingua, perché sono per i programmi;
- `manifest.json`: formato, versione, righe per tabella, ricevute attese,
  incluse e mancanti, stato della foto profilo;
- `LEGGIMI.txt` / `README.txt`, nella lingua dell'utente, con BOM e a capo di
  Windows: cosa contiene ogni file, come leggere importi, date, saldi e lapidi;
- `movimenti.csv`: lo stesso file dell'export, su tutto il periodo, dalla
  stessa funzione (`transactionCsvRows()`, estratta dalla rotta del CSV);
- `ricevute/<data del movimento>_<id>.<ext>` e la foto profilo, se è un file
  nostro.

Fuori, deliberatamente: `user_id` (uguale ovunque), `storage_path` (un
indirizzo interno, sostituito da `file`), `rate_events` (un registro contro gli
abusi, non un dato fornito), `job_runs` (di nessun utente), il PIN (un segreto
del dispositivo). Re-importabilità non promessa, come nella 23a.

### Le scelte della rotta

- **Il tetto prima delle letture**, non dopo come proponeva il primo progetto:
  le letture sono il lavoro, e un tetto controllato dopo averle fatte
  lascerebbe leggere tutto il database a ripetizione. Una lettura fallita
  consuma il suo posto, come nel CSV.
- **Tutto il database prima dello stream**: dopo la prima voce lo stato 200 è
  partito, e un errore non può più diventare una risposta.
- **Le ricevute nello stream**, con 4 download in anticipo e l'ordine
  dell'elenco; `attachments.json`, il manifest e il LEGGIMI si scrivono per
  ultimi, quando si sa quali ricevute sono entrate. Lo ZIP mette l'indice in
  coda, quindi costa niente.
- **`maxDuration = 300`**, il tetto del piano Hobby con Fluid compute. ⚠️ Va
  controllato nel pannello Vercel che Fluid compute sia attivo: senza, il
  limite è più basso e un archivio grande si interrompe a metà.
- **Niente ZIP64**: oltre 65.535 voci o 4 GB, `fitsInZip()` lo dice prima
  dello stream, con un messaggio suo (`troppo-grande`). Il writer solleva
  comunque se ci si arriva.
- **L'avatar solo dalla cartella dell'utente**: `avatar_url` lo scrive
  l'utente, e un URL verso la cartella di un altro avrebbe messo il suo file
  nell'archivio sbagliato.

### Testi toccati accanto

Il titolo della pagina e la voce delle impostazioni dicevano «Esporta
transazioni»: con l'archivio sono diventate «Esporta dati». La nota del CSV
(«le ricevute restano fuori») ora rimanda all'archivio più in basso.

### Collaudo (2026-11-18)

- **Vitest**: lo ZIP riletto da un lettore scritto a parte
  (`tests/e2e/support/zip.ts`), il vettore CRC noto, i nomi UTF-8, lo *zip
  slip*, il limite delle voci; i nomi, l'avatar e il LEGGIMI dell'archivio.
- **pgTAP** (`limiti.test.sql`, 25 prove): `archive` concessa tre volte e
  rifiutata alla quarta con un'attesa entro le 24 ore; il vincolo allargato
  rifiuta ancora un'azione sconosciuta. Controprova: la funzione della
  `20261119` (senza `archive`) fa cadere la prova 15 e solleva `22023`.
- **Playwright** (`archivio.spec.ts`): due ricevute, una tolta dal bucket.
  L'archivio passa `unzip -t`, contiene ogni tabella con le righe del
  database, dichiara la ricevuta mancante nei tre posti; la quarta richiesta è
  429 con la frase; senza sessione un rinvio all'ingresso (lo fa già il proxy,
  verso `/welcome`). Controprove: una ricevuta mancante scritta come voce
  vuota fa cadere l'elenco delle voci; senza il tetto la quarta risposta è 200.
- **Carico**, sul Supabase locale con il server nello stesso processo:
  - 250 ricevute da 500 kB, archivio di 122 MB: intestazioni dopo 70 ms,
    completo in 2,2 s, picco di memoria +69 MB; 100 ricevute (49 MB): +65 MB.
    Il picco non cresce con l'archivio.
  - Controprova, la rotta che raccoglie tutto in memoria prima di rispondere:
    +171 MB a 100 ricevute, +295 MB a 250.
  - ⚠️ In locale lo Storage risponde in millisecondi. In produzione ogni
    download attraversa la rete fra `dub1` ed `eu-west-1`: il tempo vero si
    misura col primo archivio scaricato da un account con molte ricevute.

### Dopo la review del coordinatore (2026-11-18, approvate da Jomar)

- **Il profilo con `select("*")`**, togliendo solo `id`. La prima versione
  elencava le colonne: `profiles.first_steps_dismissed_at`, che la #163 sta
  aggiungendo, sarebbe uscita dall'archivio in silenzio — la migrazione a
  campione. Il LEGGIMI ora descrive il profilo con un elenco aperto («nome,
  valuta, lingua, tema…»).
- **Un download non risponde mai con un errore in testo.** I due comandi sono
  `<a>` nudi: il browser naviga verso la rotta, e un 429 o un 500 in testo
  diventava una pagina bianca. Nella PWA installata su iOS, senza barra e senza
  tasto indietro, l'utente restava chiuso fuori dall'app. Valeva anche per il
  CSV, dal 429 della #161.
  - Ora ogni errore è un **303 verso `/impostazioni/esporta?errore=<codice>&per=<comando>`**,
    più `&attesa=<secondi>` per il limite. I codici sono un elenco chiuso
    (`filtro`, `limite`, `lettura`, `troppo-grande`, `rete`), ciascuno valido
    solo per il comando che può produrlo; un codice sconosciuto si ignora
    (`lib/export/download-error.ts`, con i suoi test). L'URL porta un codice,
    mai una frase: la frase la compone la pagina dal dizionario, accanto al
    comando giusto.
  - La sessione scaduta resta un rinvio a `/sign`.
  - **Scelta dichiarata**: dopo averlo mostrato, la pagina toglie il codice
    dall'URL con `history.replaceState` (`ForgetExportError`). L'avviso resta
    a schermo, ma un ricarico non ripete un guasto forse passato né un'attesa
    ormai vecchia. `router.replace` è scartato: rifarebbe la pagina, e l'avviso
    sparirebbe appena comparso.
  - «Filtro non valido: torna indietro e riprova» diceva di tornare indietro a
    chi è già sulla pagina, con i filtri tornati ai valori iniziali: ora
    «scegli di nuovo i filtri e riprova».
  - Cercati gli altri download con `<a>` nudo: sono solo questi due. Il report
    stampabile (`/analisi/report`) è una pagina, con i suoi stati d'errore.
- **Collaudo del rinvio** (2026-11-18, database ricostruito da zero): pgTAP
  87/87, Playwright 14/14, compresi `archivio.spec.ts` e `limiti.spec.ts`
  aggiornati (303 con il codice, la frase sulla pagina in italiano e in
  inglese, l'URL che torna pulito). Controprova: senza `consumeRateLimit` la
  quarta richiesta dell'archivio risponde 200 invece di 303, e lo scenario
  cade lì.

### Il collaudo nell'app vera, insieme alla #163 (2026-11-18)

Le due issue montate una sull'altra, su `next start` e sul Supabase locale
ricostruito con entrambe le migration: pgTAP 105/105, tipi coincidenti, la
suite intera verde (lo scenario dell'onboarding è caduto una volta su un
timeout dell'Auth locale sotto sei processi, e da solo passa: il codice
dell'onboarding non è toccato). Un account usa e getta ha percorso tutto a
mano, con gli scatti: la card dei primi passi, la chiusura, tre ricevute,
l'archivio. Nell'archivio `profile.json` porta `first_steps_dismissed_at`
della #163: il `select("*")` della review l'ha preso da solo.

**Il difetto che solo gli scatti hanno visto.** Superato il tetto, il tocco su
«Scarica l'archivio» — in fondo alla pagina — riportava alla pagina con
l'avviso, ma la pagina si ricaricava DALL'INIZIO: l'avviso stava fuori schermo,
sotto la BottomNav, e sembrava che non fosse successo niente. Lo scenario era
verde, perché `toBeVisible()` guarda il DOM e lo stile, non lo schermo.

- Il rinvio porta un'ancora, `#csv` o `#archivio`, e le due sezioni hanno
  quell'`id`, con lo `scroll-mt` della safe-area.
- Gli scenari controllano anche `toBeInViewport({ ratio: 1 })`. Controprova:
  senza `id="archivio"` l'avviso è al 47% nello schermo, e lo scenario cade lì.
- **L'ancora da sola non bastava.** Verde con tre scenari, rossa nella suite
  intera con sedici in parallelo, con lo stesso 47%: il browser al caricamento
  a volte scorre e a volte no. Ora lo scorrimento lo fa `ForgetExportError`
  dopo l'idratazione (`scrollIntoView` con `scrollBehavior()`), quando la
  sezione c'è di sicuro; l'ancora resta per chi non ha ancora JavaScript. È
  il controllo nuovo ad averlo trovato: senza `toBeInViewport` sarebbe stato
  un difetto intermittente in produzione.
