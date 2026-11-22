# #171 — la valuta scelta nell'onboarding arriva a ogni importo

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Da dove arriva

L'onboarding faceva scegliere la valuta e la salvava in `profiles.currency`, ma
l'app scriveva sempre in euro: `DISPLAY_CURRENCY = "EUR"` in
`lib/i18n/format.ts`, il segnaposto lasciato dalla Fase 19 («La valuta NON è
stata toccata», `fase-19-lingua`). Chi sceglieva il dollaro vedeva € ovunque.
*Una scelta che l'app ignora è peggio di nessuna scelta.*

La issue lasciava due strade: usarla, o toglierla e dichiarare che Seichi
lavora in euro. Decisione di Jomar (2026-11-22): **usarla**. In entrambi i casi
nessuna conversione fra valute: conti in valute diverse sono un'altra fase.

### Le decisioni

1. **Si usa la valuta del profilo, per tutto l'account.** Una valuta per utente,
   non per conto: il simbolo cambia, i numeri no.
2. **Resta modificabile dalle Impostazioni, con un avviso** sotto la riga:
   «Cambia solo il simbolo: gli importi restano quelli che hai scritto, senza
   conversione». Bloccarla dopo l'onboarding avrebbe reso permanente un errore
   di scelta. L'avviso sta prima del gesto, non dopo: chi cambia valuta deve
   saperlo prima di vedere il saldo col simbolo nuovo.
3. **Lo yen resta, senza decimali.** `currencyDecimals()` chiede a `Intl` le
   unità minori (ISO 4217): 2 per euro, dollaro, sterlina e franco, 0 per lo
   yen, mai oltre 2 perché la colonna è `numeric(10,2)`. In yen:
   - le cifre non hanno decimali («¥ 1788», non «¥ 1787,50»);
   - il tastierino del movimento non ha il tasto del separatore (una casella
     vuota al suo posto, la griglia resta 3×4) e la tastiera fisica non lo
     scrive;
   - i campi aprono il tastierino `numeric` del telefono (`amountInputMode`);
   - un importo con decimali è un errore («Questa valuta non ha decimali:
     scrivi un numero intero»), nei campi e nelle action (`isStorableAmount`);
   - il massimo è 99.999.999 (`amountMax`), non il 100.000.000 che
     `formatMoney` avrebbe scritto arrotondando `AMOUNT_MAX`.

### Come viaggia: un cookie, come la lingua

La valuta serve a ogni importo di ogni pagina, root layout compreso. Leggere
`profiles.currency` a ogni render sarebbe una query per pagina per un valore che
cambia forse una volta nella vita di un account: è lo stesso ragionamento della
lingua (Fase 19), e la stessa soluzione.

- **`seichi-currency`** (`CURRENCY_COOKIE` in `lib/i18n/config.ts`) è la fonte
  del rendering; `profiles.currency` resta la persistenza fra dispositivi.
- **Lo scrivono**: `savePreferences()` (onboarding), `updatePreferences()`
  (Impostazioni), il login (`syncPreferencesFromProfile()` in `sign/action.ts`,
  e la callback OAuth sulla risposta). Un profilo senza valuta (onboarding da
  fare) **toglie** il cookie: sullo stesso dispositivo può esserci quello di chi
  è uscito prima.
- **Lo leggono**: `getI18n()` e `requireUser()` (lato server, anche le action),
  il root layout, che lo passa a `I18nProvider`; `useI18n()` lo dà ai client
  component accanto a `locale`.
