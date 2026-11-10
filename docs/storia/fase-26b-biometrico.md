# Fase 26b — blocco biometrico

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 26b — Blocco biometrico (issue #67)

Implementata il 2026-09-10. Chiude la seconda metà dell'issue #67, lasciata
esplicitamente fuori scope dalla 26a ("merita la propria PR"). Nessuna
migration: come il PIN, vive interamente in `localStorage`/cookie del
browser — Supabase non sa che questa funzione esiste.

#### ⚠️⚠️ WebAuthn richiede un secure context, e l'IP di LAN non lo è

Verificato **prima** di scrivere una riga, come chiede il punto 3
dell'issue #67 ("verificare cosa offre davvero il browser"). `localhost` è
esente; `http://192.168.x.x:3000` — l'indirizzo di ogni collaudo da telefono
di questo progetto dalla Fase 22 in poi — **no**. È la stessa classe di
difetto già registrata per `crypto.randomUUID()`: un'API disponibile solo in
un contesto che il collaudo-da-telefono-su-LAN di questo repo non soddisfa.

Conseguenza pratica: il prompt biometrico **vero** (Face ID/Touch ID reali)
si può collaudare solo da `localhost` (con Windows Hello, se configurato)
o da un URL HTTPS reale (un preview Vercel, o prod) — mai dalla LAN. Buona
notizia trovata nella stessa ricerca: iOS supporta pienamente Face ID/Touch
ID via WebAuthn **dentro una PWA installata** da home screen, non solo in
Safari — punto 4 dell'issue chiuso senza ostacoli.

#### La decisione di architettura: nessuna verifica crittografica

WebAuthn è un protocollo challenge-response pensato per un server che
verifica una firma. Qui non c'è un server — è un blocco locale, come il PIN.
Due strade, discusse prima di scrivere codice:

- **A (scelta)** — nessuna verifica della firma: la promise risolta di
  `navigator.credentials.get()` con `userVerification: "required"` **è** la
  prova. Verificare la firma lato client contro una chiave pubblica che
  l'app stessa emette e verifica nello stesso contesto non difenderebbe da
  nessun attaccante compreso nel modello di minaccia dichiarato — chi può
  eseguire codice arbitrario in quel contesto può già chiamare `onUnlock()`
  direttamente, esattamente come può già leggere `readStoredPin()` in
  chiaro. Aggiungerebbe solo il parsing della chiave pubblica COSE e
  WebCrypto: complessità reale per una difesa immaginaria, la stessa
  illusione già scartata per l'hash del PIN nella 26a.
- **B (scartata)** — verifica reale della firma via WebCrypto lato client.

#### Il biometrico vive SOTTO il PIN, mai al suo posto

`registerBiometric()`/`verifyBiometric()`/`clearBiometric()` in
`lib/app-lock.ts`. Nessun terzo cookie: il server continua a sapere solo "un
PIN è configurato" e "fino a quando vale lo sblocco" — è indifferente a
COME l'utente ha sbloccato l'ultima volta. `markActiveNow()` è infatti
l'unica funzione chiamata da entrambi i percorsi di sblocco.

- **`challenge` e `user.id` sono byte casuali generati LOCALMENTE**, non da
  un server: non ce n'è uno, e non ce n'è bisogno — vedi sopra.
  `attestation: "none"` perché nessuno verificherà mai l'attestazione.
- ⚠️ **`clearPin()` ora chiama anche `clearBiometric()`.** Il biometrico
  senza un PIN che lo regga sarebbe uno stato che non serve a nulla (senza
  `seichi-lock-enabled` il velo non compare mai) e che riapparirebbe "già
  attivo" se l'utente rimettesse un PIN in futuro, senza aver mai rifatto
  la cerimonia col PIN nuovo.
- **La riga "Blocco biometrico" standalone in `/impostazioni` è stata
  rimossa**, non attivata. Il biometrico dipende dal PIN (si accende solo
  quando il PIN è già attivo), quindi una seconda riga a livello della
  pagina principale sarebbe stata un secondo chevron verso la STESSA
  destinazione di "Blocco con PIN", con lo stesso stato duplicato in due
  posti — la stessa classe di ramo morto già corretta più volte in questo
  progetto (`ProfileMenu`, otto voci di dizionario nella 20a). Con lei è
  sparita anche `t.settings.comingSoon` ("presto"), rimasta orfana.
- **Tre stati sulla riga**, non due: "non ancora verificato" (il controllo
  di disponibilità è asincrono, `isBiometricAvailable()`), "non disponibile
  su questo dispositivo" (nessun lettore, o contesto non sicuro — dice il
  vero invece di un "presto" che suggerirebbe un limite dell'app invece che
  del dispositivo), "disponibile" (interruttore vero).
