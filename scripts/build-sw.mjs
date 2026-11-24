/**
 * Il service worker, generato DENTRO `next build` e scritto in `public/` (#233).
 *
 * Lo chiama `compiler.runAfterProductionCompile` in `next.config.ts`: dopo la
 * compilazione, quando `.next/static` c'è già, e prima della generazione
 * statica. Così `/sw.js` è un FILE, servito come ogni altro di `public/`, e a
 * runtime non esiste nessuna funzione che possa ricompilarlo.
 *
 * ⚠️⚠️ Fino alla #233 lo serviva una route, `app/serwist/[path]/route.ts`
 * (`createSerwistRoute` di `@serwist/turbopack`): `force-static`, prerenderizzata
 * in build, ma con il tag implicito `_N_T_/layout` che ogni rotta porta. Ogni
 * `revalidatePath("/", "layout")` delle nostre action la dichiarava scaduta, e
 * Vercel la rigenerava in background eseguendo la route: che a runtime voleva
 * ricompilare il worker con esbuild, assente nella funzione → «Cannot find
 * module» a ogni controllo d'aggiornamento (Sentry SEICHI-3), e un 500 secco il
 * giorno in cui la copia in cache fosse sparita. Anche con esbuild presente,
 * nella funzione mancano `.next/static` e `app/sw.ts`: ne sarebbe uscito un
 * worker con il precache vuoto. Il problema è noto a monte e non sarà corretto
 * (serwist/serwist#360, chiusa *not planned*): il livello giusto della
 * correzione è non avere la route. Storia: `docs/storia/issue-233-sw-statico.md`.
 *
 * Fa lo stesso lavoro della route, con le stesse opzioni che l'integrazione
 * ricavava da sé (lette in `node_modules/@serwist/turbopack/src/index.schema.ts`
 * e `src/lib/build.ts`, 9.5.13), scritte qui una per una: un default che
 * cambia da una versione all'altra di una libreria non deve cambiare il worker
 * senza che una riga di questo repo si muova. `npm run audit:pwa-cache` legge
 * poi il worker che esce da qui, non questa configurazione.
 */

import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getFileManifestEntries } from "@serwist/build";
import * as esbuild from "esbuild";
import { MODERN_BROWSERSLIST_TARGET } from "next/constants.js";
import { OFFLINE_URL, offlineRevision } from "../lib/offline-revision.mjs";

/** Il sorgente del worker, relativo alla radice del progetto. */
const SW_SRC = "app/sw.ts";

/**
 * Dove finisce il worker, relativo alla radice del progetto. `public/` perché è
 * servito alla radice del sito: lo scope di un worker è la sua cartella, e da
 * `/sw.js` copre tutta l'app senza l'intestazione `Service-Worker-Allowed` che
 * la route doveva aggiungere. Il file è generato: sta in `.gitignore`.
 */
export const SW_OUTPUT = ["public/sw.js", "public/sw.js.map"];

/** Le estensioni dei file di build che finiscono nel precache (le stesse dell'integrazione). */
const STATIC_EXTENSIONS = "js,css,html,ico,apng,png,avif,jpg,jpeg,jfif,pjpeg,pjp,gif,svg,webp,json,webmanifest";

/**
 * Il target di esbuild: la lista moderna di Next (`chrome 111`, `safari 16.4`…)
 * scritta come la vuole esbuild (`chrome111`). L'integrazione passava da
 * `browserslistToEsbuild()`, che senza una configurazione browserslist nel
 * progetto (non ce n'è) dà esattamente questo. Una voce di forma diversa
 * ferma la build invece di finire tradotta male.
 */
function esbuildTarget() {
	return MODERN_BROWSERSLIST_TARGET.map((query) => {
		const match = /^(chrome|edge|firefox|safari) (\d+(?:\.\d+)?)$/.exec(query);
		if (!match) throw new Error(`build-sw: target di Next inatteso, «${query}»: va tradotto a mano per esbuild.`);
		return match[1] + match[2];
	});
}

/**
 * Genera `public/sw.js` e la sua source map.
 *
 * @param {{ projectDir: string, distDir: string, basePath?: string, assetPrefix?: string }} options
 *   `projectDir` e `distDir` come li passa l'hook di Next (assoluti);
 *   `basePath` e `assetPrefix` dalla config, solo per rifiutarli.
 */
