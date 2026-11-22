# #214 — Indietro chiude il pannello in cima, e solo lui

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Da dove arriva

Trovato progettando la #165 (2026-11-19). Esc chiudeva ormai solo lo strato in
cima, ma Indietro passa da un'altra strada: col visore di una ricevuta aperto
dentro il wizard del movimento, il tasto o il gesto Indietro chiudeva
l'INTERO wizard, form compreso.

- Il visore non usava `useCloseOnBack`: non aveva una voce sua nella
  cronologia.
- E dargliela così com'era non bastava: la voce era un booleano
  (`seichiModal`), e l'hook non ne spingeva una seconda se lo trovava già in
  cima — la difesa contro il doppio montaggio di React. Due pannelli annidati
  condividevano una voce, e il `popstate` arrivava a entrambi.

Cercando gli altri chiamanti (lezione 3): anche `ConfirmDialog` non aveva una
voce. Con la conferma di eliminazione aperta in Categorie o Ricorrenti,
Indietro non chiudeva la conferma: lasciava la pagina.

### La correzione (2026-11-22)

- **Una pila, come quella di Esc.** Ogni pannello spinge una voce con la sua
  PROFONDITÀ (`seichiDepth`); un solo ascoltatore di `popstate`, a pila non
  vuota, legge la profondità della voce su cui si è arrivati e chiude
  dall'alto i pannelli che stavano più in su. Un Indietro, un pannello; un
  salto di più voci (il menu lungo del pulsante) li chiude tutti.
- **Le chiusure dal codice** (X, sfondo, Esc, salvataggio) tolgono le voci
  rimaste appese in UN colpo solo, `history.go(-n)` in un microtask: chiudendo
  il wizard col visore aperto si smontano due pannelli, e due `back()` di fila
  non sono affidabili.
- **La chiama `useDialog`**, non più il wizard e i fogli a parte: ogni pannello
  modale ha la sua voce, visore e conferme compresi, e nessuno può dimenticarla.
- **`whenModalEntryGone()` guarda la cronologia, non la pila**: la si chiama
  subito dopo `onClose()`, quando React non ha ancora smontato il pannello. La
  prima stesura confrontava cronologia e pila e si risolveva subito — il
  difetto della #122 rimesso, trovato rileggendo prima di eseguire.
- Una voce scritta prima di questa issue (`seichiModal` senza profondità) vale
  1: una scheda rimasta aperta durante il deploy non si rompe.

### Il collaudo

`tests/e2e/indietro.spec.ts`, tre scenari:

1. col visore aperto, Indietro chiude il visore e il wizard resta con i campi
   scritti; il secondo Indietro chiude il wizard e si resta sulla pagina; il
   terzo torna alla pagina di prima (nessuna voce appesa a consumarne uno);
2. con una conferma aperta, Indietro la chiude e si resta sulla pagina; il
   gemello: chiusa dal suo «Annulla», Indietro lascia la pagina al primo colpo;
3. il rischio che la correzione poteva introdurre: ora anche la conferma ha
   una voce, e chiudendola dopo un'eliminazione il ritorno ripristina l'albero
   salvato nella cronologia mentre la lista chiede `router.refresh()`. La riga
   eliminata — una categoria e una ricorrenza — non ricompare. Ripetuto cinque
   volte di fila: è una corsa, e un verde solo non bastava.

Controprove:

- con `useCloseOnBack`, `useDialog`, `BottomSheetShell` e `TransactionModal` di
  master cadono i primi due scenari, il primo su «il wizard resta, con i campi
  scritti» e il secondo sull'URL («si resta sulla pagina»: col codice vecchio
  la conferma sparisce lo stesso, perché la pagina se ne va);
- **il doppio montaggio di React**, che esiste solo in sviluppo e che la issue
  chiedeva di non rompere: gli stessi scenari su un `next dev` collegato al
  database locale (un worktree a parte, perché nella cartella principale
  girava già il dev server di Jomar) sono verdi; con la sincronizzazione della
  cronologia fatta subito invece che nel microtask cadono entrambi — il
  pannello si chiude da solo appena aperto. È la prova che il doppio montaggio
  c'era davvero, e che il microtask lo regge.

Suite intera 31 su 31.

Nota sul collaudo: `PGRST303 JWT issued at future` è comparso anche a Docker
acceso da ore, su uno scenario che cadeva in meno di un secondo dentro
`seedBasic`. Rilanciato da solo, verde: lo scarto di orologio fra i container
non è solo dei primi minuti.
