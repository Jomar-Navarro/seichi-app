# Fase 17 — budget e notifiche

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 17 — budget e notifiche

Progettata per intero il 2026-08-03 prima di scrivere codice.
**Entrambe IMPLEMENTATE e verificate end-to-end** — migration
`20260803_budgets.sql` (17a) e `20260804_notifications.sql` (17b).

```sql
budgets: id (UUID), user_id, category_id (UUID, NULLABLE), period (TEXT),
         amount (DECIMAL 10,2, NULLABLE), valid_from (DATE), created_at
-- period: 'settimanale' | 'mensile' | 'annuale'
-- category_id NULL = budget GLOBALE (non una tabella separata)
-- amount NULL = "lapide": da questo periodo, nessun budget
```

- **Niente `valid_to`: è ridondante.** La riga successiva chiude la precedente. Il
  budget di un periodo = la riga più recente con `valid_from <= inizio_periodo`.
  Sovrapposizioni impossibili per costruzione, storico gratis, zero righe generate
  e zero job. Correggere un errore nel periodo corrente sovrascrive la riga esistente
  (stesso `valid_from`); alzare il budget da un periodo futuro crea una riga nuova —
  **stessa operazione nel codice, intenzione dedotta dal periodo**, nessuna scelta
  concettuale davanti all'utente.
- **`amount` NULL, mai 0, per cancellare.** "Nessun budget" e "budget di zero" sono
  affermazioni diverse: usare 0 come sentinella renderebbe impossibile distinguerle.
  La lapide è NULL per non doverlo fare. **Se poi 0 vada anche ammesso è una domanda
  separata, e la risposta è no** — `CHECK (amount IS NULL OR amount > 0)`: un limite
  di zero è nei fatti indistinguibile dal non voler tracciare la categoria, e
  costringerebbe a gestire `spent/0` in percentuale e stato per un caso che nessuno
  imposta.
- **Periodi ancorati al CALENDARIO** (settimana da lunedì, mese dal 1°, anno solare),
  non alla data di creazione. Un budget è una *finestra sul tempo condiviso*, non un
  evento che si ripete: l'utente pensa "questa settimana", non "i 7 giorni da quando
  l'ho creato". **Diverso da `recurring_rules`, ed è corretto così** — lì l'ancoraggio
  è `start_date` perché l'affitto esce il 5. Nessun conflitto con `addClampedMonths`:
  i confini non si calcolano avanzando, si ottengono troncando.
- **`valid_from` è sempre un confine di periodo, e lo impone il DB** con un `CHECK`
  su `date_trunc(<periodo>, valid_from)`. Non è una convenzione applicativa: una riga
  scritta a mano dal SQL Editor viene rifiutata. È anche ciò che regala alla Fase 17b
  la sua chiave di idempotenza già deterministica.
- ⚠️ **`UNIQUE (user_id, category_id, valid_from)` richiede `NULLS NOT DISTINCT`**
  (Postgres 15+). Di default in un vincolo di unicità i NULL sono tutti distinti tra
  loro → due budget **globali** per lo stesso periodo passerebbero senza errore.
- `CHECK (category_id IS NOT NULL OR period = 'mensile')` — il globale è ancorato allo
  stipendio, che è mensile. Periodi misti sì tra categorie (la spesa alimentare *ha*
  un ritmo settimanale, i viaggi annuale), ma il globale non è configurabile.
- Indice su `(user_id, category_id, valid_from DESC)`. La lettura "budget corrente per
  categoria" è un `DISTINCT ON` e va incapsulata in una **vista**.
  ⚠️ **La vista va creata con `security_invoker = true`**: una vista normale gira con i
  privilegi del proprietario e **scavalca la RLS** della tabella sottostante — ogni
  utente vedrebbe i budget di tutti.
- **Nessuna colonna `spent`.** Lo speso si somma dalle transazioni alla lettura, come
  `saved_amount` in `getGoals`. Un totale memorizzato avrebbe quattro punti di
  scrittura da tenere allineati (insert/update/delete + gli insert di pg_cron).
- **Budget solo su categorie `spesa`, e NON è imposto dal DB.** Non è esprimibile con
  una FK; servirebbe una colonna `type` ridondante o un trigger. Lo stato illegale che
  preverrebbe è innocuo (un budget su una categoria risparmio mostrerebbe 0), quindi
  il controllo sta nella server action. Denormalizzare per un difetto cosmetico costa
  più di quanto rende.
