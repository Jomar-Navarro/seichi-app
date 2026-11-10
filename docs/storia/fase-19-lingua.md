# Fase 19 — lingua (it/en)

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 19 — lingua (it/en)

Implementata il 2026-08-07 (issue #33). Migration `20260807_language.sql`, eseguita.
Verificata end-to-end. **96 file toccati, 545 voci di dizionario per lingua.**

#### Le tre decisioni di partenza

- **Il locale NON sta nell'URL.** Le route restano in italiano (`/impostazioni`,
  `/risparmi`): sono identificatori, non testo. Metterlo nel percorso avrebbe
  imposto `app/[locale]/`, il riadattamento di `PUBLIC_PATHS` nel proxy e la
  revisione di ogni `redirect()` e `emailRedirectTo`, in cambio di URL
  condivisibili per lingua e SEO multilingua — che dietro un login non valgono
  nulla. La preferenza vive in un **cookie**, come il tema della Fase 18.
- ⚠️ **Un cookie solo, non due.** Il tema ne ha due perché `prefers-color-scheme`
  è una proprietà del browser e **non viaggia negli header**, lasciando il server
  cieco sulla scelta "sistema". `Accept-Language` invece viaggia: il server
  risolve da sé anche alla primissima visita. È il caso **speculare**, e vale
  sfruttarlo invece di ricopiare la struttura del tema per simmetria.
- **`profiles.language` NON si legge a ogni render**: sarebbe una query a
  Supabase su ogni pagina per un valore che cambia due volte nella vita di un
  account. La riga del database è la persistenza fra dispositivi e viene
  riversata nel cookie **al login**, dentro la query che già interroga il profilo
  per il gate dell'onboarding (`profiles.currency`) — quindi a costo zero.
  Il cookie è la fonte per il rendering.

#### Struttura

- **Dizionari tipizzati a mano, zero dipendenze.** `it.ts` è la fonte di verità,
  `en.ts` è annotato `: Dictionary` e derivato da essa: una chiave dimenticata
  **non compila**, invece di apparire in produzione come `settings.account.title`
  in mezzo alla pagina. Plurali e numeri con `Intl.PluralRules` /
  `Intl.NumberFormat`, che sono nativi.
- ⚠️ **`it.ts` non usa `as const`.** Con le stringhe irrigidite a tipi letterali,
  `Dictionary` pretenderebbe da `en.ts` esattamente le stesse parole italiane.
- ⚠️ **I dizionari contengono SOLO stringhe e oggetti semplici, mai funzioni.**
  Il dizionario attraversa il confine server→client come prop di
  `<I18nProvider>`: una funzione lì dentro fa fallire la serializzazione RSC.
  I valori variabili passano da segnaposto `{nome}` + `fill()`.
- **`I18nProvider` non ha `setLocale`**, a differenza di `ThemeProvider`. Il tema
  cambia nel fotogramma corrente perché al client basta una classe; le parole
  stanno sul server. L'alternativa era impacchettare entrambe le lingue nel
  browser per risparmiare un round-trip su un'azione biennale.
- **`lib/i18n/config.ts` non importa `next/headers`** (serve ai client component);
  `server.ts` sì, ed è quella la guardia che rende il modulo inutilizzabile dal
  client — per questo non serve il pacchetto `server-only`.
- **`en-GB` e non `en-US`** come tag `Intl`. Seichi è un'app europea in euro:
  `en-US` scriverebbe `8/7/2026`. `en-GB` dà `07/08/2026`, identico all'italiano.
- **Gli errori li traducono le server action**, che il cookie ce l'hanno:
  `requireUser()` restituisce anche il dizionario. Restituire codici da mappare
  sul client sarebbe più puro ma raddoppierebbe gli elenchi da tenere allineati.

#### Il testo esce da `lib/`, e non è un dettaglio di stile

Sette moduli distribuivano una parola accanto a un dato. È lo stesso schema di
`TIPO_COLOR`/`TIPO_INK`, applicato ovunque: **il modulo tiene la meccanica, il
dizionario le parole.**

| Modulo | Cosa se n'è andato |
|---|---|
| `transaction-utils.ts` | `TIPO_LABEL`, `numberFormatter` |
| `types/index.ts` | `TRANSACTION_TYPES[].label` e `.description` — in un file di TIPI |
| `password.ts` | etichette di robustezza; `validateNewPassword` ora torna un **codice** |
| `budget.ts` | `label`/`suffix`/`window` per periodo |
| `recurring.ts` | `label`/`recurLabel` per cadenza |
| `category-icons.ts` | 69 etichette icona |
| `investment-types.ts` | `label` per tipologia |

