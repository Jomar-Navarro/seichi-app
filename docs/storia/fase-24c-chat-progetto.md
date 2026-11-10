# Fase 24c — la chat aperta (progettata, non implementata)

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

#### 24c — la chat aperta

##### ⚠️⚠️ La chat sposta il confine dei dati, e il consenso deve dirlo

La decisione «escono solo aggregati» era stata presa descrivendo un **referto**:
totali per periodo, categorie con nome e importo, budget, obiettivi, capitale
versato — mai note, mai righe singole, mai nomi dei conti, mai date di singoli
movimenti.

Con la chat quel confine si sposta, perché **esce anche ciò che l'utente
scrive**. È la regola già pagata nella 20b — *aggiungere una fonte a un dato
riapre ogni domanda già risposta sull'altra fonte* — e qui la fonte nuova è la
tastiera. Il consenso deve dichiarare due cose, non una.

- **`CoachSnapshot` è irrappresentabile per il TIPO**: nessun campo capace di
  contenere una nota o l'id di una riga. Stesso precedente di `ProfileHeader`
  contro `AccountContext` — *non esponendoli, l'errore non è più esprimibile*.
- ⚠️ **I nomi di categorie e obiettivi SONO testo scritto dall'utente**, e devono
  uscire o il consiglio non parla di niente. Per questo la schermata di consenso
  **mostra il payload vero**, non una descrizione: una descrizione diverge dal
  codice senza che nulla lo segnali, il payload no. È il criterio *«è scritto
  nell'interfaccia quali dati escono»* fatto in modo che non possa mentire.
- **`profiles.coach_consent_at`** (timestamptz, NULL = non ancora scelto).
  ⚠️ Niente default: la regola della #43 — *un DEFAULT è un'affermazione sul
  mondo* — vale qui più che altrove, perché l'affermazione sarebbe «questa
  persona ha acconsentito».
- ⚠️ **Il consenso si chiede alla 24c, non prima.** Chiederlo in 24b sarebbe
  chiedere il permesso di spedire dati a un servizio che l'app non contatta
  ancora.

##### Il modello non scrive MAI una cifra

Il modello riceve i numeri **già calcolati** e produce prosa con
**`{segnaposto}`**; le cifre le sostituisce `fill()` (`lib/i18n/format.ts`), lo
stesso meccanismo con cui i dizionari mettono i valori variabili nelle frasi. Il
catalogo dei segnaposto **si deriva dallo snapshot** e viaggia con lui, quindi
copre anche le categorie dell'utente (`{cat.alimentari.speso}`).

Tre guardie, e falliscono in modi diversi:

| | cosa rifiuta |
|---|---|
| segnaposto sconosciuto | una chiave che l'app non ha spedito |
| **una qualunque cifra nel testo grezzo** | un numero inventato, o ricalcolato a mente |
| `stop_reason` diverso da `end_turn` | un rifiuto o un troncamento letti come risposta |

⚠️ **Il divieto di cifre è TOTALE, anche per «tre mesi».** Un divieto parziale
(«solo gli importi») non è verificabile: bisognerebbe distinguere una somma da
un'ordinale, cioè indovinare l'intenzione. Un divieto totale è una regola binaria
che si controlla con una riga, e il costo — numeri piccoli scritti in lettere —
è una frase leggermente più formale, non una perdita di informazione.

⚠️ **Sul rifiuto non si mostra una risposta vuota.** Un riprova automatico con la
correzione, e se fallisce anche quello una frase che dice cosa è successo. Una
bolla vuota si legge come *«il coach non ha niente da dire»*, che è la classe già
corretta due volte nella 23a — *una lettura fallita travestita da fatto*.

⚠️ **E la difesa si collauda DISATTIVANDOLA**, o «funziona» e «non è mai stata
letta» restano indistinguibili (Fase 22, il `remotePattern` delle ricevute).

##### Niente streaming, ed è una conseguenza della validazione

La chat vorrebbe il testo che arriva a pezzi. Ma la validazione è **sull'intera
risposta**: mostrarla mentre arriva significherebbe poterla ritirare davanti
all'utente, cioè far vedere un numero inventato e poi toglierlo. Peggio del
silenzio di un secondo che si evita.

##### Il coach non calcola un solo numero proprio

Legge da `getDashboardTotals`, `getBudgetOverview`, `getFixedOutflows`,
`getGoals`, `getInvestments` e `sommaUscite()`. ⚠️ Riscrivere anche un solo
filtro creerebbe la **quinta** definizione di «uscita» dopo le tre che la review
della 20a ha dovuto unificare e la quarta che la 23b ha evitato di proposito.

Le parole corrette esistono già e **arrivano al modello come etichette, non si
inventano**: *Flusso*, *Uscite*, *Capitale versato*, *spese variabili*, *uscite
fisse*.

