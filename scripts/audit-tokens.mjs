/**
 * Audit dei token di stile — `npm run audit:tokens`
 *
 * Cerca la famiglia di difetti che NON fa rumore: un colore che non si applica
 * perché il nome non esiste. Non è un errore di sintassi, non lo vede `tsc`,
 * non lo vede `next build`, e l'elemento si limita a ereditare — quindi spesso
 * "sembra giusto per caso".
 *
 * Tre controlli, che falliscono in tre modi diversi:
 *
 *   A. `var(--nome)` usata senza che `--nome` sia definita in globals.css.
 *      Casi storici: `--color-hane`, `--deep` (Fase 18), `--control` (Fase 21).
 *
 *   B. una CLASSE Tailwind di colore che Tailwind non ha generato.
 *      È il controllo che MANCAVA: la Fase 18 confrontava solo le `var(--…)`,
 *      quindi `bg-glass-border` e `text-primary` sono sopravvissute per mesi —
 *      la prima lasciava invisibili le barre di robustezza password.
 *      ⚠️ Si misura contro il CSS REALMENTE GENERATO in `.next`, non contro un
 *      elenco scritto a mano: solo il compilatore sa cosa ha prodotto davvero.
 *      Richiede quindi una build — se manca, il controllo dichiara di NON aver
 *      guardato invece di passare in silenzio.
 *
 *   C. un `--ink-*` definito in `:root` ma non mappato in `@theme inline`.
 *      Un inchiostro senza mappatura non ha la classe corrispondente: era il
 *      caso di `--ink-kiri` / `text-kiri-ink`, e nessuno degli altri due
 *      controlli lo vede — la variabile esiste E la classe è scritta bene.
 *
 * Uscita diversa da zero = almeno un controllo ha trovato qualcosa.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const CSS_SOURCE = join(ROOT, "app/globals.css");
const SCAN_DIRS = ["app", "components", "lib", "store", "types"];

/* ------------------------------------------------------------------ utili --- */

function walk(dir, out = []) {
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(ts|tsx|css)$/.test(p)) out.push(p);
	}
	return out;
}

const sources = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
const css = readFileSync(CSS_SOURCE, "utf8");

let problemi = 0;
const titolo = (s) => console.log(`\n${"─".repeat(72)}\n${s}\n${"─".repeat(72)}`);

/* ------------------------------------- A. var(--…) usate ma non definite --- */

titolo("A · variabili CSS usate ma mai definite");

// ⚠️ `[ \t]` e non `\s`: le definizioni sono indentate con tab, e in un grep
// POSIX `\s` non si comporta come qui — è il motivo per cui una prima stesura
// di questo controllo contava 72 token invece di 125.
const definite = new Set(
	[...css.matchAll(/^[ \t]*(--[a-zA-Z0-9_-]+)[ \t]*:/gm)].map((m) => m[1]),
);

const usate = new Map(); // nome → [file:riga]
for (const file of sources) {
	readFileSync(file, "utf8")
		.split("\n")
		.forEach((line, i) => {
			for (const m of line.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)) {
				// I nomi costruiti a pezzi (`var(--color-${accent})`) arrivano qui
				// troncati al prefisso: si riconoscono dal trattino finale e si
				// saltano, perché il suffisso non è visibile staticamente.
				// ⚠️ Restano quindi FUORI da questo audit: vanno enumerati a mano,
				// come dice la Fase 19.
				if (m[1].endsWith("-")) continue;
				if (!usate.has(m[1])) usate.set(m[1], []);
				usate.get(m[1]).push(`${relative(ROOT, file)}:${i + 1}`);
			}
		});
}

const orfane = [...usate.keys()].filter((n) => !definite.has(n)).sort();
if (orfane.length === 0) {
	console.log(`✅ ${definite.size} definite, ${usate.size} usate — nessuna orfana.`);
} else {
	problemi += orfane.length;
	for (const n of orfane) {
		console.log(`❌ var(${n}) — non definita in app/globals.css`);
		usate.get(n).forEach((l) => console.log(`     ${l}`));
	}
}

/* ------------------------------ B. classi Tailwind di colore non generate --- */

titolo("B · classi Tailwind di colore che Tailwind non ha generato");

// ⚠️ SOLO la build di produzione (`.next/static`). Sotto `.next/dev` c'è il CSS
// del dev server, che può essere di uno stato del sorgente diverso: leggerlo
// insieme all'altro maschererebbe una classe mancante con una copia stantia.
const cssBuilt = walk(join(ROOT, ".next", "static")).filter((f) => f.endsWith(".css"));

