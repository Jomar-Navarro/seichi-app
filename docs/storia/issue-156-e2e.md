# #156 — collaudo end-to-end su un Supabase locale

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Collaudo end-to-end (#156, 2026-11-10)

Fino alla #156 ogni fase era collaudata da un driver Playwright scritto nello
scratchpad e poi buttato: le controprove sul codice di prima, la parte più
preziosa di quel lavoro, non si potevano rieseguire. Ora stanno in
`tests/e2e/` (`@playwright/test`) e girano in CI nel job `e2e`.

#### ⚠️ Il database: un Supabase LOCALE, mai la produzione

**Deciso da Jomar il 2026-11-10**, fra tre strade:

| | perché no |
|---|---|
| account usa e getta in produzione (come `collauda-app`) | ogni PR scriverebbe sul database vero, e il giorno in cui la #40 riaccende *Confirm email* la registrazione non dà più una sessione: servirebbe la chiave `service_role` nei segreti di CI |
| un secondo progetto cloud di staging | va allineato a mano a ogni migration, e il piano gratuito lo sospende dopo 7 giorni senza uso |
| **Supabase locale in Docker** ✅ | — |

`supabase start` (la CLI è in devDependencies, **2.122.x**: la 3.0 è una
riscrittura di pochi giorni prima) ricostruisce il database **dalle migration
del repo** e lo butta alla fine. Non tocca la produzione, non ha segreti — le
chiavi del database locale sono quelle pubbliche della CLI — e la configurazione
d'autenticazione è sua (`supabase/config.toml`): la #40 non lo cambia.

```bash
npm run e2e:db       # Docker deve girare. Ricrea lo schema solo se lo stack è spento
npm run e2e:build    # l'app costruita CONTRO il database locale, in .next
npm run test:e2e     # next start -p 3200 + la suite (anche: npx playwright test <file>)
npx supabase stop --no-backup   # spegne e butta il database locale
```

- ⚠️⚠️ **La difesa della produzione è il MARCATORE.** Le NEXT_PUBLIC_* sono
  inlinizzate in compilazione, quindi su quale database scrivono i test lo
  decide la build, non le variabili del momento: una `.next` costruita con
  `.env.local` e servita ai test creerebbe account sul database vero.
  `e2e:build` lascia `.next/e2e-supabase.json`, `next build` svuota `.next`
  all'inizio, e il server dei test lo avvia `e2e.mjs serve`, che si rifiuta se
  il marcatore manca o non punta a `127.0.0.1`. ⚠️ **Nel comando del server,
  non nel `globalSetup`**: Playwright avvia il `webServer` PRIMA del
  `globalSetup` (letto nel sorgente del runner, code review), quindi un
  controllo là arriverebbe a build già servita. Provato togliendo il
  marcatore: la suite si ferma con la frase giusta e la porta resta libera.
  In più ogni chiamata dei test al database passa da `assertLocal()`, e il
  webServer non riusa MAI un server già acceso (sulla 3100 può girare una
  build di produzione di `collauda-app`). Verificato dopo la prima build:
  l'host di produzione non compare in nessun file di `.next`.
  Porta, marcatore e lettura delle chiavi stanno in `scripts/e2e-local.mjs`,
  importato dallo script e dalla suite: un modulo, non due copie.
- ⚠️ `e2e:build` e `npm run build` **si sostituiscono a vicenda** in `.next`:
  dopo un collaudo end-to-end, `audit:tokens` e `collauda-app` vogliono una
  build normale, e viceversa.
- **Le chiavi JWT sono ES256, come in produzione**: `e2e.mjs db` genera
  `supabase/signing_keys.json` (ignorato da git) alla prima esecuzione. Col
  segreto HS256 di default `getClaims()` ripiegherebbe in silenzio su
  `getUser()`, e i test proverebbero un percorso d'autenticazione che la
  produzione non usa. ⚠️ `supabase start` su uno stack già acceso **non
  ricarica la configurazione**: `e2e:db` e il `globalSetup` controllano che il
  JWKS esponga la chiave del file, e ogni account di prova che il suo token
  sia ES256.
- `config.toml` accende solo ciò che l'app usa (niente realtime, edge
  functions, analytics, email locale, S3, vettori) e alza i limiti di accesso
  per IP: i test entrano tutti dallo stesso indirizzo. ⚠️ **Non descrive la produzione**, e l'avvertenza in
  testa al file dice perché non deve mai farlo (sotto).