⚠️ **Le etichette icona sono annidate per TIPO, non una mappa piatta `id →
etichetta`**: nove icone cambiano nome col contesto (`Landmark` è "Bonifico" fra
le entrate e "Azioni" fra gli investimenti; `Home` è "Casa / Affitto" fra le
spese e "Casa nuova" fra i risparmi). Appiattire avrebbe mostrato l'etichetta di
un altro contesto **senza alcun errore**.

#### Quello che fa `Intl`, e che quindi NON sta nei dizionari

Sei array/rami italiani sono spariti perché `Intl` li produce per ogni lingua.
Vale la pena cercarne altri prima di aggiungere una voce di dizionario:

- `"Oggi"`/`"Ieri"` e `"oggi"/"domani"/"fra N giorni"` → `Intl.RelativeTimeFormat`
  con `numeric: "auto"` (`relativeDayLabel`, `formatRelativeTime`)
- `MESI`/`GIORNI` in `action.ts`, `MESI_LUNGHI` in `/analisi`, `DAYS` in
  `TransactionForm` → `Intl.DateTimeFormat` (`formatDate`, `weekdayInitials`)
- plurali scritti a mano (`n === 1 ? … : …`) in quattro punti → `Intl.PluralRules`
  (`plural()`)

#### I difetti che la traduzione ha fatto emergere

- ⚠️ **`profiles.language` conteneva `"IT"`/`"EN"` maiuscoli.** L'onboarding
  scriveva il valore grezzo della select, le impostazioni leggevano minuscolo:
  chi sceglieva English si ritrovava "Italiano", in silenzio. Invisibile finché
  nessuno consumava il campo; con l'i18n acceso sarebbe stata l'intera app nella
  lingua sbagliata. Normalizzato al confine (`normalizeLocale`), in lettura, e
  con un `CHECK` in migration — perché il codice applicativo lo scavalca un
  insert dal SQL Editor.
- ⚠️ **`nuova {type}` era grammaticalmente sbagliato in italiano per tre tipi su
  cinque**: il pulsante diceva "Nuova investimento", "Nuova risparmio", "Nuova
  abbonamento". Un aggettivo si accorda col genere del nome, e il genere non sta
  nella chiave del database. **In inglese il problema non esiste — ed è
  esattamente per questo che un template pensato in inglese lo nasconde.**
  Ora `newByType` ha frasi intere. Stessa classe: `Seleziona ${title}` in
  `Select` (che produceva "Seleziona category") e `Budget "X" ` + aggettivo nelle
  notifiche.
- ⚠️ **`splitAmount` in `BalanceCard` si sarebbe rotto in inglese.** Cercava la
  virgola (`lastIndexOf(",")`) per staccare i decimali; in `en-GB` la virgola
  separa le MIGLIAIA, quindi `1,234.50` sarebbe diventato `1` grande e `,234.50`
  piccolo. Ora passa da `formatToParts`, che etichetta i pezzi.
- **`GoalCard` era l'unico punto che usava `style: "currency"`**, cioè scriveva
  "180 €" mentre tutto il resto scrive "€ 180".
- Tre `color: "#fff"` sopra un riempimento d'accento (la stessa dialog di
  conferma, ricopiata tre volte) — la trappola documentata nella Fase 18.

#### Le categorie di default: tradotte alla SCRITTURA

`CATEGORY_MAP` non ha più `name`. Il nome arriva da
`t.presetCategories[chiave].title` **al momento dell'insert**, non al render.

Motivo: una volta scritto in `categories.name` non è più una stringa dell'app ma
un **dato dell'utente**, rinominabile, e già copiato nel payload delle notifiche
(`'category', c.name` nella migration della 17b). Tradurlo alla lettura avrebbe
richiesto una colonna `preset_key`, una regola "se è valorizzata ignora `name`",
l'azzeramento al primo rename — e avrebbe fatto **disaccordare la lista dalle
notifiche già emesse**, due nomi per la stessa categoria nella stessa schermata.
Chi cambia lingua dopo rinomina le proprie categorie, come farebbe comunque.

Lo **stesso catalogo** serve il picker dell'onboarding e la server action: se
fossero due elenchi, la card potrebbe dire "Groceries" e la categoria creata
chiamarsi "Alimentari".

