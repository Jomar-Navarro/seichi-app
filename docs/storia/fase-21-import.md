# Fase 21 — import da file (CSV, Trade Republic)

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Fase 21 — import da file (CSV / Trade Republic)

Implementata il 2026-08-13 (issue #35). Migration `20260816_imports.sql`.
Progettata leggendo un export `pytr` **reale**, non la documentazione.

```sql
imports: id, user_id, account_id (il conto del FILE), source, filename, created_at
transactions: + import_id (FK cascade), + import_key (unique con user_id)
import_transactions(account, source, filename, rows jsonb) → (import_id, inserted, submitted)
```

#### Le decisioni di schema

- **Una tabella `imports`, non solo una colonna.** Il lotto è ciò che rende
  l'import **annullabile**: `transactions.import_id` è `on delete cascade`,
  quindi disfare è una sola istruzione atomica. La colonna va messa subito —
  vale il precedente di `notifications.destination`, e qui il backfill sarebbe
  **impossibile**: nessun dato residuo direbbe quali righe erano arrivate insieme.
- ⚠️ **`on delete cascade` su `import_id` mentre `account_id` è `no action`**, ed
  è la stessa asimmetria di `categories` (cascade, serve a eliminare un
  obiettivo) contro `accounts` (no action, cancellerebbe movimenti reali). Qui la
  cascade **è** l'operazione.
- **Nessuna colonna `row_count`** — quinta volta che questo progetto rifiuta un
  totale memorizzato, dopo `spent`, `saved_amount`, `balance` e `valid_to`. Qui
  divergerebbe al primo movimento importato che l'utente cancella a mano.
- **`import_key` TEXT + `unique (user_id, import_key)` + `on conflict do nothing`**,
  come `notifications.dedup_key`: reimportare un file sovrapposto **non può**
  duplicare, per costruzione. ⚠️ I NULL restano **distinti** (default) — è
  l'opposto di `budgets`, dove NULL significava "il budget globale", cioè una
  cosa sola. Qui NULL significa "riga inserita a mano", e ce ne sono migliaia.
- **FK composita `(account_id, user_id) → accounts (id, user_id)`**, come nella
  20b: nessuna policy RLS guarda `account_id`.
- ⚠️ **`import_transactions()` è `security invoker`**, cioè il default — non
  `definer` come le altre funzioni del progetto. Qui non serve alcun privilegio
  in più, e marcarla `definer` per abitudine avrebbe disattivato la RLS in cambio
  di niente. Serve come funzione solo per l'**atomicità** lotto + righe.
- **Tre policy su `imports`, niente UPDATE**: una riga è il verbale di un evento
  accaduto, non contenuto modificabile.

#### Le quattro cose che il file vero insegna, e nessuna documentazione dice

1. ⚠️ **`amount` non è il movimento di cassa.** Su un acquisto vale il
   controvalore e la commissione sta a parte (`amount −24,97`, `fee −1,00`: dal
   conto escono 25,97). Sulle vendite c'è anche `tax`.
2. ⚠️ **La colonna che contiene la cassa cambia con il tipo di riga.**
   `TAX_OPTIMIZATION` (il bollo) ha `amount = 0` e il movimento in `tax`.
3. ⚠️ **Alcune righe non sono movimenti.** `MIGRATION` (trasloco di custodia, a
   coppie ±n) e `FREE_RECEIPT` hanno gli importi **vuoti**.
4. ⚠️ **`counterparty_iban` è popolata solo sulle righe recenti.** Sulle altre
   l'IBAN sta dentro il testo libero, o non c'è affatto — quindi **non** si può
   costruire su di lei una colonna `accounts.iban`: mancherebbe metà delle volte.

I primi tre si chiudono con **una regola sola** invece che con tre rami speciali:
`netto = amount + fee + tax`, e **netto zero significa nessun movimento di
cassa**. La conferma che sia quella giusta la dà il file: il versamento del
07/03/2024 ha `amount 201,40` e `fee −1,40`, cioè **200,00 tondi**. Un numero
rotondo che esce dall'aritmetica non è una coincidenza.

#### Il passo centrale decide per GRUPPO, non per riga

È lo scostamento voluto dal mockup `Seichi Importa CSV.dc.html`, che mostrava una
lista di transazioni con una pastiglia "seleziona categoria" ciascuna. Un estratto
di tre anni ha **~200 righe e ~15 decisioni**: tutti gli acquisti sono
investimenti, tutti gli interessi entrate, tutti i bonifici da uno stesso IBAN
vengono dallo stesso conto. Le righe restano ispezionabili aprendo il gruppo: è
la **decisione** che si accorpa, non l'informazione.

⚠️ **La direzione fa parte dell'IDENTITÀ del gruppo.** `TAX_OPTIMIZATION` compare
sia in addebito sia in storno: raccolti insieme, una decisione sola varrebbe per
righe che vanno in versi opposti.

#### Gli altri difetti del mockup, corretti

- **Mancava il conto**, e senza `transactions.account_id` (NOT NULL dalla 20a)
  l'import non scrive una riga. Sta nel passo 1, perché è una proprietà
  dell'**estratto**, non delle singole righe.
- **La riga "Trasferimento risparmio" chiedeva una categoria**, che
  `transactions_transfer_category_check` vieta. Un trasferimento vuole invece il
  **conto di destinazione**.
- **"max 10 MB" contro `bodySizeLimit: 3mb`** in `next.config.ts`. Il limite è
  ora 2 MB (`IMPORT_MAX_BYTES`), quarto numero della catena da tenere allineata
  insieme a quelli dell'avatar. Per la misura: l'estratto di tre anni pesa **40
  KB**; il mockup dichiarava "2,1 MB" per 42 transazioni.
- ⚠️ **"42 da importare · 3 duplicati ignorati" nella schermata di conferma**
  prometteva prima dell'import un numero conoscibile solo **dopo**: quante righe
  risultino già presenti lo decide il vincolo di unicità. Il riepilogo mostra ora
  *da importare / ignorate / illeggibili*, che sommano al totale del file; i "già
  presenti" compaiono alla fine.

#### ⚠️⚠️ Il difetto più costoso: 216 movimenti sul conto sbagliato

Il primo import reale ha attribuito un estratto **Trade Republic** al **Conto
principale**, e ha scritto 31 trasferimenti fra Revolut e il corrente — portando
Revolut a **−2.618,08 €** su un conto che non aveva mosso un euro.

**Non è stato un errore dell'utente: era l'unica strada che l'interfaccia
offriva.** Tre buchi che si sommavano, e ognuno da solo sarebbe stato innocuo:

1. **Un conto Trade Republic non esisteva**, e dal flusso non si poteva creare —
   uscire a farlo avrebbe perso il file già caricato.
2. **Il selettore della controparte conteneva UNA voce** (l'unico altro conto),
   con il gruppo già proposto come `trasferimento`. Non una scelta: l'unica riga
   disponibile.
3. **L'app sapeva che era un estratto Trade Republic e non lo diceva.**

Le correzioni: l'analisi si fa **alla scelta del file** (solo dopo si conosce il
profilo, quindi l'avviso arriva prima della scelta e non dopo), un avviso ambra
per gli estratti di broker, e `AccountPicker` — un selettore che sa **creare** un
conto senza uscire.

⚠️ **E il quarto buco, che è mio e vale come regola: l'annullamento viveva solo
nello stato del componente.** Il lotto era stato progettato apposta per rendere
l'import reversibile, e poi il comando aveva la vita di una schermata: uscito da
lì, la riga di `imports` era irraggiungibile da tutta l'app e restava solo il SQL
Editor. **Progettare la reversibilità e non darle una casa stabile è metà del
lavoro** — e la metà mancante si vede solo usando l'app. Ora
`/impostazioni/importa` elenca gli import precedenti con il comando che li disfa.

#### Emerso dal code-review (12 rilievi, tutti applicati)

I quattro che valgono una regola:

- ⚠️ **`parseAmount("1.250")` restituiva 1,25** — un fattore mille perso in
  silenzio: la riga si importa, non finisce fra le illeggibili, e l'importo è
  semplicemente sbagliato. Ora un separatore **ripetuto**, o seguito da
  **esattamente tre cifre**, è quello delle migliaia. Ambiguità residua
  dichiarata: un file tecnico con tre decimali. Trade Republic ne usa sei.
- ⚠️ **`targetsFor` ignorava la direzione in due rami su cinque.** `vendite`
  proponeva `entrata` per definizione — vero quasi sempre, falso quando le
  commissioni superano il ricavo. È **esattamente il difetto che il tipo
  `Direction` è stato introdotto per rendere impossibile**, sopravvissuto dentro
  le eccezioni scritte a mano: un filtro applicato al caso generale e saltato nei
  casi speciali non è una difesa, è una convenzione.
- ⚠️ **`ImportHistory.run()` scartava l'esito di `undoImport`**: un annullamento
  fallito chiudeva la conferma e ricaricava come uno riuscito, lasciando lotto e
  transazioni al loro posto. L'utente vedeva il gesto compiersi e i dati restare.
- ⚠️ **Nessun `try/finally` attorno alle server action**: una promise rifiutata
  lasciava `pending` a `true` e il flusso bloccato senza messaggio.

Più: errori di query scartati che si travestivano da "categoria sbagliata",
messaggi Postgres grezzi mostrati all'utente, controparte non controllata per
`archived`, `ready` vero dopo un'analisi fallita (un pulsante vivo che non fa
niente), la corsa fra due scelte di file ravvicinate, il contatore delle tendine
che restava sbilanciato allo smontaggio, e tre voci di dizionario mai usate.

#### ⚠️ Tre volte su tre, a sbagliare era la VERIFICA e non il codice

Vale come regola di metodo, perché è successo in una fase sola:

- il controllo sul **mojibake** interrogava una riga che usa il campo `name`,
  dove la riparazione non passa mai: passava senza testare niente;
- il **driver** decideva un gruppo solo e concludeva "il pulsante non si accende",
  mentre a bloccare erano i quattro gruppi di bonifici — e intanto quel KO
  nascondeva il difetto vero, che era l'ordinamento;
- ⚠️ la **controprova nella migration** cercava `qual not like '%select
  auth.uid()%'`. Postgres non conserva il testo che scrivi: lo ri-stampa
  dall'albero sintattico, e `(select auth.uid())` diventa `( SELECT auth.uid()
  AS uid)` — maiuscolo e con un alias. Con `like` sensibile alle maiuscole il
  controllo dichiarava **nude tutte e 25 le policy** del database, tutte
  perfettamente corrette. Si controlla con `~*`, mai con `like`.

La regola già scritta per la #47 — *un registro di guasti non è collaudato finché
non ha registrato un guasto* — ha un gemello: **un controllo che segnala un
guasto va diagnosticato prima di crederci.** Due dei tre difetti veri di questa
fase si sono visti proprio andando a capire perché una verifica diceva rosso.

#### La tendina, e perché `Select` da solo non poteva farcela

⚠️ Una card con `backdrop-filter` crea un **contesto di impilamento**: il menu
resta confinato al livello della card, quindi nessuno z-index scritto dentro
`Select` può superare la `BottomNav`, che è `fixed` a z-40. Tre difese, e servono
tutte e tre perché falliscono in modi diversi:

- **si ribalta verso l'alto** quando sotto non c'è spazio (calcolo al tocco, non
  al render: in una lista lunga la posizione cambia di continuo);
- **altezza massima con scorrimento interno**, o una lista lunga esce comunque;
- **lo z-index lo alza il CHIAMANTE**, avvisato da `onOpenChange` — l'unico che
  può alzare la card è chi la disegna.

Il contatore delle tendine aperte è un **numero**, non un booleano: `Select` non
si chiude quando se ne apre un'altra.

#### ~~`SELL` non ha un tipo~~ — chiuso dalla Fase 21b (#52)

L'import ha reso visibile il buco, **non lo ha creato** — stesso schema della
#43. La misura, sui dati veri: versato su Trade Republic € 3.578,50, vendite
€ 881,31, quindi **versato netto € 2.697,19** contro un valore reale di
€ 2.935,61; la differenza di € 238,42 sono plusvalenze e liquidità non
investita. Vedi "Fase 21b" qui sotto.

#### ~~Debito aperto: `/investimenti` non ha il selettore conto~~ — chiuso (#53)

Chiuso insieme alla #52, e nella stessa PR di proposito: sono la stessa pagina,
quindi una verifica sola. Vedi "Fase 21b".

