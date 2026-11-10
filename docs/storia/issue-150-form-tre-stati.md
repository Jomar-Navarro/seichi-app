# #150 — conti e categorie del form in tre stati

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Form — conti e categorie in tre stati (#150, 2026-11-07)

Il form del movimento scriveva «Serve un conto per registrare un movimento»
a chi i conti li aveva: lo stato iniziale, il caricamento e «nessun conto»
erano lo stesso array vuoto. Visto tre volte nei collaudi (20b, #117, #148) e
tre volte preso per un difetto della PROVA, correggendo l'attesa del driver
invece del form. **Un sintomo che torna in tre collaudi diversi non è
un'attesa troppo corta.**

- `components/UI/useClientRows.ts`: `useAccountRows()` e `useCategoryRows()`,
  tre stati (`loading` / `ready` / `failed`) e `retry`. Il caricamento si
  DERIVA da chiave e tentativo, senza `setState` nell'effetto. Usato dal form
  del movimento e da `RecurringSheet`. Restano letture del browser: come
  server action finirebbero in coda dietro a quelle della pagina.
- «Serve un conto» solo a lettura arrivata **e** senza un conto su cui
  scrivere (`effectiveAccountList` vuota). ⚠️ Prima la condizione era la lista
  vuota: con tutti i conti archiviati il salvataggio restava spento **senza
  una parola**. Trovato dalla controprova, non dalla issue.
- `Select` riceve lo stato della lettura (`load`, con `optionsLoad()`): mentre
  le righe arrivano il campo dice «Caricamento…», se la lettura fallisce «Non
  disponibile» e sotto compare la frase con «Riprova» (`LoadError`, variante
  `inline`). ⚠️ **Le tre parti stanno in `Select` e non nei moduli**: ricopiate
  in quattro punti, al selettore di destinazione ne era già sfuggita una
  (code review della #182). Due campi sulle stesse righe (origine e
  destinazione) dicono la frase una volta sola: `failedMessage: null`.
- «Non disponibile» e non «Seleziona …» su una lettura fallita: un movimento o
  una regola CON un conto non devono sembrare senza. Neutro rispetto al
  genere, perché lo stesso campo è un conto o una categoria.

Collaudo su una build di produzione, account usa e getta (eliminato): conti e
categorie rallentati di 4 secondi, risposte 500 e una risposta con tutti i
conti archiviati, tutto modificato nel browser. **22 controlli su 22**;
controprova su master, stesso account: **12 KO**.

