---
name: collauda-app
description: Avvia e pilota Seichi in un browser headless per vedere una modifica funzionare davvero — login via cookie di sessione, screenshot, confronto fra numeri di schermate diverse. Usare quando si chiede di eseguire l'app, fare screenshot, o verificare che un cambiamento regga nell'app vera e non solo nei test.
---

# Collaudare Seichi nell'app vera

`tsc`, lint e `next build` passano su difetti che costano giorni: numeri
sbagliati, etichette che mentono, parametri dimenticati. Questo skill serve a
**guardare l'app**, non a compilarla.

## 1 · Il dev server

```bash
npm run dev          # porta 3000
```

⚠️ **Ne gira quasi sempre già uno.** Next lo rileva e il secondo esce con
*"Another next dev server is already running"* dopo aver occupato la 3001 —
quindi non fidarti dell'output, controlla la porta:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/welcome   # atteso 200
```

Per fermarlo, il PID è nel messaggio di Next (`taskkill /PID <pid> /F`).

## 2 · L'autenticazione: cookie, non password

⚠️ **Tutte le rotte utili sono dietro il login.** Senza sessione il proxy
risponde `307 → /welcome` su `/`, `/conti`, `/transazioni`, `/analisi`: un
browser vedrebbe solo la landing.

**Cookie `sb-*`, non le credenziali.** La password non entra mai nella
conversazione, e i token scadono da soli in **un'ora**.

⚠️ **NON farseli incollare in chat.** Sembra la via ovvia — DevTools →
Application → Cookies → copia i due valori — ed è quella che fallisce: il cookie
di sessione è un JSON base64 da ~5000 caratteri che Supabase spezza in `.0` e
`.1` a un punto **arbitrario**, quindi i due pezzi vanno riuniti *prima* di
decodificare e **un solo carattere perso rende l'intera sessione invalida**.
Copiando a mano stringhe di 3000 caratteri il carattere si perde: è successo due
volte di fila (2026-08-12) — una `w` in coda a `.0`, poi `.1` troncato — e il
sintomo è sempre lo stesso, un anonimo `finito su /welcome` che somiglia a un
token scaduto e manda a cercare il difetto dalla parte sbagliata.

⚠️ Il pezzo `.0` **decodifica pulito da solo**, il che rende la diagnosi
ingannevole: sembra intero. Il taglio si vede solo riunendo i pezzi, e il
controllo utile è che `.1` si allinei con **offset 0**: se serve un carattere di
riempimento per leggerlo, a `.0` ne manca uno.

**Farlo fare al browser.** Console su `http://localhost:3000` — i cookie di
sessione **non sono `httpOnly`** (solo il marcatore di recupero lo è), quindi JS
li legge:

```js
copy(JSON.stringify(document.cookie.split('; ')
  .filter(c => c.startsWith('sb-'))
  .map(s => { const i = s.indexOf('=');
    return { name: s.slice(0, i), value: decodeURIComponent(s.slice(i + 1)) }; })))
```

poi, in PowerShell, direttamente nel file che il driver legge:

```powershell
Get-Clipboard | Set-Content -NoNewline "<scratchpad>\cookies.json"
```

Nessuna trascrizione, nessun token nella conversazione, e il formato è già
quello che serve.

Costo dichiarato: così **non si verifica il percorso di login**, che va provato
a mano.

Il file è un JSON `[{name, value}, …]` **nello scratchpad, mai nel repo**, e si
cancella finito il giro. Playwright lo carica con `context.addCookies()`
aggiungendo `domain: "localhost"`, `path: "/"`, `sameSite: "Lax"`.

⚠️ `SEICHI_COOKIES` e `SEICHI_SHOTS` sono **obbligatorie e senza default**: lo
script esce se mancano. La prima versione ripiegava su `./cookies.json`, che si
risolve contro la CWD — cioè la radice del repository — e avrebbe scritto una
sessione viva in un percorso tracciato da git. `.gitignore` copre comunque
`cookies.json` e `shots*/` come seconda difesa.

## 3 · Eseguire il driver

`drive.mjs` sta accanto a questo file, ma `import { chromium } from "playwright"`
si risolve solo dalla radice del progetto: copiarlo lì, eseguirlo, cancellarlo.

```bash
cp .claude/skills/collauda-app/drive.mjs ./_drive.tmp.mjs
SEICHI_COOKIES=<scratchpad>/cookies.json SEICHI_SHOTS=<scratchpad>/shots \
  node ./_drive.tmp.mjs
rm -f ./_drive.tmp.mjs
```

⚠️ **Mai `cp -r node_modules` nello scratchpad** per aggirare la risoluzione:
sono decine di migliaia di file e il comando va in timeout.

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

**Leggi `console --errors`.** Un errore durante una ricompilazione è
transitorio: rieseguire a compilazione ferma prima di dargli peso.

## 5 · Trappole di questo progetto

- ⚠️ **Il primo tocco su "Archivia" NON scrive**: arma la conferma nello stato
  locale. È ciò che rende il collaudo sicuro su un database di **produzione** —
  fermarsi lì e non completare mai l'azione.
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

Login, registrazione e onboarding: il driver salta il primo e gli altri due
richiedono un utente nuovo. Vanno provati a mano, ed è dove si nascondono i
difetti di ordinamento fra i passi.
