# Costo delle richieste a Supabase, e la regione delle funzioni

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Costo delle richieste a Supabase (2026-08-08)

Il pannello Supabase segnava ~2300 richieste in un'ora di uso normale. Non era un
loop: era **fan-out architetturale**. Una vista della home costava **12 richieste**
— 5 auth + 7 REST — e si ripagava a ogni navigazione, a ogni `router.refresh()` e
dopo ogni `revalidatePath("/", "layout")`, cioè dopo ogni transazione salvata.
Ora ne costa **6**, con le chiamate auth a **zero**.

#### ⚠️ `auth.getUser()` è una chiamata di RETE, una per invocazione

È la trappola centrale, e non si vede leggendo il codice: `getUser()` **non legge
il cookie**, fa una `GET /auth/v1/user` verso GoTrue ogni volta e non memoizza
nulla. Siccome ogni loader apriva il proprio client e rifaceva il proprio
controllo, la home chiedeva **cinque volte la stessa risposta, in parallelo,
dentro lo stesso render**.

Il rimpiazzo è `getSessionUser()` in `lib/auth.ts`, che legge le **claims** del
JWT: firma verificata in locale con WebCrypto, JWKS in una cache di modulo di
`auth-js` (`GLOBAL_JWKS`, una volta per processo). Costo di rete a regime: zero.

- ⚠️ **Il risparmio dipende dal TIPO DI CHIAVE, non da questo codice.** Funziona
  perché il progetto usa chiavi JWT asimmetriche — si verifica con
  `curl $SUPABASE_URL/auth/v1/.well-known/jwks.json`, che deve rispondere
  `"alg":"ES256"`. Con un segreto simmetrico HS256 `getClaims()` ripiega **da
  solo** su `getUser()`: nessun errore, nessun avviso, e ogni chiamata torna a
  essere rete. È una regressione che nessun test coglie.
- ⚠️ **`SessionUser` è una FOTOGRAFIA, `User` era VIVO.** È la differenza che
  conta, e ignorarla è già costata un difetto (vedi sotto). Il tipo espone `id`
  — `sub` non cambia mai, quindi non può diventare stantio — e `email`, marcata
  come utilizzabile **solo per disegnare**. Niente `providers`: chi ha bisogno
  dei provider ha bisogno di quelli di adesso.
- **Le letture d'account restano su `getUser()`, ed è deliberato**: cambio email, cambio
  password, eliminazione account (`impostazioni/account/actions.ts`),
  `resetPassword`, il gate di `/reimposta-password` e il `/callback` subito dopo
  lo scambio del code. Le claims dicono che il token è autentico e non scaduto,
  **non che la sessione sia ancora viva**: un logout altrove non si vede fino
  alla scadenza dell'access token. Sul percorso di lettura non è una perdita —
  PostgREST valida quello stesso JWT allo stesso modo, quindi la RLS non avrebbe
  comunque visto la revoca — ma sulle operazioni sensibili la verifica lato
  server è esattamente ciò che si sta comprando, e là costa una chiamata per
  azione invece di cinque per render.

#### ⚠️ Il difetto che questa fase ha introdotto, e come si chiude

Trovato dal code-review, non dalla verifica manuale — che infatti era passata.

`getAccountContext()` era passata alle claims come tutto il resto. Ma quella
funzione serviva **due bisogni con requisiti di freschezza diversi**: la home
(avatar, iniziali, nome) e le pagine impostazioni (email e provider come
*fatto*, e come *conferma*). Sulle prime uno scatto vecchio è innocuo; sulle
seconde no.

**Perché l'email diventa stantia**: `/email-confermata` non è un flusso PKCE —
non scambia alcun `code` e quindi **non rinnova la sessione**. E `getSession()`
rinnova solo un token già *scaduto*, non uno che sta per esserlo. Quindi dopo un
cambio email confermato il JWT porta l'indirizzo vecchio per un'ora.

