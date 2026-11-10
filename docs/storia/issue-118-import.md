# #118 — import: vendite con categoria, deduplica per conto

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Import — le vendite con categoria, e la deduplica che ignorava il conto (issue #118)

Dalla review completa del 2026-09-28 (#128). Migration
`20260820_import_key_account.sql`, **da eseguire due volte: prima e dopo il
deploy** (vedi sotto).

- ⚠️ **Scegliere "ETF" per il gruppo vendite faceva fallire l'intero import.**
  Il client mostrava correttamente le categorie `categoryTypeFor("disinvestimento")`,
  cioè quelle degli investimenti (#52); `buildRow` sul server confrontava invece
  col tipo nudo, `"investimento" !== "disinvestimento"`. L'unico modo di
  importare le vendite era senza categoria — cioè senza compensare la posizione
  su `/investimenti`, che è l'intero scopo della #52. **Era il chiamante
  dimenticato della "migrazione a campione" già registrata per `categoryTypeFor()`
  nella #9**, e il più costoso dei quattro: la validazione del server.
- ⚠️ **La chiave del profilo generico non conteneva il conto.**
  `generico:<data>|<importo>|<descrizione>#n` descrive una RIGA, non un evento:
  due conti della stessa banca hanno righe identiche (il bollo, il canone), e il
  secondo estratto veniva saltato e contato fra i "già presenti" mentre su quel
  conto non c'era. Ora `importKeyFor()` (`lib/import/index.ts`) scrive
  `generico:<conto del file>:…`. **Trade Republic resta senza conto, ed è
  deliberato**: la sua chiave è l'id del movimento nel file, un evento che
  appartiene a un conto solo — legarla al conto permetterebbe di importare lo
  stesso estratto su due conti, cioè di contare due volte lo stesso denaro.
- ⚠️ **Il conto della chiave è quello del FILE** (`imports.account_id`), non
  `transactions.account_id`: su un trasferimento in entrata l'origine della riga
  è l'altro conto (modello a una riga della 20b).
- **La migration riscrive le chiavi generiche già scritte**, o reimportare uno
  di quei file sullo stesso conto duplicherebbe tutto. ⚠️ **Due esecuzioni**,
  trovato dal code-review: solo dopo il deploy, un reimport nel frattempo
  duplica; solo prima, un import del codice vecchio nel frattempo scrive chiavi
  che lo script non ha visto. Rieseguirla è un no-op, e `not exists` lascia al
  loro posto i doppioni veri invece di far fallire lo script sul vincolo unico.

Collaudo del 2026-09-29 nell'app vera, su un account di prova usa e getta
(eliminato alla fine): 11 controlli su 11. Un estratto Trade Republic sintetico
(un acquisto da 500 + 1 di commissione, una vendita da 200 − 1) si importa con
ETF su entrambi i gruppi, e `/investimenti` mostra **€ 302,00** di capitale
versato; lo stesso CSV del bollo entra su due conti con due chiavi diverse; il
reimport sullo stesso conto non scrive niente. **Controprova** con `actions.ts`
di `master`: "La categoria non corrisponde al tipo scelto", e il bollo sul
secondo conto finisce fra i "già presenti".

**Verificato sul database il 2026-09-29: zero chiavi generiche nel formato
vecchio** — nessun import generico è mai stato fatto, solo estratti Trade
Republic. La migration è quindi un no-op sui dati di oggi, e delle due finestre
ne resta una sola: un import generico fatto dal codice vecchio prima del deploy.
Basta eseguirla una volta DOPO il deploy; prima non serve, ma non fa danni.

