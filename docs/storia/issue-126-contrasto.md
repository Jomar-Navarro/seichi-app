# #126 — contrasto, accento come testo, accessibilità

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Contrasto, accento come testo, accessibilità (issue #126)

Dalla review completa del 2026-09-28 (#128). Nessuna migration.

#### ⚠️ La decisione di design: due token, un solo colore sicuro

`--text-muted` (272 usi) e `--text-disabled` (37 usi) erano sotto la soglia
4,5:1 che questo stesso file si dà — `--color-kiri` nudo dà 2,84–3,13:1,
`--color-hai` 2,30–2,86:1, anche in scuro. Il file aveva già la soluzione
pronta per il kiri: `--ink-kiri`, la stessa tinta portata oltre soglia per il
sesto inchiostro dei grafici.

Calcolato il budget reale (formula WCAG, contro `kami`/`tsuki`/`--modal-bg`):
`--ink-kiri` siede a **4,66–5,13:1**, a pochi millesimi di luminanza dal
minimo. Per avere un SECONDO grigio "più spento ma ancora ≥4,5:1" servirebbe
una luminanza compresa in una finestra di 0,006 — invisibile in hex. **Due
grigi distinti e accessibili non esistono su questa palette.**

Deciso: `--text-disabled` (light) e `--text-disabled` (dark) puntano ora ai
rispettivi `--text-muted`. I due token restano SEPARATI — significano cose
diverse (vedi il commento già presente in `GoalCard.tsx`: muted = dato,
disabled = etichetta di sezione/hint) — ma risolvono allo stesso colore: la
gerarchia visiva fra i due resta tipografica (maiuscole, tracking,
dimensione), non cromatica. Verificato a occhio in entrambi i temi
(`/impostazioni`, le etichette di sezione maiuscole): resta leggibile, non
appesantisce la pagina.

#### Accento usato come colore del testo

Lo stesso schema già corretto da `TIPO_COLOR`/`TIPO_INK` (il colore pieno
risalta su riempimenti/icone, 3:1 basta; il testo vuole l'inchiostro, 4,5:1):
cinque punti dove un accento pieno coloriva direttamente una label.

- `CategorySheet.tsx` — la pillola del tipo selezionato, il periodo di budget
  selezionato, l'etichetta dell'icona selezionata: tutte e tre leggevano
  `TIPO_COLOR[type]`/il colore della categoria invece del loro inchiostro.
- `TransactionModal.tsx` — l'etichetta del tipo nell'header (`selectedType.color`).
- `FrequencySelector.tsx` — guadagna un prop `ink` (coppia di `color`, come
  `TIPO_COLOR`/`TIPO_INK`), passato dai due chiamanti (`RecurringSheet`,
  `TransactionForm`) insieme al `color` che già avevano.

Verificato non a occhio ma leggendo `getComputedStyle` nel browser: il testo
selezionato di "spesa" risolve a `rgb(150, 84, 61)` = `#96543d` =
`--ink-aka`, non `#b47358` (`--color-aka`).

#### Gli altri punti

- **`GoalCard.tsx`** — il testo di un obiettivo completato usava
  `var(--color-kiri)` fisso: quel token non è ridefinito in `.dark` (lo dice
  il commento accanto alla sua definizione), quindi un completato restava
  colorato IDENTICO nei due temi. Ora `var(--text-muted)`, che si adatta.
- **`CategoryManager.tsx`** — `capitalize` su `t.newByType[type]`
  ("nuova entrata") produceva "Nuova Entrata": il CSS maiuscolizza OGNI
  parola, l'italiano solo la prima. Tolta la classe, maiuscola spostata nel
  dizionario (entrambe le lingue, "Nuova entrata"/"New income").
- **`AttachmentPicker.tsx`** — il bottone "Aggiungi ricevuta": `border
  border-dashed border-subtle` su un angolo arrotondato è il difetto Firefox
  della #81 (bordo traslucido + raggio), non dichiarato lì; e l'etichetta
  usava `text-disabled` a RIPOSO, su un comando attivo (`disabled:opacity-50`
  già copre lo stato vero disabilitato durante l'upload). Tratteggio in SVG,
  riposo in `text-muted`.
  ⚠️ **Prima correzione duplicava `DashedAddButton`** invece di condividerlo —
  trovato dal code-review, che ha citato il precedente di `SwitchVisual`
  ("scritto due volte, tratteggio e raggio divergerebbero alla prima
  modifica"). Estratto `DashedBorder.tsx`, usato da entrambi.
- **`GoalSheet.tsx`** — le 8 icone del picker obiettivo non avevano nome
  accessibile: `lib/goal-icons.ts` teneva etichette italiane scritte a mano
  (`label: "Viaggio"`…) mai lette da nessuno. Le parole si spostano in
  `t.goals.goalIcons` (entrambe le lingue, come ogni altra stringa rivolta
  all'utente), usate come `aria-label` + `aria-pressed`; `GOAL_ICONS` perde il
  campo morto.
- **`Switch.tsx`** — il bottone di `<Switch>` (usato solo da `ThemeToggle`)
  aveva il bersaglio tattile identico al disegno, 38×22: sotto i 44×44
  dell'issue #69. Il bottone cresce a `w-11 h-11` e centra `SwitchVisual` al
  suo interno — il disegno non cambia dimensione, solo l'area cliccabile.
- **`common.required`** — voce di dizionario mai letta da nessun componente:
  rimossa da entrambe le lingue.

#### Il collaudo

`tsc`, lint, `next build` e `npm run audit:tokens` (72/83/6 token, nessuna
classe incollata a `${`) verdi dopo ogni giro, incluso dopo l'estrazione di
`DashedBorder`.

Verifica visiva nell'app vera, **su un account di prova usa e getta**
(registrato dall'app, eliminato dall'app alla fine via
`/impostazioni/elimina`): registrazione → onboarding → screenshot di
`/impostazioni`, del form categoria (pillole selezionate) e del wizard
movimento (riquadro ricevute), in entrambi i temi — zero errori console in
ogni giro.

⚠️ **Il quarto criterio dell'issue — "Firefox: nessun quadrato sulla zona
ricevute" — richiedeva il motore vero**: il bug #81 è invisibile su
Chromium. `npx playwright install firefox` (fuori da `package.json`, come la
#111), contesto con `locale: "it-IT"` (altrimenti Firefox manda
`Accept-Language: en-US` e i selettori sui testi italiani non trovano
niente — la stessa trappola già pagata nella 23a), un secondo account di
prova, `deviceScaleFactor: 4` e uno screenshot ritagliato su ciascuno dei
quattro angoli del riquadro. Nessun quadratino, in nessuno dei quattro
angoli, in nessuno dei due temi.

Due selettori ambigui trovati e corretti durante il collaudo, entrambi la
stessa classe: un testo cercato nella pagina intera risolveva a un elemento
dietro il modale invece che dentro. `t.typesShort.entrata` è **minuscolo**
("entrata"), non "Entrata" come la label di sezione di `CategoryManager`
dietro il backdrop — bastava scoprire che "spesa" è già selezionata di
default aprendo "Nuova spesa" per non doverci cliccare affatto. Ogni
selettore dentro un pannello va scoperto all'ultimo `div.fixed.inset-0.z-50`
aperto, mai cercato nella pagina intera.