- **Il primo frutto: la ricostruzione da zero non reggeva.** Mancava `pg_cron`
  (vedi «Ricostruita da zero per davvero» nella sezione della #43).

#### ⚠️⚠️ L'integrazione GitHub di Supabase applica le migration al merge

Scoperto preparando la #156, ed è **precedente**: l'integrazione GitHub del
progetto ha *Deploy to production* acceso, e **a ogni commit su master prova
ad applicare alla produzione tutte le migration** che non trova nella propria
cronologia. Siccome le migration sono sempre state eseguite a mano dal SQL
Editor, la cronologia è vuota, e il tentativo si ferma alla prima istruzione
della `20260727`: «STOP: la 20260813 è già stata eseguita» (il controllo
«Supabase Preview» rosso sui commit di master). **Le guardie hanno fatto
esattamente il loro lavoro.**

- Dal merge della #156 in poi la cartella ha un `config.toml`. Secondo la
  documentazione (letta il 2026-11-10) la produzione riceve solo migration,
  Edge Functions e bucket **dichiarati** in `config.toml`; `[auth]`, `[api]`,
  `[db]` e seed restano fuori finché un blocco `[remotes]` non nomina il
  progetto. Quindi: **mai un `[remotes]` per la produzione**, niente bucket né
  funzioni in `config.toml`.
- ⚠️ **Da decidere con la #157**: allineare la cronologia
  (`supabase migration repair`) farebbe sì che il merge applichi DAVVERO le
  migration nuove, in automatico. Cambierebbe la procedura di rilascio —
  oggi a volte l'ordine è «prima il codice, poi la migration» (#123) — quindi
  prima va scelto se tenere *Deploy to production* acceso.

#### Gli account di prova

Ogni test ne crea uno suo (`account` in `support/fixtures.ts`) e lo elimina
alla fine, anche se fallisce: niente stato condiviso, quindi i test girano in
parallelo e in qualunque ordine. L'utente nasce dall'API admin del database
locale, **già confermato**; tutto il resto lo scrive col PROPRIO token, sotto
RLS, come l'app. Indirizzi `@e2e.seichi.test` (un dominio riservato, mai
consegnabile); `global-teardown.ts` elimina quelli di un test interrotto e
fallisce se qualcuno resta. La registrazione dal form vero la prova il suo
scenario.

#### Gli scenari, e la controprova di ciascuno

Ogni scenario custodisce un difetto che c'è stato davvero, e i numeri sono
scelti perché ogni formula sbagliata dia un valore diverso. **Controprova del
2026-11-10**: ogni difetto reintrodotto nel codice dell'app, due build da sei
mutazioni scelte in modo che non si tocchino: in ciascuna **esattamente** i sei
scenari mutati diventano rossi, per la ragione prevista, e gli altri sei
restano verdi.

