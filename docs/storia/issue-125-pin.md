# #125 — blocco PIN: due fonti, il velo, il computer

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Blocco PIN — due fonti, il velo, il computer (issue #125)

Dalla review completa del 2026-09-28 (#128). Nessuna migration. Il modello di
minaccia resta quello della 26a: blocco dell'interfaccia, non dei dati.

- ⚠️⚠️ **Il blocco era fail-closed sulla finestra di grazia e fail-OPEN sulla
  propria esistenza.** Il PIN sta in `localStorage`, il flag "c'è un PIN" in
  `seichi-lock-enabled`, scritto da `document.cookie` una volta al
  salvataggio, e il client decideva dal solo cookie. Cookie sparito e PIN
  rimasto: nessun blocco, né sul server né sul client, mentre
  `/impostazioni/blocco` — che legge `localStorage` — diceva "attivo". Su
  Safari succede da sé: ITP tronca a 7 giorni i cookie di `document.cookie`,
  qualunque `Max-Age` si chieda. Ora:
  - il client decide dall'**unione** delle due fonti (`isLockedOnClient`),
    con la stessa regola del server (`isLockedFor`);
  - `seichi-lock-enabled` lo **scrive il server** (`setAppLockCookie`,
    `app/(main)/app-lock-actions.ts`): ITP non tronca un `Set-Cookie`. Un
    cookie, uno scrittore — la regola già scelta per la lingua
    (`LOCALE_COOKIE_OPTIONS`). Il client lo cancella subito e chiede al
    server di cancellarlo, ma non lo crea mai;
  - all'apertura `enabledCookieFix` dice in che verso correggerlo, e la
    server action fa rendere di nuovo pagina e layout: la riga "Attivo" di
    `/impostazioni` torna giusta senza un `router.refresh()`.
  ⚠️ `secure` lo decide l'azione dal protocollo della richiesta, non da
  `NODE_ENV` come la lingua: una build di produzione provata in LAN su http
  si vedrebbe rifiutare il cookie, e ogni caricamento chiederebbe di nuovo di
  scriverlo — con un nuovo render della pagina.
- **Lo stato del blocco vive in uno store per istanza**, letto con
  `useSyncExternalStore`: l'idratazione usa la decisione del server, la prima
  lettura sul client la corregge — senza un `setState` in un effetto.
  ⚠️ `initialLocked` si legge UNA volta, come prima: il layout si rende di
  nuovo a ogni `revalidatePath("/", "layout")`, e la finestra di grazia si
  rinnova solo uscendo dal primo piano — applicare quelle decisioni
  chiuderebbe fuori chi usa l'app da due minuti, a ogni salvataggio.
- **Il verso opposto, cookie acceso senza PIN.** Ad app bloccata il velo dice
  "Il PIN non c'è più" e offre subito l'uscita, invece di rispondere "PIN
  errato" a quello giusto; ad app sbloccata il cookie stantio si spegne, o le
  due pagine delle impostazioni si contraddirebbero. "Assente" solo se
  `localStorage` lo dice (`isStoredPinAbsent`), non se la lettura fallisce:
  l'uscita cancellerebbe un PIN vero appena tornasse leggibile.
- ⚠️ **Una card dell'import con la tendina aperta si disegnava SOPRA il
  velo.** Sale a z-60 per superare la `BottomNav`; il velo era z-60 e veniva
  prima nel documento, quindi vinceva lei — controparte, IBAN e importi
  visibili sopra il blocco. `inert` impedisce di toccare, non di vedere. Ora
  il velo è **z-65** (sotto solo `BootSplash`, z-70) e viene dopo i figli.
  Chi aggiunge un livello sopra 60 deve guardare lì.
- **Niente PIN sul computer**, deciso con Jomar il 2026-10-07. Il velo copre
  una pagina i cui numeri sono già nel DOM: sul computer F12 li legge sotto il
  blocco, e la protezione vera è il blocco schermo del sistema. Il PIN resta
  su telefono e tablet, dove protegge l'icona sulla home screen (Fase 25).
  ⚠️ Computer = **nessun input touch** (`any-pointer: coarse` assente), non la
  larghezza e non il puntatore principale: un iPad con tastiera e trackpad
  può dichiararsi `pointer: fine` (trovato dalla review). Un portatile con lo
  schermo touch risulta un tablet, e sbagliare in quel verso è com'era prima.
  Un PIN già impostato su un computer continua a bloccare: si toglie, non si
  cambia, e il biometrico non si offre. I comandi che impostano qualcosa
  rileggono `isComputer()` al tocco, perché l'idratazione parte da "non è un
  computer".
- **Il blocco per inattività promesso dai testi non è mai esistito**: l'app
  si blocca quando la pagina viene NASCOSTA. Col computer fuori, il caso
  scoperto — schermo acceso, nessuno davanti — è quasi solo quello: su
  telefono e tablet lo schermo che si spegne nasconde la pagina. I testi
  dicono ora "quando esci dall'app o lo schermo si spegne per più del tempo
  scelto". Niente timer.
- I due nomi della passkey vengono dal dizionario: erano cablati in italiano,
  e il sistema operativo li mostra nel proprio elenco.

#### Il collaudo, e la verifica che era cieca

2026-10-07 nell'app vera, su un account di prova usa e getta (autorizzato da
Jomar, eliminato dall'app alla fine): **43 controlli** fra telefono emulato
(touch), computer emulato e inglese, con un autenticatore WebAuthn virtuale
per la passkey. Ogni controllo che riguarda il cookie guarda anche CHI lo
scrive: un `Set-Cookie` del server sì, `document.cookie` mai.
**Controprova** col codice di master: il cookie cancellato lascia l'app
aperta e non torna, la riga non dice "Attivo", il ritorno oltre la grazia non
blocca, la tendina resta sopra il velo, il PIN si offre sul computer.
La corsa trovata dalla seconda review — accensione del cookie ancora in
viaggio, PIN tolto nel frattempo — è provata rallentando l'azione di 5
secondi: il cookie finisce spento; tolta la cancellazione dal server, resta
acceso.

- ⚠️⚠️ **`elementFromPoint` salta gli elementi `inert`**, e sotto il velo è
  tutto inert. La prima versione del controllo sulla tendina rispondeva
  "coperta" anche con master, mentre lo screenshot mostrava la tendina sopra
  il velo: misurava chi riceve il tocco, non chi si vede. Ora toglie `inert`
  per la sola durata della misura. È la regola della 23b — *un controllo che
  misura la proprietà giusta nel modo sbagliato non fallisce mai* — vista
  questa volta da una controprova che doveva essere rossa e non lo era.
- ⚠️ **Scaricare la pagina fa scattare `visibilitychange: hidden`**, che
  riscrive la finestra di grazia: cancellare i cookie e poi fare `goto`
  provava lo scenario sbagliato, perché la richiesta partiva con un'attività
  fresca. Si passa da `about:blank` prima di toccarli, come quando scadono ad
  app chiusa.
- In sviluppo l'effetto di montaggio gira due volte (StrictMode): due
  `Set-Cookie` dove in produzione ce n'è uno.

#### Residui dichiarati

- Un PIN impostato **prima** della #125 ha il cookie scritto dal client.
  Quando ITP lo fa scadere, il server rende una volta una pagina senza velo e
  il velo arriva col JavaScript; da lì il cookie è quello del server.
- ITP e il prompt biometrico vero non si vedono da Chromium: la prova finale
  è dal telefono sul deploy HTTPS, il quarto criterio della issue.