- **Il proxy ripara il cookie mancante.** Un utente autenticato senza cookie (chi
  era già dentro al rilascio, o chi l'ha cancellato) riceverebbe il ripiego €:
  un numero col simbolo sbagliato è un'affermazione falsa. Il proxy legge allora
  `profiles.currency` una volta e scrive il cookie, sulla richiesta (perché il
  render di quella pagina la veda) e sulla risposta. Dalla richiesta dopo il
  ramo non parte più.
- **Le notifiche** leggevano la valuta dal profilo, con una query loro. Ora
  usano quella di `requireUser()`: una fonte sola, o il campanello avrebbe
  potuto dire $ sopra una pagina in €.

**Concessione dichiarata**, la stessa della lingua: il cookie è una fotografia
per dispositivo. Cambiata la valuta sul telefono, il computer mostra la vecchia
fino al prossimo accesso (e la riga delle Impostazioni, che legge il profilo
vivo, dice già la nuova).

### Il simbolo: `narrowSymbol`

Il primo collaudo l'ha mostrato prima di scrivere i test: con il `symbol` di
default di `Intl`, in `it-IT` il dollaro è **«USD»** e lo yen **«JPY»**; in
`en-GB` «US$» e «JP¥». Il simbolo nudo è riservato alle valute «di casa» del
locale, per distinguere i dollari fra loro in un testo che ne nomina più d'uno.
Qui ogni utente ha una valuta sola: `currencySymbol()` usa `narrowSymbol` («$»,
«¥»). Il franco resta «CHF», perché `Intl` non ne ha uno più stretto.

### Cosa è cambiato, punto per punto

- `DISPLAY_CURRENCY` non esiste più: i suoi ~30 riferimenti ricevono `currency`
  da `useI18n()`, `getI18n()` o `requireUser()`.
- `splitAmount(value, { locale, currency })` e `formatAmount(…, locale,
  currency)`: i decimali sono quelli della valuta.
- `parseAmountInput`, `applyAmountKey`, `amountErrorMessage` e
  `isStorableAmount` prendono la valuta: il compilatore ha elencato ogni
  chiamante, nessuno è rimasto indietro.
- Due «€» scritti a mano, sfuggiti alla Fase 19 perché non passavano da
  `formatMoney`: la pastiglia della card budget senza icona e il tooltip del
  grafico mensile (che usava anche `toFixed(2)`, cioè il punto decimale in
  italiano).
- `renderNotification()` ricomponeva a mano la cifra all'unità: ora è
  `formatMoney`, una regola in un posto solo.
- L'onboarding offriva quattro valute, le Impostazioni cinque (mancava il
  franco): l'elenco ora è `CURRENCIES` per entrambi, con le icone in un
  `Record<Currency, …>` che non compila se ne manca una.
- L'archivio completo dice la valuta per nome nel `LEGGIMI.txt` («Gli importi
  sono in USD, la valuta del profilo»), dalla stessa riga di `profile.json`. Il
  CSV dei movimenti ha sempre avuto numeri nudi, senza simbolo: non cambia.

### Collaudo

- **Vitest**: `formatMoney` nelle cinque valute e nelle due lingue, i decimali,
  `splitAmount` in yen, il simbolo stretto; parser, tastierino, action e messaggi
  in yen con il gemello in euro, dollaro, sterlina e franco; il README
  dell'archivio. Controprove: senza `narrowSymbol` cadono esattamente i casi USD
  e JPY; con lo yen forzato a due decimali cadono gli undici casi dello yen.
  Quest'ultima ha trovato un'asserzione che non guardava: «¥ 99.999.999,99»
  *contiene* «¥ 99.999.999», e il `toContain` restava verde. Ora confronta la
  frase intera.
- **End-to-end** (`tests/e2e/valuta.spec.ts`): un account in dollari su otto
  pagine (report e Impostazioni compresi) più il campanello; il proxy che ricava
  la valuta senza cookie; lo yen scelto dalle Impostazioni, con il tastierino, un
  movimento salvato a 1500 e un saldo iniziale con decimali rifiutato. Controprove:
  `getCurrency()` che ignora il cookie fa cadere tutti e tre; senza il blocco del
  proxy cade il secondo; con il tasto del separatore sempre visibile cade il
  terzo, ciascuno sulla riga dichiarata.
- ⚠️ **Il primo verde era falso.** La prova leggeva `body.textContent`, che
  comprende gli script del payload RSC — pieni di `$` (`$RT`, `$Sreact`). «C'è un
  $ nella pagina» passava senza aver guardato un importo. Ora il testo si legge da
  una copia del body senza script, e si cerca `$` seguito da una cifra.
