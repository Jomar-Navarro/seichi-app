// Gli avvisi di sicurezza alti, con le eccezioni dichiarate (2026-11-18).
//
// Prende il posto di `npm audit --audit-level=high` nella CI. Stesso perimetro
// (l'intero albero, strumenti di sviluppo compresi: esbuild, Tailwind e
// Serwist girano in `next build`, anche su Vercel) e stessa soglia (alto e
// critico; i moderati restano fuori, `ci-dipendenze.md` regola 3). In più, un
// elenco di eccezioni: avvisi alti SENZA una versione corretta, valutati uno
// per uno, con il motivo e una scadenza.
//
// Perché: il 2026-11-18 `npm audit` ha cominciato a segnalare picomatch
// (GHSA-fc5q-39xc-vjpf, ReDoS), alto e su ogni versione pubblicata. Il job
// `verifica` è richiesto dalla protezione di `master`: senza una via
// dichiarata, ogni PR restava bloccata da un avviso che nessun aggiornamento
// poteva togliere. L'alternativa era scavalcare la protezione, che smette di
// proteggere proprio quando serve.
//
// Uscita 1 — con il motivo — se:
//   · c'è un avviso alto o critico fuori dall'elenco;
//   · un'eccezione è scaduta (si rivaluta, non si rinnova a occhi chiusi);
//   · un'eccezione non serve più (l'avviso è sparito: si toglie dall'elenco,
//     o resterebbe lì a coprire il prossimo avviso con lo stesso id);
//   · `npm audit` non risponde (un registro irraggiungibile non è «zero
//     avvisi»).
// Uscita 0 altrimenti, dopo aver stampato cosa ha controllato: un elenco di
// soli OK non distingue «passato» da «non eseguito».

import { spawnSync } from "node:child_process";

/**
 * Le eccezioni. Ogni voce: l'id dell'avviso, il pacchetto, perché è accettato
 * QUI (non in generale), e fino a quando. La scadenza è una data di
 * rivalutazione, non di rinnovo automatico.
 *
 * Vuoto dal 2026-11-19: l'unica voce, picomatch (GHSA-fc5q-39xc-vjpf), è
 * uscita perché GitHub ha RITIRATO l'avviso il 2026-11-18, senza una versione
 * corretta. Storia in `docs/storia/issue-152-ci`.
 */
const EXCEPTIONS = [];

const SEVERE = new Set(["high", "critical"]);

/** L'id GHSA dall'URL dell'avviso (`https://github.com/advisories/GHSA-…`). */
function advisoryId(url) {
	return String(url ?? "").split("/").pop();
}

const run = spawnSync("npm audit --json", { shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
let report;
try {
	report = JSON.parse(run.stdout);
} catch {
	console.error("✗ npm audit non ha restituito un JSON leggibile:\n" + (run.stderr || run.stdout).slice(0, 2000));
	process.exit(1);
}
if (report.error || !report.vulnerabilities) {
	console.error("✗ npm audit è fallito:", JSON.stringify(report.error ?? report).slice(0, 2000));
	process.exit(1);
}

// Gli avvisi veri stanno negli oggetti di `via`; le stringhe sono pacchetti
// che li ereditano da una dipendenza, e si contano una volta sola, alla fonte.
const advisories = new Map();
for (const vuln of Object.values(report.vulnerabilities)) {
	for (const via of vuln.via) {
		if (typeof via !== "object") continue;
		const id = advisoryId(via.url);
		advisories.set(id, { id, pkg: via.name, severity: via.severity, title: via.title, range: via.range });
	}
}

const today = new Date().toISOString().slice(0, 10);
const problems = [];
const accepted = [];

for (const a of advisories.values()) {
	if (!SEVERE.has(a.severity)) continue;
	const ex = EXCEPTIONS.find((e) => e.id === a.id);
	if (!ex) {
		problems.push(`avviso ${a.severity} non accettato: ${a.pkg} ${a.range} — ${a.title} (${a.id})`);
	} else if (today > ex.until) {
		problems.push(`eccezione scaduta il ${ex.until}: ${a.pkg} (${a.id}). Rivaluta: c'è una versione corretta? Il motivo vale ancora?`);
	} else {
		accepted.push(`${a.pkg} ${a.range} (${a.id}), fino al ${ex.until}`);
	}
}
for (const ex of EXCEPTIONS) {
	if (!advisories.has(ex.id)) {
		problems.push(`l'eccezione ${ex.id} (${ex.pkg}) non serve più: l'avviso è sparito, toglila da scripts/audit-security.mjs`);
	}
}

const moderate = [...advisories.values()].filter((a) => !SEVERE.has(a.severity)).length;
console.log(`Avvisi letti: ${advisories.size} (${moderate} sotto la soglia «alto»).`);
for (const line of accepted) console.log(`~ accettato per eccezione: ${line}`);

if (problems.length > 0) {
	for (const p of problems) console.error(`✗ ${p}`);
	process.exit(1);
}
console.log("✓ nessun avviso alto o critico fuori dalle eccezioni dichiarate");
