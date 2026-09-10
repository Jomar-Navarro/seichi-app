/**
 * Genera le `apple-touch-startup-image` — `npm run generate:pwa-splash`
 *
 * Script ONE-OFF, come `generate-pwa-icons.mjs`: si rilancia a mano solo se
 * il marchio cambia. I PNG si versionano in `public/splash/`.
 *
 * ⚠️ Perché esiste, e perché non basta il manifest: `app/manifest.ts`
 * imposta già `background_color`/`theme_color`, che Android usa per
 * disegnare lo splash nativo della PWA. **iOS NON legge quel campo per lo
 * splash di avvio** — Safari supporta solo il meccanismo proprietario
 * `apple-touch-startup-image` (precedente al Web App Manifest, mai
 * allineato ad esso), che vuole un PNG per ogni combinazione ESATTA di
 * larghezza/altezza logica e pixel-ratio del dispositivo. Senza, l'apertura
 * da home screen su iPhone mostra uno schermo vuoto (nero durante la
 * transizione di sistema, poi bianco) fino a quando la pagina vera non
 * arriva — verificato dal vivo su iPhone 15, non supposto.
 *
 * ⚠️ Le dimensioni NON sono a memoria: sono lette da
 * `apple-fallback-data.json` di elegantapp/pwa-asset-generator (licenza
 * MIT), un elenco mantenuto e verificato contro le specifiche Apple reali —
 * una tabella copiata da un gist trovato per strada avrebbe fermato la
 * copertura a iPhone 11 (verificato: è successo cercando prima di questa).
 * Solo RITRATTO: l'app di Seichi non supporta l'orizzontale.
 *
 * Copre iPhone 12 → 17/Air incluso (~ultimi 4 anni, su richiesta esplicita
 * — coprire l'intera matrice storica Apple, oltre 20 combinazioni ciascuna
 * un numero che se sbagliato non dà errore ma rende l'immagine
 * silenziosamente invisibile, non era proporzionato per un'app che oggi ha
 * un solo utente reale). Le dimensioni FISICHE sono deduplicate: più
 * modelli condividono la stessa risoluzione (es. iPhone 15/15 Pro/14
 * Pro/16 sono tutti 1179×2556@3) e usano la STESSA immagine.
 *
 * ⚠️ Contiene SOLO sfondo + badge, non "Seichi"/整地: `sharp`/librsvg
 * rasterizza SVG con i font di SISTEMA della macchina che esegue lo
 * script, e un glifo CJK potrebbe non esserci (a differenza del browser,
 * che ha un fallback di sistema affidabile) — non verificabile senza
 * generare e guardare il risultato pixel per pixel. Il testo arriva un
 * istante dopo con `BootSplash` (browser vero, fallback CJK garantito):
 * questa immagine esiste solo per non mostrare NIENTE nell'istante prima,
 * non per essere la schermata completa.
 *
 * ⚠️ `prefers-color-scheme` risponde al tema di SISTEMA del dispositivo,
 * mai al cookie di Seichi (Fase 18): a quello stadio non esiste ancora una
 * richiesta HTTP da cui leggerlo. Un utente con Seichi su scuro ma il
 * sistema su chiaro vedrà lo splash nativo chiaro e poi `BootSplash` scuro
 * — lo stesso "lampo, una volta sola" già accettato per tutta l'app.
 */

import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SPROUT_PATHS = [
	"M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3",
	"M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4",
	"M5 21h14",
];

// Stessi valori di lib/pwa-icon.ts / app/manifest.ts — duplicati qui per lo
// stesso motivo di generate-pwa-icons.mjs: Node puro, fuori dalla build,
// non può importare un modulo TypeScript.
const MIDORI_LIGHT = "#6f8a63";
const MIDORI_DARK = "#67b89a";
// I tre stop del gradiente di --background in globals.css, per tema.
const GRADIENT_LIGHT = ["#f5f1e8", "#ece6da", "#e6dfd1"];
const GRADIENT_DARK = ["#1a2436", "#151d2b", "#101723"];

const OUT_DIR = join(process.cwd(), "public", "splash");

/**
 * Risoluzioni FISICHE unificate per iPhone 12 → 17/Air, da
 * apple-fallback-data.json (elegantapp/pwa-asset-generator). `css` è la
 * larghezza/altezza LOGICA (fisica / scaleFactor): è quella che finisce
 * nella media query `device-width`/`device-height`, non la fisica.
 */
