# #155 — test unitari

> Storia del progetto, spostata da `CLAUDE.md` il 2026-11-10 senza cambiare una parola.
> Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Test unitari (#155, 2026-11-10)

Fino alla #155 il repo non aveva un solo test: i casi si scrivevano a mano a
ogni collaudo e sparivano con lo scratchpad. Ora `npm test` (Vitest) verifica
le funzioni pure di `lib/` dove un errore cambia un numero in silenzio. Gira in
CI dopo il lint.

- **Accanto al modulo** (`lib/amount.test.ts`), solo funzioni pure: niente
  Supabase, niente DOM. Quello che passa dalla rete resta allo skill
  `collauda-app`. Per «oggi» si usa `vi.useFakeTimers({ toFake: ["Date"] })`.
- **Installata la 5.0.5 di Vitest**, perché la 5.1.0 era uscita da due giorni:
  la fissa il lock, e le versioni successive arrivano da Dependabot come per
  ogni altra dipendenza. Nessuno script d'installazione da approvare; Vite 8
  arriva come dipendenza di Vitest.
- ⚠️ **Il fuso è fissato** a `Europe/Rome` in `vitest.config.mts`, prima che
  partano i processi dei test. Metà di `lib/` ragiona in ora locale, e i casi
  che contano (il cambio dell'ora, la mezzanotte del primo del mese) esistono
  solo in un fuso che li ha. **Provato togliendo la riga, in UTC (il fuso della
  CI): cade solo il controllo del fuso in `lib/dates.test.ts`, e gli altri
  test sulle date passano senza aver attraversato niente.** È esattamente il
  motivo per cui quel controllo c'è.
- L'alias `@/` è una regex (`/^@\//`): la chiave `"@"` avrebbe preso anche
  `@supabase/…`.
- I test e la configurazione sono esclusi dalla scansione di Tailwind
  (`@source not` in `globals.css`): sono pieni di stringhe d'esempio, e la
  regola della #114 vale anche per loro.

Cosa copre (12 file, 421 test): importi scritti a mano e tastierino (#119,
159 casi: i 131 di allora sono stati ricostruiti dalla specifica); il lettore
CSV, i profili Trade Republic e generico, la chiave di deduplica (#118);
date e confini di periodo (#121); prima esecuzione e ripresa delle ricorrenti
(#117), confrontate col `+ interval` del job SQL; totali; segno per conto
(20b); revisione della pagina offline (#127); l'export CSV e il giro completo
con il lettore dell'import (23a); `fill`, `plural`, `Intl`; la parità dei
dizionari.

#### I due difetti che i test hanno trovato

Entrambi in `lib/import/csv.ts`, il lettore dell'import, e corretti nella
stessa PR:

- ⚠️⚠️ **`parseAmount("0,125")` dava 125.** Una virgola sola seguita da tre
  cifre vale migliaia, anche con uno zero davanti: un fattore mille, muto.
  `lib/amount.ts` aveva già l'eccezione «nessuno scrive zero mila» dalla #119;
  qui mancava. È di nuovo la «migrazione a campione» della Fase 18, una regola
  corretta in uno dei due parser e non nell'altro. Ora la regola sta in
  `lib/thousands.ts` (`couldBeThousandsGroup`), usata da entrambi (code
  review): per il resto i due parser divergono di proposito, su questa no.
  ⚠️ La correzione cambia la chiave di deduplica delle righe generiche con un
  importo così: un file già importato col difetto, reimportato, scriverebbe
  una seconda riga accanto a quella sbagliata invece di riconoscerla.
  **Verificato sul database il 2026-11-10: zero righe con chiave
  `generico:%`**, quindi nessun import da riallineare.
- ⚠️ **`parseDate("31/02/2026")` dava `2026-02-31`.** Si controllava il mese
  ma non il giorno, e Postgres rifiutava la data dentro `import_transactions()`,
  facendo fallire l'**intero** lotto. Ora la riga finisce fra le illeggibili,
  come ogni data che non si capisce (`isISODate`).

#### La parità dei dizionari

`en.ts: Dictionary` fa già fallire la build su una chiave mancante. Il test
copre le due cose che compilano: un **segnaposto** perso in una lingua (`fill()`
lascia `{n}` dov'è) e una traduzione **dimenticata**. Le foglie identiche nelle
due lingue sono ammesse solo se elencate in `SAME_IN_BOTH`, una per una: oggi
29, tutte nomi, sigle o parole che l'italiano usa così com'è (Fase 19 ne
contava 26; poi sono arrivate «Coach», «Report» e «Cloud gaming»). Una nuova
uguale fa fallire il test e va decisa lì: tradotta, o aggiunta all'elenco.

#### Controprova, e due test che a sbagliare erano miei

- **23 mutazioni, una per regola**, ciascuna un difetto vero o storico:
  `parseAmount("1.250") === 1.25`, il netto Trade Republic senza commissioni,
  il segno con il tipo prima della destinazione, la prima esecuzione a oggi,
  l'export senza BOM e senza difesa dalle formule, un segnaposto perso… Tutte
  e 23 fanno fallire almeno un test. ⚠️ Al primo giro sei non erano partite, e
  non andavano contate come verdi: la shell aveva dimezzato le barre
  rovesciate dell'heredoc (`\\-` → `-`) e la ricerca su più righe non teneva
  conto degli a capo CRLF. Lo script va scritto con l'editor, non in un
  heredoc.
- Due rossi del primo giro erano **aspettative sbagliate**, non difetti:
  - in italiano `Intl` non raggruppa sotto le cinque cifre (CLDR,
    `minimumGroupingDigits: 2`): l'app scrive davvero «€ 1234,50»;
  - «l’altro ieri» ha l'apostrofo tipografico (U+2019).

  Un rosso va diagnosticato prima di correggere: due volte aveva torto il
  codice (i difetti qui sopra), due volte il test.

