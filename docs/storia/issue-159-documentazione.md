# #159 — documentazione: CLAUDE.md snello, la storia in docs/, un README vero

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Com'è andata (2026-11-17)

La issue, aperta il 2026-11-07, chiedeva tre cose: CLAUDE.md sotto le 600
righe senza perdere una regola, un README utilizzabile da zero, l'ordine delle
fasi allineato allo stato vero.

**CLAUDE.md l'ha già fatto la #193** (2026-11-10), per una strada un po'
diversa dalla proposta: da 573.296 a 23.115 caratteri, con la memoria in tre
livelli — il nucleo in CLAUDE.md, le regole per area in `.claude/rules/`
(caricate aprendo un file dell'area), la storia in `docs/storia/`. Uno script
ha verificato che ognuna delle 9.079 righe dell'originale stesse in uno e un
solo file, nell'ordine originale.

- La storia sta in `docs/storia/`, non in `docs/fasi/`: contiene anche le
  issue, non solo le fasi.
- Le lezioni trasversali sono la sezione «Lezioni di metodo» di CLAUDE.md, non
  un `docs/lezioni.md`: si caricano in ogni sessione, che è il punto.
- L'ordine delle fasi è la sezione «Stato» di CLAUDE.md, con la sua data; il
  vecchio Implementation Order sta in `docs/storia/ordine-delle-fasi.md`.

**Il README** era ancora quello di `create-next-app`. Ora dice cos'è Seichi,
cosa serve, come si avvia, come si prepara un progetto Supabase da zero
(migration con `db push`, URL di Auth, chiavi ES256, provider OAuth), i
comandi, il collaudo e il deploy. Le regole non le ripete: rimanda a
CLAUDE.md, `.claude/rules/` e `docs/storia/`, perché due copie divergono.

- Ogni affermazione è stata letta nel codice, non ricordata: le variabili
  d'ambiente da `process.env` e `next.config.ts`, gli indirizzi di ritorno da
  ogni `redirectTo`, i comandi della CI da `ci.yml`, la sintassi di `link`
  dalla CLI installata.
- ⚠️ Rilette, due frasi della prima stesura erano false: «il loro indirizzo di
  ritorno è `/callback`» per Google e Facebook (nella loro console va quello di
  Supabase, `…/auth/v1/callback`), e un invito a provare l'app sul database
  locale, mai provato. Corrette prima della PR.
- `.env.local` contiene anche `NEXT_PUBLIC_ANON_KEY`, che il codice non legge
  più (la chiave pubblicabile l'ha sostituita), e `SUPABASE_DB_URL`, che non è
  dell'app. Il README elenca solo le tre che servono.

**Una frase stantia trovata per strada**: l'intestazione di
`supabase/config.toml` diceva l'integrazione GitHub con *Deploy to production*
acceso, scritto il 2026-11-10; la #157 l'ha spento. Ora dice spento, e perché
le regole del file valgono lo stesso: basta riaccenderlo.