- ⚠️ **Affitto e utenze sono categorie `abbonamento`, non `spesa`** (vedi
  `app/(onboarding)/actions.ts`), e tipo transazione e tipo categoria sono accoppiati
  1:1 (`TransactionForm` filtra con `.eq("type", selectedType.id)`). Quindi restano
  fuori da ogni budget. Per il per-categoria è voluto; per il **globale** significa che
  la cifra va chiamata **"spese variabili"**, mai "spese totali", con accanto una riga
  di sola lettura "uscite fisse previste" sommata da `recurring_rules`. Un numero
  sbagliato che sembra giusto è peggio di un numero assente: se il globale ignora in
  silenzio l'affitto, l'utente smette di fidarsene. Il calcolo *stipendio − fisse =
  disponibile* e il suggerimento dell'importo restano alla Fase 24 (AI).

```sql
notifications: id, user_id, type, payload (JSONB), dedup_key (TEXT),
               destination (TEXT), read (BOOL), created_at
-- UNIQUE (user_id, dedup_key)
```

- **`payload` JSONB, non testo già composto.** Il DB registra i FATTI, la frase la
  compone `lib/notifications.ts` alla lettura. Salvare `'€ ' || round(x)` avrebbe
  cablato la valuta ignorando `profiles.currency`, saltato il separatore delle
  migliaia (le card accanto scrivono "€ 1.234" via `Intl.NumberFormat`) e reso
  **intraducibile alla Fase 19 tutto lo storico già scritto**.
- ⚠️ Il campo si chiama `destination`, **in inglese** come ogni altra colonna. Il
  primo progetto lo chiamava `destinazione`, contraddicendo la regola di questo
  stesso documento.

- **Generazione SOLO da pg_cron, mai da trigger o server action**, e **dopo**
  `generate_recurring_transactions()` nella stessa esecuzione — invertito valuterebbe
  lo stato di ieri e mancherebbe proprio lo sforamento causato dalla ricorrente appena
  inserita, che è il caso per cui esiste.
- **Perché non sincrono**: quando l'utente inserisce la spesa a mano sta guardando lo
  schermo e la barra diventa rossa da sola — una notifica tre secondi dopo è rumore, e
  il rumore fa smettere di aprire il campanello, seppellendo l'unica notifica che vale
  ("tra 3 giorni escono 12€"). Le notifiche servono per ciò che accade **mentre non
  guardi**: l'affitto generato dal cron alle 3 di notte, che nessuna server action
  vedrebbe mai. Conseguenza accettata: sfori martedì alle 18, la notifica arriva
  mercoledì. Va bene — **la notifica è il registro, non l'allarme**.
- **`dedup_key` TEXT + UNIQUE, non un vincolo composito tipizzato.** Gli eventi hanno
  chiavi naturali diverse: budget = categoria + inizio periodo, rinnovo abbonamento =
  `recurring_rule_id` + data. Una colonna `category_id` che contiene un id di regola è
  un campo che mente sul proprio nome. Ogni generatore compone una stringa
  deterministica (`budget_sforato:{category_id}:{2026-08-01}`) e usa
  `INSERT ... ON CONFLICT DO NOTHING` → **idempotente per costruzione, non per
  attenzione di chi scrive**. Il cron può girare due volte o fallire a metà senza
  duplicare niente.
- Ogni notifica porta una **destinazione** (una notifica non toccabile è un vicolo
  cieco) — colonna da mettere subito, aggiungerla dopo richiede backfill delle righe
  già spedite.
- ⚠️ **Le notifiche NON si cancellano mai**, e la pulizia a 90 giorni prevista in
  progetto **era un bug**: la riga non è solo un messaggio, è anche la prova che
  quell'evento è già stato emesso. Cancellandola si libera la `dedup_key` e il
  generatore rifà la notifica — un obiettivo al 100% verrebbe rinotificato ogni 90
  giorni per sempre, e i budget annuali hanno chiavi valide 365 giorni contro una
  finestra di 90. Scartato anche un registro eventi separato: sarebbe la separazione
  concettualmente giusta, ma aggiunge una tabella per poter cancellare poche migliaia
  di righe in dieci anni.

#### Deciso il 2026-08-03 leggendo `Seichi Stati Supporto.dc.html`