⚠️ **Nessun consiglio può parlare di rendimento o di valore di mercato**: Seichi
non ha quotazioni, il totale investito è la somma dei versamenti (21b). Non è una
regola di prompt, è una conseguenza dello snapshot — quei numeri non ci sono, e
citarli richiederebbe una cifra, che è già vietata.

##### Lo schema

```sql
coach_conversations: id, user_id, locale, created_at
coach_messages:      id, conversation_id, user_id, role, body, created_at
-- role: 'user' | 'assistant' | 'snapshot'
```

- ⚠️ **`body` conserva il testo COI SEGNAPOSTO**, non le cifre già sostituite. È
  la lezione di `notifications.payload` (17b): il database registra i fatti, la
  frase si compone alla lettura. Salvando le cifre, una conversazione riletta fra
  un mese mostrerebbe i numeri di allora accanto a un'app che ne mostra altri —
  e niente direbbe quali sono giusti.
- **Nessuna colonna `message_count`.** Sesta volta che questo progetto rifiuta un
  totale memorizzato, dopo `spent`, `saved_amount`, `balance`, `valid_to` e
  `row_count`.
- **Nomi colonna in inglese**, come ogni altra tabella.
- ⚠️ **`delete_current_user()` va aggiornata**, e con lei una guardia nuova: la
  `20260818` è oggi l'ultima a definirla, quindi **la sua guardia è SCADUTA** nel
  momento in cui la catena si allunga. È la regola scritta nella Fase 22 — *una
  guardia protegge dai successori che esistevano quando è stata scritta* — e
  stavolta la si applica sapendola, invece di scoprirla.
- RLS con una policy per operazione, forma `(select auth.uid())`.
  ⚠️ Residuo dichiarato: l'utente può inserire una riga `role='assistant'` fra i
  propri messaggi, e quella riga torna al modello come storia. È un'iniezione
  **verso se stessi** e non tocca i numeri (che restano segnaposto validati),
  quindi non giustifica una RPC dedicata — ma va scritto, o la prossima lettura
  lo scambia per una dimenticanza.

##### ⚠️ I numeri che cambiano a metà conversazione

Registri una spesa in un altro tab e poi chiedi «quanto mi resta?». Il system
prompt **non si riscrive**: lo farebbe invalidando la cache *e* riscrivendo la
storia, cioè rispondendo a domande vecchie con numeri nuovi.

La forma pulita esiste su Opus 5 ed è di prima classe: un `{role: "system"}`
dentro `messages`, cioè **il canale operatore a prova di iniezione**. ⚠️ **Non è
portabile**: Haiku 4.5 non lo ha, e gli altri fornitori hanno una nozione di
«messaggio di sistema» diversa e per lo più non ripetibile a metà conversazione.

Il ripiego, che funziona ovunque: una riga `role='snapshot'` in `coach_messages`,
spedita come messaggio **utente** dentro un recinto esplicito e resa nella UI
come un separatore («i numeri sono cambiati»), mai come una bolla dell'utente.

⚠️ È un ripiego, e va scritto che lo è: un blocco che *dice* di venire dall'app,
in un canale dove l'utente può scrivere, è distinguibile solo per convenzione. Ci
si può appoggiare **solo perché i numeri sono già protetti altrove** — dai
segnaposto e dal divieto di cifre. Se il fornitore scelto offre un canale
operatore vero, questo è il primo pezzo che diventa pulito.

##### La cache del prompt va MISURATA, non supposta

Lo snapshot sta nella parte stabile della richiesta, perché la domanda
dell'utente arriva dopo ed è l'unica cosa che cambia.

⚠️ **Ogni fornitore ha una soglia minima sotto la quale la cache non scatta, e
non lo dice.** Sulla Claude API il prefisso minimo memorizzabile dipende dal
modello (512–4096 token); altrove il meccanismo ha nomi e minimi diversi. Con uno
snapshot di poche categorie è uno scenario **probabile**, non teorico: si
verifica leggendo il contatore dei token letti da cache nella risposta, e se
resta zero su richieste con lo stesso prefisso la cache non c'è — e il preventivo
per messaggio va rifatto. È il metodo di sempre: non credere a un verde che
nessuno ha guardato.

##### Il fornitore — deciso il 2026-08-27 di NON deciderlo adesso

**Rinviato alla 24c**, e il rinvio è legittimo per una ragione strutturale: il
fornitore tocca **una funzione sola**. Snapshot, segnaposto, divieto di cifre,
catalogo chiuso e instradamento ibrido non dipendono da chi risponde. È la
proprietà che rende questa scelta **reversibile invece che strutturale**, ed è lo
stesso trattamento riservato a `DISPLAY_CURRENCY` nella Fase 19 — *quando si
affronterà, basta seguirne i riferimenti*.