**La conseguenza**: `/impostazioni/elimina` passava a `DeleteAccountFlow`
l'email delle claims (vecchia), mentre `deleteAccount()` la confrontava con
quella di `auth.getUser()` (nuova). Digitare la nuova non abilitava il pulsante,
digitare la vecchia veniva rifiutato dal server: **account impossibile da
eliminare**. Stesso schema per `hasPasswordIdentity`, che la UI ricavava dalle
claims e il server da `user.identities` — due derivazioni della stessa domanda
nello stesso flusso, concordi per fortuna e non per costruzione.

**La chiusura è una separazione, non un ripiego a `getUser()` ovunque**:

| funzione | fonte | chi la usa |
|---|---|---|
| `getAccountContext()` → `AccountContext` | `auth.getUser()`, viva | le 5 pagine impostazioni |
| `getProfileHeader()` → `ProfileHeader` | claims | la home |

⚠️ **A garantirlo è il TIPO, non il commento.** `ProfileHeader` non espone
`email` né `hasPasswordIdentity`, quindi nessuna pagina che parta di lì può
usare per una conferma d'identità un dato che è una fotografia. La classe di
difetto non è mitigata: è **irrappresentabile**. Il costo è una chiamata auth
sulle sole impostazioni — una per vista, non cinque — e la home resta a zero.

**La regola generale**: quando si sostituisce una fonte viva con una copia
memorizzata, la domanda non è "il dato è lo stesso?" ma "**per quanto tempo può
divergere, e chi se ne accorge?**". Un campo che serve a disegnare e un campo
che serve a decidere hanno bisogni diversi anche quando contengono la stessa
stringa.

#### Un preambolo solo: `requireUser()`

Le quattro righe di apertura (client, utente, dizionario, controllo) stavano
copiate identiche in **32 server action su sei file**, e in un solo giorno hanno
dovuto cambiare due volte: prima per passare alle claims, poi per gestire
l'errore di `getClaims()`. Ogni volta una modifica a tappeto in cui **applicarla
a metà non si vede** — la stessa "migrazione a campione" descritta nella Fase 18.
Ora sono una chiamata: `const { supabase, user, t } = await requireUser()`.

⚠️ **`requireUser()` (`lib/auth.ts`) e `requireLiveUser()`
(`impostazioni/account/actions.ts`) NON sono intercambiabili**, e i nomi sono
diversi apposta: la prima legge le claims (fotografia), la seconda interroga
GoTrue (utente di adesso, `email` e `identities` compresi). Con lo stesso nome
basterebbe un import distratto per riaprire il difetto dell'eliminazione account.

#### Le risposte con i cookie di sessione non devono essere memorizzabili

`@supabase/ssr` passa a `setAll` un secondo argomento con
`Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`,
`Expires: 0`, `Pragma: no-cache`, e la sua documentazione dice perché:
*"Responses that set auth cookies must not be cached by CDNs or reverse proxies,
otherwise one user's session token can be served to a different user."*

- Nel **proxy** quegli header ora vengono tenuti da parte e applicati **anche al
  ramo di redirect**, che costruisce una risposta nuova e prima copiava i soli
  cookie: usciva un 307 con dei token in `Set-Cookie` e nessuna direttiva.
- ⚠️ **`lib/supabase/server.ts` NON può applicarli**, e non è una svista: in un
  Server Component `cookies()` non ha un canale per gli header di risposta, e in
  un Route Handler la `Response` nasce dopo il client. La copertura sta in
  `next.config.ts`, con una regola `headers()` sulle quattro rotte che scrivono
  cookie di sessione fuori dal proxy — `/callback`, `/auth/confirm` e i due
  signout. Verificata a runtime.

#### `cache()` su `createClient()`

Non è cosmesi: senza, la home istanziava cinque client, ognuno col proprio client
GoTrue. Con un'istanza sola per richiesta il rinnovo di un token scaduto avviene
una volta dentro il lock interno di GoTrue, invece che in cinque corse parallele
sullo stesso refresh token — **che è monouso**, la stessa classe di difetto già
documentata nel proxy.

⚠️ **Fuori da un render React `cache()` non memoizza e non solleva** (verificato,
React 19.2.7): nelle server action degrada al comportamento precedente, dove il
controllo si fa comunque una volta sola. Quindi è sicura ovunque, ma il guadagno
si vede **solo durante un render** — cioè esattamente nel caso che serviva.

