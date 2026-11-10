# Metodo del collaudo — trappole già pagate

Da leggere prima di scrivere un driver o uno script di collaudo nuovo. Ogni voce
è un KO o un falso verde che è già costato tempo; la storia completa è in
`docs/storia/`. Le trappole specifiche dell'app (passo dell'importo, conto
ricordato, splash) sono nella sezione 5 di `SKILL.md`.

## Selettori

1. **Un locator testuale cerca per sottostringa, senza maiuscole**: «Entrate»
   aggancia «entrate meno uscite di questo mese». Usa `getByRole` con `exact`,
   oppure restringi la ricerca al contenitore giusto.
2. **Dentro un pannello aperto si cerca nel pannello**, cioè nell'ultimo
   `div.fixed.inset-0.z-50`, mai nella pagina intera: la stessa parola c'è anche
   nella lista dietro il modale.
3. **Quando sparisce la classe su cui ti appoggiavi, il selettore diventa PIÙ
   specifico, non meno**: un selettore generico aggancia la griglia della home
   dietro il modale.
4. **Il bottone di una riga può contenere nome, tipo e importo concatenati**
   (`"Trade RepublicConto€ 864,33"`): niente ancoraggi `^…$`.
5. **Le etichette si leggono dal dizionario, non a memoria**: il tipo `spesa` a
   schermo è «Uscita».

## Attese

1. **Dopo un clic su un link interno, `networkidle` può risolvere prima che
   l'URL cambi** (navigazione client-side): aspetta l'URL o un elemento della
   pagina d'arrivo.
2. **I form leggono conti e categorie dal browser**: aspetta che la lettura sia
   arrivata, non un tempo fisso. Un form che dice «Serve un conto» mentre i conti
   arrivano era un difetto dell'app (#150), non un'attesa troppo corta.
3. **In un contesto nuovo il service worker prende il controllo a metà della
   prima visita**: fai un giro di riscaldamento che aspetti
   `navigator.serviceWorker.controller`.

## Misure

1. **Un numero formattato non si confronta come esatto**: confronta l'intervallo
   degli arrotondamenti possibili.
2. **`every` su un array vuoto è vero**: pretendi `length > 0` prima di
   dichiarare superato un controllo.
3. **Un `if` senza `else` è un buco**: ogni ramo di scarto scrive un KO che dice
   quale controllo non è stato eseguito.
4. **Un colore di fondo si legge con l'alpha**: `rgba(255,255,255,0.45)` non è
   bianco.
5. **`elementFromPoint` salta gli elementi `inert`**: per sapere che cosa si VEDE
   sotto il velo, togli `inert` per la sola durata della misura.
6. **Un grafico animato si misura contando i ridisegni** dell'`svg`, non leggendo
   il tracciato: Recharts entra allargando un `clipPath`.
7. **Quando lo stato dell'interfaccia sopravvive al gesto, l'interfaccia non può
   testimoniare sul gesto.** Misura un effetto che nasce solo se il gesto è
   avvenuto: le richieste, o le righe nel database.
   - Una server action è una POST.
   - Il corpo con un file è multipart: si legge con `postDataBuffer()`, e i
     campi si chiamano `_1_…`.
   - La risposta RIUSCITA di un'action contiene il dizionario intero: cerca
     `"error":"…"`, non la frase.

## Guasti

1. **Un guasto si inietta abbassando una soglia vera** (`ATTACHMENT_MAX_BYTES`,
   blocchi di lettura da 5), o rispondendo 500 alla sola action interessata,
   riconosciuta dal corpo esatto.
2. **Una rete caduta non fa rifiutare un'action**: con `useOffline` resta in
   sospeso e riparte alla riconnessione. `route.abort()` prova un'altra cosa.
3. **I guasti fra il server Next e Supabase non passano dal browser**: servono un
   proxy che inoltra a Supabase e risponde a comando, e una build costruita
   sull'URL del proxy (le `NEXT_PUBLIC_*` sono inlinizzate).
4. **Scaricare la pagina fa scattare `visibilitychange: hidden`**: per simulare
   cookie scaduti ad app chiusa, passa da `about:blank` prima di toccarli.

## Browser e lingua

1. **`locale: "it-IT"` in ogni contesto, Firefox compreso.** `context.request`
   non manda l'`Accept-Language` del `locale`: un file in inglese si scarica con
   un clic vero.
2. **Firefox di Playwright** (`npx playwright install firefox`, fuori da
   `package.json`) per i difetti di Gecko, come la #81.
3. **WebAuthn senza hardware**: un autenticatore virtuale via CDP
   (`WebAuthn.addVirtualAuthenticator`). Per un rifiuto veloce usa
   `setUserVerified(false)`, non la rimozione: senza dispositivo Chrome aspetta
   il timeout di 60 secondi.
4. **Movimento ridotto**: `emulateMedia({ reducedMotion: "reduce" })`. Chromium
   da solo non lo rispetta negli scorrimenti `smooth`.
5. **In un contesto `hasTouch` il tastierino del PIN si preme con `tap()`**:
   deduplica pointerdown e click.

## Dati

1. **Lo stato preparato via REST rispetta le regole delle action che il collaudo
   usa** (un colore è il token intero, non `"ao"`), o il foglio rifiuta per un
   motivo che non c'entra.
2. **Note uniche per ogni esecuzione**: una nota fissa si somma fra un giro e
   l'altro.
3. **Le righe di una controprova su un database vero si cancellano subito**:
   possono far fermare una migration che conta le righe non valide.