⚠️⚠️ **Un piano GRATUITO è escluso, e non per preferenza.** Proposto il
2026-08-27 — *«utilizziamo Gemini gratis allora»* — e a rispondere sono i termini
di Google, non un'opinione:

> *"You may use only **Paid Services** when making API Clients available to users
> in the European Economic Area, Switzerland, or the United Kingdom."*

Seichi è un'app italiana per utenti italiani: il piano gratuito **non è
utilizzabile**, indipendentemente da cosa se ne pensi. E anche fuori dall'UE
resterebbe escluso dalla riga successiva:

> *"human reviewers may read, annotate, and process your API input and output"* …
> *"**Do not submit sensitive, confidential, or personal information to the
> Unpaid Services**."*

Il payload del coach è **esattamente** quello: quanto guadagni, quanto spendi, in
quali categorie, quali obiettivi hai. Useremmo il servizio contro l'istruzione
esplicita di chi lo fornisce.

⚠️ Sta scritto qui perché *«usiamo il piano gratuito»* è la prima idea che viene
a chiunque guardi il costo — è venuta anche a noi, due volte — e senza il motivo
registrato tornerà una terza. **E vale oltre Google: un piano gratuito si paga in
dati.** La domanda da fare a un fornitore non è quanto costa, è cosa fa con ciò
che gli mandi.

I candidati veri, tutti a pagamento, con il profilo di un messaggio del coach
(~4.000 token in ingresso di cui ~3.000 in cache, ~600 in uscita). ⚠️ **Prezzi
letti il 2026-08-27** dalle pagine ufficiali: sono un'istantanea, non un fatto
stabile.

| | per messaggio | 5 msg/giorno |
|---|---|---|
| gpt-5-nano | ~0,03 ¢ | $0,05 / mese |
| Gemini 3.1 Flash-Lite | ~0,19 ¢ | $0,29 / mese |
| Gemini 3.5 Flash-Lite | ~0,27 ¢ | $0,41 / mese |
| Haiku 4.5 | ~0,43 ¢ | $0,65 / mese |

⚠️ **Due listini in giro sono PROMOZIONALI** — Gemini 3.7/3.6 Flash raddoppiano
il 1° gennaio 2027 — e un prezzo con scadenza non è la base su cui si sceglie un
fornitore. È la stessa forma del difetto dei DEFAULT: *un'affermazione sul mondo*
che smette di essere vera senza che nessuno la riscriva.

**A decidere NON sarà il prezzo**, e vale registrare perché: fra il più economico
e il più caro ballano ~60 centesimi al mese, e con l'ibrido il percorso
predefinito non chiama nessuno. Decideranno due cose misurabili:

- ⚠️ **il tasso di scarto delle guardie.** Segnaposto, divieto di cifre e
  catalogo chiuso sono *istruzioni*, e un modello piccolo le viola più spesso.
  Ogni violazione è un riprova, cioè una seconda chiamata e il doppio
  dell'attesa: il criterio è **costo per risposta buona**, non per chiamata, e a
  queste cifre la differenza la fa l'attesa, non il conto;
- la qualità percepita su domande vere, misurata su qualche caso reale.

⚠️ **I parametri NON sono portabili, e sbagliarli non dà un avviso ma un 400.**
Esempio già mappato, se la scelta cadesse su Haiku 4.5:

| | su Opus 5 | su Haiku 4.5 |
|---|---|---|
| `output_config.effort` | `low`…`max` | **errore** — non si manda |
| `thinking` | adattivo, acceso di default | solo `budget_tokens` |
| messaggi di sistema in conversazione | supportati | **non supportati** |
| `fallbacks` server-side sul rifiuto | disponibili | non disponibili |

Fuori dalla Claude API cambia tutto — nomi dei parametri, forma della risposta,
motivo di terminazione, filtri di sicurezza che possono bloccare una risposta.
⚠️ **La forma dell'API si LEGGE al momento di scriverla, non si ricorda**: vale
la regola della Fase 17b, *una migration che indovina è peggio di una che manca*,
applicata a un SDK invece che a uno schema.

Comune a ogni fornitore, e quindi già deciso: **il thinking si spegne o si tiene
al minimo** (è la voce che domina il costo in uscita, e non serve a scegliere
parole su numeri dati), e **la risposta si guarda prima di leggerla** — un
troncamento, un rifiuto o un blocco di sicurezza non sono una risposta vuota.

##### La chiave

- ⚠️ **La chiave è server-only**, mai `NEXT_PUBLIC_*`, qualunque sia il
  fornitore, e la chiamata vive in una server action come ogni altra operazione
  di questo progetto.
