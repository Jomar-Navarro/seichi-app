/**
 * I tipi del database generati dallo schema vero (#157), non scritti a mano.
 *
 *   node scripts/db-types.mjs          rigenera `types/database.ts`
 *   node scripts/db-types.mjs --check  fallisce se il file nel repo è vecchio
 *
 * La fonte è il Supabase LOCALE (`npm run e2e:db`), che la CLI ricostruisce
 * dalle migration: i tipi descrivono ciò che il repo dice del database. Che il
 * repo dica il vero sulla produzione lo controlla `supabase db diff --remote`
 * (vedi `docs/storia/issue-157-supabase-cli.md`).
 *
 * Perché esiste: fino alla #157 i tipi di `types/index.ts` erano scritti a
 * mano, ed è la classe di difetto pagata con la #43 — colonne descritte come
 * `text` dove erano `character varying(n)`, default che nessun file conosceva.
 * Con `--check` in CI una migration che cambia lo schema senza rigenerare i
 * tipi ferma la PR.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = "types/database.ts";
const CHECK = process.argv.includes("--check");

const HEADER = `/**
 * ⚠️ GENERATO da \`npm run db:types\` — non modificare a mano (#157).
 *
 * Lo schema \`public\` del Supabase locale, ricostruito dalle migration. Dopo
 * una migration: \`npx supabase migration up\` e \`npm run db:types\`. (Uno
 * stack fermato col backup riparte dal backup, SENZA le migration nuove.)
 * La CI lo rigenera e fallisce se questo file non coincide.
 *
 * ⚠️ Il generatore non sa tutto: i CHECK che restringono un testo, gli
 * argomenti di una funzione che possono essere NULL, le colonne di un
 * \`RETURNS TABLE\` che possono esserlo. Quelle stanno in
 * \`types/database-app.ts\`, ed è \`AppDatabase\` il tipo dei client.
 */
`;

function generate() {
	// Comando come STRINGA con la shell: `npx` su Windows è un .cmd (vedi e2e.mjs).
	const r = spawnSync("npx supabase gen types --lang typescript --schema public", {
		cwd: ROOT,
		encoding: "utf8",
		shell: true,
		maxBuffer: 16 * 1024 * 1024,
	});
	if (r.status !== 0) {
		throw new Error(
			`\`supabase gen types\` è fallito: il Supabase locale è acceso? (\`npm run e2e:db\`)\n${String(r.stderr || r.error || "").trim()}`,
		);
	}
	// ⚠️ Su quale database ha letto lo dice la CLI su stderr. Un progetto
	// collegato con `supabase link` NON cambia il default (misurato con la
	// 3.1.0: «local stack · default; pass --remote»), ma è un'affermazione su un
	// programma altrui: si controlla invece di crederci.
	if (!/Target:\s*local stack/i.test(r.stderr)) {
		throw new Error(`\`supabase gen types\` non ha letto il database locale:\n${r.stderr.trim()}`);
	}
	return format(r.stdout);
}

/** La CLI stampa il file senza formattarlo: lo ristampa il compilatore di TypeScript, già fra le dipendenze. */
function format(source) {
	// Gli errori di sintassi dall'API pubblica: `parseDiagnostics` del SourceFile
	// funziona ma è interna, e se sparisse `?? []` farebbe passare tutto.
	const { diagnostics = [] } = ts.transpileModule(source, { reportDiagnostics: true, fileName: OUT });
	if (diagnostics.length > 0) {
		throw new Error(
			`L'output di \`supabase gen types\` non è TypeScript valido: ${ts.flattenDiagnosticMessageText(diagnostics[0].messageText, "\n")}`,
		);
	}
	const file = ts.createSourceFile(OUT, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
	const printed = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(file);
	// La stampante indenta di 4 spazi; il progetto usa i tab.
	const tabbed = printed.replace(/^( {4})+/gm, (m) => "\t".repeat(m.length / 4));
	return HEADER + "\n" + tabbed;
}

const fresh = generate();
if (CHECK) {
	let current = "";
	try {
		current = readFileSync(`${ROOT}${OUT}`, "utf8");
	} catch {
		// resta vuoto: il file manca, ed è un «vecchio» anche lui
	}
	if (current.replace(/\r\n/g, "\n") !== fresh) {
		console.error(
			`⚠️ ${OUT} non coincide con lo schema ricostruito dalle migration.\n` +
				"Una migration ha cambiato il database senza rigenerare i tipi: `npm run db:types` e committa il file.",
		);
		process.exitCode = 1;
	} else {
		console.log(`${OUT} coincide con lo schema delle migration.`);
	}
} else {
	writeFileSync(`${ROOT}${OUT}`, fresh);
	console.log(`${OUT} rigenerato dal Supabase locale.`);
}
