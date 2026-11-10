---
paths:
  - "**/*.tsx"
  - "components/UI/*.ts"
  - "store/**"
---

# Componenti React

Storia: `docs/storia/issue-122-form-movimento`, `issue-148-movimenti`,
`issue-150-form-tre-stati`, `issue-124-errori`, `fase-22-ricevute`,
`fase-26a-pin`, `fase-28-responsive`.

## Confini e stato

1. **Un server component non passa funzioni a un client component** (`icon`,
   `on*`, `render*`): la serializzazione RSC fallisce solo aprendo la pagina, e
   né `tsc` né `next build` lo vedono.
   - Si passano dati: stringhe e oggetti semplici.
   - Un componente che deve leggere la lingua resta server e usa `getI18n()`.
2. **I pannelli si montano e si smontano**:
   `{aperto && <Sheet key={record?.id ?? "new"} />}`, e gli inizializzatori di
   `useState` leggono le prop. Niente effetto che azzera, niente `eslint-disable`
   per farlo tacere.
3. **Mai `setState` sincrono dentro un effetto** (`react-hooks/set-state-in-effect`).
   - Un valore esterno che differisce fra server e client si legge con
     `useSyncExternalStore`.
   - Un caricamento si DERIVA da chiave e tentativo.
   - `setState` va bene dentro il callback di un evento a cui l'effetto si
     iscrive.
4. **Ogni stato ha un proprietario solo**: due copie della stessa coda divergono
   nel ramo d'errore. Quando due strade scrivono lo stesso campo, la precedenza è
   DICHIARATA (un ref), non dedotta dall'ordine degli eventi del browser.
5. **Un `eslint-disable` di `exhaustive-deps` dice quale valore congela.** Un
   valore letto allo smontaggio sta in un ref, non nella closure del montaggio.
6. **La memoria di modulo segue tre regole**:
   - esiste solo nel browser: sul server una variabile di modulo è condivisa fra
     tutti gli utenti;
   - è legata all'utente, e scade a ogni salvataggio (`transactionSavedAt`);
   - una copia mostrata si riaggiorna sempre, e se l'aggiornamento fallisce la
     pagina lo dice.

## Letture, errori, gesti

1. **Ogni lettura ha tre stati**: in caricamento, arrivata, fallita. Mai un array
   vuoto che li confonde (`useClientRows`, `Select` con `load`). Una lettura
   fallita è `LoadError` con «Riprova», mai `EmptyState`.
2. **Ogni gestore che chiama un'action ha `try`, `catch` e `finally`.** Senza
   `catch` un'eccezione sparisce e il gesto non dice niente; senza `finally`
   `pending` resta acceso per sempre. Un'action fallita si dice quanto una
   lettura fallita.
3. **Una richiesta superata si scarta con un contatore** (`requestId`). Oggi Next
   spedisce le action una alla volta, ma la documentazione lo chiama un dettaglio
   d'implementazione.
4. **Le letture che un client component fa all'apertura stanno in una sola
   action**, che le compone in parallelo sul server (`getMovimentiData`): più
   action si metterebbero in coda. Dove la pagina è un server component sottile
   che passa il lavoro al client (Movimenti), quel server component non legge
   niente dalla rete: si rende a ogni navigazione, e ritarderebbe il tocco sulla
   nav.
5. **Per navigare dopo aver chiuso un pannello, aspetta `whenModalEntryGone()`**:
   il cleanup di `useCloseOnBack` fa `history.back()`, e un `router.push` in volo
   verrebbe scartato.
6. **Un form che resta montato fra un passo e l'altro fa sopravvivere ogni suo
   stato.**
   - Ciò che vale per un tipo (categoria, destinazione) si ricorda per tipo.
   - `createdId` vive nel modale e si scrive in un `finally`, o una riprova
     duplica il movimento.
7. **Il conto guardato lo dichiarano le pagine** (`<ViewedAccount>`,
   `useViewedAccount()`) e lo ritirano confrontando il turno, non l'id.

## Tocco, tastiera, mouse

1. **Deduplica pointerdown e click**: il browser sintetizza un click anche dopo
   `preventDefault()`. Se l'ultimo tocco cambia schermata, il click fantasma va
   assorbito (`swallowNextClick()` in `PinPad`).
2. **Ogni comando funziona anche da tastiera** (`onClick`, non solo
   `onPointerDown`). Un ascoltatore globale dei tasti vive solo nel passo che lo
   usa.
3. **Un trascinamento usa `setPointerCapture`**, e un flag che sopprime il click
   si azzera a ogni nuovo `pointerdown`.

## Accessibilità

1. **Ogni bottone di sole icone ha un nome accessibile** (`aria-label` dal
   dizionario), e `aria-pressed` o `aria-expanded` dicono ciò che si vede.
2. **Sotto un velo si usa `inert`, non `aria-hidden`**: il secondo lascia libero
   il fuoco della tastiera.
3. **Niente `capitalize` sul testo italiano**: maiuscolizza ogni parola. La
   maiuscola sta nel dizionario.
