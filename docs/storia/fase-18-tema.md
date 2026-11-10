# Fase 18 — tema chiaro e scuro

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 18 — tema chiaro/scuro

Implementata il 2026-08-05 (issue #32). Tre stati: chiaro, scuro, sistema.

- **La preferenza sta in un COOKIE, non in `localStorage`.** La classe `.dark` va su
  `<html>`, che è emesso dal root layout, cioè un server component: il cookie viaggia
  con la richiesta, quindi il server sa già cosa rendere e **il primo byte è quello
  giusto**. Niente flash, e soprattutto niente `suppressHydrationWarning` — che nella
  soluzione classica (`next-themes`: script inline + localStorage) non risolve il
  mismatch, lo **zittisce**. Quel cerotto serve solo perché la fonte del dato è
  irraggiungibile dal server; cambiando fonte il problema non esiste. Il costo
  abituale — leggere i cookie rinuncia allo static — qui era già pagato: proxy su
  ogni richiesta e cookie di sessione Supabase ovunque.
- **Due cookie, non uno.** `prefers-color-scheme` è una proprietà del browser e **non
  viaggia negli header**: con la scelta su "sistema" il server sarebbe di nuovo cieco.
  Il secondo cookie porta il valore **già risolto**, scritto dal client che lo conosce.
  Così `globals.css` resta a due soli blocchi (`:root` chiaro, `.dark` scuro): la via
  alternativa — far gestire "sistema" a un `@media` — avrebbe richiesto di duplicare
  ~50 token dentro la media query.
- Il cambio applica la classe **nel fotogramma corrente** e scrive il cookie per il
  caricamento successivo: nessun round-trip, nessun `router.refresh()`.
- **Primissima visita senza cookie: si rende scuro**, l'aspetto storico dell'app. Se
  il sistema dice altro, `ThemeProvider` corregge al mount — un lampo, una volta sola.
- **Doppio comando, voluto**: interruttore binario nel `ProfileMenu` (dal mockup) e
  tre stati in `/impostazioni`. Il binario non sa esprimere "sistema", quindi riflette
  ciò che si **vede** e, se toccato, fissa una scelta esplicita.
- La persistenza è **solo cookie**: `profiles.theme` per la sincronizzazione fra
  dispositivi è rimandata e si innesta senza toccare nulla, perché il cookie resta la
  fonte per il rendering. Serve comunque per le pagine pre-auth, che non hanno utente.

#### Il tema chiaro non era mai stato renderizzato — cosa è emerso

- ⚠️ **Due token CSS inesistenti, vivi da mesi**: `--color-hane` (sfondo dei tooltip
  dei tre grafici) e `--deep` (sfumatura in fondo alle transazioni recenti). Una
  variabile CSS inesistente **non fa rumore**: la dichiarazione è invalida e la
  proprietà semplicemente non si applica. C'è un audit ripetibile — confrontare ogni
  `var(--…)` del codice con i token definiti in `globals.css` — ed è il modo per
  trovarli. Vale la pena rieseguirlo a ogni fase.
  Nota: correggendo `--deep` è **comparsa** una sfumatura concettualmente sbagliata
  (suggeriva contenuto nascosto in una lista che non scorre, e sfumava verso il colore
  della pagina invece che della card). È stata **rimossa**, non riparata.
- ⚠️ **Un token può essere giusto in un tema e semanticamente sbagliato nell'altro.**
  `--bg-tab` (pastiglia del tab attivo) valeva una tinta *più scura del fondo* in
  entrambi. In scuro funziona — scurire fa emergere. In chiaro il selezionato leggeva
  come **disabilitato**: il design lo vuole bianco in rilievo. È il difetto che il
  grep non trova, perché la sintassi è corretta.
- **`--shadow-drop` in chiaro era sottotono** (0.10 contro lo 0.13–0.20 dei mockup):
  ogni superficie sembrava incollata al fondo. Portato a 0.14, l'inset a 0.9.
- I neutri brand (`tsuki`, `kiri`, `yoru`…) **non sono ridefiniti in `.dark`**: usarli
  come testo (`text-tsuki` era il testo primario di `/analisi` e `/investimenti`)
  significa colore fisso, invisibile in chiaro. Usare sempre i semantici
  (`text-foreground`, `text-muted`).
- Il separatore fra le fette dei donut era `var(--color-yoru)`: somigliava allo sfondo
  scuro **per caso**, e in chiaro disegnava un anello di inchiostro. Va usato il
  colore del **fondo** (`--background-secondary`).
- La palette del donut spese era policroma (rosso/blu/oro/viola = uscite, investimenti,
  risparmi, ricorrenti): suggeriva una distinzione di natura che lì non esiste, visto
  che sono **tutte uscite**. Ora è una scala monocromatica derivata da `--color-aka`
  con `color-mix`, quindi si ricalcola da sé nei due temi.
- Nuovi token: `--ink-*` (vedi Design System), `--switch-track-off`/`--switch-knob-off`
  (componente `components/UI/Switch.tsx`), `--halo-a`/`--halo-b` per gli aloni
  `zg-breathe`, che ora stanno anche sulla Home. **I valori scuri degli aloni sono
  identici a prima**: welcome e onboarding non cambiano di un pixel.

#### Emerso dal code-review, dopo il merge della PR #45 (2026-08-05)

La migrazione accento→inchiostro era stata applicata **a campione**: quasi sempre a
un elemento e non al suo vicino identico — l'importo di una ricorrente sì e il
pulsante "elimina" cinque righe sotto no, "Esci" sì e "Elimina il tuo account"
accanto no. Quattordici difetti, tredici dei quali lì dentro. Le correzioni che
non sono semplici sostituzioni di colore:

- **`tone` di `SettingsRow` faceva due lavori.** Colorava la label *e* la pastiglia
  dell'icona, quindi passargli l'inchiostro ri-tingeva anche la pastiglia e due
  righe adiacenti finivano con pastiglie di tinta diversa sotto la stessa icona.
  Ora sono due prop separate: `tone` (solo testo, vuole un inchiostro) e `accent`
  (solo pastiglia, vuole l'accento pieno).
- **Il colore lo distribuisce la libreria, in coppia.** Dove il colore arriva da un
  modulo condiviso si aggiunge il gemello invece di cambiare quello esistente:
  `TIPO_INK` accanto a `TIPO_COLOR`, `budgetInk()` accanto a `budgetColor()`,
  `PasswordStrength.ink` accanto a `.color`. Riempimenti e barre restano
  sull'accento, il testo prende l'inchiostro, e la scelta non è del chiamante.
- **`SwitchVisual` estratto da `Switch`.** La riga "Ripeti" di `TransactionForm` non
  può usare `<Switch>` — è già un `<button>`, e annidare il `role="switch"` sarebbe
  markup interattivo dentro markup interattivo — quindi ne ricopiava il disegno. Le
  due geometrie erano **già** divergenti (38×22 con pomello 18 contro 40×24 con
  pomello 20): un commento che dice "usa gli stessi token così non divergono" non
  impedisce niente, il disegno condiviso sì.
- **Un ramo morto in `ProfileMenu`**: la forma compatta (solo avatar, menu ancorato
  a destra) non era raggiungibile, perché l'unico chiamante passa sempre `name`.
  Rimossa insieme alle prop opzionali che la descrivevano.
- ⚠️ **Una frase può essere sbagliata dove un colore era solo un lampo.** Con la
  scelta su "sistema", alla primissima visita `resolved` è l'ipotesi del server, e
  `/impostazioni` scriveva "segue il sistema · ora scuro" su una pagina chiara. Il
  lampo di colore era messo in conto (vedi sopra); una *dichiarazione* falsa no.
  Fino all'idratazione si dice solo la parte vera comunque ("segue il sistema",
  icona monitor). Il rilevamento usa `useSyncExternalStore`, **non**
  `useEffect`+`setState`: il lint di React vieta il secondo come render a cascata,
  e qui la differenza fra render del server e render del client è esattamente ciò
  che il primo esiste per esprimere.
- ⚠️ **L'audit dei token non vede tutto.** Rieseguito, passa: 72 token definiti,
  zero `var(--…)` usate senza definizione. Ma `--ink-kiri` *era* definito e non
  mappato in `@theme inline`, quindi `text-kiri-ink` non esisteva e sarebbe
  fallito in silenzio come qualsiasi classe inventata. Va confrontata anche la
  lista dei `--color-*-ink` di `@theme inline` con quella dei `--ink-*` di `:root`.

#### Rimandato

- Saluto orario al posto di "Bentornato": il server è in UTC su Vercel, quindi un
  "buongiorno" alle 23 è peggio di un saluto neutro. Si fa lato client, al costo di un
  lampo del testo dopo l'idratazione.
- ~~⚠️ **`<input type="date">` mostra `mm/dd/yyyy`**~~ — **chiuso nella Fase 19**
  con `components/UI/DatePicker.tsx`. Il formato seguiva la lingua del **browser**,
  non `lang="it"` della pagina: era l'unico pezzo di interfaccia non traducibile,
  perché il testo lo disegna il browser e non è nostro.