#### Le query: due difetti dello stesso tipo

- **`getDashboardTotals` lanciava due query dove la seconda era un SOVRAINSIEME
  della prima** (una filtrata sul mese, una senza filtri). La filtrata non
  aggiungeva un solo dato: costava una richiesta e ritrasferiva le stesse righe.
- **`getNotifications()` chiamava `getUnreadCount()`**, che è una server action a
  sé: apriva un secondo client e rifaceva il proprio controllo auth per una query
  che parte comunque nello stesso `Promise.all`. Ora la query è estratta in
  `unreadCountQuery()`, condivisa fra le due.

#### `dashboard_totals()` — migration `20260808_dashboard_totals.sql`

Le somme della home le fa Postgres. Prima si scaricava **ogni transazione
dell'account**, tutta la storia, per produrre una trentina di numeri.

- ⚠️ **I confini dei mesi li calcola l'APP e li passa come parametro**, non
  `date_trunc` nel database. Oggi nascono da `new Date(y, m, 1)`, cioè nel fuso
  del processo che rende la pagina: UTC su Vercel, **ora italiana in sviluppo
  locale**. Spostare il calcolo nel DB li avrebbe fissati a UTC, cambiando in
  silenzio i totali della dashboard locale — e solo nelle prime ore del mese,
  cioè il momento peggiore per accorgersene. La chiusura pulita è `ClientClock`
  (Fase 17a), ma la home è un server component e non conosce il fuso dell'utente.
- **Un array di 7 confini, non due domande separate.** Il mese corrente **è**
  l'ultimo bucket del trend a 6 mesi (`m-5+i` con `i=5` è `inizioMese`):
  chiederli separatamente avrebbe sommato due volte le stesse righe.
- **`total` torna `numeric` senza precisione**, non `numeric(10,2)` come la
  colonna: una somma può superare le dieci cifre anche se nessun importo singolo
  lo fa, e il cast la farebbe fallire.
- ⚠️ **Ordine di deploy vincolante**: la migration va eseguita **prima** di
  pubblicare il codice, o la home risponde 404 sulla RPC. Nessun ripiego sulla
  vecchia strada, di proposito — un fallback silenzioso nasconderebbe una
  migration non eseguita e l'app girerebbe per mesi sulla via lenta.
