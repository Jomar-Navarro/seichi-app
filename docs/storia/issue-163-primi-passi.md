# #163 — primi passi: guidare un utente nuovo dopo l'onboarding

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Il progetto (2026-11-18, deciso con Jomar)

Finito l'onboarding, un utente nuovo arrivava in una home a zeri e doveva
indovinare da dove partire. La card «Primi passi» gli indica quattro cose da
fare, e si spunta da sola leggendo i dati:

| voce | fatta quando | dove porta |
|---|---|---|
| saldo iniziale | un conto con `initial_balance <> 0` | `/conti` |
| prima transazione | una riga qualsiasi in `transactions`, su tutti i conti | il modale del movimento, come il + |
| budget | una riga di `budgets` con `amount` non nullo | `/impostazioni#budget` (il budget globale) |
| traguardo | una categoria `risparmio` con `target_amount > 0` | `/risparmi` |

I casi al limite, decisi uno per uno:

- **Saldo a zero.** Il conto dell'onboarding nasce a 0, quindi zero vuol dire
  «non fatto». Chi parte davvero da zero non spunterà mai la voce: chiude la
  card con «Ho capito». Scartati il togliere la voce e un «salta» per la
  singola voce, che sarebbe stato un altro stato da salvare.
- **Transazioni generate o importate** contano: sono transazioni vere.
- **La lapide** da sola non è un budget. Un budget tolto dopo averlo impostato
  conta ancora, perché la riga con l'importo resta nello storico.
- **L'obiettivo** vuole un traguardo: l'onboarding crea già tre obiettivi senza
  traguardo, e senza la condizione la voce sarebbe spuntata dal primo giorno.
  Per lo stesso motivo il testo dice «Dai un traguardo a un obiettivo», non
  «Crea un obiettivo».
- **Le voci facoltative**: l'import è un link sotto la voce della transazione
  («Importa un estratto conto»), finché non esiste un lotto. Il blocco con PIN
  è stato escluso: vive sul dispositivo, e la card deve valere ovunque.