- Screenshot nei due temi: l'avviso sotto la valuta, il tastierino in yen, la
  home in yen.

### La review, e il menu

La code review prima del merge ha trovato tre cose vere, tutte nate dal fatto
che la valuta ora decide anche i decimali, e una che il cookie apriva:

- **Un movimento coi centesimi, riaperto dopo il passaggio allo yen**, partiva
  dal passo dell'importo con «¥12,50» e «Continua» spento, senza un perché. Ora
  sotto la cifra c'è «Questa valuta non ha decimali: scrivi un numero intero».
  Arrotondarlo da solo sarebbe stato il terzo numero plausibile: si cancellano i
  decimali col tasto ⌫ e si prosegue.
- **L'avviso diceva il falso in yen**: «gli importi restano quelli che hai
  scritto» è vero nel database, non a schermo, dove 12,50 si legge ¥ 13. Per una
  valuta senza decimali l'avviso aggiunge che i centesimi si vedono arrotondati.
- ⚠️ **Il cookie sopravviveva all'uscita.** Chi entrava dopo sullo stesso
  dispositivo per una strada che non lo riallinea (una registrazione, un OAuth
  con `next` diverso da «/») vedeva i propri importi col simbolo e i decimali
  dell'altro — e le action li validavano con quei decimali. Il proxy non poteva
  accorgersene: ripara un cookie che MANCA. Ora ogni `auth.signOut()` (cinque
  punti: le due route di uscita, l'action delle Impostazioni, l'eliminazione
  dell'account, la password reimpostata) chiama `clearCurrencyCookie()`. La
  lingua resta: è una preferenza di chi legge, non un fatto dei dati.
- Minori: «CHF» toccava i bordi delle pastiglie da 32 e 36px (tre, non una:
  preferenze, limite mensile, card del budget), e ora prende un corpo più
  piccolo; `amountMax` si ricava dalle cifre intere in aritmetica intera; il
  commento del proxy dichiarava un costo più basso del vero (ogni richiesta
  dell'onboarding, prefetch e action comprese — e limitarlo ai documenti
  lascerebbe un prefetch col simbolo del ripiego nella cache del router).

**Il menu.** Collaudando, Jomar ha notato che le righe di valuta e lingua
aprivano il menu del browser: erano `<select>` native invisibili sopra la riga.
Il blocco con PIN l'aveva già scartata e disegnato un menu a mano per «richiedi
il PIN dopo»; ora quel menu è `RowMenu` (`components/UI/RowMenu.tsx`) e lo
usano tutte e tre le righe, invece di tre copie. Aggiunge ciò che al primo
mancava: `aria-haspopup`, `role="option"` con `aria-selected`, il fuoco sulla
scelta attuale all'apertura, frecce, Home ed End, l'apertura verso l'alto
quando sotto c'è la `BottomNav` (la regola di `Select.tsx`), la chiusura allo
scorrimento.

Controprove dei test aggiunti: senza `clearCurrencyCookie()` nell'uscita delle
Impostazioni cade il test del proxy su «all'uscita il cookie della valuta se ne
va»; senza la riga sotto la cifra cade quello dello yen su «il passo
dell'importo dice perché». Screenshot del menu nei due temi, sul telefono e da
desktop, con «CHF» nella pastiglia.

### Residui

- Le scorciatoie sopra il tastierino del movimento (5, 10, 20, 50, 100) restano
  quelle: sensate in euro, minuscole in yen. Una scala per valuta è una scelta di
  design, non un difetto di questa issue.
- Un importo con decimali scritto in euro resta com'è se poi si passa allo yen:
  la cifra a schermo si arrotonda all'unità, e il campo, aprendolo in modifica,
  chiede di toglierli. Nessuna conversione, per scelta.
- L'import da file non controlla i decimali in yen: un estratto conto in yen è
  già in interi, e uno con i centesimi arriverebbe da una banca in un'altra
  valuta, che è il caso dei conti multivaluta (un'altra fase).
