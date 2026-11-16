---
paths:
  - "tests/**"
  - "**/*.test.ts"
  - "playwright.config.ts"
  - "vitest.config.mts"
  - "scripts/e2e*.mjs"
  - "supabase/config.toml"
  - "supabase/tests/**"
  - "scripts/db-types.mjs"
  - ".claude/skills/collauda-app/**"
---

# Test e collaudo

Storia: `docs/storia/issue-155-test-unitari`, `issue-156-e2e`,
`issue-157-supabase-cli`. Le trappole dei driver Playwright stanno in
`.claude/skills/collauda-app/metodo.md`.

## Test unitari (Vitest)

1. **Accanto al modulo** (`lib/x.test.ts`), e solo funzioni pure: niente
   Supabase, niente DOM. Ciò che passa dalla rete resta all'end-to-end.
2. **Il fuso è `Europe/Rome`** (`vitest.config.mts`): i casi che contano (il
   cambio dell'ora, la mezzanotte del primo del mese) esistono solo in un fuso
   che li ha. Un test controlla che il fuso sia davvero quello.
3. **«Oggi» si fissa con `vi.useFakeTimers({ toFake: ["Date"] })`.**
4. **Ogni regola ha una mutazione che la fa fallire.** Uno script di mutazione si
   scrive con l'editor, non in un heredoc: la shell mangia le barre rovesciate.
5. **Un rosso si diagnostica prima di correggere**: due volte aveva torto il
   codice, due volte il test.

## Prove del database (pgTAP)

`supabase/tests/*.test.sql`, `npx supabase test db` a database locale acceso;
in CI dopo `e2e:db`. Ogni file è `begin; … select plan(n); … finish();
rollback;`: niente resta, e la suite end-to-end trova il database com'era.

1. **Utenti e dati li crea il test** (`insert into auth.users`, indirizzi
   `@pgtap.seichi.test`, uuid fissi e leggibili). Perché: la prova che richiede
   un secondo utente non dice più «SALTATA».
2. **Un rifiuto si prova con codice E messaggio esatto** (`throws_ok(sql,
   '23514', 'new row … "nome_del_vincolo"', …)`): un insert sbagliato fallisce
   per un altro motivo e non deve passare per il vincolo cercato.
3. **Ogni rifiuto ha un gemello che passa** (`lives_ok`), ogni «non succede» un
   gemello in cui succede. Senza, una tabella che rifiuta tutto è verde.
4. **Le prove che misurano un numero hanno dati propri**, che nessun rifiuto
   tocca: un rifiuto rotto lascia la sua riga, e su dati condivisi farebbe
   cadere anche il numero, attribuendo il guasto alla causa sbagliata (#157).
5. **Il ruolo si cambia dentro la stringa di `throws_ok`/`lives_ok`**, con un
   `reset role` dopo: se l'istruzione riesce, il `set local role` resta.
6. **Controprova con mutazioni dichiarate**: si scrive prima quali prove devono
   cadere, si applica il difetto al database locale, e devono cadere quelle e
   nessun'altra. Poi `npx supabase stop --no-backup` e `npm run e2e:db`: il
   database si ricostruisce da zero (uno stack riavviato riparte dal backup).

## End-to-end (Playwright)

1. ⚠️ **Mai contro la produzione.** La suite gira su un Supabase locale in Docker.
   - La difesa è il marcatore `.next/e2e-supabase.json`: lo lascia `e2e:build`,
     e lo pretende `e2e.mjs serve` prima di avviare il server.
   - Il controllo sta nel comando del server, non nel `globalSetup`: Playwright
     avvia il `webServer` prima del `globalSetup`.
   - Ogni chiamata dei test al database passa da `assertLocal()`, e il server
     non si riusa mai.
2. **`e2e:build` e `npm run build` si sostituiscono in `.next`**: dopo l'una,
   l'altra va rifatta.
3. **`supabase/config.toml` descrive solo il database locale**: mai `[remotes]`,
   bucket o funzioni (vedi `database.md`).
   - Le chiavi JWT locali sono ES256 come in produzione (`signing_keys.json`,
     ignorato da git).
   - `major_version` segue la produzione (Postgres 17): se Supabase la porta a
     una maggiore nuova, si alza insieme.
   - Uno stack già acceso non ricarica la configurazione.
   - Non dare a una variabile di `.env.local` un nome `SUPABASE_*` che sia una
     chiave della configurazione (`SUPABASE_AUTH_SITE_URL`…). Perché: la CLI v3
     legge `.env.local` e quei nomi vincono su `config.toml`. `SUPABASE_DB_URL`
     non lo è: misurato, i comandi restano su `Target: local stack` (storia:
     `issue-151-dipendenze`, CLI 3.0.0).
4. **Ogni test crea il suo account e lo elimina alla fine, anche se fallisce**
   (fixture `account`, indirizzi `@e2e.seichi.test`). Nessuno stato condiviso.
   L'utente nasce dall'API admin locale; i dati si scrivono col suo token, sotto
   RLS.
5. **Ogni scenario custodisce un difetto storico**, con numeri scelti perché ogni
   formula sbagliata dia un valore diverso. Ha la sua controprova: reintrodotto
   il difetto, deve diventare rosso per la ragione prevista.
6. **Impostazioni fisse della suite**:
   - `?conto=` esplicito dove conta il conto;
   - `retries: 0`: un test che passa al secondo giro nasconde un difetto di
     tempi;
   - un'eccezione non gestita nella pagina fa fallire il test (`pageErrors`).
7. **Trappole note**:
   - lo splash si dissolve nell'opacità e resta nel DOM;
   - il tastierino del PIN scarta la stessa cifra entro 80 ms: usa PIN di cifre
     diverse;
   - il passo dell'importo legge la tastiera fisica;
   - un'assenza è vera anche un istante prima: aspetta la schermata finale;
   - nelle fixture il parametro si chiama `provide`, non `use`;
   - dopo un aggiornamento di Playwright, `npx playwright install chromium
     firefox` (la CI aggiunge `--with-deps`, che porta le librerie di sistema
     di Linux): senza, ogni test cade su `Executable doesn't exist` prima di
     aprire una pagina, e il rosso non dice niente dell'app.

## Collaudo nell'app vera

1. **Lo skill `collauda-app`**, con un account usa e getta: `setup.mjs`, poi il
   driver, poi `teardown.mjs`, sempre. Mai chiedere cookie o password a Jomar.
2. **Le controprove di CSS e di build si fanno su `next start`** (porta 3100),
   mai sul dev server.
