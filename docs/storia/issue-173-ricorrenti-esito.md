# #173 — la regola ricorrente saltata si fa sentire

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Da dove arriva

Tre silenzi lasciati aperti, e dichiarati, dalla #47 (`issue-047-job-giornaliero`):

- `createRecurringRule()` chiamava `generate_recurring_transactions()` e ne
  scartava errore e conteggio: se il movimento già dovuto non si generava, il
  form diceva «Ricorrenza creata» lo stesso;
- quando il job notturno salta la regola di un utente, `job_runs` dice
  `partial` e giustamente non alza l'allarme globale, ma l'utente di quella
  regola non riceveva alcun segnale;
- `job_runs.details` portava il numero delle regole saltate, non quali.

### Un guasto vero, trovato per strada (2026-11-22)

Cercando come far fallire una regola per il collaudo: `recurring_rules.notes` è
`text`, `transactions.notes` è `varchar(255)`, e il campo descrizione del form
non ha limite. Una ricorrenza con una descrizione di 300 caratteri si salva, e
il movimento generato viene rifiutato (`22001`): la regola è saltata subito, e
poi ogni notte. Era esattamente il caso di questa issue, prodotto dal form senza
iniezioni. Deciso con Jomar di tenerlo fuori: è la **#220** (limite nel form,
nelle action e CHECK sulla tabella). Qui serve come guasto vero dello scenario
e2e, che andrà spostato su un'altra iniezione quando la #220 si chiude.

### Le decisioni

- **La funzione restituisce gli id, non il numero** (`uuid[]`, migration
  `20261122`). Il conteggio è `cardinality()`, quindi non si perde niente, e
  serve a due lettori: `run_daily_jobs()` li scrive in `details`, e la action
  sa se è stata saltata proprio LA SUA regola. Un numero conterebbe anche le
  altre regole scadute dell'utente, e una sua regola vecchia rotta farebbe
  comparire l'avviso su ogni regola nuova.
- **La notifica nasce nel passo `notifications`, non nel blocco delle
  ricorrenti.** Un insert fallito lì farebbe scattare l'`exception` del blocco,
  e con la notifica se ne andrebbero i movimenti appena generati per tutti.
- **Solo dal cron.** La RPC del form risponde nel form, mentre l'utente guarda:
  la regola della 17b.
- **Dedup per regola e occorrenza, non per giorno** (la issue proponeva il
  giorno). Il `next_run` di una regola guasta non avanza, quindi la chiave del
  giorno avrebbe dato una notifica a notte, finché qualcuno non la corregge: il
  rumore che fa smettere di aprire il campanello. Deciso con Jomar.
- **Il form non risponde `{ error }`.** La regola esiste: un errore terrebbe il
  pannello su «Crea ricorrenza», e il secondo tocco creerebbe una seconda
  regola. Nemmeno «Qualcosa è andato storto» (`genericError()`, come proponeva
  la issue), che manderebbe a riprovare: il motivo va nei log, e a schermo va
  una frase sua, in ambra. Il pannello resta aperto con la frase e «Chiudi»:
  l'annuncio di #165 è solo per lo screen reader, e chiudendo nessuno avrebbe
  letto niente. Deciso con Jomar.
- **«Mancato» solo se la regola era già dovuta.** Con una partenza futura la RPC
  non aveva niente da generare, e se cade non manca nessun movimento
  (`generationMissed()`, `lib/recurring.ts`).
- **Le guardie.** Per mesi la `20260811` è stata «quella da rieseguire per
  riagganciare il cron», e non aveva guardia: rieseguita dopo la `20261122`,
  avrebbe rimesso un `run_daily_jobs()` che assegna un `uuid[]` a un `int`, e il
  job sarebbe caduto ogni notte. Ora la `20260811` e la `20260821` riconoscono
  il successore dal tipo di ritorno, e i messaggi della `20260728`, della
  `20260804` e della `20260809` rimandano alla `20261122`.

### Il collaudo

- **pgTAP** (`supabase/tests/ricorrenti-saltate.test.sql`, 21 prove), tre
  utenti e un guasto iniettato con un CHECK dentro la transazione: la RPC
  restituisce solo la regola di chi chiama e non notifica; il cron scrive gli id
  in `details`, genera le regole sane, notifica i proprietari delle saltate e
  nessun altro, non rinotifica al giro dopo, e torna `ok` quando la causa sparisce.
  Mutazioni dichiarate prima: senza la notifica cadono c8, c9, c10 e d1; senza gli
  id in `details` cade c2; con la dedup per giorno cade c8. Nessun'altra.
  ⚠️ Alla prima stesura c5, c6 e c8 erano rossi per la ragione sbagliata: il
  `set local request.jwt.claims` della prova RPC dura fino alla fine della
  transazione, e `reset role` non lo toglie. `run_daily_jobs()` girava come
  l'utente tre. Ora la prova azzera le claims e controlla `auth.uid()` NULL
  (c0) prima del cron.
- **Vitest**: `generationMissed`, `isDueNow`, la frase della notifica nelle due
  lingue. Mutazioni: senza il controllo «già dovuta» cade la partenza futura;
  con `length > 0` al posto dell'id cade «un'altra regola»; senza la voce in
  `META` cade l'icona.
- **e2e** (`tests/e2e/ricorrenti.spec.ts`): la ricorrenza con la nota lunga
  lascia il pannello aperto con l'avviso, nello schermo, senza «Crea
  ricorrenza»; una regola sola, nessun movimento. Il gemello con la nota corta
  si chiude su «Ricorrenza creata.» e genera il movimento.
- ⚠️ Errore mio, registrato perché è una trappola: aggiornando con `sed` i
  messaggi delle guardie ho scritto «l'ultima» dentro una stringa SQL fra apici
  singoli. La ricostruzione del database si fermava alla `20260804` con
  «Stopping containers» e nessun messaggio d'errore. In SQL l'apostrofo si
  raddoppia (`l''ultima`).