- **Soglie obiettivo: 50% e 100%.** Un obiettivo dura mesi, quindi sono ~2 notifiche
  in tutto. Il mockup mostrava "al 58%", cioè un avanzamento arbitrario: sarebbe
  rumore, e il rumore fa smettere di aprire il campanello.
- **Anticipo rinnovo abbonamento: 3 giorni** (confermato dal mockup).
- **Il tap segna come letta E naviga**, più un comando "segna tutte come lette". È ciò
  che rende utile la colonna `destinazione`. Scartato "aprire il pannello segna tutto":
  azzererebbe il valore del non-letto, che è l'unica cosa che distingue ciò che hai
  già visto.
- **Badge con il numero** sulla campanella (9+ oltre la nona). Il mockup mostra la
  campanella nuda, ma senza segnale non c'è motivo di aprirla.
- **Due notifiche del mockup NON si fanno.** "Il tuo stipendio è stato registrato" è
  la categoria scartata nella decisione di Fase 15 (ridondante con la banca). "Il
  valore del tuo portafoglio è aumentato del 4,1%" non è **calcolabile**: Seichi non ha
  quotazioni, gli investimenti sono transazioni manuali e il totale è la somma dei
  versamenti — non varia da solo. Servirebbe un feed prezzi, che non è in roadmap.
- **Stati visivi dal mockup**: non letta = riga piena + pallino `kin`; letta =
  `opacity: 0.55` + pallino spento. Pastiglia icona 36px colorata per tipo, testo 13px,
  timestamp **relativo** ("2 ore fa", "Ieri", "3 giorni fa"). Pannello come card sotto
  l'header, con overlay sfocato dietro.
- ~~Nel mockup la campanella è in alto a destra, ma nell'app quel posto è di
  `ProfileMenu`: saranno due pastiglie affiancate.~~ **Non più vero dalla Fase 18**:
  l'header della Home è stato rifatto sul mockup `Seichi Dashboard.dc.html`, che
  mette l'avatar col saluto e il nome **a sinistra** — ad aprire il menu è il
  gruppo intero, non il solo avatar — e lascia alla campanella il suo angolo.
- **`delete_current_user()` va aggiornata** con `budgets` e `notifications`: fa i
  `DELETE` espliciti tabella per tabella, deliberatamente, e la cascade da sola non
  basta per come è scritta.
- **Consegna in due PR**: 17a budget (schema, vista, RLS, CRUD, barre, uscite fisse),
  17b notifiche. Dipendenza a senso unico — il budget con la barra che diventa ambra
  all'80% e rossa al 100% è già un prodotto finito senza una sola notifica.

#### Emerso implementando la 17a

- **La scrittura passa da `set_budget()`, non da un insert del client.** Così
  `valid_from` lo calcola il DB con `budget_period_start()`, la stessa funzione usata
  dal `CHECK`: se lo calcolasse l'app, la stessa aritmetica esisterebbe in due
  linguaggi. In più l'upsert è atomico (niente leggi-poi-scrivi fra due tab) e i
  controlli non esprimibili come vincolo (categoria `spesa`, globale mensile) danno un
  messaggio leggibile invece di una violazione di CHECK. Riceve la data **locale** del
  client: il server è in UTC e fra mezzanotte e le 2 sbaglierebbe periodo.
- ⚠️ **Cambiare periodo poteva sparire in silenzio.** Difetto del versionamento a solo
  `valid_from`: il nuovo inizio può non essere il più recente, in entrambe le
  direzioni. Mensile → settimanale il 1° agosto (venerdì): la settimana è iniziata il
  27 luglio, *prima* della riga mensile del 1 ago, che `budgets_at()` continuerebbe a
  restituire. Settimanale → mensile il 15 agosto: l'inizio mensile è il 1 ago, prima
  della settimana corrente. **Il primo tentativo di correzione avanzava al confine
  successivo del periodo nuovo — sbagliato**: nel secondo caso il budget entrava in
  vigore il 1° *settembre*, l'azione rispondeva "salvato" e per tre settimane non
  cambiava nulla. Un no-op silenzioso è il difetto peggiore possibile qui.
  Soluzione attuale: il nuovo budget vale **subito**, e `set_budget()` rimuove le
  righe interne al periodo corrente scritte sotto il regime precedente
  (`valid_from > v_from AND valid_from <= p_today`). Cambiare periodo *è* ridefinire
  la finestra corrente; lo storico dei periodi precedenti e le righe future non si
  toccano.