const SIZES = [
	{ css: [393, 852], scale: 3, models: "iPhone 14 Pro, 15, 15 Pro, 16, 16e" },
	{ css: [430, 932], scale: 3, models: "iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus" },
	{ css: [390, 844], scale: 3, models: "iPhone 12, 12 Pro, 13, 13 Pro, 14" },
	{ css: [428, 926], scale: 3, models: "iPhone 12 Pro Max, 13 Pro Max, 14 Plus" },
	{ css: [375, 812], scale: 3, models: "iPhone 12 mini, 13 mini" },
	{ css: [440, 956], scale: 3, models: "iPhone 16 Pro Max, 17 Pro Max" },
	{ css: [402, 874], scale: 3, models: "iPhone 16 Pro, 17, 17 Pro" },
	{ css: [420, 912], scale: 3, models: "iPhone Air" },
];

/**
 * Sfondo (gradiente radiale approssimato — SVG non ha un'ellisse nativa per
 * `radial-gradient`, un cerchio generoso è visivamente equivalente a questa
 * scala) + badge Sprout in pastiglia di vetro, centrato al 46% dell'altezza
 * — non al 50%: è dove il badge si trova DAVVERO dentro `BootSplash.tsx`
 * una volta che il gruppo badge+testo (che quello sì è centrato per
 * intero) si assesta. Allineare i due evita un salto verticale visibile
 * nel passaggio nativo → componente.
 */
function buildSvg(width, height, dark) {
	const gradient = dark ? GRADIENT_DARK : GRADIENT_LIGHT;
	const midori = dark ? MIDORI_DARK : MIDORI_LIGHT;
	const badgeFill = dark ? "rgba(236,240,248,0.13)" : "rgba(255,255,255,0.7)";
	const ring = dark ? "rgba(230,233,239,0.12)" : "rgba(70,62,48,0.1)";

	// Badge e raggio d'angolo scalati sulla larghezza, stessa proporzione
	// di 64px su 414px logici (~15.5%) usata da BootSplash.
	const badge = width * 0.155;
	const radius = badge * 0.375; // 24/64 di BootSplash
	const cx = width / 2;
	const cy = height * 0.46;

	const iconScale = (badge * 0.62) / 24; // stesso fattore "fraction" di generate-pwa-icons.mjs
	const iconOffset = (badge - 24 * iconScale) / 2;
	const paths = SPROUT_PATHS.map(
		(d) => `<path d="${d}" fill="none" stroke="${midori}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`,
	).join("");

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
		<defs>
			<radialGradient id="bg" cx="50%" cy="0%" r="85%">
				<stop offset="0%" stop-color="${gradient[0]}" />
				<stop offset="50%" stop-color="${gradient[1]}" />
				<stop offset="100%" stop-color="${gradient[2]}" />
			</radialGradient>
		</defs>
		<rect width="${width}" height="${height}" fill="url(#bg)" />
		<rect x="${cx - badge / 2}" y="${cy - badge / 2}" width="${badge}" height="${badge}" rx="${radius}"
			fill="${badgeFill}" stroke="${ring}" stroke-width="1" />
		<g transform="translate(${cx - badge / 2 + iconOffset} ${cy - badge / 2 + iconOffset}) scale(${iconScale})">${paths}</g>
	</svg>`;
}

mkdirSync(OUT_DIR, { recursive: true });

const jobs = [];
for (const { css, scale } of SIZES) {
	const [w, h] = css;
	for (const dark of [false, true]) {
		const physW = w * scale;
		const physH = h * scale;
		const file = `splash-${w}x${h}-${dark ? "dark" : "light"}.png`;
		jobs.push({ file, physW, physH, dark, cssW: w, cssH: h, scale });
	}
}

await Promise.all(
	jobs.map(async ({ file, physW, physH, dark }) => {
		const svg = buildSvg(physW, physH, dark);
		await sharp(Buffer.from(svg)).png().toFile(join(OUT_DIR, file));
		console.log(`✅ ${file} (${physW}×${physH})`);
	}),
);

console.log(`\n${jobs.length} immagini generate in public/splash/.`);
console.log("Verificare a vista con Read prima di committare, ALMENO una per tema.");
