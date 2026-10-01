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
 *   D. una classe INCOLLATA a `${` in un className costruito a pezzi.
 *      Lo scanner di Tailwind legge il sorgente come testo e non la estrae:
 *      `…border-subtle${x}` non genera `border-subtle`. Se la stessa classe
 *      compare altrove funziona per caso; se no, non esiste — è il caso dei
 *      separatori bianchi di `SettingsGroup` (issue #114), invisibili a B per
 *      due motivi: saltava ogni className con `${`, e non riconosceva le
 *      varianti arbitrarie come `[&>*+*]:`. Ora non fa più né l'una né
 *      l'altra cosa, e D non ha bisogno di una build.
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

/** Riga (da 1) di un indice nel testo. */
function rigaDi(src, idx) {
	let n = 1;
	for (let k = src.indexOf("\n"); k !== -1 && k < idx; k = src.indexOf("\n", k + 1)) n++;
	return n;
}

/**
 * I pezzi di testo LETTERALE di ogni `className` (e `areaClassName` & co.) di
 * un file: le stringhe e le parti statiche dei template, ciascuno con la sua
 * posizione. Una parte di template seguita da `${` porta anche `interp`, la
 * posizione dell'interpolazione.
 *
 * ⚠️ Un piccolo parser e non una regex per riga: un className costruito a
 * pezzi va a capo, annida template e stringhe, e dentro `${…}` può contenere
 * commenti con apostrofi ("l'enfasi") che una regex leggerebbe come stringhe.
 * La regex di prima prendeva un attributo per riga e lo saltava se conteneva
 * `${` — cioè non guardava NESSUN className dinamico (issue #114).
 */
function classNameLiterals(src) {
	const pezzi = [];
	let i = 0;

	function stringa(q) {
		const start = ++i;
		while (i < src.length && src[i] !== q && src[i] !== "\n") i += src[i] === "\\" ? 2 : 1;
		pezzi.push({ text: src.slice(start, i), at: start });
		i++;
	}
	function template() {
		let start = ++i;
		while (i < src.length && src[i] !== "`") {
			if (src[i] === "\\") {
				i += 2;
			} else if (src[i] === "$" && src[i + 1] === "{") {
				pezzi.push({ text: src.slice(start, i), at: start, interp: i });
				i += 2;
				espressione();
				start = i;
			} else {
				i++;
			}
		}
		pezzi.push({ text: src.slice(start, i), at: start });
		i++;
	}
	// Legge fino alla graffa che chiude quella già aperta, e si ferma DOPO.
	function espressione() {
		let depth = 1;
		while (i < src.length) {
			const c = src[i];
			if (c === "/" && src[i + 1] === "/") {
				const nl = src.indexOf("\n", i);
				i = nl === -1 ? src.length : nl;
			} else if (c === "/" && src[i + 1] === "*") {
				const fine = src.indexOf("*/", i + 2);
				i = fine === -1 ? src.length : fine + 2;
			} else if (c === '"' || c === "'") {
				stringa(c);
			} else if (c === "`") {
				template();
			} else {
				if (c === "{") depth++;
				else if (c === "}" && --depth === 0) {
					i++;
					return;
				}
				i++;
			}
		}
	}

	for (const m of src.matchAll(/\b(?:className|[a-z]\w*ClassName)\s*=\s*/g)) {
		if (m.index < i) continue; // dentro un className già letto
		i = m.index + m[0].length;
		if (src[i] === '"' || src[i] === "'") stringa(src[i]);
		else if (src[i] === "{") {
			i++;
			espressione();
		}
	}
	return pezzi;
}

const classNames = new Map(
	sources.filter((f) => !f.endsWith(".css")).map((f) => {
		const src = readFileSync(f, "utf8");
		return [f, { src, pezzi: classNameLiterals(src) }];
	}),
);

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
// Variabili definite NEL COMPONENTE, come chiave di uno `style` inline
// (`{ "--group-tint": … }`) e lette dallo stesso elemento o da un figlio — la
// via per dare a una classe `lg:` un colore calcolato a runtime (issue #108,
// `SettingsRow`, `BudgetCards`). Valgono SOLO nel file che le definisce: una
// custom property è visibile al sottoalbero che la dichiara, quindi usata in
// un altro file sarebbe di nuovo una scommessa, e l'audit la segnala.
const definiteNelFile = new Map(); // file → Set(nomi)
for (const file of sources) {
	if (file.endsWith(".css")) continue;
	const nomi = new Set(
		[...readFileSync(file, "utf8").matchAll(/["'](--[a-zA-Z0-9_-]+)["'][ \t]*:/g)].map((m) => m[1]),
	);
	if (nomi.size) definiteNelFile.set(file, nomi);
}
for (const file of sources) {
	readFileSync(file, "utf8")
		.split("\n")
		.forEach((line, i) => {
			// ⚠️ Anche la forma abbreviata di Tailwind v4, `bg-(--nome)`, che è
			// `var(--nome)` scritto da Tailwind: fino all'issue #108 questo
			// controllo non la vedeva, e un nome sbagliato lì fallisce in silenzio
			// esattamente come uno dentro `var()`.
			for (const m of line.matchAll(/(?:var\(|[a-z]-\()(--[a-zA-Z0-9_-]+)/g)) {
				// I nomi costruiti a pezzi (`var(--color-${accent})`) arrivano qui
				// troncati al prefisso: si riconoscono dal trattino finale e si
				// saltano, perché il suffisso non è visibile staticamente.
				// ⚠️ Restano quindi FUORI da questo audit: vanno enumerati a mano,
				// come dice la Fase 19.
				if (m[1].endsWith("-")) continue;
				if (definiteNelFile.get(file)?.has(m[1])) continue;
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
	// ⚠️ E il token deve cominciare a un CONFINE: senza il lookbehind il match
	// partiva a metà parola dentro un valore arbitrario, e
	// `grid-cols-[repeat(auto-fit,minmax(300px,1fr))]` produceva `to-fit` — una
	// "classe di gradiente" mai generata, cioè un falso positivo (issue #108).
	// ⚠️ Anche le varianti ARBITRARIE (`[&>*+*]:`, `data-[state=open]:`): prima
	// il match ripartiva dopo i loro due punti e verificava `border-subtle`
	// nuda — che esiste altrove — invece della classe CON la variante, che non
	// esisteva (issue #114).
	// ⚠️⚠️ E la classe con la variante NON va scritta per intero in un commento:
	// Tailwind scansiona ogni file non ignorato, script e commenti compresi, e
	// la genererebbe da qui — la prima stesura di questa nota lo faceva, e
	// rimetteva nel CSS proprio la classe di cui la build doveva accorgersi.
	const VARIANTE = String.raw`(?:[a-z0-9][a-z0-9-]*(?:\[[^\]\s]+\])?|\[[^\]\s]+\]):`;
	const CLASS_RE = new RegExp(
		`(?<![A-Za-z0-9_-])(?:${VARIANTE})*(?:${PREFIX})-[a-zA-Z0-9-]+(?:/[a-z0-9.]+)?`,
		"g",
	);

	// Solo ciò che sta dentro un className (vedi `classNameLiterals`): i
	// commenti di questo progetto sono prosa italiana e nominano le classi di
	// continuo. I className costruiti a pezzi si guardano anch'essi, nelle loro
	// parti letterali: una classe incollata a `${` la segnala D.
	const candidate = new Map();
	for (const [file, { src, pezzi }] of classNames) {
		for (const pezzo of pezzi) {
			for (const m of pezzo.text.matchAll(CLASS_RE)) {
				const cls = m[0];
				// Il filtro dei nomi nativi guarda la sola utility, senza
				// varianti né modificatore: `dark:bg-white/20` è nativa quanto
				// `bg-white`.
				const utility = cls.slice(cls.lastIndexOf(":") + 1).split("/")[0];
				if (BUILTIN.test(utility.slice(utility.indexOf("-") + 1))) continue;
				if (!candidate.has(cls)) candidate.set(cls, []);
				candidate.get(cls).push(`${relative(ROOT, file)}:${rigaDi(src, pezzo.at + m.index)}`);
			}
		}
	}

	// Nel CSS Tailwind scrive come caratteri di ESCAPE tutto ciò che non può
	// stare in un identificatore — `focus:border-muted` diventa il selettore
	// `.focus\:border-muted`, `bg-muted/50` diventa `.bg-muted\/50`, e
	// `[&>*+*]:border-t` diventa `.\[\&\>\*\+\*\]\:border-t`.
	// ⚠️ E un identificatore CSS non può COMINCIARE con una cifra: Tailwind la
	// scrive come escape esadecimale seguito da uno spazio, quindi il breakpoint
	// `2xl:text-2xl` diventa il selettore `.\32 xl\:text-2xl`.
	const selettore = (cls) => {
		const s = cls.replace(/[^A-Za-z0-9_-]/g, (ch) => "\\" + ch);
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

/* ------------------------------------- D. classi incollate a un `${…}` --- */

titolo("D · classi incollate a `${` in un className costruito a pezzi");

// Una parte statica seguita da `${` deve finire con uno spazio (o essere
// vuota). Lo scanner di Tailwind non estrae ciò che sta attaccato a `${`
// (verificato con `@tailwindcss/oxide`, issue #114), quindi la classe esiste
// solo se un ALTRO file la scrive per intero: funziona per caso, e smette senza
// avvisi quando quell'altro uso sparisce. Copre anche i nomi costruiti a
// runtime (`bg-${accent}`), che Tailwind non genera comunque.
// ⚠️ Solo PRIMA di `${`: dopo la graffa che chiude (`}text-xs`) lo scanner
// la classe la estrae, e qui non c'è niente da segnalare.
const incollate = [];
for (const [file, { src, pezzi }] of classNames) {
	for (const { text, interp } of pezzi) {
		if (interp === undefined || text === "" || /\s$/.test(text)) continue;
		incollate.push(`${relative(ROOT, file)}:${rigaDi(src, interp)}  ${text.match(/\S+$/)[0]}\${`);
	}
}

if (incollate.length === 0) {
	console.log("✅ nessuna classe incollata a `${`.");
} else {
	problemi += incollate.length;
	console.log("❌ classi che Tailwind non vede — serve uno spazio prima di `${`:");
	incollate.forEach((l) => console.log(`     ${l}`));
}

/* ------------------------------------------------------------------ esito --- */

console.log();
if (problemi === 0) {
	console.log("✅ Audit dei token superato.");
	process.exit(0);
}
console.log(`❌ Audit dei token: ${problemi} problem${problemi === 1 ? "a" : "i"}.`);
process.exit(1);