#### Le notifiche: la 17b aveva ragione

`payload` JSONB con i **fatti** invece della frase già composta era stato deciso
nella Fase 17b prevedendo esattamente questo momento. Il risultato: le frasi si
compongono alla lettura, quindi **anche le notifiche di mesi fa cambiano lingua**
insieme all'app. Salvando il testo, tutto lo storico sarebbe rimasto italiano.

#### La valuta NON è stata toccata

`profiles.currency` è scelta dall'utente e già letta da `getAccountContext()` e
dalle notifiche, ma farla arrivare a ogni foglia è un lavoro **indipendente dalla
lingua** — tocca gli stessi file per un'altra ragione. Il comportamento resta
identico dietro `DISPLAY_CURRENCY` in `lib/i18n/format.ts`: quando si affronterà,
basta seguirne i riferimenti invece di cercare "€" in tutto il codice. Per questo
anche i cinque `€` decorativi nel markup passano da `currencySymbol()`.

#### ⚠️ Come verificare, e cosa la verifica NON vede

Quattro controlli, tutti ripetibili. I primi due sono **codice di verifica usa e
getta**, non parte del repo: si riscrivono in dieci minuti quando servono.

1. **Testo cablato** — cerca stringhe letterali in posizione di testo (nodi JSX,
   prop testuali, qualsiasi stringa con uno spazio). ⚠️ **NON cercare "parole
   italiane da un elenco"**: è stato provato e ha mancato "Altro", "Ago",
   "Investito", "Seleziona" — e non avrebbe mai trovato
   `"Sorry, something went wrong"`, che era cablato **in inglese**. In un'app
   tradotta ogni letterale in posizione di testo è un residuo, in qualunque
   lingua: quello è il controllo giusto.
2. **Confine server→client** — per ogni server component, le prop
   `icon`/`on*`/`render*` passate a un figlio `"use client"`.
3. **Parità dizionari** — stesse foglie in it/en, voci mai usate, e **valori
   identici fra le due lingue** (una traduzione dimenticata compila benissimo;
   i 26 identici attuali sono tutti parole internazionali: Email, ETF, Budget…).
4. **Audit dei token CSS** della Fase 18 — ora è uno script nel repo,
   `npm run audit:tokens` (`scripts/audit-tokens.mjs`), non più codice usa e
   getta: è l'unico dei quattro che va rieseguito a *ogni* fase. Restano fuori
   le costruzioni **dinamiche** (`` var(--color-${accent}) ``), il cui suffisso
   non è visibile staticamente: vanno enumerate a mano.

#### L'audit dei token, e i due buchi che aveva (2026-08-20)

Lo script fa tre controlli, perché la stessa famiglia di difetti — *un colore
che non si applica perché il nome non esiste* — fallisce in tre modi:

| | cosa cerca | come si vedeva prima |
|---|---|---|
| **A** | `var(--nome)` mai definita | il grep della Fase 18 |
| **B** | una **classe** Tailwind mai generata | ⚠️ **niente lo cercava** |
| **C** | un `--ink-*` non mappato in `@theme inline` | a mano, dopo `text-kiri-ink` |
| **D** | una classe **incollata a `${`** in un className costruito a pezzi | ⚠️ niente — vedi la #114 nella Fase 28e |

⚠️ **Il controllo B è quello che mancava, e costava.** La Fase 18 confrontava
solo le `var(--…)`, quindi `bg-glass-border` — un token che **non esiste da
nessuna parte** — è sopravvissuta per mesi in `LoginForm` e `SignUpForm`: le
lineette ai lati di "oppure" erano invisibili, e soprattutto le barre di
robustezza password mostravano **solo i segmenti verdi**, senza traccia sotto
quelli non ancora soddisfatti. Insieme a lei `text-primary` (già nota e mai
chiusa), `var(--control)` della Fase 21 e `text-md`, che in Tailwind **non
esiste**: la scala è `xs, sm, base, lg, xl`, non c'è `md`.

⚠️ **B si misura contro il CSS REALMENTE GENERATO in `.next/static`**, non
contro un elenco scritto a mano — solo il compilatore sa cosa ha prodotto. Da
qui due conseguenze: serve una build (senza, il controllo **dichiara di non
aver guardato** invece di passare), e si legge **solo** la build di produzione,
mai `.next/dev`, che può essere di uno stato del sorgente diverso e
mascherare una classe mancante con una copia stantia.

