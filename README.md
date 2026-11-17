# Seichi (整地)

App di budgeting personale: movimenti, conti, budget, obiettivi di risparmio,
investimenti, import ed export. È una PWA installabile, in italiano e in inglese,
con tema chiaro e scuro.

In produzione su <https://seichi-app.vercel.app>. Le registrazioni non sono
ancora aperte al pubblico (#40).

**Stack**: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4,
Supabase (Postgres, Auth, Storage), Zustand, Recharts, Serwist per la PWA.
Deploy su Vercel.

## Requisiti

- **Node 24.x**: la versione la fissa `engines.node` in `package.json`, la
  stessa per locale, CI e Vercel.
- **Docker Desktop**, solo per il database locale dei test.
- **Un progetto Supabase** su cui far girare l'app. La CLI di Supabase non va
  installata a parte: è una dipendenza di sviluppo (`npx supabase …`).

## Avvio in locale

```bash
git clone https://github.com/Jomar-Navarro/seichi-app.git
cd seichi-app
npm install
```

Crea `.env.local` nella radice:

| variabile | cosa contiene |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | l'URL del progetto Supabase (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la chiave pubblicabile (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL` | l'indirizzo dell'app, base dei link nelle email: `http://localhost:3000` in sviluppo |

Senza `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SITE_URL` né `dev` né `build`
partono, con un errore che dice quale manca (`next.config.ts`). Le
`NEXT_PUBLIC_*` sono scritte nel codice al momento della build: cambiarle vuol
dire ricompilare.

```bash
npm run dev    # http://localhost:3000
```

L'app legge e scrive i dati del progetto di `.env.local`. Per provare senza
toccare dati veri serve un progetto Supabase di prova: il database locale in
Docker è pensato per i test (vedi «Collaudo»).

## Il progetto Supabase

Su un progetto nuovo:

1. **Lo schema** viene tutto dalle migration di `supabase/migrations/`,
   comprese le policy RLS, i bucket `avatars` e `receipts` e il job notturno di
   `pg_cron`:

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push --remote --dry-run   # elenca cosa applicherebbe
   npx supabase db push --remote
   ```

   Si applicano in ordine di nome, e ogni file aggiunge il suo numero alla
   cronologia del progetto. Mai dal SQL Editor: la cronologia resterebbe
   indietro. La procedura completa sta in `.claude/rules/rilascio.md`.

2. **Auth → URL Configuration**: *Site URL* uguale a `NEXT_PUBLIC_SITE_URL`, e
   fra i *Redirect URLs* `<SITE_URL>/callback` e `<SITE_URL>/email-confermata`.
   Senza, i link di conferma, di recupero password e di cambio email tornano
   sulla home invece che sulla pagina che li gestisce.

3. **Chiavi JWT asimmetriche (ES256)**. L'app verifica la sessione in locale
   con `getClaims()`; con un segreto HS256 ripiega in silenzio su una chiamata
   di rete a ogni richiesta (`docs/storia/costo-richieste-supabase.md`).

4. **Accesso con Google e Facebook**, facoltativo: si abilitano i due provider
   in *Auth → Providers*. Nella console di Google e di Facebook l'indirizzo di
   ritorno da registrare è quello di Supabase che il pannello mostra accanto al
   provider (`https://<ref>.supabase.co/auth/v1/callback`); da lì Supabase
   rimanda all'app su `/callback`, già fra i *Redirect URLs* del punto 2.

5. **L'integrazione GitHub** di Supabase, se la colleghi, tiene *Deploy to
   production* spento: le migration le applica `db push`, nell'ordine rispetto
   al deploy del codice che la PR dichiara.

## Comandi

```bash
npm run dev                 # dev server sulla 3000
npm run build               # build di produzione
npm run lint                # eslint
npm test                    # Vitest: le funzioni pure di lib/
npm run db:types            # rigenera types/database.ts dal database locale

# collaudo end-to-end, su un Supabase LOCALE in Docker
npm run e2e:db              # avvia il database locale e applica le migration
npx supabase test db        # le prove pgTAP di supabase/tests/
npm run e2e:build           # costruisce l'app contro il database locale
npm run test:e2e            # la suite Playwright

# audit
npm run audit:eslint-rules  # le regole di eslint scattano ancora
npm run audit:tokens        # token e classi di colore (il controllo B vuole una build)
npm run audit:pwa-cache     # cosa mette in cache il service worker (vuole una build)
```

## Collaudo

- **Test unitari** (`npm test`): le funzioni pure di `lib/`, accanto ai moduli
  (`lib/x.test.ts`).
- **Prove del database** (`npx supabase test db`): vincoli, privilegi e RLS, in
  `supabase/tests/`. Ogni file crea i suoi utenti e si annulla alla fine.
- **End-to-end** (Playwright, `tests/e2e/`): ogni scenario custodisce un difetto
  già successo. Gira su un Supabase locale in Docker, **mai sulla produzione**:
  il server dei test parte solo se trova il marcatore lasciato da `e2e:build`.

  La prima volta:

  ```bash
  npx playwright install chromium firefox
  npm run e2e:db        # genera anche la chiave ES256 locale (supabase/signing_keys.json)
  npm run e2e:build
  npm run test:e2e
  ```

  `e2e:build` e `npm run build` scrivono entrambi in `.next`: dopo l'uno, l'altro
  va rifatto. Per spegnere il database locale: `npx supabase stop --no-backup`.

La CI (`.github/workflows/ci.yml`) esegue tutto questo su ogni PR e su `master`,
più `npm audit --audit-level=high`.

## Deploy

- **Il codice** va su Vercel a ogni merge su `master`. Le funzioni girano a
  `dub1` (`vercel.json`), accanto al database (`eu-west-1`). Su Vercel servono
  le stesse tre variabili di `.env.local`, con `NEXT_PUBLIC_SITE_URL` uguale
  all'indirizzo pubblico.
- **Le migration** si rilasciano a parte, con `db push`: la PR dice se vanno
  prima o dopo il deploy del codice (`.claude/rules/rilascio.md`).

## Struttura

```
app/                 le pagine (App Router): (auth), (onboarding), (main)
components/UI/       componenti generici
components/features/ componenti con logica
lib/                 meccanica senza testo: auth, totali, date, importi, import/export, i18n
store/               stato dell'interfaccia (Zustand)
supabase/            migration, prove pgTAP, configurazione del database LOCALE
types/               database.ts (generato) e i tipi dell'app
tests/e2e/           scenari Playwright
scripts/             audit, e2e, generatori di icone e splash
docs/storia/         la storia di ogni fase e issue
```

## Dove sta il resto

- **`CLAUDE.md`**: le regole che valgono ovunque, il glossario (una parola, un
  significato), lo schema del database e lo stato del progetto.
- **`.claude/rules/`**: le regole di dettaglio per area (database, stili,
  accesso, test…), ognuna col suo perché.
- **`docs/storia/`**: decisioni, alternative scartate e difetti di ogni fase.
  Prima di cambiare un'area si legge la sua storia: l'indice è in `CLAUDE.md`.
- **La board** del progetto su GitHub: cosa resta da fare.
