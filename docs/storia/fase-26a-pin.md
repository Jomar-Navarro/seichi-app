# Fase 26a — blocco con PIN

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 26a — Blocco app con PIN (issue #67)

Implementata il 2026-09-09/10, PR #90. Chiude solo la metà PIN dell'issue #67:
"Blocco biometrico" resta "presto" — WebAuthn richiede una vera cerimonia di
credenziali, non un booleano, e ha bisogno di verificare cosa offre davvero
iOS Safari prima di disegnare l'interfaccia. **26b, in una PR separata.**

#### ⚠️ Cosa protegge — dichiarato, non dedotto dall'interfaccia

Come impone l'issue #67: questo è un blocco dell'**interfaccia**, non dei
dati. La sessione Supabase resta valida nel cookie; non sostituisce né
indebolisce la riautenticazione delle operazioni sensibili (Fase 16); non è
cifratura. `lib/app-lock.ts` lo dice in testa al modulo, non solo nella UI.

#### Le decisioni di architettura

- **Il PIN vive SOLO in `localStorage`, per dispositivo** — mai sul server,
  mai sincronizzato fra dispositivi, mai in un cookie, e **in chiaro**. Un
  hash di un PIN a 6 cifre si forza offline in microsecondi: hasharlo
  darebbe solo l'illusione di una protezione che non c'è — la stessa
  sicurezza-per-oscurità già scartata per il path degli avatar (Fase 16).
  Meglio dichiararlo che fingerlo.
- **Due cookie NON segreti** (`seichi-lock-enabled`,
  `seichi-lock-active-until`), stesso pattern del tema (Fase 18): senza,
  un fotogramma di dashboard vera (Server Component, i numeri sono già
  nell'HTML) passerebbe prima che il JS client decida di coprirla. Non
  portano il PIN — solo "questo dispositivo ha un PIN" e "fino a quando
  vale la finestra di grazia", che bastano al server per il primo byte
  giusto. ⚠️ Dalla #125 `seichi-lock-enabled` lo scrive il SERVER e il
  client decide anche da `localStorage`: scritto da `document.cookie`, Safari
  lo faceva scadere in 7 giorni e il blocco si spegneva. Vedi la sezione
  della #125.
- **Fail-closed**: `isLockedFromCookies()` blocca di default — cookie
  assente, scaduto o manomesso è sempre trattato come "bloccato", mai come
  "sbloccato". Il costo di un velo di troppo (si annulla in un istante con
  il PIN) è accettabile; il contrario no.
- ⚠️ **Una funzione sola, letta sia da server sia da client.**
  `lib/app-lock.ts` non importa `next/headers`: il root layout chiama
  `isLockedFromCookies()` su valori grezzi da `cookies()`, `AppLockProvider`
  chiama `isLockedOnClient()` — entrambe passano da `isLockedFor()`. Due
  copie della stessa logica avrebbero potuto divergere silenziosamente.
- **`inert`, non `aria-hidden`**, su `{children}` sotto il velo: `aria-hidden`
  da solo lascia comunque il fuoco tastiera libero di finirci dentro.

#### Il redesign da Claude Design, e cosa NON è stato adottato

Il mockup (`PinCard`/`PinSetupCard`) ha portato il PIN da 4 a **6 cifre**
(`APP_LOCK_PIN_LENGTH`), un tastierino circolare con lettere decorative, e
pallini che restano pieni e **rossi** per `APP_LOCK_REJECT_DISPLAY_MS`
(900ms) dopo un errore invece di sparire all'istante.

⚠️ **Tre elementi del mockup non sono stati costruiti, deliberatamente**: un
blocco temporaneo dopo N tentativi, uno switch biometrico funzionante, una
finestra di grazia scelta dalla schermata finale del wizard. Mostrarli
avrebbe promesso funzioni che l'app non ha — lo stesso principio di "Nuova
investimento" (Fase 19) applicato a un mockup invece che a un template.
Resta l'unica via d'uscita onesta: "Esci e accedi di nuovo" dopo 3
tentativi, non subito — un comando sempre visibile e per lo più inerte
insegna a ignorarlo (stessa regola di "Azzera filtri", issue #9).

#### La finestra di grazia: da costante a scelta, sempre solo locale

Percorso in tre passi, su richieste esplicite successive: 5 minuti (prima
stesura) → 1 minuto (richiesto) → **configurabile** fra 30s/1/3/5 minuti
(`APP_LOCK_GRACE_OPTIONS_MS`, richiesto). `readGraceMs()`/`writeGraceMs()`
stanno accanto al PIN in `lib/app-lock.ts`, **mai in un cookie**: il server
deve sapere *che* un PIN è attivo e *fino a quando* vale l'ultimo sblocco,
mai *quale durata* l'utente ha scelto — non gli serve per decidere cosa
rendere.

⚠️ **Il menu è disegnato a mano, non una `<select>` nativa.** Il primo
tentativo riusava lo schema di `PreferencesSection` (valuta/lingua): sul
sistema operativo esce il picker nativo, un riquadro grigio piatto sopra
una card di vetro Zen Glass — trovato dal telefono, non da un controllo.
Il menu vero è `position: fixed` con le coordinate calcolate al tocco (come
`Select.tsx`), non `absolute`: `SettingsGroup` ha `overflow-hidden` per
ritagliare gli angoli delle righe, e un menu `absolute` lì dentro verrebbe
tagliato.

#### La riga a riposo: una singola route, due stati di `BottomNav`

Il wizard (crea/conferma/done) è a schermo intero senza barra, coerente con
`AppLockScreen` (già un velo `fixed` sopra la barra durante lo sblocco
vero); il riposo di `/impostazioni/blocco` la mostra. **Non esprimibile con
`DOCUMENT_ROUTES`** (un elenco di path, Fase 23b): la stessa route ha stati
diversi. Risolto con `fullScreenActive` in `useUIStore`, scritto da
`AppLockSettings` via un effetto sincronizzato su `step` (con cleanup) e
letto sia da `BottomNav` sia da `AppLockPageShell` (il `pb-*` della pagina
dipende dallo stesso flag).

⚠️ **Trovato guardando gli screenshot del collaudo precedente**, non da un
controllo: la barra era visibile sotto il tastierino in ogni scatto, e non
notato — promemoria a guardare gli screenshot per quello che mostrano,
non solo per le assert che passano.

#### I due difetti mobile-only, trovati dal telefono

- **Il picker nativo** (sopra).
- ⚠️ **Click fantasma sull'ultima cifra**: dopo un tocco il browser mobile
  sintetizza comunque un click di compatibilità, anche con
  `preventDefault()` sul `pointerdown`. Di norma innocuo (atterra sulla
  stessa riga toccata), ma l'ultima cifra fa scattare `onComplete`, che
  cambia schermo **all'istante** — quando il click sintetico arriva, il
  tastierino non c'è più e il browser lo fa atterrare su qualunque bottone
  si trovi ora in quella posizione (una voce della bottom nav). Corretto
  con `swallowNextClick()` in `PinPad.tsx`: un ascoltatore capture-phase su
  `document` che assorbe il **prossimo** click ovunque cada, armato nello
  stesso istante in cui l'ultima cifra completa il PIN, timeout di
  sicurezza a 400ms perché non resti armato in attesa di un tocco
  successivo legittimo.

⚠️ **Il meccanismo di cattura è verificabile in Chromium desktop, la CAUSA
no**: la sintesi del click di compatibilità è specifica del browser mobile
reale. È la stessa classe di difetto già registrata più volte in questo
documento — una parte di collaudo che nessun driver headless può fare.

#### Il code-review pre-merge — 6 difetti, due gravi

Review multi-agente su tutto il branch prima del merge ("fai una code
review e poi mergia"). Tutti corretti e riverificati nell'app vera:

- ⚠️⚠️ **Bypass del blocco.** Il gestore `hidden` di `visibilitychange`
  rinfrescava la finestra di grazia (`markActiveNow()`) guardando solo se
  un PIN è configurato, **mai** se l'app è ancora bloccata. Scenario: velo
  su, l'utente cambia app senza sbloccare, torna — il cookie si
  rinfrescava comunque, e un ricaricamento (o una scheda nuova) mostrava
  la dashboard vera senza aver mai digitato il PIN. Corretto con
  `if (!locked) markActiveNow()`, `locked` in dipendenza dell'effetto (la
  chiusura deve vedere il valore corrente, non quello del primo render).
- ⚠️⚠️ **Tastierino non raggiungibile da tastiera.** I tasti avevano solo
  `onPointerDown`: Invio/Spazio su un bottone a fuoco genera un click, non
  un pointerdown, quindi nessuna cifra si poteva digitare senza un
  puntatore — un lockout totale per chi naviga solo da tastiera,
  sull'**unico** modo di sbloccare l'app. Aggiunto `onClick`, distinto da
  un tocco reale con un ref a breve durata (stesso schema di
  `swallowNextClick`).
- **`savePin()` poteva fallire** (localStorage bloccato, navigazione
  privata) senza che il chiamante se ne accorgesse: il cookie "enabled" si
  accendeva comunque, l'utente vedeva "PIN impostato" su un PIN mai
  scritto, e l'app si sarebbe bloccata senza che nessun PIN digitato
  potesse più aprirla. `savePin()` ora ritorna un booleano;
  `AppLockSettings` mostra un errore onesto invece di "fatto".
- La cancellazione nel `PinPad` non era bloccata durante la finestra di
  lettura dell'errore (il controllo valeva solo per le cifre nuove): si
  poteva cancellare l'ultima cifra e ridigitarne un'altra, due tentativi
  in corsa fra loro. `rejected` ora blocca tutto, cancellare compreso.
- **La via di fuga eseguiva un sign-out immediato dietro un'etichetta che
  non lo lasciava intuire** ("Hai dimenticato il PIN?"): la stringa onesta
  scritta apposta nel dizionario (`signOutAndReset`) non era mai stata
  collegata. Ora in due passi, come `DeleteAccountFlow`.
- **Un commento affermava una correzione che non funzionava**: diceva che
  `AppLockSettings` correggeva da sé lo spazio vuoto sotto il wizard con un
  `margin-bottom` negativo. Misurato: zero effetto — margine e padding sono
  proprietà del box model indipendenti, un margine su un figlio non riduce
  il padding di un antenato. Corretto con `AppLockPageShell.tsx`, che legge
  `fullScreenActive` (client) per scegliere il `pb-*` vero.

#### Fuori scope, dichiarato

- **Blocco biometrico (WebAuthn)** — Fase 26b, PR separata.
- **Nessun lockout/cooldown reale sui tentativi** — coerente con "non è
  sicurezza vera": la sola conseguenza di sbagliare è la via di fuga dopo 3
  tentativi.

#### Il collaudo, e cosa resta da fare

Ogni passaggio sopra è stato verificato nell'app vera con un driver
Playwright ad hoc (sessione riusata via cookie, mai la password): 29
controlli sull'impostazione iniziale, 16 sulla riga a riposo/barra
condizionale, 6 sulla finestra di grazia configurabile, 11 sul menu
disegnato a mano, 15 sui sei difetti del code-review. Zero errori console
in ogni giro. Il click fantasma e il picker nativo sono stati confermati
anche da un telefono vero, su segnalazione diretta dell'utente.

✅ **Il criterio di accettazione dell'issue #67** — *"Provato dal telefono
sull'indirizzo di LAN"* — nella sua forma end-to-end (cold start → sblocco,
sullo stesso dispositivo reale) **è stato verificato il 2026-09-11**,
chiudendo il debito lasciato aperto dal collaudo precedente. Era l'area
dove questo progetto ha imparato più volte che il comportamento diverge da
quello headless (`crypto.randomUUID()` in Fase 22, la stampa in 23b, il
service worker in Fase 25) — in particolare il ciclo
`visibilitychange`/background su iOS, che un browser desktop non riproduce
fedelmente. Con questa prova, **la Fase 26a è chiusa per intero**: resta
aperta solo la 26b (blocco biometrico), il cui equivalente reale — Face
ID/Touch ID su un dispositivo fisico contro un URL HTTPS — non è
riproducibile dalla LAN (vedi sotto) e resta un debito a sé.

