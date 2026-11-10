---
name: collauda-app
description: Avvia e pilota Seichi in un browser headless per vedere una modifica funzionare davvero — con un account di prova usa e getta, registrato ed eliminato dall'app, screenshot e confronto fra numeri di schermate diverse. Usare quando si chiede di eseguire l'app, fare screenshot, o verificare che un cambiamento regga nell'app vera e non solo nei test.
---

# Collaudare Seichi nell'app vera

`tsc`, lint e `next build` passano su difetti che costano giorni: numeri
sbagliati, etichette che mentono, parametri dimenticati. Questo skill serve a
**guardare l'app**, non a compilarla.

⚠️ **Dalla #156 c'è anche la suite `tests/e2e/`** (Playwright, su un Supabase
LOCALE in Docker: `npm run e2e:db`, `e2e:build`, `test:e2e`). Questo skill
resta per GUARDARE — screenshot, numeri messi a confronto, la produzione dopo
un merge; un controllo che deve restare, con la sua controprova, si scrive là.
⚠️ `e2e:build` e `npm run build` si sostituiscono in `.next`: prima di una
build di produzione per questo skill, rifarla.

## 1 · Il server

```bash
npm run dev          # porta 3000
```

⚠️ **Ne gira quasi sempre già uno.** Next lo rileva e il secondo esce con
*"Another next dev server is already running"* dopo aver occupato la 3001 —
quindi non fidarti dell'output, controlla la porta:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/welcome   # atteso 200
```

**Una build di produzione** serve quando conta il CSS (in sviluppo Tailwind
accumula le classi già generate, e una classe mancante sembra esserci: #114) e
per ogni controprova:

```bash
npm run build && npx next start -p 3100     # poi SEICHI_URL=http://localhost:3100
```

`next build` non disturba il dev server (che usa `.next/dev`). La controprova
su master: `git checkout master`, build, stessi script, poi di nuovo il branch.

⚠️ **Su Windows un `next start` in background non si ferma con TaskStop**: il
processo node resta e tiene la porta, e il server successivo esce con
`EADDRINUSE`. Si chiude per PID:
`netstat -ano | grep ":3100 .*LISTENING"`, poi `taskkill //PID <pid> //F`.

## 2 · L'autenticazione: un account di prova usa e getta

⚠️ **Non chiedere a Jomar cookie o password.** Le rotte utili sono dietro il
login, e il modo di entrarci è un account creato apposta, che vive il tempo
del collaudo e poi si elimina dall'app. È la pratica di questo progetto dalla
#116, e Jomar l'ha confermata come quella da usare senza chiedere
(2026-11-09).

```bash
D=<scratchpad>/collaudo
SEICHI_DIR=$D node .claude/skills/collauda-app/setup.mjs      # registra e prepara
# … driver e script ad hoc …
SEICHI_DIR=$D node .claude/skills/collauda-app/teardown.mjs   # elimina, SEMPRE
```

- **`setup.mjs`** registra l'utente dal form vero (`/sign?tab=signup`) e
  prepara lo stato via REST **col token di quell'utente**, quindi sotto RLS
  come farebbe l'app: due conti ("Conto principale", "Revolut"), una categoria
  per tipo, sei mesi di movimenti, un trasferimento, un versamento su un
  obiettivo, una regola ricorrente e un budget. È ciò che i passi del driver
  si aspettano: senza un secondo conto il passo 2 non ha niente da scegliere,
  senza un budget la nota del passo 5 non compare.
  Scrive in `SEICHI_DIR` la sessione (`state.json`) e le credenziali
  (`account.json`), e si rifiuta di partire se un `account.json` di un account
  ancora vivo è lì.
- **L'indirizzo** è `git config user.email` con `+seichi-<data>` davanti alla
  chiocciola: arriva al titolare del repo senza essere scritto qui dentro —
  ⚠️ **il repository è pubblico**. Si sovrascrive con `SEICHI_EMAIL`.
- **La password** la genera lo script e sta solo in `account.json`, nello
  scratchpad: non passa mai dalla conversazione.
- **`teardown.mjs`** entra dal form di login, elimina l'account da
  `/impostazioni/elimina` (così passa anche dalla pulizia dello Storage, che in
  SQL non si fa) e poi **prova** che il login risponda `invalid_credentials`.
  Va eseguito anche se il collaudo si è fermato a metà: il database è quello
  di **produzione**, e il collaudo finisce quando i dati sono come li ha
  trovati, non quando il referto è verde.