- **Sulla schermata di sblocco il bottone biometrico è un TOCCO esplicito**,
  mai invocato da solo al montaggio: WebAuthn richiede quasi ovunque un
  gesto dell'utente per `get()`, e un bottone lo garantisce senza dover
  verificare browser per browser quali lo richiedano davvero. Se annullato
  o fallito, silenzio: si ricade sul PIN, che resta a schermo sotto un
  divisore "oppure" — un tentativo biometrico mancato non è un "PIN errato"
  e non deve contare per la via di fuga a 3 tentativi.

#### Il code-review pre-collaudo — 4 difetti, 2 con una corsa reale dietro

Tre agenti indipendenti sono convergenti sugli stessi due difetti principali,
confermando che non erano rumore:

- ⚠️⚠️ **Corsa fra `registerBiometric()` e `clearPin()`.** La cerimonia
  `create()` può restare in sospeso fino al `timeout` di 60s. Se nel
  frattempo l'utente rimuove il PIN (`clearPin()` → `clearBiometric()`) e
  POI la cerimonia sospesa si risolve con successo, `registerBiometric()`
  scriveva comunque la credenziale in `localStorage` — resuscitando
  esattamente lo stato "biometrico attivo senza un PIN sotto" che
  `clearPin()` esiste per impedire. L'invariante era garantita solo dal
  CHIAMANTE (la riga compare solo a PIN acceso), non dal modulo che la
  dichiara. Corretto con un controllo `hasStoredPin()` dentro
  `registerBiometric()` stesso, appena prima di scrivere: l'invariante ora
  si difende da sé, non dipende da chi la chiama.
- ⚠️ **Il messaggio di errore del biometrico sopravviveva alla sua stessa
  riga.** `biometricError` era un sibling di `SettingsGroup`, fuori dal
  blocco `hasPin && (...)` che contiene la riga a cui si riferisce, e
  `reset()` non lo azzerava. Rimuovendo il PIN dopo un tentativo fallito, la
  riga spariva ma il testo "Non è stato possibile attivare…" restava a
  descrivere un interruttore che non c'era più — e la stessa frase
  fantasma poteva ripresentarsi dopo un "Cambia PIN" riuscito. Doppia
  chiusura: `reset()` lo azzera sempre, e il render è ora dietro
  `hasPin && biometricError` come seconda difesa.
- **`PinPad` non si disabilitava durante `biometricBusy`**: un PIN corretto
  digitato mentre la cerimonia biometrica era ancora in sospeso poteva
  chiamare `onUnlock()` due volte per due percorsi indipendenti — innocuo
  oggi perché `unlock()` è idempotente, ma senza motivo per poter correre
  insieme. Ora `disabled={signingOut || biometricBusy}`.
- **Nessun `try/finally` attorno a `registerBiometric()`/`verifyBiometric()`
  nei chiamanti** — la stessa classe già pagata tre volte in questo
  progetto (Fase 21, 22, 24a): un'eccezione futura avrebbe lasciato
  `biometricBusy` bloccato a `true` per sempre. Aggiunto in entrambi,
  anche se nessuno dei due lancia oggi.

Non applicati, per scelta: auto-invalidare la credenziale al primo rifiuto
biometrico (un singolo Face ID sbagliato per errore disattiverebbe la
funzione senza preavviso — peggiore del bottone che continua a esserci e
ricade sul PIN), un timeout difensivo sul controllo di disponibilità
(nessuna prova che si blocchi mai, e nessun'altra API del browser in questo
progetto ne ha uno), e l'estrazione di un helper condiviso per il
sottoscrittore no-op di `useSyncExternalStore` (il file usa già due volte
lo stesso idioma inline per `hasPin`/`storedGraceMs`; introdurre un import
per le sole righe nuove avrebbe reso incoerente proprio questo file).

