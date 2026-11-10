# Fase 28e — nuovo design desktop (#108, #111, #114)

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 28e — nuovo design desktop da Claude Design (issue #108)

Implementata il 2026-09-23. Un progetto Claude Design più recente ("Seichi
budgeting app homepage", 7 mockup desktop a 1440px in tema scuro) sostituisce
i riferimenti su cui erano state costruite 28b e 28c. Nessuna migration. Il
confronto pagina per pagina e il piano sono il commento del 2026-09-22 sulla
issue.

#### Come è stata fatta: 5 stream in parallelo, e cosa costa

- Cinque stream a file disgiunti — A sidebar/layout, B Home+Analisi, C
  Conti+Investimenti, D Movimenti, E Impostazioni+Obiettivi — ciascuno con la
  propria review, poi un consolidamento con review d'insieme `high`.
- ⚠️ **Worktree FUORI dal repo, non `isolation: worktree`.** Quelli
  dell'harness nascono in `.claude/worktrees/` — dentro il progetto, sotto gli
  occhi del dev server che gira sulla 3000 — e partono da `origin/master`,
  cioè senza i pezzi condivisi. `node_modules` è una junction verso quella del
  repo: ⚠️ si toglie con `cmd /c rmdir`, **mai** con `Remove-Item -Recurse`, che
  in PowerShell 5.1 può svuotarne il target.
- **I pezzi usati da più stream si scrivono PRIMA della fan-out**, sul branch
  di integrazione (`Avatar` con `rounded`, `DashedAddButton`): scritti in
  parallelo due volte divergono, e nessuno stream può importare quello
  dell'altro.
- ⚠️ **`DesignSync` non arriva ai subagent**: hanno lavorato dalle specifiche
  distillate dall'orchestratore. Una frase ambigua ("legenda … flex-wrap") è
  diventata una legenda in riga dove il mockup la vuole in colonna — corretta
  al consolidamento. La specifica per un agente che non vede il mockup va
  scritta come se fosse il mockup.
- ⚠️ **Il limite d'uso del piano**: cinque contesti in parallelo l'hanno
  esaurito due volte. Gli stream si riprendono col loro contesto
  (`SendMessage`), non da capo; e conviene chiedere un commit di checkpoint
  appena una parte passa i controlli, o uno stop costa il lavoro non salvato.

#### Le convenzioni comuni — perché 7 pagine sembrino un'app sola

- Sotto `lg:` niente cambia: tutto passa da `lg:`/`xl:`.
- Contenitore da `lg:`: `lg:px-10 lg:pt-9 lg:pb-12 lg:max-w-6xl lg:mx-auto
  lg:w-full` — il mockup ha 34/40/48 di padding e ~1080–1180px di contenuto.
- Titolo `lg:text-[30px] lg:tracking-[-0.6px]`.
- **Gli split di PAGINA a due colonne partono da `xl:`**: a 1024 la colonna di
  contenuto è ~688px (1024 − 256 sidebar − 80 di padding), e un importo a 46px
  come "€ 12.345,67" è largo ~280px. ⚠️ **Eccezione: Impostazioni, da `lg:`**
  (#114, sotto) — lì non ci sono importi grandi, solo le righe del telefono.

#### Le decisioni

- **Footer della sidebar: SÌ** — era la decisione che la issue lasciava
  aperta. Avatar, nome, "N conti attivi", chevron, e apre lo STESSO
  `ProfileMenu` della home (variante `sidebar`, verso l'alto), non un secondo
  menu — ma senza la voce "Impostazioni", che nella rail c'è già (#114, sotto).
  I dati partono nel layout come **promise** letta con `use()` in un
  Suspense attorno al solo footer, quindi non ritardano la pagina, e la promise
  non rifiuta mai: un error boundary che avvolga il layout non c'è.
  Costo: una HEAD count (`countActiveAccounts`, ora una sola in
  `lib/account.ts` anche per le regole di eliminazione dei conti) più
  `profiles`, condivisa con la home via `cache()`; per render del LAYOUT —
  caricamento, `router.refresh()`, `revalidatePath("/", "layout")` — non per
  pagina vista. ~~⚠️ **Residuo dichiarato**: la rail è `hidden lg:flex`,
  quindi sul telefono le due query girano per un footer che nessuno vede.~~ —
  **chiuso dalla review post-merge** (sotto): le query partono solo dove la
  rail si vede, e lo dice un cookie scritto dal client.
- **Il marchio della sidebar è l'ensō**, come nel mockup; icona PWA,
  BrandHeader e BootSplash restano col germoglio. Precedente: la schermata di
  sblocco (26b), dove il cambio era stato chiesto prima.
- **Voce attiva per prefisso**: `/impostazioni/categorie` accende Impostazioni.
  `/conti` non accende niente — non è in nav, ci si arriva dalla home.
- **Home**: da `lg:` il saluto è testo (il menu profilo è nel footer) e il
  selettore conti sta in riga col saluto — una sola istanza, spostata col CSS.
  Movimenti recenti in UNA card con divisori e scorciatoia Analisi affiancati
  da `xl:`. La sparkline del Flusso viene da `flussoTrend`: stessa
  `flussoDaTotali()` della cifra, composta dalle serie già calcolate, zero
  query — `entrate − spese` sarebbe stata la quinta definizione di «uscita».
  `Sparkline` ora scala dal minimo con lo zero incluso (identica per ogni serie
  ≥ 0) e chiude l'area sulla linea dello zero quando la serie scende sotto.
- **Analisi**: il KPI Flusso entra nella card del grafico; da `xl:` grafico |
  (donut + uscite fisse). `inCard` su `MonthlyLineChart`/`SpendingPieChart`:
  il report stampabile non la passa e resta identico.
- ⚠️ **Conti e Investimenti: la griglia della 28b è INVERTITA** — eroe fisso a
  sinistra, lista a colonna singola a destra, come nel mockup. La logica di
  swipe/hover-reveal di `ActiveAccountRow` è invariata byte per byte;
  `overflow-x-clip` sulla lista, perché lo scorrimento del vassoio finiva sopra
  la card del saldo (e, a `lg:`, sotto la sidebar). `AccountSelector` ha
  `alignEndFromLg`: col chip all'estremità destra, il pannello da 20rem
  ancorato a sinistra sforava lo schermo.
- **Movimenti**: la 28c l'aveva stretta a 672px senza un mockup; ora è larga
  come le altre. Budget in una card sola, a righe; la finestra temporale nel
  titolo della card SOLO se tutti i budget hanno lo stesso periodo (la regola
  della 17a). La ricerca resta a 16px anche da `lg:`: un iPad in orizzontale è
  `lg:`, e Safari zoomerebbe al fuoco (#69).
- ⚠️ **Impostazioni: revisione ESPLICITA della 28c.** Due colonne da `xl:`,
  come il mockup nuovo; fra `lg:` e `xl:` una colonna da 672px allineata a
  sinistra, sotto il proprio titolo. Tutte le righe esistenti mantenute.
  ~~Due colonne da `xl:`~~ — **da `lg:` dalla #114** (sotto): la colonna
  sola lasciava mezzo iPad vuoto.
- **Obiettivi**: tessera "Nuovo obiettivo" in coda; "completato" deciso sul
  valore esatto come la pagina, e un obiettivo mancato si ferma al 99%.
- **`DashedAddButton`**: il tratteggio è un SVG, non un `border-dashed` — un
  bordo traslucido su un raggio riaprirebbe la #81. Tratto da 1 su un
  rettangolo rientrato di mezzo pixel: la prima stesura (tratto da 2 ritagliato
  a metà dall'svg) aveva angoli da 2px, perché il ritaglio agisce solo sui
  lati dritti.

#### Difetti trovati facendo la fase

- ⚠️ **L'anello della zona pericolo era sparito dalla #81 in poi**, a ogni
  larghezza: `tone` di `SettingsGroup` scriveva un `borderColor` su una card
  che non aveva più un bordo. Ora ridefinisce `--border` sulla card e
  `card-shadow-ring` disegna l'anello tinto; la tinta da `lg:` si mescola col
  vetro (`--card`), non col trasparente, o in chiaro la card perde la
  superficie. ~~È l'unica differenza visibile sotto `lg:`~~ — non era vero,
  vedi la review post-merge qui sotto: è la più evidente, non l'unica.
- `PwaStatus` era fratello di `MainContentShell`: da `lg:` i suoi avvisi
  finivano sotto la sidebar fissa. Ora sta dentro il gutter.
- La review d'insieme ha trovato 10 rilievi, 8 applicati; i due lasciati sono
  il residuo del footer qui sopra (chiuso dopo il merge) e l'override
  `lg:size-13.5!` sulla misura dell'avatar (stile, non difetto).

#### `audit:tokens`: due falsi positivi e un buco

Il primo giro sul branch unito usciva con due errori del CONTROLLO, non del
codice: `var(--group-tint)`, definita inline sullo stesso elemento, e `.to-fit`,
estratto da dentro `repeat(auto-fit,…)`. Ora una variabile dichiarata come
chiave di `style` nel file che la usa conta come definita, e una classe deve
cominciare a un confine di token. E il buco: la forma abbreviata di Tailwind v4
`bg-(--nome)` sfuggiva del tutto al controllo A. Controprova su un file sonda:
4 difetti iniettati, 4 segnalati; 2 casi sani, 0 segnalati.

#### Il collaudo, e due artefatti che somigliavano a regressioni

Driver ad hoc nello scratchpad: 7 pagine più report e categorie, a
414/768/1024/1280/1440, chiaro e scuro, con confronto pixel sotto `lg:` contro
una base scattata al commit di partenza.

- ⚠️ La prima base aveva il grafico di /analisi ancora VUOTO: scatto troppo
  presto, non un difetto. Il driver ora aspetta che Recharts disegni.
- ⚠️ In un contesto Playwright nuovo il service worker prende il controllo a
  metà della prima visita, e `controllerchange` accende il banner "nuova
  versione" (56px) di `PwaStatus` a caso. Bloccare il service worker non va —
  la registrazione fallita accende il badge d'errore di Next su ogni pagina —
  serve un giro di riscaldamento che aspetti `navigator.serviceWorker.controller`.
  ~~⚠️ Lo stesso meccanismo potrebbe mostrare il banner a un utente vero alla
  primissima visita, senza alcun aggiornamento: da verificare, fuori scope.~~
  — era vero, ed è **chiuso dalla #111** (sotto).
- Esito sotto `lg:`: 24 foto su 36 identiche al pixel; le altre sono
  antialiasing (importi spezzati in più span), la zona pericolo (voluta) e una
  striscia di 6px dietro la bottom nav — il vetro sfocato che campiona un
  contenuto diverso, smentita da un secondo scatto.
- Da `lg:`: nessuno scroll orizzontale e nessun errore di console su nessuna
  pagina; la tendina dei conti misurata con un clic vero, dentro lo schermo a
  1024 e 1440.

~~⚠️ Resta da fare a mano: **Firefox** sulle superfici nuove (la #81 si vede solo
lì) e un giro sull'app vera.~~ — **fatto il 2026-09-24** (#111, sotto).

#### Emerso dalla review post-merge (2026-09-24)

Una rilettura dell'intero diff della PR #109, chiesta dopo il merge. Nessun
difetto bloccante; quattro rilievi applicati, due lasciati.

- ⚠️ **Il footer della sidebar faceva query anche dove la rail non si vede.**
  Il commento le giustificava con la `profiles` "condivisa con la home", ma lo
  è solo quando la pagina È la home: su ogni altra pagina, sul telefono, erano
  due richieste per render del layout — cioè a ogni movimento salvato, perché
  ogni mutazione chiama `revalidatePath("/", "layout")`. Il server non può
  saperlo da solo: la larghezza della finestra non viaggia negli header. È il
  caso del secondo cookie del tema (Fase 18), con la stessa soluzione:
  `SIDEBAR_COOKIE` (`lib/sidebar.ts`) lo scrive la `Sidebar` da un
  `matchMedia` sul breakpoint `lg:`, e il layout con "0" non avvia la promise.
  ⚠️ **Cookie assente = si fanno le query**, com'era prima: sbagliare in quel
  verso costa due query alla prima visita da un telefono, nell'altro
  lascerebbe un desktop senza footer. Se la rail compare dopo un render che le
  aveva saltate (iPad ruotato, finestra allargata) parte **un** `router.refresh()`
  per montaggio — uno solo, o con un cookie non scrivibile il server leggerebbe
  "0" per sempre e i refresh non finirebbero mai. Residuo minore: sul desktop
  le query partono anche sul report e nel wizard del PIN, dove la rail è
  nascosta per scelta, perché il layout non conosce il percorso.
  Collaudato con un driver sull'app vera (17/17, più la controprova: stessa
  richiesta dal telefono, nome assente col cookie a "0" e presente a "1") e
  ✅ **provato a mano su un iPad ruotato** il 2026-09-24: il passaggio al
  breakpoint funziona.
- ⚠️ **Sotto `lg:` le differenze visibili erano più d'una.** Due correzioni
  della fase si vedono anche sul telefono, ed erano sfuggite al confronto pixel
  perché l'account di prova non ha quei dati: un obiettivo al 99,6% mostra ora
  "99%" invece della spunta (`GoalCard`, completato sul valore esatto), e con
  un filtro conto e zero budget la nota "valgono su tutti i conti" non compare
  più a spiegare card che non ci sono (`BudgetCards`). Entrambe giuste; era
  sbagliata la frase che diceva "l'unica differenza". **Un confronto pixel
  dimostra l'identità solo per i dati che ha davanti.**
- **L'hover delle voci del menu profilo scuriva**, in chiaro: `bg-control` è
  inchiostro al 7%, e sul pannello color carta la voce sembrava scavata, cioè
  disabilitata — la trappola che il commento dell'hover della nav, nella stessa
  rail, descrive. Ora `bg-surface`, che schiarisce in entrambi i temi.
- `getActiveAccountCount` era esportata e dentro `cache()` con un solo
  chiamante interno: ora è una funzione privata.

Lasciati, entrambi minori — ~~e poi chiusi dalla #111 lo stesso giorno~~:

- ~~**L'ordine di lettura della home sul telefono**: nel DOM il selettore conti
  viene prima di coach e campanella, che a schermo stanno sulla riga sopra.~~
- ~~**Gli avvisi di `PwaStatus` da `lg:`** occupano tutto il gutter con `px-5`,
  non la colonna della pagina.~~

#### Chiuso dalla #111 (2026-09-24)

Le quattro imperfezioni rimaste dopo la 28e, in una PR sola.

- ⚠️ **Il banner "nuova versione" compariva alla PRIMA visita**, senza alcun
  aggiornamento. `app/sw.ts` ha `clientsClaim: true`: alla prima installazione
  il service worker prende il controllo di una pagina che non ne aveva
  nessuno, e `controllerchange` scatta lo stesso. Ora `PwaStatus` lo conta come
  aggiornamento solo se prima del cambio un controller esisteva. Il precedente
  si aggiorna a ogni cambio, non si fissa al montaggio: una scheda aperta alla
  prima visita e rimasta aperta fino al deploy dopo deve comunque ricevere
  l'avviso di quel deploy. **Un avviso falso al primo contatto è il peggiore
  possibile**: insegna subito che gli avvisi di questa app si possono ignorare.
  ⚠️ Il collaudo conta i `controllerchange` veri prima di credere al "nessun
  banner": senza almeno un evento il verde sarebbe vuoto. Controprova con un
  evento sintetico su una pagina già controllata: lì il banner compare.
- **L'ordine di lettura della home**: il selettore conti è montato una volta
  per breakpoint, e se ne vede sempre uno solo. È la scelta che la 28e aveva
  scartato ("due pannelli e due stati per lo stesso filtro"), e il timore non
  regge: lo stato del filtro vive nell'URL e nel cookie, non nel componente,
  che tiene solo il proprio aperto/chiuso; e l'istanza nascosta è `display:
  none`, quindi fuori dal Tab e dall'albero di accessibilità. Con un'istanza
  sola, spostata col CSS, l'ordine del DOM poteva essere giusto per una sola
  delle due righe. Verificato col Tab: sul telefono avatar → coach → campanella
  → selettore, sul desktop selettore → coach → campanella.
- **Gli avvisi di `PwaStatus` da `lg:`** hanno la cornice delle pagine
  (`lg:px-10`, `max-w-6xl`): scarto misurato 0px dal titolo e dalla ricerca di
  Movimenti a 1024, 1280 e 1440.
- ✅ **Firefox**: i quattro angoli di 11 superfici della 28e — voce attiva e
  footer della rail, menu del profilo aperto, card Flusso e Saldo, i due
  tratteggi, uscite fisse, capitale versato, card Budget, zona pericolo —
  ingranditi e messi in fila, in chiaro e in scuro. Nessun quadrato della #81.
  Col Firefox di Playwright, cioè lo stesso motore Gecko in cui il difetto
  nasce: `npx playwright install firefox` lo scarica fuori dal repo, senza
  toccare `package.json`. ⚠️ **Il Firefox di Playwright manda `Accept-Language:
  en-US`**, e senza cookie della lingua l'app risponde in inglese: i selettori
  sui testi italiani non trovavano niente e davano un timeout che sembrava una
  pagina rotta. Il contesto va aperto con `locale: "it-IT"`. È la stessa
  trappola già pagata nella 23a con `context.request`, dall'altra parte.

#### Chiuso dalla #114 (2026-10-01)

Rifiniture viste su un iPad Air 2 in orizzontale (1024×768). La prima era una
regressione della 28e, su ogni larghezza.

- ⚠️⚠️ **I separatori fra le righe delle impostazioni erano quasi bianchi.**
  In `SettingsGroup` la classe del colore stava attaccata al `${` del template
  aggiunto dalla 28e (`…border-subtle${tone ? … }`). Lo scanner di Tailwind
  legge il sorgente come testo e non estrae ciò che è incollato a `${`
  (verificato con `@tailwindcss/oxide`): la classe con la variante
  `[&>*+*]:` non veniva generata, il bordo aveva lo spessore ma non il
  colore, e ripiegava su `currentColor` — in scuro `rgb(230,233,239)`, cioè
  il colore del testo. Lo spazio prima di `${` lo chiude; le altre sette
  classi nella stessa posizione (`scrollbar-none`, `modal-shadow-ring`,
  `mb-4`, `py-6`, `gap-5`, `active:opacity-80` due volte, l'anello di
  `MonthlyLineChart`) funzionavano solo perché un altro file le scriveva per
  intero, e sono staccate anche loro.
- **`audit:tokens` non poteva vederlo, per due motivi**: saltava ogni
  className con `${` e la sua regex non riconosceva le varianti arbitrarie,
  quindi verificava `border-subtle` nuda, che esiste. Ora legge i className
  con un piccolo parser (multi-riga, template annidati, commenti con
  apostrofi) e ne verifica tutte le parti letterali — 81 classi contro 72 —
  e il controllo **D** segnala ogni parte statica che non finisce con uno
  spazio prima di `${`, anche un nome costruito a runtime (`bg-${accent}`).
  Non richiede una build. Controprova: con i sei file di master D elenca i
  nove punti della issue, e un file sonda con template annidato, commento
  con apostrofo e `areaClassName` dà 7 segnalazioni su 7 attese, nessuna su
  `${a}text-xs` (dopo la graffa lo scanner la classe la vede).
- ⚠️⚠️ **E la documentazione mascherava il difetto.** Tailwind scansiona ogni
  file non ignorato da git, `CLAUDE.md` compreso (`lg:max-w-3xl` compariva
  solo qui ed era nel CSS). La prima controprova sulla build di master è
  uscita VERDE: la classe mancante la generava il commento che avevo appena
  scritto nell'audit. Una classe che il codice smette di generare resta nel
  CSS se la prosa la nomina, e sparisce dallo schermo e dal controllo B
  insieme. Ora `globals.css` esclude dalla scansione i file che non sono
  interfaccia (`@source not` su `../**/*.md` — un glob, non un elenco che il
  prossimo file di prosa avrebbe aggirato — più `.claude`, `scripts`,
  `supabase`): il CSS perde sei classi che nessun componente usa
  (`bg-white`, `isolate`, `overflow-x-clip` nuda, `static`,
  `text-kiri-ink`, `text-tsuki`). ⚠️ I commenti nel codice dell'app restano
  scansionati e non si possono escludere: un commento che racconta una
  classe che NON deve esistere la nomina a pezzi, o la rigenera.
- **Impostazioni a due colonne da `lg:`**, l'eccezione alla regola delle
  convenzioni: a 1024 ogni colonna misura 332px, quasi il contenuto di un
  iPhone SE. ⚠️ **La card del budget non reggeva**: i sottotitoli sono
  spiegazioni, non dati, e troncati mentivano per omissione — "Abbonamenti
  di questo mese, fuori …" perdeva proprio "dal limite". Ora le righe di
  `GlobalBudgetSection` sono `min-h-15.5` e i sottotitoli vanno a capo; sul
  telefono, dove ci stanno, restano alte 62px. Stesso cambio per il bottone
  del suggerimento, che aveva già un sottotitolo senza `truncate` dentro
  un'altezza FISSA: andando a capo sarebbe uscito dal bottone. Il padding
  stretto fra `lg:` e `xl:` proposto dalla issue (`lg:px-6`) non è servito,
  e avrebbe fatto saltare il titolo di 16px passando da una pagina all'altra.
  Nella card profilo nome ed email si troncano coi puntini come sul
  telefono, e l'email intera sta nella riga sotto.
- **"Impostazioni" tolta dal menu del footer della rail**, dove era il
  secondo ingresso a pochi centimetri dalla voce della nav. Resta nella
  variante `header`: sotto `lg:` la bottom nav non ce l'ha, e le due varianti
  non si vedono mai insieme.

Emerso dalla code review prima del merge (7 rilievi, 5 applicati), tutto
sull'audit: le classi costruite in una **variabile** e poi usate in un
className (`${card}`, `{titleClass}`) sfuggivano a B e D — ora si risolvono
le dichiarazioni dello stesso file, un livello solo (oltre si raccolgono URL
e chiavi), e B passa da 81 a 83 classi; un apostrofo dentro una **regex
letterale** apriva una stringa e faceva leggere storto il resto del file, in
silenzio — ora le regex si saltano, e un className che il parser non sa
chiudere viene **segnalato** invece di tacere; i gruppi **con nome**
(`group-hover/riga:`) davano un falso "mai generata", verificato con una
build che li contiene. Scartati: un helper `cx()` al posto dei template
(cambierebbe l'idioma di tutto il progetto, e D ora fa rispettare quello
esistente) e un `lg:max-w-2xl` nominato in un commento, che il codice usa
davvero in dodici file.

Collaudo del 2026-10-01 su un account di prova usa e getta (autorizzato da
Jomar, eliminato alla fine): 92 controlli a 414/1024/1440, chiaro e scuro, su
Impostazioni, Blocco con PIN (PIN messo solo nel browser di prova) e Profilo
(foto caricata e poi tolta dall'app). Ogni separatore ha il colore di
`var(--border)` risolto nella propria card, mai quello del testo. ⚠️ **La
controprova sul dev server è inutile**: Tailwind in sviluppo accumula le
classi già generate, e il `SettingsRow` di master risultava verde. Va fatta
su una build di produzione con `next start` su un'altra porta — lì master dà
2 KO su 2 con lo stesso colore della issue, il fix 2 OK. ✅ **Provato
sull'iPad vero** da Jomar il 2026-10-01.

#### Aperti, preesistenti e fuori scope

- ~~`NotificationBell`: aria-label e "riprova" cablati in italiano~~ — chiuso
  dalla #124. Resta il tooltip di `MonthlyLineChart`, che scrive
  `€ ${toFixed(2)}` ignorando la lingua.
- `elimina/page.tsx` colora il titolo con l'accento aka: va l'inchiostro
  (Fase 18).
- `/conti/[id]`: l'etichetta "Movimenti" e "carica altri" nello stile vecchio.
- Il chip di `AccountSelector` è alto 48px con testo da 12px; il mockup lo
  vuole ~40px, 13px e con un pallino colorato.

