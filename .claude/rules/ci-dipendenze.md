---
paths:
  - "package.json"
  - "package-lock.json"
  - ".github/**"
  - "eslint.config.mjs"
  - "scripts/audit-eslint-rules.mjs"
---

# Dipendenze e CI

Storia: `docs/storia/issue-151-dipendenze`, `issue-152-ci`,
`issue-155-test-unitari`, `issue-156-e2e`.

1. **Una dipendenza si aggiunge quando serve.** Si installa una versione uscita
   da qualche giorno, e la fissa il lock. Le maggiori arrivano da Dependabot una
   per volta, e si PROVANO su un ramo: non si giudicano dal numero di versione.
2. **`allowScripts` approva versioni esatte.**
   - Un aggiornamento con uno script d'installazione nuovo si legge, poi si
     approva con `npm approve-scripts <pkg>`.
   - Le voci dei pacchetti spariti si tolgono a mano.
   - La CI fallisce sulla frase `not yet covered by allowScripts`: il prefisso
     dell'avviso cambia fra le versioni di npm.
3. **`overrides["@serwist/turbopack"].zod`** forza la patch di `zod` solo nel ramo
   di Serwist; si toglie quando Serwist la porta da sé (`npm ls zod`). Gli avvisi
   moderati di `glob` e `minimatch` sono accettati: arrivano da `@serwist/build`,
   da ESLint 10 e da typescript-eslint, e girano solo in build e nel lint, sui
   nostri file.
4. **ESLint 10 convive con plugin che dichiarano fino al 9.**
   - Sei regole vanno in crash (`import/order` e cinque di spaziatura JSX di
     react) e non vanno accese.
   - `npm run audit:eslint-rules` è la sentinella che le regole campione
     scattino ancora: quando cambia il preset di `eslint-config-next`, rileggi
     `EXPECTED`.
   - `strict-peer-deps` resta spento.
5. **TypeScript resta sotto la 6.1** finché typescript-eslint non la supporta
   (regola `ignore` in `dependabot.yml`). La 6.0 è adottata (#186, 2026-11-10).
6. **Node viene da `engines.node`** (24.x), letto da CI e Vercel. `@types/node`
   segue la stessa maggiore, alzata a mano.
7. **`npm audit --audit-level=high` gira sull'intero albero**: esbuild, Tailwind
   e Serwist girano in build anche su Vercel.
8. **I job `verifica` ed `e2e` sono richiesti dalla protezione di `master`**:
   rinominarli vuol dire aggiornare la regola. Le `NEXT_PUBLIC_*` della CI sono
   fittizie, quindi la sua build non è pubblicabile.