#### Il collaudo: un autenticatore VIRTUALE via Chrome DevTools Protocol

Tecnica nuova per questo repo, degna di nota per fasi future che tocchino
WebAuthn: Chromium espone un dominio CDP (`WebAuthn.*`) che simula un
platform authenticator senza hardware reale —
`WebAuthn.addVirtualAuthenticator` con `transport: "internal"`,
`hasUserVerification: true`, `isUserVerified: true`,
`automaticPresenceSimulation: true` approva ogni cerimonia da solo. Gira su
`localhost` (secure context) dentro lo stesso driver Playwright ad hoc già
usato per le altre fasi, sola lettura sul database (PIN e biometrico non
toccano mai Supabase).

Nove prove: impostazione PIN, riga biometrica che diventa un interruttore
attivabile (non "non disponibile" — cioè che `isBiometricAvailable()` vede
l'autenticatore virtuale), attivazione, sblocco vero dopo la scadenza della
finestra di grazia, sblocco che sparisce col velo, rifiuto biometrico che
lascia il velo su, PIN che sblocca comunque dopo il rifiuto. **9/9 OK**,
zero errori console, confermato guardando gli screenshot (non solo il
referto): il bottone resta interattivo dopo un rifiuto, mai uno stato
"premuto per sempre".

⚠️ **Il primo giro del test di rifiuto ha mentito**, ed è di nuovo la
regola già scritta più volte in questo documento: *un controllo che
segnala un guasto va diagnosticato prima di crederci*. `removeVirtualAuthenticator`
toglie qualunque dispositivo possa rispondere, e con `enableUI:false`
Chrome non ha nulla da fare: resta ad ASPETTARE il `timeout` di 60s passato
a `get()`, invece di rifiutare subito. Il fix del `disabled` sul PinPad
(sopra) lo ha reso visibile: il tastierino restava correttamente
disabilitato, e il test falliva per un timeout nello SCRIPT, non per un
difetto dell'app. Corretto con `WebAuthn.setUserVerified(authenticatorId,
false)`, che TIENE l'autenticatore — il dispositivo c'è e rifiuta in
fretta, che è anche il caso realistico ("Face ID non ha riconosciuto il
volto"), non "il telefono non ha alcun sensore".

⚠️ **WebAuthn non distingue Face ID da Touch ID da Windows Hello**, e non è
un limite del collaudo: è l'astrazione stessa dell'API. Tutti e tre sono
esposti allo stesso `transport: "internal"` con verifica utente — l'app (e
nessun test) può sapere quale dei tre abbia risposto. L'autenticatore
virtuale usato qui rappresenta indifferentemente tutti e tre.

Il prompt biometrico VERO — Face ID o Touch ID su un dispositivo reale,
non simulato — restava dichiaratamente non provato: richiede un URL HTTPS
reale, che la LAN non è (WebAuthn lo esige). Stessa regola già scritta per
la prova `b2` della Fase 22, *una prova che si autoesclude va lasciata
dichiarata e ripresa*.

#### ⚠️⚠️ Il quinto difetto, trovato proprio in quella prova non fatta

Chiuso lo stesso giorno, appena provato **davvero** dal telefono (2026-09-10):
un iPhone 15 sull'IP di LAN mostrava "Blocco biometrico — **non disponibile
su questo dispositivo**". La frase era **falsa**: un iPhone 15 ha Face ID,
il dispositivo non c'entra — la causa vera è quella già scritta sopra,
l'indirizzo `http://192.168.x.x:3000` non è un secure context.

È la stessa classe già corretta più volte in questo progetto — un messaggio
che manda a controllare la cosa sbagliata (`contoError()` nella 20b,
`avatarRemoveFailed` riusato per le ricevute nella 22) — e la conferma di
un pattern: **su tre "trovati usando l'app vera" di questa fase (26a e
26b), due sono arrivati dal telefono e uno dal code-review; zero da
`tsc`/lint/build.** Nessuno dei tre tocca un tipo o una firma di funzione:
sono tutti nella zona che i controlli statici non vedono per costruzione —
un testo che dice il falso, un timing fra due promise, un messaggio
attribuito alla causa sbagliata.