⚠️ **Lo scanner ha prodotto falsi positivi due volte prima di essere giusto**,
ed è la regola della Fase 21 (*un controllo che segnala un guasto va
diagnosticato prima di crederci*) pagata di nuovo:

- prima versione: estraeva l'utility **nuda**, quindi dichiarava mancanti
  `last:border-b-0`, `focus:border-muted` e `bg-muted/50` — sane. Tailwind
  scrive varianti e modificatori **dentro** il selettore (`.last\:border-b-0`);
- seconda: pretendeva che una variante iniziasse con una lettera, e su
  `2xl:text-2xl` partiva a metà token da `xl:`. Un identificatore CSS non può
  cominciare con una cifra, quindi Tailwind la scrive come escape esadecimale:
  `.\32 xl\:text-2xl`.

**Il collaudo dello scanner è parte dello scanner**: prima di crederci sono
stati reintrodotti tutti e cinque i difetti e verificato che li segnali, con
accanto un `2xl:text-2xl` valido che **non** deve comparire. Uscita 1 se trova
qualcosa, 0 altrimenti — un elenco di soli OK non distingue *passato* da *non
eseguito*.

⚠️ **`tsc` e `next build` non vedono gli errori di serializzazione RSC.** Marcare
`SummaryCard` come `"use client"` per usare `useI18n()` ha rotto la home: la
pagina è un server component e gli passa `icon`, cioè una funzione. I tipi erano
corretti e la build passava — l'errore compare solo **aprendo la pagina**.
`SummaryCard` resta quindi un server component e legge la lingua con `getI18n()`.
Build verde non significa app funzionante.

⚠️ **Scrivere il cookie della lingua NON basta a cambiare la lingua resa.** Una
navigazione soft (`router.push`) riusa il root layout dalla cache del router, e
quindi il dizionario vecchio. Nell'onboarding questo produceva il difetto
peggiore possibile: `/category` mostrava le card in italiano mentre
`saveCategories()` — che il cookie lo legge sul server — scriveva i nomi in
inglese nel database, cioè proprio il disallineamento che il catalogo unico
esiste per impedire. Ogni action che cambia lingua deve fare
`revalidatePath("/", "layout")`, non solo `setLocaleCookie()`.

#### Emerso dal code-review

Dodici difetti, undici introdotti dalla fase. I quattro che valgono una regola:

- ⚠️ **`t.mappa[valoreDalDatabase].campo` è una dereferenziazione ottimista.**
  Il tipo dice cosa il DB *dovrebbe* contenere, non cosa contiene: sostituendo
  `FREQ_RECUR_LABEL[f] ?? f` con l'accesso diretto, una riga inattesa passava da
  difetto cosmetico a schianto di pagina. Si usa `lookup()` di
  `lib/i18n/format.ts`, che il ripiego lo impone.
- ⚠️ **Un array italiano sostituito da `Intl` può perdere la maiuscola.**
  `MESI`/`GIORNI` davano "Gen"/"Lun", `Intl` dà "gen"/"lun" — e in inglese non si
  nota ("Jan"/"Mon"), quindi la regressione si vede **solo nella lingua di
  default**. Vale per `weekdayInitials` e `shortMonth`, che ora capitalizzano.
- ⚠️ **`Intl` non vince sempre.** `format(0, "second")` in italiano è "ora", che
  accanto a "1 ora fa" nella stessa colonna si legge come un conteggio troncato.
  È l'unico caso in cui una parola scritta a mano ("adesso") batte `Intl`, e sta
  nel dizionario per questo.
- ⚠️ **Sostituire un controllo nativo può togliere uno stato.**
  `<input type="date">` si poteva svuotare; il `DatePicker` emetteva solo giorni
  concreti, quindi una scadenza opzionale diventava irreversibile. Il comando che
  la rimuove compare quando `placeholder` dichiara che la data è opzionale.

Più due lezioni sul metodo di verifica, entrambe pagate:
**estrarre un componente non è finito finché l'originale non è cancellato**
(il calendario è vissuto duplicato in `TransactionForm` e `DatePicker`, già
divergenti); e **uno scanner va messo alla controprova**, perché quello del testo
cablato leggeva solo i `.tsx` e non guardava le stringhe fuori dal JSX — due
buchi che insieme nascondevano sei `"Non autenticato"` nelle server action.

