# #175 — conti: «riattiva» provato, e il saldo negativo dal telefono

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Da dove arriva

Due rami dichiarati e mai chiusi, raccolti dal report sullo stato del progetto
(2026-11-07):

- **«Riattiva» un conto archiviato** (#62): mai verificato, perché l'account di
  collaudo non aveva conti archiviati. *Una prova che si autoesclude va
  lasciata dichiarata e ripresa.*
- **Il saldo iniziale negativo dal telefono** (residuo della #119): il
  tastierino decimale di iOS (`inputMode="decimal"`) non ha il segno meno, e
  un conto in rosso — una carta di credito — non si apriva dall'iPhone.

### «Riattiva» (2026-11-22)

Nessuna correzione: il ramo funziona. Lo custodisce ora
`tests/e2e/conti.spec.ts`: Revolut archiviato è fuori dal saldo della home
(€ 1500, «1 conto attivo») e dal selettore; «riattiva» in `/conti` lo riporta
fra gli attivi, la pagina lo annuncia, il database dice `archived = false`, e
in home tornano € 1800, «2 conti attivi» e la voce nel selettore.

⚠️ **La prima controprova era sbagliata, e vale registrarlo.** Togliere il
`router.refresh()` di `reactivate()` lasciava lo scenario verde: la action
chiama `revalidatePath("/", "layout")`, e la risposta di una server action che
rivalida porta già la pagina aggiornata. Quel `refresh` è superfluo, non
sbagliato; la controprova giusta rompe la riattivazione stessa
(`archived: true` scritto sempre), e lo scenario cade su «la riga torna fra
gli attivi».

### Il comando ± (2026-11-22)

- Un interruttore dentro il campo del saldo iniziale, a destra, con lo stato in
  `aria-pressed` e il nome «Saldo negativo». Inverte il segno del testo
  (`toggleAmountSign()` in `lib/amount.ts`), con il trattino `-`, lo stesso di
  `formatAmountInput`; `parseAmountInput` legge già il segno col suo
  `allowNegative`. A campo vuoto mette il segno, e poi si scrivono le cifre.
- **`onPointerDown` + `preventDefault`**: il fuoco resta nel campo, e sul
  telefono la tastiera non si chiude a ogni tocco. Il gesto vero è `onClick`,
  che vale anche da tastiera.
- **Premuto non diventa rosso**: un saldo è un importo neutro (glossario,
  «Saldo · N conti attivi»), e il rosso qui vuol dire uscite. Passa dal testo
  attenuato al testo principale.
- 44px di bersaglio, rientrati nel padding: il campo non si alza. Guardato
  negli screenshot, nei due temi.

### Il collaudo

- Vitest: `toggleAmountSign` e `hasMinusSign`, 14 casi (il meno tipografico
  incollato, il campo vuoto, due tocchi che tornano al valore di partenza, lo
  stesso trattino di `formatAmountInput`).
- e2e `conti.spec.ts`, due scenari; controprove ciascuna con la sua build:
  c1 (la action scrive sempre `archived: true`) fa cadere la riattivazione;
  c2 (il comando tolto) e c3 (senza `onPointerDown`, «il fuoco resta nel
  campo») fanno cadere il saldo negativo. Nessun'altra.
- ⚠️ **«Il fuoco resta nel campo» si prova con un mouse vero**, premuto e tenuto:
  la prima stesura usava un `pointerdown` sintetico, che non sposta mai il
  fuoco, e la prova sarebbe passata senza aver guardato.

Il criterio «inserito da iPhone» è coperto dal gesto (solo cifre e virgola,
poi ±) nel browser del collaudo; la prova sul telefono vero resta a Jomar,
come per ogni cosa che dipende dal dispositivo (lezione 10).

### L'audit dei token aveva torto

`npm run audit:tokens` dava `aria-pressed:text-foreground` per «mai
generata». Nel CSS della build c'era:
`.aria-pressed\:text-foreground[aria-pressed=true]{…}`. Le varianti `aria-*` e
`data-*` diventano un selettore d'attributo, e l'audit riconosceva come fine
del selettore spazio, `{`, `:` e simili, non `[`. Aggiunta la parentesi quadra
ai terminatori; controprova: con `aria-pressed:text-inesistente` l'audit cade
come deve.