Chiuso separando il FATTO (`isInsecureContextForBiometric()`, sincrono, in
`lib/app-lock.ts`) dal messaggio: contesto non sicuro → "richiede una
connessione sicura (https)"; nessun lettore biometrico → "non disponibile
su questo dispositivo". Due cause, due frasi — mai la stessa frase per due
guasti diversi solo perché arrivano dallo stesso `else`.

#### ✅ Il prompt biometrico VERO, chiuso il 2026-09-11

Il tentativo del 2026-09-10 (sopra) era dalla LAN, quindi non poteva
riuscire *per costruzione* — verificava solo che il messaggio dicesse la
causa giusta. Con il primo deploy pubblico (`https://seichi-app.vercel.app`)
esiste finalmente un URL HTTPS reale: attivato il biometrico da
Impostazioni → Blocco e provato lo sblocco vero su un dispositivo fisico.
**Funziona.** Con questo si chiude anche l'ultimo debito dichiarato
dell'issue #67, insieme a quello della 26a chiuso il giorno prima.

#### Redesign della schermata di sblocco (2026-09-11)

Richiesto guardando l'app vera, dopo il primo deploy: il mockup
`PinCard.dc.html` nel progetto Claude Design "Seichi budgeting app homepage"
era cambiato rispetto a quello seguito dalla 26a, e la schermata di sblocco
non lo rifletteva più.

- **L'accesso biometrico si è spostato DENTRO la tastiera numerica**, in
  basso a sinistra (dove sul telefono sta l'asterisco) — non più un bottone
  separato sopra i pallini con un divisore "oppure". `PinPad` guadagna
  `onBiometric`/`biometricLabel`: se assenti, quella casella resta vuota
  come prima. `orPin` è sparita da entrambi i dizionari, non più usata.
  ⚠️ Il meccanismo di deduplica pointerdown/click (il "click fantasma" già
  documentato sopra) è stato **generalizzato** (`onPointerDownAction`/
  `onClickAction`) invece di scriverne una copia per il nuovo tasto — due
  implementazioni dello stesso meccanismo sarebbero due occasioni di farle
  divergere.
- **Lo Sprout diventa un ensō** (cerchio zen incompleto, lo stesso SVG del
  mockup) — scelta esplicita chiesta all'utente, non dedotta: lo Sprout è il
  marchio usato ovunque nell'app (PWA, `BrandHeader`, `BootSplash`), quindi
  cambiarlo solo qui non è una cosa da assumere in silenzio. Colore
  `text-foreground` (inchiostro), non l'accento: qui è un simbolo, non
  un'icona che deve risaltare.
- **Due elementi del mockup NON adottati, entrambi verificati prima di
  scartarli**: il font `Inter` (l'app usa `Geist` ovunque, confermato in
  `app/layout.tsx` — il mockup lo importa solo perché è il default del
  canvas) e il link "Usa la password" in fondo alla card, il cui `onClick`
  nel canvas si limita ad azzerare la demo — nessuna funzione reale
  collegata. Confermato con l'utente prima di ignorarlo: resta il flusso
  attuale, "Hai dimenticato il PIN?" → "Esci e accedi di nuovo".
- **Collaudato con un autenticatore virtuale via CDP** (stessa tecnica della
  Fase 26b): ensō presente, casella vuota senza credenziale, tasto
  biometrico presente e funzionante dopo la registrazione, PIN
  sbagliato/corretto invariati — in entrambi i temi, zero errori console.
  `npm run lint`, `next build` e `npm run audit:tokens` verdi.
  ⚠️ I primi scatti dello script di collaudo mostravano lo **splash di
  apertura** ancora in dissolvenza sopra la schermata vera: un'attesa
  troppo corta nello script (300-600ms contro i 900ms del CSS), non un
  difetto dell'app — corretto allungando l'attesa prima di ogni screenshot
  successivo a una navigazione.