export async function buildServiceWorker({ projectDir, distDir, basePath, assetPrefix }) {
	// Gli URL del precache si riscrivono più sotto supponendo il sito alla
	// radice. Con un basePath o un assetPrefix il worker chiederebbe file che non
	// esistono, e lo si scoprirebbe offline: meglio una build che si ferma.
	if (basePath || assetPrefix) {
		throw new Error("build-sw: `basePath` e `assetPrefix` non sono supportati: gli URL del precache vanno riscritti.");
	}

	const dist = `${path.relative(projectDir, distDir).split(path.sep).join("/")}/`;
	if (dist.startsWith("../") || dist === "/") {
		throw new Error(`build-sw: la cartella di build (${distDir}) non sta dentro il progetto.`);
	}

	// Il worker di una build precedente, rimasto in `public/`, finirebbe nel
	// glob di questa: via prima di cercare (e comunque escluso qui sotto).
	for (const file of SW_OUTPUT) rmSync(path.join(projectDir, file), { force: true });

	const { manifestEntries, count, size, warnings } = await getFileManifestEntries({
		globDirectory: projectDir,
		globPatterns: [`${dist}static/**/*.{${STATIC_EXTENSIONS}}`, "public/**/*"],
		globIgnores: ["**/node_modules/**/*", ...SW_OUTPUT],
		globFollow: true,
		globStrict: true,
		maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
		// I file di `.next/static` hanno già l'hash nel nome: niente revisione.
		dontCacheBustURLsMatching: new RegExp(`^${dist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}static/`),
		manifestTransforms: [
			// `/~offline` è una pagina dinamica, non un file: si aggiunge a mano, con
			// la revisione calcolata dalle ALTRE voci (#127, `lib/offline-revision.mjs`).
			// Qui gli URL sono ancora percorsi su disco: la formula toglie il prefisso.
			(manifest) => ({
				manifest: [...manifest, { url: OFFLINE_URL, revision: offlineRevision(manifest), size: 0 }],
				warnings: [],
			}),
			// Da percorso su disco a URL, come faceva l'integrazione:
			// `.next/static/x` → `/_next/static/x`, `public/icon.png` → `/icon.png`.
			(manifest) => ({
				manifest: manifest.map((entry) => {
					if (entry.url.startsWith(dist)) return { ...entry, url: `/_next/${entry.url.slice(dist.length)}` };
					if (entry.url.startsWith("public/")) return { ...entry, url: `/${entry.url.slice("public/".length)}` };
					return entry;
				}),
				warnings: [],
			}),
		],
	});

	// Un avviso qui è un file che NON entra nel precache (troppo grande, glob
	// vuoto): offline mancherebbe. L'integrazione lo stampava e proseguiva; qui
	// ferma la build, perché nessuno legge i log di una build verde.
	if (warnings.length > 0) {
		throw new Error(`build-sw: il precache ha degli avvisi:\n  ${warnings.join("\n  ")}`);
	}
	if (!manifestEntries?.some((entry) => entry.url === OFFLINE_URL)) {
		throw new Error(`build-sw: ${OFFLINE_URL} manca dal precache.`);
	}

	const result = await esbuild.build({
		entryPoints: [{ in: path.join(projectDir, SW_SRC), out: "sw" }],
		// L'uscita è calcolata come se il worker stesse alla radice del progetto,
		// come con la route: la source map nomina così `app/sw.ts`, che è la
		// chiave con cui `audit:pwa-cache` riconosce il NOSTRO codice. I file si
		// scrivono poi in `public/` più sotto, con `write: false`.
		outdir: projectDir,
		write: false,
		bundle: true,
		format: "esm",
		platform: "browser",
		target: esbuildTarget(),
		minify: true,
		treeShaking: true,
		sourcemap: true,
		entryNames: "[name]",
		define: { "self.__SW_MANIFEST": JSON.stringify(manifestEntries, null, 2) },
		logLevel: "silent",
	});
	if (result.errors.length > 0 || result.warnings.length > 0) {
		const messages = await esbuild.formatMessages([...result.errors, ...result.warnings], { kind: "error" });
		throw new Error(`build-sw: esbuild non ha compilato pulito il worker:\n${messages.join("\n")}`);
	}

	// Ci si aspettano due file e solo due: un terzo (un chunk, un asset) sarebbe
	// un pezzo di worker che nessuno scrive.
	const outputs = new Map(result.outputFiles.map((file) => [path.relative(projectDir, file.path).split(path.sep).join("/"), file]));
	const expected = SW_OUTPUT.map((file) => path.posix.basename(file));
	if (outputs.size !== expected.length || !expected.every((name) => outputs.has(name))) {
		throw new Error(`build-sw: esbuild ha prodotto ${[...outputs.keys()].join(", ")}, non ${expected.join(", ")}.`);
	}
	for (const file of SW_OUTPUT) {
		writeFileSync(path.join(projectDir, file), outputs.get(path.posix.basename(file)).contents);
	}

	console.log(`   service worker: ${count} voci nel precache (${(size / 1024).toFixed(1)} KiB), scritto in ${SW_OUTPUT[0]}`);
}
