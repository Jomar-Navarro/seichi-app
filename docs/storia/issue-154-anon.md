# #154 — anon senza privilegi

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Database — anon senza privilegi (issue #154)

Migration `20260822_revoke_anon.sql`, eseguita il 2026-11-10. Nessuna modifica
al codice. `anon` aveva `arwdDxtm` su tutte e dieci le tabelle di `public` e
`rwU` su `job_runs_id_seq`: il default di Supabase, che le tabelle nuove
ereditavano da sole. Lo proteggeva la sola RLS. Ora una richiesta senza
sessione si ferma al grant, prima della RLS.

- **Scritta interrogando il catalogo** (`pg_class.relacl`, `pg_proc.proacl`,
  `pg_default_acl`). Ha detto che tutto è di `postgres` e che ogni grant ad
  `anon` l'ha concesso `postgres`, quindi dal SQL Editor si revoca tutto. La
  guardia in testa si ferma se non è più vero, o se il file non gira come
  `postgres`: in entrambi i casi un `revoke` darebbe solo un WARNING, e il file
  finirebbe con "Success" lasciando `anon` al suo posto.
- **Cinque funzioni erano eseguibili da `anon`**, tutte per due strade: PUBLIC
  (il default di Postgres) e un grant esplicito arrivato dal default di
  `postgres`. Erano le tre funzioni dei budget, `handle_new_user()` e
  `rls_auto_enable()`. Ora non lo sono più. `authenticated` e `service_role`
  restano con i loro grant espliciti: `budget_period_start` sta nel CHECK di
  `budgets`, e `set_budget()` è `security invoker`.
- ⚠️ **I default si chiudono, o il debito si riforma.** Le tabelle, sequenze e
  funzioni nuove di `public` nascono senza `anon`. In più c'è una riga
  **globale**, la sola possibile, che toglie PUBLIC dalle funzioni nuove create
  da `postgres`: un default per schema può solo aggiungere privilegi.
  Il prezzo: una funzione che `postgres` crea fuori da `public` e `storage`
  nasce eseguibile solo dal proprietario. Se un giorno servisse uno schema
  `private` per le funzioni delle policy, l'`execute` ad `authenticated` va
  concesso a mano. È un errore che si vede subito, contro una funzione
  `security definer` chiamabile con la chiave pubblicabile.
  ⚠️ La convenzione di ogni migration resta (`revoke all on function … from
  public, anon` + `grant execute … to authenticated`): il default è la rete
  sotto, non la regola.
- ⚠️ **I default di `supabase_admin` su `public` concedono ancora tutto ad
  `anon`**, e `postgres` non può toccarli (non ne è membro). Oggi in `public`
  non c'è un solo oggetto di `supabase_admin`. Se la piattaforma ne creasse uno,
  lo direbbero le prove c1 e c2 della controprova in fondo alla `20260822`, che
  si possono rieseguire in qualunque momento.
- ⚠️⚠️ **L'insert dava già `42501` prima della migration**, ma per la RLS
  ("new row violates row-level security policy"). Ora dice "permission denied
  for table". **La prova si fa sul messaggio, non sul codice**: sul solo
  codice, il secondo criterio della issue sarebbe passato anche senza la
  migration.
- **Un trigger scatta anche se chi scrive non ha `execute` sulla sua funzione**:
  Postgres lo controlla quando il trigger si crea. È ciò su cui conta
  `handle_new_user()`, che `supabase_auth_admin` aveva solo tramite PUBLIC.
  Provato due volte: con un trigger di prova (c8) e con una registrazione vera.
- **La diagnostica era sbagliata al primo giro**: `relkind` ha il tipo interno
  `"char"`, e `text || "char"` è un operatore ambiguo (`42725`). Serve
  `relkind::text`.

#### Emerso dalla code review (7 rilievi, 6 applicati)

La prima versione era già girata in produzione, e la review ha trovato tre
modi in cui avrebbe potuto finire con "Success" lasciando `anon` al suo posto.
Sul catalogo di quel giorno non è successo, ma il file deve difendersi da solo.

- ⚠️ **La revoca sulle tabelle nominava solo `anon`**, mentre la guardia
  cercava anche PUBLIC. Un grant a PUBLIC lasciato da una correzione a mano
  passava la guardia (l'aveva concesso `postgres`) e restava. Ora la revoca
  vale per `public, anon`.
- ⚠️ **Le funzioni erano cinque nomi scritti a mano.** La prossima dimenticata
  sarebbe passata, e su un database ricostruito senza `rls_auto_enable()` (che
  nessun file del repo crea) il `revoke` avrebbe dato `42883` e annullato
  l'intero file. Ora è un ciclo sul catalogo, che restituisce ad
  `authenticated` e `service_role` esattamente ciò che avevano prima.
- ⚠️ **Le post-condizioni erano solo nella controprova commentata.** Ora c'è
  una sezione 4 di verifica, ESEGUITA dal file stesso, perché legge il catalogo
  e non crea niente. Una revoca senza effetto diventa un errore, invece di un
  WARNING sotto un "Success". La c9 della controprova inietta un grant e
  pretende che quelle stesse query lo vedano.
- La guardia controlla anche chi ha CONCESSO l'`execute` sulle funzioni, non
  solo il proprietario.
- La c3 pretendeva `USAGE` di `authenticated` su `job_runs_id_seq`, che l'app
  non usa: avrebbe spinto a rimettere un privilegio che non deve esserci.

Non applicato: togliere la riga globale sui default delle funzioni. Il prezzo
è dichiarato, ed è ora anche nelle regole.

La versione corretta è idempotente, ed è stata **rieseguita** lo stesso giorno
perché la verifica della sezione 4 girasse sul database vero: "Success". Poi la
controprova, **c1-c9 verde**, con la c9 che vede il grant iniettato.

Collaudo del 2026-11-10:

- **Controprova SQL c1-c8** tutta verde (c9 aggiunta dopo la review, vedi
  sotto): nessun privilegio di `anon` su
  relazioni e funzioni, `authenticated` intatto, lettura e scrittura come
  `anon` rifiutate dal grant, tabella e funzione nuove senza `anon` (e la RLS
  accesa da `rls_auto_enable()`), il trigger senza `execute`.
- **Sonda REST con la sola chiave pubblicabile**: prima `200 []` su dieci
  tabelle, `204` su PATCH e DELETE, `200` su due funzioni helper dei budget;
  dopo, tutto `401 42501 permission denied`.
- **29/29 in produzione** su un account usa e getta, registrato ed eliminato
  dall'app (il login successivo risponde `invalid_credentials`). Il giro ha
  coperto la registrazione (il `full_name` lo scrive solo il trigger),
  l'onboarding dalle tre pagine, `set_budget`, `budgets_at`, un insert, nove
  pagine, il logout, il login col gate dell'onboarding e la richiesta di
  recupero password.
- **L'OAuth non si prova da un browser headless.** Dal codice: `/callback`
  legge `profiles` dopo `exchangeCodeForSession`, sullo stesso client, quindi
  come `authenticated`.

