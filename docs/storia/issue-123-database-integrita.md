# #123 — guardie, importi positivi, job in concorrenza, rinnovi

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Database — guardie, importi positivi, job in concorrenza, rinnovi (issue #123)

Dalla review completa del 2026-09-28 (#128). Migration
`20260821_integrity_job_safety.sql`, più correzioni alla `20260804`, `20260809`,
`20260811` e `20260818`.

⚠️⚠️ **Ordine: PRIMA il deploy del codice, POI la migration** — il contrario del
solito. Le notifiche di rinnovo perdono `days`, e il codice vecchio fa
`relativeDayLabel(Number(undefined))`: `Intl.RelativeTimeFormat.format(NaN)`
SOLLEVA, e porta via l'intero pannello. Verificato col codice di master su un
payload con la sola `date`: `RangeError`. Il codice nuovo regge entrambi i
payload.

- ⚠️ **La `20260804` non aveva guardia e si dichiarava "idempotente"**: rieseguita
  faceva `drop table notifications`. Ora si ferma se `notifications.payload`
  esiste, cioè se è già girata: riconosce SE STESSA e non un successore, perché
  il danno (le notifiche esistono già) non dipende dai successori. Vedi la
  tabella delle guardie nella sezione #43; corretti anche i commenti della
  `20260809` e `20260811` che la davano per assente ("l'unico file con
  `cron.schedule`").
- **La `20260818` non era rieseguibile** (`2BP01`): la FK degli allegati poggia su
  `transactions_id_user_key`. Ora si toglie per nome prima e si ricrea dopo,
  FUORI dal `create table`, che su una tabella esistente non fa niente. La
  lezione della 20b — *`drop … if exists` non è idempotenza* — applicata dove
  mancava.
- **`amount > 0` su `transactions` e `recurring_rules`, `type`/`amount`/`date`
  NOT NULL.** Le action lo controllano dalla #119; il vincolo copre il resto —
  SQL Editor, import, la prossima action che se ne dimentica. La migration conta
  le righe che lo violerebbero e si ferma PRIMA di scrivere.
  ⚠️ **Il CHECK ha reso fatale un caso dell'import generico**: "0,0001" passava
  il `!== 0`, diventava 0,00 nella colonna, e col vincolo avrebbe fatto fallire
  l'INTERO lotto. Ora il netto si arrotonda al centesimo prima del controllo,
  come già faceva Trade Republic. **Un vincolo nuovo trasforma in errore ogni
  scrittore che oggi produce il valore vietato: vanno cercati tutti prima.**
- **`for no key update` sul cursore del job delle ricorrenti.** Cron e
  `createRecurringRule` sovrapposti scrivevano due volte la stessa occorrenza:
  misurato sul database vero, 501 occorrenze doppie in 2 corse su 3. Ora la
  seconda esecuzione aspetta e poi trova la regola già avanzata.
  ⚠️ **Non `skip locked`, come diceva la prima stesura**: salta qualunque riga
  bloccata, anche una regola che l'utente sta salvando alle 03:00, senza
  contarla né registrarlo — la classe della #47. E non `for update`, che
  blocca anche i controlli di FK (review della #123).
  ⚠️ **Scartato l'indice unico su `(recurring_rule_id, date)`**: un movimento
  generato si modifica, data compresa, e tiene il suo `recurring_rule_id` —
  l'affitto di settembre spostato al 5 ottobre occuperebbe la chiave di ottobre,
  e il job salterebbe l'occorrenza vera in silenzio. Pagato anche il debito di
  `search_path to 'public'`.
- ⚠️ **Il rinnovo salva la DATA, non la distanza.** `days = next_run − oggi` era
  vero solo il giorno in cui il job girava: siccome le notifiche non si
  cancellano, la riga diceva "fra 3 giorni" per sempre. La migration legge la
  data dalla `dedup_key` delle righe vecchie e toglie `days`; l'app conta la
  distanza dall'oggi del CLIENTE (`getNotifications(todayLocalISO())`). Un
  rinnovo passato dice "ieri", "2 settimane fa", "2 mesi fa", col corpo al
  passato. ⚠️ **Niente data assoluta**: dopo il sostantivo vorrebbe un articolo
  che cambia col numero ("del 5", "dell'8", "del 1°") — la trappola di "il 0%".
  E oltre la settimana `numeric: "always"`: con `"auto"` `-1 week` è "la
  settimana scorsa", una settimana di calendario, falsa detta di dieci giorni fa.
  Senza una data leggibile la riga dice solo `Rinnovo "Spotify"`.
- **Le join di `generate_notifications()` verso `categories` confrontano il
  proprietario.** Una riga può puntare alla categoria di un altro utente (FK a
  colonna singola), e la funzione ne copiava il nome. Per i budget la riga si
  SALTA: con il nome NULL il client l'avrebbe letta come il budget globale. Le FK
  composite `(category_id, user_id)` restano da fare, e richiedono di chiudere
  prima `categories.user_id` nullable (vedi "Debiti restati aperti").

Collaudo del 2026-10-05, migration eseguita e verificata:

- **Query di verifica, prima di tutto**: zero occorrenze doppie, zero righe non
  valide, 4 rinnovi tutti con la data nella `dedup_key`, zero riferimenti a
  categorie altrui. La corsa del job non era ancora successa sui dati veri.
- ⚠️ **La corsa si prova su un account usa e getta, via REST, PRIMA e DOPO.** Una
  regola settimanale con 501 occorrenze arretrate e due chiamate RPC lanciate
  insieme: prima della migration **501 doppie in 2 corse su 3**, dopo **0 su 6**.
  Sei e non tre perché tre esiti puliti avevano ancora ~4% di probabilità di
  essere fortuna (corse che non si sovrappongono). Lo stesso account: un `-50`
  su una `spesa` accettato con il saldo che SALE, poi rifiutato con `23514`.
  ⚠️ **Le righe della controprova vanno cancellate subito**: la sezione 1 della
  migration conta le righe non valide di TUTTO il database, e si sarebbe
  fermata per il `-50` dell'account di prova.
- **Controprova SQL** 9/9, con c3 e c4 non saltate (c'è un secondo utente). La c4
  ha un gemello positivo — lo stesso budget su una categoria PROPRIA deve
  notificare — o passerebbe anche se il ramo dei budget non scattasse affatto.
- `20260804` rieseguita: STOP. `20260818` rieseguita: Success. Il pannello dice
  `Rinnovo "Palestra" l'altro ieri` · *Erano previsti € 40*.

