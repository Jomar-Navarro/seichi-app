# #217 — il + durante lo scheletro della home propone il conto sbagliato

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Da dove arriva (2026-11-19)

Trovato collaudando la #165: lo scenario e2e «il nuovo movimento propone il
conto guardato» (#112) cadeva qualche volta col server carico, una volta su
«Conto principale». Aprendo `/?conto=<Revolut>` e toccando + mentre si vede
lo scheletro, il form proponeva il primo conto attivo: lo stesso difetto della
#112, riaperto da una corsa.

### Perché succedeva

- Tutta la home sta in `<Suspense fallback={<HomeSkeleton />}>`, e
  `<ViewedAccount>` era in fondo a `DashboardContent`: si montava solo
  all'arrivo delle sei letture.
- Il + sta nel layout, ed è attivo già durante lo scheletro.
- Il form legge il conto guardato una volta sola, all'arrivo dei conti
  (`getState()`, apposta: non deve cambiare conto da solo). Se in quel
  momento la pagina non l'ha ancora dichiarato, ripiega sul primo attivo, e
  la dichiarazione che arriva dopo non lo corregge.

### La correzione (2026-11-20)

`<ViewedAccount>` sta in `MainPage`, accanto al Suspense: arriva con
l'involucro della pagina, che è anche quello che rende toccabile il +.

- ⚠️ Lì il conto **non è ancora validato**: il `redirect` per un conto che non
  è dell'utente sta in `DashboardContent`, dopo la lettura dei conti.
  Aspettarlo avrebbe rimesso la dichiarazione dietro lo scheletro. La garanzia
  sta nel form, che propone il conto guardato solo se è fra i conti letti
  sotto RLS e non è archiviato. Un id inventato ricade sul primo attivo.
- Scartata l'altra proposta della issue, un form che segue la dichiarazione
  finché l'utente non tocca «Conto»: più codice, e un campo che cambia valore
  sotto gli occhi.
- `/analisi` e `/investimenti` non cambiano. Sopra la loro dichiarazione non
  c'è né un Suspense né un `loading.tsx`, quindi la pagina arriva intera, e
  il + non si può toccare prima che il conto sia dichiarato. Lo scenario le
  prova lo stesso, per il giorno in cui uno dei due comparisse.
- `/transazioni` e `/conti/[id]` dichiarano da un client component reso
  direttamente dalla pagina, senza Suspense in mezzo: nessuna corsa.

### Il collaudo: tenere fermo lo scheletro apposta

Le letture della home le fa il server, quindi `page.route()` non le
raggiunge; e una risposta servita da `route.fulfill()` arriva intera, non a
pezzi. Per toccare + durante lo scheletro senza sperare nei tempi c'è
`openHeld()` (`tests/e2e/support/hold.ts`): un proxy fra il browser e
`next start` che lascia passare l'involucro e trattiene ciò che chiude un
Suspense, finché il test non lo rilascia.

Come è fatto lo streaming, misurato leggendo i chunk HTTP della risposta
(ogni chunk è un invio di Next):

| chunk | cosa porta |
|---|---|
| `#0` | l'HTML dell'involucro, con un `<template id="B:n">` per ogni Suspense aperto |
| `#1` | i dati RSC dell'involucro, che servono per idratare |
| poi | altri dati RSC; il contenuto `<div hidden id="S:n">` con `$RC("B:n",…)`, che lo scambia con lo scheletro |
| col `redirect` | `<meta id="__next-page-redirect" http-equiv="refresh">`, poi `$RX("B:n",…)` |

Tre trappole trovate strada facendo:

1. **Il primo marcatore non è il punto giusto.** In `/analisi` i tab si
   aprono e si chiudono dentro `#0`. Tagliando lì si tratteneva anche `#1`,
   la pagina non si idratava, e il + non rispondeva. Si trattiene dal primo
   chunk che chiude un confine aperto in un chunk *precedente*.
2. **Un `redirect` dentro il Suspense non manda `S:`**, manda `$RX`. Prima
   arriva il `<meta refresh>`, che lasciato passare fa ricaricare al browser
   la pagina di arrivo dopo un secondo: il test avrebbe provato quella.
3. **«Transazioni recenti» compare anche nei dati RSC** (il dizionario
   passato ai client component), non solo nell'HTML. Per sapere dove sta il
   contenuto si cerca il nodo HTML, `>Transazioni recenti<`.

Misure, 2026-11-20, su `next start`:

- su 40 aperture, la dashboard arriva sempre in streaming dopo l'involucro, e
  il `redirect` dell'id inventato arriva sempre come `$RX`;
- lo scenario nuovo e quello della #112, 12 ripetizioni con 4 worker: 24 su
  24 verdi;
- a 8 worker invece cadevano entrambi, anche quello senza proxy. La macchina
  era in swap: 2,8 GB liberi su 15,4, Windows Update e Defender al lavoro.
  Un prefetch di `/recupera-password` impiegava 25 secondi. Era un difetto
  dell'ambiente, non dell'app.

Controprove, dichiarate prima di farle:

| mutazione | rossi attesi | rossi avuti |
|---|---|---|
| `<ViewedAccount>` di nuovo in fondo a `DashboardContent` (master) + un `loading.tsx` in `/analisi` | home con Revolut, `/analisi` | gli stessi, entrambi su «Conto principale» |
| il form propone `viewedAccountId` senza cercarlo fra i conti letti | home con l'id inventato | lo stesso, su «Seleziona conto» |

### La review (2026-11-20)

Nessun rilievo sul codice dell'app. Quattro, minori, sul proxy, tutti
applicati:

- il piede della sidebar ha un Suspense suo nel layout, quindi può far
  trattenere anche una pagina che arriva intera: i commenti che dicevano il
  contrario sono stati corretti (non fa danno, la dichiarazione sta
  nell'involucro);
- il socket verso Next si chiude quando il browser se ne va, e uno stream
  interrotto senza il chunk finale fa cadere la risposta invece di lasciarla
  appesa;
- una riga di dimensione illeggibile ferma il proxy invece di farlo girare
  all'infinito sugli stessi byte;
- se lo splash manca, il rosso lo dice (`toBeAttached` con un messaggio)
  invece di un timeout generico.

Ripetendo lo scenario dopo le correzioni, un rosso su 24 a 4 worker: il +
toccato prima che React lo idratasse, e il pannello non si apriva. Con la
pagina trattenuta `load` non arriva mai, e lo splash da solo non lo
garantisce. `openHeld` ora aspetta che il nodo del + porti le sue props di
React (`__reactProps$…`). Dopo: 32 su 32, e la controprova sul codice di
master di nuovo rossa dove deve.