- ⚠️⚠️ **`RETURN QUERY` di plpgsql pretende i tipi ESATTI; `language sql` no.**
  Una funzione SQL accetta qualsiasi tipo *binary-coercible* e converte in
  silenzio (`varchar` dove è dichiarato `text`, `int2` dove è dichiarato `int`).
  La prima versione di `dashboard_totals()` era `language sql` e funzionava
  proprio grazie a quell'indulgenza; aggiungendo il tetto su `p_bounds` è
  diventata plpgsql e la home è morta con
  `structure of query does not match function result type` — messaggio che **non
  dice quale colonna** e che compare solo all'esecuzione, non alla creazione
  (`create or replace` era passato senza un lamento). Ogni colonna restituita ha
  ora un cast esplicito. Non è ridondanza: lega la funzione alla propria firma
  invece che a un'assunzione sullo schema — che all'epoca **nessuno poteva
  verificare leggendo il repo**, perché `transactions` non era versionata. Da
  quando lo è (issue #43, `20260727`) l'assunzione è controllabile, e si vede
  che era **giusta**: `type` è davvero `character varying`, non `text`.

#### Il proxy: un redirect è un'AFFERMAZIONE

`updateSession()` scartava l'`error` di `getClaims()` esattamente come faceva
`getSessionUser()`. Stesso difetto, conseguenza peggiore: un JWKS irraggiungibile
o un GoTrue lento finivano nello stesso cesto di "token non valido", e l'utente —
con una sessione buona — veniva spedito su `/welcome`. Un redirect **dichiara**
"non sei autenticato", e lì era una dichiarazione falsa.

Ora su un errore di rete la richiesta **passa**. Non è un buco, ed è la parte che
va capita: ⚠️ **il proxy è una comodità di navigazione, non il perimetro di
sicurezza.** Il perimetro sono la RLS e il controllo che ogni pagina e ogni
action rifanno da sé — necessario comunque, perché una server action è
raggiungibile con una POST diretta. Verificato: tutte e dodici le pagine di
`(main)` passano da un loader che autentica. A valle `getSessionUser()` incontra
lo stesso guasto e solleva, quindi si vede una pagina d'errore: sgradevole ma
**vera e ricaricabile**, invece di un logout che mente.

#### ⚠️ Il travaso dei cookie nel redirect fa il contrario di quel che diceva

Il commento originale sosteneva di "salvare la rotazione" persa da un redirect
nudo. Riesaminato, **era sbagliato due volte**:

- la rotazione riuscita non passa quasi mai di lì — se il refresh va a buon fine
  `getClaims()` torna le claims, `user` è valorizzato e si esce dall'altro ramo;
- un `NextResponse.redirect()` senza `Set-Cookie` **non può cancellare niente**:
  non ha alcun header con cui farlo.

Ciò che arriva davvero in quel ramo è l'opposto: refresh **fallito**, sessione
dismessa da auth-js, e `setAll` che scrive delle **cancellazioni**. Inoltrarle è
comunque la cosa giusta — il token è morto, e ripulire impedisce al browser di
ripresentarlo a ogni richiesta. Il codice resta, il commento no.

⚠️ Rischio residuo dichiarato: sotto concorrenza una richiesta che perde la corsa
potrebbe cancellare i cookie appena scritti da una sorella. È mitigato **da
GoTrue, non da noi** — il *refresh token reuse interval* (10s di default) fa sì
che le richieste parallele con lo stesso refresh token ricevano tutte la stessa
sessione nuova invece di un errore, ed esiste esattamente per il burst di
prefetch dell'hard refresh. Se venisse portato a 0 nelle impostazioni Auth, quel
blocco va rivisto.

#### Cosa NON era il problema

Vale la pena saperlo prima di rimettere mano a questa zona:

- **Il proxy.** Gira su ogni richiesta ma usa già `getClaims()`, che con ES256
  non tocca la rete.
- **Il prefetch della `BottomNav`.** `node_modules/next/dist/docs/01-app/02-guides/prefetching.md`:
  le pagine dinamiche non si prefetchano senza `loading.js`, e nel repo non ce
  n'è nessuno. In sviluppo il prefetch automatico non gira proprio.
- **Polling.** Non ce n'è: `DashboardRefresher` reagisce a un contatore di
  Zustand, non a un timer.

#### Come misurare, la prossima volta

Il numero da guardare nel pannello Supabase non è il totale ma la **card Auth**:
se non è quasi piatta, da qualche parte è rientrato un `getUser()` sul percorso
di lettura.

#### Le funzioni stanno accanto al database (#148, 2026-11-03)

Fino al 2026-11-03 le funzioni Vercel giravano a **Washington** (`iad1`, il
predefinito: nessuno l'aveva scelto), mentre il database è in **Irlanda**
(`eu-west-1`, dal pannello di Supabase). Ogni query di ogni pagina e di ogni
server action attraversava l'Atlantico due volte. Ora `vercel.json` le fissa a
**`dub1` (Dublino)**.

- ⚠️ **La regione sta nel repo, non nel pannello di Vercel**: una scelta fatta
  solo dal pannello non si legge da nessuna parte, ed è così che `iad1` è
  rimasto per due mesi senza che nessuno lo sapesse.
- **Si verifica dall'header `X-Vercel-Id`** di una risposta dinamica
  (`curl -sI https://seichi-app.vercel.app/welcome`): il primo segmento è il
  nodo d'ingresso (`fra1` dall'Italia), il **secondo** è la regione della
  funzione. Deve dire `dub1`.
- ⚠️ Se un giorno il progetto Supabase cambia regione, `vercel.json` va
  spostato con lui: la regione giusta è quella del **database**, non quella
  dell'utente. Ogni pagina fa più query che richieste.
- Prima della modifica, da qui: `/welcome` mediana 266 ms, `/manifest.webmanifest`
  227 ms (10 campioni, `time_starttransfer`). Due rotte che non leggono il
  database: il guadagno vero è sulle pagine che lo leggono, da misurare dal
  telefono.