- ⚠️ **Serve *Confirm email* spento** (oggi lo è, #40). Con la conferma accesa
  `signUp` non restituisce una sessione e il setup si ferma: quel giorno va
  rifatto.

- Se il setup si ferma a metà (server spento, registrazione rifiutata) lo
  dice, lascia uno scatto in `SEICHI_DIR` e chiede il teardown, che elimina
  l'account o scopre che non è mai nato. In entrambi i casi la cartella torna
  pronta per un nuovo setup.

**Dati propri del collaudo**: uno script nello scratchpad apre il contesto
con `browser.newContext({ storageState: "<D>/state.json" })`, oppure prepara
le righe via REST col token, come fa `setup.mjs`. Per risolvere `playwright`
da lì: `createRequire("<repo>/package.json")("playwright")`.

⚠️ **E alla fine risalva la sessione**: `context.storageState({ path:
"<D>/state.json" })`, come fa il driver. Passata l'ora del token, il proxy lo
rinnova solo nel browser, e il refresh token rimasto nel file è già stato
usato. Ripresentarlo al giro dopo è un riuso, e Supabase revoca l'intera
sessione: ogni giro successivo finirebbe su `/welcome` con l'account ancora
vivo. Il teardown non ne soffre, perché entra dal form di login.

## 3 · Eseguire il driver

```bash
SEICHI_DIR=$D SEICHI_SHOTS=$D/shots node .claude/skills/collauda-app/drive.mjs
```

Gli script si eseguono **dal loro posto**: Node cerca `playwright` risalendo
le cartelle fino al `node_modules` della radice. (Una versione precedente di
questo file diceva di copiare il driver nella radice: non serve.)
`SEICHI_DIR` e `SEICHI_SHOTS` sono **obbligatorie e senza default**, perché un
default si risolverebbe dentro il repo e scriverebbe lì una sessione viva.
`.gitignore` copre comunque `state.json`, `account.json` e `shots*/` come
seconda difesa.

⚠️ **Mai `cp -r node_modules` nello scratchpad**: sono decine di migliaia di
file e il comando va in timeout.

## 4 · Cosa guardare

**Apri gli screenshot.** Sono lì per essere letti, non per essere prodotti: il
filtro conto della home che non arrivava a `getTransactions` — totali di un
conto sopra i movimenti di tutti — si è visto solo così. Tipi corretti,
parametro mancante, nessun controllo automatico in grado di vederlo.

**Rifai l'aritmetica.** `Flusso = entrate − spese − abbonamenti`: se i numeri
delle card non tornano col numero grande, il difetto è nella formula anche
quando la pagina sembra a posto.

**Confronta le schermate fra loro.** Il difetto più grave della Fase 20a era
`/analisi` che mostrava "Flusso netto" — la stessa parola della home — con
un'altra formula. Nessuna delle due pagine era sbagliata *da sola*.

**Leggi gli errori di console.** Un errore durante una ricompilazione è
transitorio: rieseguire a compilazione ferma prima di dargli peso.

**Diagnostica ogni KO prima di crederci, e ogni OK che pretende un'assenza.**
Nel giro del 2026-11-09 il driver dava 12 KO: uno era un difetto vero
dell'app, gli altri erano il driver rimasto indietro rispetto all'app. E "la
categoria NON deve esserci" passava su un form che non si era nemmeno aperto.

**Prima di scrivere uno script nuovo leggi `metodo.md`**, qui accanto:
selettori, attese, misure e guasti che hanno già prodotto falsi KO e falsi
verdi.

## 5 · Trappole di questo progetto

- ⚠️ **Il primo tocco su "Archivia" NON scrive**: arma la conferma nello stato
  locale. Il driver si ferma lì: anche su un account di prova, un collaudo
  che legge non deve dipendere da uno che scrive.
- ⚠️ **Molti pezzi sono montati due volte**, uno per breakpoint, e quello del
  desktop è `display: none` sul telefono: il footer della sidebar, il
  selettore conti della home (#111). `getByText(…).first()` prende la copia
  nascosta. Si cerca per ruolo (`getByRole`, che salta i nascosti) o con
  `.filter({ visible: true })` **prima** di `.first()`.
- ⚠️ **Il modale del movimento si apre sul passo dell'importo**: per arrivare
  al form serve un tasto e "Continua" (`passaImporto` nel driver).
- ⚠️ **Il tocco su un conto apre `/conti/[id]`** (#62); "Modifica" sta lì.
- ⚠️ **Il tastierino del PIN in un contesto `hasTouch` si preme con `tap()`**,
  non `click()`: deduplica pointerdown e click (il click fantasma della 26a),
  e i click sintetici di Playwright ci finiscono dentro.
- ⚠️ **`locale: "it-IT"` nel contesto**: senza, Playwright manda
  `Accept-Language: en-US` e l'app risponde in inglese.
- ⚠️ **"Aprire la home" non è uno stato determinato**: il conto scelto si
  ricorda in un cookie. `?conto=` vuoto è un'istruzione ("tutti i conti") e
  batte la memoria — su home, `/analisi` e `/transazioni`.
- ⚠️ **Dopo un `goto` lo splash copre la pagina per ~900ms**, e i grafici
  Recharts entrano animati per ~1,5s: `shot()` aspetta entrambi, o lo scatto
  mostra l'ensō in dissolvenza e un grafico a metà.
- ⚠️ **La riga conto è un `div` col bottone dentro** (markup interattivo
  annidato vietato), quindi l'importo è in un *fratello*: un selettore
  `button` che contenga `€` non aggancia niente e va in timeout. Puntare al
  nome del conto.
- **Playwright rende in tema CHIARO** — non ha il cookie del tema. È un
  vantaggio: è il tema dove i difetti di contrasto si vedono.
- **Viewport 414×896**: l'app è disegnata per il telefono; a 1280px bottom nav
  e bottom sheet non sono nella forma che vede l'utente.
- **Il ruolo `postgres` del SQL Editor ha `BYPASSRLS`**: una prova di isolamento
  eseguita da lì non dimostra nulla. Serve `set local role authenticated`.
- **Collauda nella lingua in cui il difetto è visibile.** Il nome del primo
  conto veniva dal dizionario sbagliato: in italiano corretto e rotto danno la
  stessa stringa, in inglese no.

## 6 · Cosa resta fuori

- **L'onboarding**: `setup.mjs` lo salta scrivendo `profiles.currency`, che è
  il cancello. Registrazione e login invece li attraversano setup e teardown.
  I tre passi vanno provati a mano, ed è dove si nascondono i difetti di
  ordinamento fra i passi.
- **Ciò che dipende dal dispositivo**: un'API che vuole un contesto sicuro
  (`crypto.randomUUID()`, WebAuthn), la stampa, lo splash nativo di iOS, il
  movimento ridotto vero. `localhost` in Chromium non li vede: si provano dal
  telefono, sulla LAN o sul deploy HTTPS.
