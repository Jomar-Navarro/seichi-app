# #153 — movimento ridotto

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Movimento ridotto (#153, 2026-11-09)

Nessuna regola `prefers-reduced-motion` in tutto il repo, e quattro animazioni
infinite. Ora ognuna dice **accanto a sé**, in `globals.css`, cosa fa quando
il sistema chiede movimento ridotto — non un blocco in fondo al file, così
chi ne aggiunge una nuova (#71) trova il modello lì vicino.

| animazione | con movimento ridotto |
|---|---|
| `zg-breathe` (aloni) | ferma, a opacità 0.74 — la media del respiro: con il solo `animation: none` tornerebbe a 1, più accesa di quanto il disegno la mostri mai |
| `zg-pulse` (scheletri) | ferma; la forma dice già "qui arriva qualcosa" |
| `zg-shake` (PIN errato) | via; i pallini rossi dicono già l'errore |
| `zg-ring` (attesa sull'avatar) | ferma, a opacità 0.65 (il suo primo fotogramma): un anello attorno alla foto, accanto a "Caricamento…" |
| `zg-boot-out` (splash) | **nessuna regola**, deliberatamente |

- ⚠️ **`zg-ring` si spegne con `animation: none`, non con
  `animation-play-state: paused`**: la pausa congela un fotogramma qualunque,
  anche quello a opacità 0, e l'attesa sparirebbe. L'anello fermo è
  l'indicazione statica che la issue chiedeva.
- ⚠️ **Uno stato fermo usa un valore che l'animazione mostra.** Aloni e
  anello hanno opacità 1 come stile di base e non ci arrivano mai, quindi la
  regola la dichiara (0.74, 0.65); gli scheletri ci arrivano a ogni ciclo, e
  restano lì.
- ⚠️⚠️ **Lo splash resta com'è, e la issue proponeva di accorciarlo.** È
  `zg-boot-out`, con `forwards`, a portare il velo a opacità 0: con
  `animation: none` resterebbe sopra l'app per sempre (la controprova lo
  mostra). E accorciarla non serve: è una dissolvenza, e le WCAG (2.3.3)
  escludono i cambi di opacità dall'animazione di movimento — "Riduci
  movimento" di iOS sostituisce proprio gli spostamenti con dissolvenze.
  Accorciata scoprirebbe invece la correzione del tema alla prima visita, che
  lo splash esiste per coprire. Anello e aloni dentro il velo si fermano con le
  loro regole.
- **Niente regola globale** che azzeri ogni durata (`* { animation-duration:
  0.01ms }`, la ricetta diffusa): spegnerebbe lo splash a metà strada e
  lascerebbe gli aloni a un'opacità mai disegnata. Le **transizioni brevi
  restano** — chevron, interruttore, puntini del carosello: partono da un
  gesto e spostano di pochi pixel. **Quelle che spostano davvero si spengono
  sul posto** con `motion-reduce:transition-none`: il vassoio di Conti (120px,
  e sul computer lo apre il solo passaggio del mouse) e la barra del budget,
  che si allunga quando cambiano i dati.
- ⚠️ **I grafici non avevano bisogno di un hook.** Recharts 3 ha
  `isAnimationActive: "auto"` come default, e `"auto"` legge da sé
  `prefers-reduced-motion`. Il donut di `/investimenti`, che la prop non la
  passa, si fermava già; `MonthlyLineChart` e `SpendingPieChart` passavano
  `animated = true` (la prop della stampa, 23b) e così **forzavano**
  l'animazione proprio a chi l'aveva chiesta spenta. Ora `animated` diventa
  `"auto"`, e `false` resta per il report.
- **Gli scorrimenti chiesti da JavaScript** — il puntino del carosello della
  home, il campo sopra la tastiera, la frase d'errore del form — saltano invece
  di scorrere: `scrollBehavior()` in `lib/motion.ts`. Il CSS non li raggiunge.
  ⚠️ Restituisce `"auto"`, che **non** vuol dire "istantaneo" ma "quello che
  dice lo `scroll-behavior` CSS del contenitore" (trovato dalla review). Oggi
  nessuno dice `smooth`, quindi salta; uno scorrimento fluido in CSS va scritto
  `motion-safe:`, che serve comunque per le ancore. `"instant"` non è stato
  scelto: un Safari che non lo conosce solleva un `TypeError`, e uno degli
  scorrimenti parte da un effetto di React.
- Lo scheletro della lista movimenti usava la pulsazione di Tailwind invece di
  `zg-pulse`, come gli altri: allineato, così una regola sola le ferma tutte.

Collaudo del 2026-11-09 su una build di produzione, con
`emulateMedia`/`reducedMotion: "reduce"` e un account di prova usa e getta
(registrato ed eliminato dall'app; il login successivo risponde
`invalid_credentials`): **23/23** senza login (aloni, splash, anello, e le
regole e le transizioni su elementi iniettati) e **14/14** autenticati — grafici di `/analisi`
e `/investimenti`, scheletro della lista con la risposta trattenuta 3 secondi,
scossa del PIN (impostato solo nel `localStorage` del browser di prova),
carosello della home. **Controprova su master**: 7 KO e 5 KO, fra cui il
grafico di `/analisi` ridisegnato 91 volte con movimento ridotto e il
carosello che scorre per 16 fotogrammi.

- ⚠️ **Un grafico animato si misura contando i ridisegni**, non leggendo il
  `d` del tracciato: l'`<Area>` di Recharts entra allargando un `clipPath`, a
  tracciato fermo. Un ciclo di `requestAnimationFrame` confronta l'`outerHTML`
  di ogni `svg.recharts-surface`: fermo cambia una volta, animato decine.
- ⚠️ **Chromium non rispetta da solo il movimento ridotto negli scorrimenti
  `smooth`**: la controprova del carosello è la prova che `scrollBehavior()`
  serve, e non solo su Safari.
- ⚠️ Il primo giro della scossa diceva KO su entrambi i rami, con UN pallino
  pieno dopo sei tocchi: in un contesto con `hasTouch` il tastierino deduplica
  pointerdown e click (il click fantasma della 26a), e i `click()` sintetici di
  Playwright ci finiscono dentro. Con `tap()`, un tocco vero, è verde. La
  verifica, non l'app.

Dalla code review (5 rilievi, 3 applicati): il vassoio di Conti e la barra
del budget, che la prima versione lasciava scorrere; l'anello fermo a opacità
1. Respinti: gli scheletri a un'opacità media invece di 1 (1 è un fotogramma
che la pulsazione mostra) e `"instant"` al posto di `"auto"` (vedi sopra).

Resta da fare a mano: iOS con *Accessibilità → Movimento → Riduci movimento*.