- ⚠️ **La rimozione di un budget non applica il controllo "solo categorie spesa".**
  Se l'utente cambia il tipo di una categoria che aveva un budget, quel budget va
  ripulito **proprio quando** la categoria non è più `spesa`. Applicare il controllo
  anche in rimozione lascerebbe una riga che nessuno può più togliere: la card
  resterebbe a "€0 / €X" per sempre, e il campo budget è ormai nascosto.
  `CategorySheet` scrive la lapide quando il tipo cambia via da `spesa`.
- ⚠️ **Il fuso orario non si chiede al server.** Le server action girano in UTC su
  Vercel: `new Date()` lì dà il giorno del *server*, e fra mezzanotte e le 2 ora
  italiana è ancora ieri. L'orologio arriva dal client come `ClientClock`
  (`lib/dates.ts`), che porta la data locale **e lo scostamento di fuso** — serve
  entrambi, perché `transactions.date` è un istante assoluto e senza offset i confini
  di periodo sarebbero comunque quelli della mezzanotte del server. Per lo stesso
  motivo `GlobalBudgetSection` carica i propri dati da sé: la pagina impostazioni è un
  server component e non può conoscere il fuso dell'utente.
- **Il budget si imposta nel form categoria** (`CategorySheet`), non in una pagina
  dedicata — è una proprietà della categoria, si modifica dove si modifica lei. La
  *memorizzazione* resta la tabella versionata: `getBudgetForCategory()` la carica
  all'apertura, e si riscrive solo se è cambiata davvero, altrimenti ogni rinomina
  della categoria creerebbe una riga di storico identica alla precedente.
- **Il globale sta nelle impostazioni**: non appartiene a nessuna categoria, quindi il
  form categoria non poteva ospitarlo.
- **La finestra temporale sta su ogni card, non nell'intestazione di sezione.** Era il
  rischio previsto dei periodi misti: l'intestazione diceva "Budget del mese" seguendo
  il periodo del globale, cioè una dichiarazione falsa sulle card settimanali accanto.
  E le card si scorrono orizzontalmente, quindi guardandone una a metà scroll
  "€ 10 / € 100" non dice su quale arco di tempo. Intestazione neutra ("Budget"),
  finestra sulla card ("questo mese"). Per lo stesso motivo la cifra delle uscite
  fisse dice esplicitamente "del mese".
- `createCategory()` ora restituisce l'`id`: serve a impostare il budget subito dopo,
  sulla categoria appena creata.

#### Emerso implementando la 17b

- **Un solo job, non due.** Il cron della Fase 14 (`generate-recurring`) è stato
  smontato e sostituito da `seichi-daily`, che invoca `run_daily_jobs()`: quella
  chiama in sequenza ricorrenti → notifiche → pulizia. Un secondo cron a un orario
  più tardi sarebbe stato *sperare* che il primo avesse finito, e qui l'ordine è
  **correttezza**, non ottimizzazione.
- ⚠️ **Il wrapper è sicuro solo perché `generate_recurring_transactions()` distingue
  cron da RPC con `auth.uid()`** (NULL dal cron → tutti gli utenti). Invocandola da
  `run_daily_jobs()`, anch'essa lanciata dal cron, `auth.uid()` resta NULL e il
  comportamento non cambia. Verificato sul codice della funzione prima di agganciarla:
  cambiarlo in silenzio avrebbe fermato le ricorrenti senza alcun errore.
- **`generate_notifications()` non può riusare `budgets_at()`**: quella filtra su
  `auth.uid()`, che dal cron è NULL. La stessa logica è riscritta in forma
  insiemistica su tutti gli utenti — con lo stesso `DISTINCT ON`, che raggruppa i NULL
  e quindi tratta il budget globale come una categoria a sé.
- **Nessuna policy di INSERT su `notifications`.** Sono un registro generato dal
  server, non contenuto dell'utente: se il client potesse scriverle, "non letto"
  smetterebbe di significare qualcosa e la `dedup_key` sarebbe aggirabile.