- ⚠️ **Non si controlla in `next.config.ts`**, e va scritto perché — o qualcuno
  la aggiunge lì per simmetria con `NEXT_PUBLIC_SITE_URL`. Quel controllo esiste
  perché le `NEXT_PUBLIC_*` sono sostituite come costanti **in compilazione**,
  quindi un throw applicativo scatterebbe addosso a un utente. Una variabile
  server-side si legge a runtime: la forma giusta è uno stato «coach non
  configurato» leggibile — e con la 24b consegnata, quello stato è **un coach che
  funziona lo stesso**, non una schermata rotta.
- **L'SDK entra solo nella 24c**, e sarà quello ufficiale del fornitore scelto:
  vale la regola di `lib/import/csv.ts` — *una dipendenza si aggiunge quando
  serve, non quando è comoda* — e riscrivere a mano le chiamate HTTP sarebbe
  codice nostro da tenere allineato a un'API che cambia. Fino alla 24c
  `package.json` e `.env.local` **non si toccano**.

##### Il tetto sta nel DATABASE, non nello stato del componente

Con l'ibrido il tetto protegge dall'incidente, non dall'uso normale: il percorso
predefinito non consuma niente. Due fusibili:

- **un tetto di messaggi al giorno per utente**, contato sulle righe;
- **un tetto di turni per conversazione**, oltre il quale si apre una
  conversazione nuova — il contesto cresce a ogni turno, e la compaction del
  server sarebbe una soluzione sproporzionata a un problema che si chiude
  ricominciando.

⚠️ Nel database e non nel client per la ragione già pagata nella Fase 21:
*l'annullamento dell'import viveva nello stato del componente*, e un controllo
che vive quanto una schermata non è un controllo.

⚠️ E i tetti servono **anche** contro il fornitore, non solo contro la bolletta:
i limiti di frequenza esistono su ogni piano, e un 429 va reso come una frase che
dice cosa è successo — non come una bolla vuota.

##### La lingua

⚠️ **Il testo generato è un DATO, non una stringa di interfaccia.** Le risposte
deterministiche della 24b invece **sono** stringhe di interfaccia e stanno nei
dizionari: la stessa bolla contiene le due nature, e la differenza è chi ha
scritto la frase.

È il rovescio esatto di `notifications.payload`: là il database tiene i fatti e
la frase si compone alla lettura, quindi anche lo storico cambia lingua con
l'app. Qui la frase la scrive il modello e i fatti li mette l'app.

Conseguenza: una conversazione **resta nella lingua in cui è nata**.
`coach_conversations.locale` la registra; cambiando lingua non si traduce lo
storico — si apre una conversazione nuova. Tradurre a posteriori significherebbe
una chiamata per ogni messaggio già scritto, per un'azione che nella vita di un
account capita due volte.

#### Le rinunce dichiarate

- ⚠️ **Niente 50/30/20 con percentuali.** `abbonamento` contiene affitto **e**
  Spotify; `spesa` contiene la spesa alimentare **e** il ristorante. Un 50/30/20
  dedotto da questa tassonomia è *un numero sbagliato che sembra giusto*, cioè la
  regola elevata nella 17a. Renderlo onesto richiede una classificazione
  necessario/voluto per categoria — una colonna, una schermata e una decisione di
  schema a sé, da prendere in chiaro e non scivolarci dentro. Il coach parla
  quindi di **Flusso, uscite fisse, disponibile e tasso di risparmio**, che i
  dati sostengono davvero, e cita le metodologie solo in modo qualitativo.
- ⚠️ **Nessun piano gratuito**, per i termini citati sopra e non per prudenza.
- **BYOK scartato per ora**: sposta il costo su ogni utente ma obbliga a
  custodire la chiave di qualcun altro. Ha senso solo il giorno in cui le
  registrazioni si aprono (issue #40), e va deciso allora.
- **Niente consiglio automatico dal job notturno.** La 17b ha già deciso che il
  cron serve per *ciò che accade mentre non guardi*: un consiglio non è un
  evento, e generarlo per chi non apre mai la pagina è spesa senza lettore.
- **Niente streaming** (vedi sopra).
- **Il coach non scrive né modifica nulla**: legge. Un modello che crea
  transazioni o budget è una fase diversa, con una superficie di collaudo
  diversa.

#### L'audit dei consumatori — fatto, e non è una formalità

La fase **non aggiunge un tipo di transazione**, non crea una vista e non somma
niente di nuovo: legge dalle funzioni esistenti. Nessun totale dell'app si muove,
e le due tabelle nuove non hanno alcuna FK verso `transactions`. È l'unica fase
recente in cui l'audit si chiude in una riga — e vale registrarlo, perché è la
conseguenza diretta della scelta di non far calcolare niente al modello.