**La chiusura** sta in `profiles.first_steps_dismissed_at`, NULL = non ancora
chiusa, nessun default (lezione della #43) e nessun backfill: scrivere
«chiusa» per chi non l'ha mai vista affermerebbe il falso. Nel database e non in
`localStorage`, perché chiusa su un dispositivo deve restare chiusa sugli altri.

**A voci tutte fatte** la card non sparisce da sola: dice «Primi passi
completati» e offre «Chiudi». Scelta di Jomar fra le due: così, a chiusura
avvenuta, la home smette di pagare la richiesta anche per chi non avrebbe mai
premuto «Ho capito». ⚠️ Diverge dal primo criterio della issue («un account con
tutto fatto non la vede»): un account con tutto fatto la vede, una volta, nello
stato «completati».

**Una lettura fallita** (profilo o RPC) nasconde la card e registra il motivo.
Non è un `LoadError`, perché la card è un aiuto facoltativo e non il contenuto
della pagina; e non sono quattro voci «da fare», perché inviterebbe a rifare
ciò che esiste già (il difetto della #124).

### Il costo in richieste

La home ha già pagato per le sue richieste (`costo-richieste-supabase`). Prima
della #163 erano sette: `dashboard_totals`, le ultime transazioni, gli
obiettivi, le transazioni di risparmio (`readAll`, almeno una), il profilo, il
conteggio delle notifiche, i saldi dei conti.

Tre opzioni:

1. una RPC `first_steps()` nel `Promise.all` della home: otto, sempre;
2. **la stessa RPC sotto un suo `<Suspense>`, solo a card aperta: otto finché la
   card è aperta, sette dopo** — scelta;
3. conteggi HEAD separati: da otto a dieci.

Il budget costava una richiesta nuova in ogni caso: la home non legge i budget.
Lo stato di chiusura invece non costa niente, perché viaggia nella select del
profilo che la home fa già (`loadProfile()`, `cache()`): ci vuole una colonna in
più, non una richiesta.

**Il salto all'arrivo della card è accettato** (Jomar, 2026-11-18): lo
scheletro della home (`HomeSkeleton`) non riserva il posto della card, quindi
per un utente nuovo il Flusso scende quando la card arriva. Riservarlo
lascerebbe un buco, a ogni caricamento, a chi la card l'ha già chiusa: cioè a
quasi tutti, per sempre, per un salto che un utente vede solo i primi giorni.
Lo scheletro della home non sa se la card è aperta: lo saprebbe solo leggendo
il profilo, e allora non sarebbe più uno scheletro.

La RPC parte prima delle letture della pagina (`loadFirstSteps()` in testa a
`DashboardContent`) e la aspetta solo `<FirstSteps>` sotto il suo Suspense:
partendo dal componente, aspetterebbe la fine di tutte le altre.

### Il design: A contro B

Due proposte su Claude Design, in tema chiaro e scuro, telefono e desktop:

- **A, la lista**: le quattro voci con una casella ciascuna, tutte leggibili a
  colpo d'occhio. Ovvia, ma è la card a checklist che si vede ovunque.
- **B, le pietre di passaggio** (tobi-ishi, le pietre dei sentieri nei giardini
  giapponesi, un rimando a 整地): le voci come quattro pietre irregolari, e per
  intero UNA voce sola — la prossima — con il perché e il pulsante che la fa.

Jomar ha scelto **B** («un design clean»), con la possibilità di aggiungere più
avanti la lista di A sotto le pietre. Il prezzo di B, scritto perché non
sorprenda: sul telefono gli altri tre passi non hanno testo visibile, li legge
lo screen reader e una persona deve toccare la pietra per sapere cosa c'è
dietro. Da `lg:` il sentiero è una colonna con i nomi, e la voce si apre a
destra.

### L'app

- `supabase/migrations/20261121_first_steps.sql`: la colonna e `first_steps()`,
  `security invoker`.
- `lib/first-steps.ts`: l'ordine delle voci, la prossima, il conteggio
  (funzioni pure, con i test).
- `lib/account.ts`: `loadProfile()` porta la chiusura accanto a
  `ProfileHeader`, non dentro, perché quel tipo arriva al client della Sidebar.
  Un profilo non letto è `unknown`, e la card si nasconde: una lettura fallita
  non può riaprire una card già chiusa. Da qui l'errore della lettura del
  profilo si registra, invece di sparire.
- `lib/first-steps-server.ts`: `loadFirstSteps()`, che non solleva mai.
- `app/(main)/first-steps-actions.ts`: `dismissFirstSteps()`, con `upsert` e
  `revalidatePath("/")`.
- `components/features/FirstSteps.tsx` (server) e `FirstStepsCard.tsx`
  (client): un DOM solo che si ridispone da `lg:`. La card ha per `key` la
  firma delle voci fatte: trovato in review, senza rimontare la voce aperta
  restava quella di prima dopo un salvataggio (`useState` legge la prop una
  volta sola).

**L'ancora del budget.** Il budget globale sta in `/impostazioni` come
sezione della pagina, anche sul telefono (non in una sottopagina): il passo
porta a `/impostazioni#budget`, e lo scroll lo fa Next da sé (un `Link` con
hash scorre all'`id`), istantaneo, quindi senza movimento da dichiarare. La
sezione ha `scroll-mt` pari alla safe-area più il respiro d'apertura delle
pagine: nessuna pagina ha un header fisso (#86), ma la safe-area è un padding
del contenitore che scorre via, e senza margine il titolo finirebbe sotto la
barra di stato della PWA su iOS.

Testi: «transazione» e non «movimento», come il + e «Transazioni recenti»
accanto. Il pulsante della voce è «Aggiungi transazione», la stessa etichetta
del +, perché fa la stessa cosa. Il progresso è «2 su 4», non «2 di 4 fatti»
(«1 di 4 fatti» non concorda).

Rimasti fuori, segnalati e non decisi: il saluto della home è «Bentornato»
anche al primo ingresso, e la lista vuota della home dice «Aggiungi il primo
movimento» mentre la card dice «transazione».

Rispetto al mockup B, il contatore «N su 4» sta accanto al titolo e non a fine
riga delle pietre: così è nello stesso posto sul telefono e sul desktop.

### Collaudo (2026-11-18)

Scritto mentre il database locale serviva alla #162, ed eseguito dopo.

- `npm test`: `lib/first-steps.test.ts`, con due mutazioni provate (colonne
  scambiate, ordine rovesciato): rosse entrambe.
- `types/database.ts` scritto a mano nella forma del generatore finché il
  database era occupato: `npm run db:types` ha prodotto lo stesso file, byte
  per byte, e `db:types:check` è verde.
- `supabase/tests/primi-passi.test.sql`, 18 prove: la colonna senza default, la
  chiusura scritta solo dal proprietario, i privilegi della funzione, ogni voce
  col suo caso «quasi», l'utente due che non vede i dati dell'uno. Gli esiti si
  raccolgono da `authenticated` in una tabella temporanea e si confrontano da
  `postgres`, perché le funzioni di pgTAP scrivono nelle loro tabelle
  temporanee. Regge perché `authenticated` ha TEMP sul database tramite PUBLIC
  (`=Tc/postgres`), verificato. Le cinque mutazioni m1–m5 fanno cadere
  ESATTAMENTE le prove dichiarate in testa al file. La prima stesura delle
  dichiarazioni era incompleta (ogni mutazione di una voce fa cadere anche
  «un account appena nato», m5 anche le due righe sul profilo nuovo): corretta
  prima di eseguirle.
- `tests/e2e/primi-passi.spec.ts`: account nuovo, chiusura vista da un secondo
  contesto del browser, voci che si spuntano dai dati, stato «completati»,
  l'indirizzo del passo budget. ⚠️ Al primo giro lo scenario «completati» era
  rosso, e il difetto era del test: la card sparisce al tocco, prima che la
  action arrivi, e ricaricare subito interrompeva la richiesta. Ora aspetta la
  chiusura scritta nel database, come il primo scenario. Controprove: c1
  (lettura della chiusura ignorata) fa cadere entrambi gli scenari sull'assenza
  finale, dopo che l'attesa sul database era passata; c2 (obiettivo senza
  traguardo che conta) li fa cadere entrambi sul «0 su 4», con la card a «1 su
  4». Tutta la suite: 15 su 15.
- **Le richieste della home**, contate nei log di Kong del Supabase locale
  (solo user agent `node`, cioè il server Next), su un caricamento completo
  della home dal telefono. «Prima» è il codice della #163 con la card
  disattivata: nessuna RPC e la select del profilo senza la colonna nuova,
  cioè ciò che fa master.

  | home | prima | card aperta | card chiusa |
  |---|---|---|---|
  | tutti i conti (`/?conto=`) | 7 | 8 | 7 |
  | filtrata su un conto | 7 | 8 | 7 |

  L'ottava è sempre `rpc/first_steps`. Le sette di sempre: `profiles`, due
  volte `transactions`, `categories`, la HEAD di `notifications`,
  `rpc/dashboard_totals`, `account_balances`.
- **L'app vera**, a 414 e a 1440 px, in chiaro e in scuro, negli stati nuovo,
  a metà e completati: coerente col mockup B. Gli scatti hanno trovato un
  difetto: da `lg:` i nomi dei passi partivano da x diversi, perché ogni pietra
  ha una larghezza sua. Ora la pietra sta in un riquadro fisso. L'ancora
  `#budget` dal telefono: la pagina scende di 637 px e il titolo della sezione
  sta a 28 px dall'alto (`1.75rem`; in Chrome desktop la safe-area vale 0). Sul
  telefono vero resta da guardare con la safe-area di iOS.