| scenario | difetto (fase) | mutazione → esito |
|---|---|---|
| registrazione, abbandono dopo le preferenze | primo conto creato a `/category` (20a) | niente `ensureFirstAccount` in `savePreferences` → «Serve un conto…» |
| onboarding completato una seconda volta | `saveCategories` cancellava tutto (#116) | cancellare prima di inserire → movimenti 2 → 0 |
| home e /analisi, con e senza conto | /analisi sottraeva risparmi e investimenti (20a) | `sommaUscite` su ogni tipo ≠ entrata → 1020 invece di 1620 |
| trasferimento dal form | segno dal tipo prima che dalla destinazione (20b) | ordine invertito in `amountSign` → niente «+ € 100,00» sul conto di arrivo |
| il nuovo movimento propone il conto guardato | primo conto attivo sempre (#112) | ignorare `viewedAccountId` → «Conto principale» invece di Revolut |
| «indietro» nel wizard | il form si smontava (#122) | montarlo solo al passo «form» → «Seleziona categoria» |
| ricerca con lo spazio finale | ago non ripulito (#122) | niente `trim()` → nessun risultato |
| export di un conto riletto da `parseCsv()` | Tipo da `t.typesSingular` (23a) | → «Spesa» e id minuscoli nella colonna |
| velo del PIN senza il cookie | il client decideva dal solo cookie (#125) | `isPinEnabledOnClient` sul solo cookie → nessun velo |
| import Trade Republic, vendite su ETF | categoria confrontata col tipo nudo (#118) | `type !== d.target` → l'import fallisce |
| `@desktop` separatori delle impostazioni | classe incollata a `${` (#114) | → colore del testo, `rgb(51, 55, 61)` |
| `@firefox` bordi traslucidi arrotondati | bordo vero sul vetro (#81) | `border border-subtle` sulla card di `SettingsGroup` → 9 elementi |

- Tre progetti: `telefono` (414×896, tutto ciò che non ha un'etichetta),
  `desktop` (1440×900, `@desktop`) e `firefox` (1024×768, `@firefox`).
  ⚠️ Il controllo della #81 legge lo **stile calcolato**, quindi trova la causa
  in qualunque motore; gira in Firefox perché è lì che il difetto si vede, e lo
  scatto di un fallimento lo mostra. Unica eccezione dichiarata: il riquadro
  tratteggiato dell'import.
- `?conto=` esplicito ovunque conti il conto: con la memoria in cookie «aprire
  la home» non è uno stato determinato (20b, #148).
- Un'eccezione non gestita nella pagina fa fallire il test anche se ogni
  asserzione è verde (`pageErrors`, automatica).
- **Niente tentativi ripetuti** (`retries: 0`): un test che passa al secondo
  giro è un difetto di tempi nascosto. Il limite è 90 s per test perché il
  primo giro, con otto browser su un `next start` appena acceso, ha toccato i
  50 su un portatile.

#### Trappole trovate scrivendo la suite

- **Lo splash si dissolve nell'OPACITÀ e resta nel DOM** (trasparente,
  `pointer-events-none`): aspettare `visibility: hidden` non finisce mai.
- **Il tastierino del PIN scarta la stessa cifra ripetuta entro 80 ms**
  (il duplicato del tocco, 26a), e Playwright tocca più in fretta di un dito:
  «000000» registra una cifra sola. I PIN dei test hanno cifre tutte diverse,
  e dopo un PIN sbagliato si aspetta che l'errore sparisca (~900 ms durante i
  quali il tastierino non accetta cifre).
- **Il passo dell'importo legge la tastiera fisica** (28d): `keyboard.type()`
  è più semplice e più vero dei tasti a schermo.
- Il bottone «indietro» del modale **non ha un nome accessibile** (si trova
  dall'icona `lucide-chevron-left`): materia della #165.
- **`use` come parametro di una fixture** fa scattare `rules-of-hooks` di
  React: nelle fixture si chiama `provide`.
- **Un'assenza è vera anche un istante prima**: «nessun messaggio d'errore»
  dopo «Importa» passava prima che l'errore arrivasse. Si aspetta la schermata
  finale, non l'assenza dell'errore.

#### Emerso dalla code review (10 rilievi, 9 applicati)

- ⚠️⚠️ **Il marcatore si controllava DOPO l'avvio del server** (vedi sopra):
  la difesa principale della suite era nel posto sbagliato, e lo diceva un
  commento che descriveva un ordine che Playwright non ha.
- ⚠️ **Uno stack già acceso tiene la configurazione vecchia**: la chiave ES256
  scritta dopo l'avvio non arrivava ad Auth, e niente se ne accorgeva. Ora lo
  controllano tre punti (vedi sopra).
- ⚠️ **Il rilevatore della #81 leggeva l'opacità solo da `rgba()`**: un
  `color-mix()` o una classe come `border-subtle/50` diventano `oklab(… / a)`,
  e passavano per opachi. E guardava due angoli su quattro.
- **L'utente si eliminava a pagina ancora aperta**: una richiesta in volo
  poteva sollevare un errore e far fallire per `pageErrors` un test verde. Ora
  la pagina va su `about:blank` prima (`leave()`); lo scatto di un fallimento
  è già stato preso, Playwright lo fa appena finisce il corpo del test.
- L'elenco degli utenti si fermava alla prima pagina «corta»: ora alla prima
  VUOTA. La pulizia dell'onboarding trova il suo utente con un login, non
  sfogliando tutti gli utenti.
- Porta, marcatore e lettura di `supabase status` erano scritti due volte.
- Con lo stack spento il caricamento della configurazione falliva con un
  errore muto: ora dice di avviarlo.
- Email locale, S3 e vettori accesi per niente.

Non applicato: la cache dei browser di Playwright in CI. Il job dura tre
minuti e mezzo, e `--with-deps` installa comunque i pacchetti di sistema.

#### Cosa resta fuori

Ciò che dipende dal dispositivo (Face ID vero, la stampa, lo splash nativo di
iOS, *Riduci movimento* vero), l'OAuth, e ciò che è proprio della produzione
(SMTP, *Confirm email* acceso): restano al telefono e allo skill
`collauda-app`.

Il job `e2e` è fra i controlli richiesti da `master` dal 2026-11-10, insieme
a `verifica` (deciso con Jomar, dopo il merge della #192). La regola del ramo
non vale per gli amministratori: se il job si rompe per una causa esterna — il
registro delle immagini Docker giù, per esempio — il merge resta possibile a
mano. Una PR aperta prima di quel giorno non ha il controllo e va aggiornata
sulla `master`.