if (cssBuilt.length === 0) {
	// ⚠️ Un controllo che non ha guardato deve DIRLO. Un elenco di soli OK non
	// distingue "passato" da "non eseguito" — è la regola già scritta per la #47.
	console.log("⚠️  SALTATO — nessun CSS in .next/static/. Esegui `npm run build` e ripeti.");
	problemi += 1;
} else {
	const generato = cssBuilt.map((f) => readFileSync(f, "utf8")).join("\n");

	// Solo i prefissi che portano un COLORE: `text-xs` o `border-2` non hanno un
	// token di colore dietro e produrrebbero rumore.
	const PREFIX = "bg|text|border|fill|stroke|ring|outline|divide|accent|caret|from|via|to";
	// Suffissi che Tailwind fornisce di suo. Non stanno fra i token del progetto
	// e non sono mai il difetto che questo controllo insegue.
	const BUILTIN =
		/^(inherit|current|transparent|black|white|auto|none|left|right|center|top|bottom|start|end|justify|wrap|nowrap|balance|pretty|clip|ellipsis|hidden|visible|solid|dashed|dotted|double|collapse|separate|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?$/;

	// ⚠️ Il token va preso INTERO: varianti davanti (`last:`, `focus:`, `dark:`)
	// e modificatore di opacità dietro (`/50`). Una prima stesura si fermava
	// all'utility nuda e ha dichiarato mancanti tre classi perfettamente sane —
	// `last:border-b-0`, `focus:border-muted`, `bg-muted/50` — perché Tailwind le
	// scrive nel CSS con le varianti dentro il selettore (`.last\:border-b-0`).
	// Un valore arbitrario (`text-[11.5px]`) non combacia di proposito: non ha un
	// token dietro e non è il difetto che questo controllo insegue.
	// ⚠️ La variante può iniziare con una CIFRA (`2xl:`). Pretendendo una lettera,
	// il match partiva a metà token — da `xl:` — e cercava nel CSS un selettore
	// che non esiste: due falsi positivi, entrambi su breakpoint sani.
	const CLASS_RE = new RegExp(
		`(?:[a-z0-9][a-z0-9-]*:)*(?:${PREFIX})-[a-zA-Z0-9-]+(?:/[a-z0-9.]+)?`,
		"g",
	);
	// Solo ciò che sta dentro un className: i commenti di questo progetto sono
	// prosa italiana e nominano le classi di continuo.
	const ATTR_RE = /className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{([^}]*)\})/g;

	const candidate = new Map();
	for (const file of sources) {
		if (file.endsWith(".css")) continue;
		readFileSync(file, "utf8")
			.split("\n")
			.forEach((line, i) => {
				for (const attr of line.matchAll(ATTR_RE)) {
					const blob = attr[1] ?? attr[2] ?? attr[3] ?? "";
					if (blob.includes("${")) continue; // costruita a pezzi
					for (const m of blob.matchAll(CLASS_RE)) {
						const cls = m[0];
						// Il filtro dei nomi nativi guarda la sola utility, senza
						// varianti né modificatore: `dark:bg-white/20` è nativa quanto
						// `bg-white`.
						const utility = cls.slice(cls.lastIndexOf(":") + 1).split("/")[0];
						if (BUILTIN.test(utility.slice(utility.indexOf("-") + 1))) continue;
						if (!candidate.has(cls)) candidate.set(cls, []);
						candidate.get(cls).push(`${relative(ROOT, file)}:${i + 1}`);
					}
				}
			});
	}

	// Nel CSS Tailwind scrive i due punti e la barra come caratteri di ESCAPE —
	// `focus:border-muted` diventa il selettore `.focus\:border-muted`, e
	// `bg-muted/50` diventa `.bg-muted\/50`. Il resto del token è per costruzione
	// solo lettere, cifre e trattini, quindi non porta altri metacaratteri.
	// ⚠️ E un identificatore CSS non può COMINCIARE con una cifra: Tailwind la
	// scrive come escape esadecimale seguito da uno spazio, quindi il breakpoint
	// `2xl:text-2xl` diventa il selettore `.\32 xl\:text-2xl`.
	const selettore = (cls) => {
		const s = cls.replace(/[:/]/g, (ch) => "\\" + ch);
		return "." + (/^[0-9]/.test(s) ? `\\3${s[0]} ${s.slice(1)}` : s);
	};
	// Si cerca il selettore seguito da un terminatore, o `.bg-card` combacerebbe
	// dentro `.bg-card-elevated`. I due punti sono fra i terminatori perché dopo
	// una variante segue la pseudo-classe (`.last\:border-b-0:last-child`).
	const TERMINATORI = [" ", ",", "{", ":", ">", "+", "~", ")", "\n", "\r", "\t"];
	const esisteNelCss = (cls) =>
		TERMINATORI.some((t) => generato.includes(selettore(cls) + t));

	const mancanti = [...candidate.keys()].filter((c) => !esisteNelCss(c)).sort();

	if (mancanti.length === 0) {
		console.log(
			`✅ ${candidate.size} classi di colore verificate contro il CSS generato — tutte esistono.`,
		);
	} else {
		problemi += mancanti.length;
		for (const c of mancanti) {
			console.log(`❌ .${c} — usata ma MAI generata: non applica nulla, l'elemento eredita`);
			candidate.get(c).forEach((l) => console.log(`     ${l}`));
		}
	}
}

/* ------------------------------- C. --ink-* senza classe corrispondente --- */

titolo("C · inchiostri definiti ma senza classe corrispondente");

const inks = [...css.matchAll(/^[ \t]*--ink-([a-z]+)[ \t]*:/gm)].map((m) => m[1]);
const mappati = new Set([...css.matchAll(/--color-([a-z]+)-ink[ \t]*:/g)].map((m) => m[1]));
const senzaClasse = [...new Set(inks)].filter((n) => !mappati.has(n));

if (senzaClasse.length === 0) {
	console.log(`✅ ${new Set(inks).size} inchiostri, tutti mappati in @theme inline.`);
} else {
	problemi += senzaClasse.length;
	for (const n of senzaClasse) {
		console.log(
			`❌ --ink-${n} definito in :root ma non mappato → la classe text-${n}-ink NON esiste`,
		);
	}
}

/* ------------------------------------------------------------------ esito --- */

console.log();
if (problemi === 0) {
	console.log("✅ Audit dei token superato.");
	process.exit(0);
}
console.log(`❌ Audit dei token: ${problemi} problem${problemi === 1 ? "a" : "i"}.`);
process.exit(1);