- ⚠️ **Una policy RLS non sa limitare le COLONNE**, e col solo `for update` l'utente
  poteva riscriversi `dedup_key` e `destination` sulle proprie righe. Non è estetica:
  forgiando una chiave futura si **zittisce per sempre** la notifica vera di quel
  periodo — l'idempotenza per costruzione è proprio ciò che rende una chiave falsa un
  silenziatore permanente. Serve anche un **grant a livello di colonna**
  (`grant update (read)`): la RLS decide quali RIGHE, il grant quali COLONNE.
- ⚠️ **pg_cron esegue il comando come UNA transazione.** Con i passi in sequenza nuda,
  un'eccezione nelle notifiche faceva rollback anche degli **insert finanziari** delle
  ricorrenti appena eseguiti. Ogni passo di `run_daily_jobs()` ha il proprio blocco
  `exception`: le ricorrenti restano scritte e il motivo finisce nei log.
- **Il seed dei traguardi già superati** viene scritto dalla migration come *già
  letto*: senza, la prima esecuzione dopo il deploy scoprirebbe insieme tutti i
  traguardi storici e riempirebbe il pannello di notifiche "adesso" per fatti di mesi
  fa — il rumore che questa fase esiste per evitare.
- **La soglia dell'80% è duplicata fra SQL e TypeScript** e non è eliminabile senza
  generazione di codice: serve alla barra a ogni render e al job notturno. È isolata
  in `budget_warning_threshold()` e in `BUDGET_WARNING_THRESHOLD`, così i due punti da
  tenere allineati hanno un nome.
- **Il rinnovo abbonamento usa `next_run between today and today + 3`**, non
  `= today + 3`: se il job salta un giorno l'avviso arriva comunque invece di perdersi
  per sempre, e la dedup lo tiene singolo.
- **"Ricorrenti generate" filtra su `created_at`, non su `date`.** Il ciclo interno di
  `generate_recurring_transactions()` recupera più occorrenze arretrate in una sola
  esecuzione: quelle hanno `date` nel passato ma sono state create oggi.
- **`coalesce` sui nomi nei titoli.** Un `name` NULL produrrebbe per concatenazione un
  `title` NULL, e il `NOT NULL` farebbe fallire l'INTERO job notturno per tutti gli
  utenti. La FK in cascade lo rende impossibile oggi, ma un job non sorvegliato non è
  il posto dove appoggiarsi a un'invariante altrui.
- ⚠️ **Il cron usa l'orologio del DATABASE (UTC), non quello del client.** È
  inevitabile: un job gira una volta per tutti e non ha un client. È schedulato alle
  03:00 UTC apposta, così per l'Europa continentale `current_date` coincide con la data
  locale. Per un fuso molto a ovest le soglie verrebbero valutate con un giorno di
  anticipo; la chiusura pulita è una colonna `profiles.timezone`.
- **Il pannello non usa `bg-modal`** (0.85 in scuro, tarato per i bottom sheet che
  coprono uno sfondo già oscurato) ma `--color-deep` al 94%: galleggia sulla dashboard
  piena di numeri, e il design lo vuole a 0.92.
- ⚠️ **La SQL della Fase 14 non era nel repo** — è esistita solo dentro Supabase fino
  al 2026-08-04, quando è stata ricostruita in `20260728_recurring.sql`
  interrogando il catalogo (`information_schema.columns`, `pg_constraint`,
  `pg_policies`, `pg_get_functiondef`), non a memoria: una migration che indovina è
  peggio di una che manca.
- ⚠️ **`recurring_rules` non aveva alcun `CHECK` su `type`.** Emerso proprio
  ricostruendo il file: nel database era testo libero, mentre `categories` ha il suo
  `categories_type_check`. Il difetto contava perché la notifica di rinnovo
  abbonamento filtra su `type = 'abbonamento'` e quindi si appoggiava alla sola
  disciplina applicativa. Vincolo aggiunto il 2026-08-04.
- ~~⚠️ **IL REPO NON RICOSTRUISCE ANCORA IL DATABASE DA ZERO.**~~ — **chiuso il
  2026-08-12** dalla issue #43: `profiles`, `categories` e `transactions` sono
  ora versionate in `20260727_baseline_fase3.sql`, e le correzioni che quella
  fotografia ha reso visibili — fra cui **la registrazione rotta da cinque
  settimane** — stanno in `20260813_schema_cleanup.sql`. Vedi la sezione
  "Ricostruzione dello schema". Recuperare `recurring_rules` aveva chiuso un
  buco; questo ha chiuso gli altri.

