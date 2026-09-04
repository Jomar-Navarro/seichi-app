/**
 * Genera le icone statiche per `manifest.ts.icons[]` — `npm run generate:pwa-icons`
 *
 * Script ONE-OFF, non parte della build: si rilancia a mano solo se il
 * marchio cambia (colore, glifo). I PNG prodotti si versionano in `public/`,
 * come `favicon.ico` oggi — non li rigenera `next build`.
 *
 * ⚠️ Perché non `next/og`/`ImageResponse` come `app/icon.tsx`: quei file
 * generano icone a RICHIESTA, dentro la build Next, con un solo formato
 * (`<link>` per il browser). `manifest.ts.icons[]` invece vuole PNG statici
 * a percorso stabile — Chrome pretende almeno un 512×512 per l'installabilità
 * — e generarli a ogni richiesta sarebbe lavoro sprecato per un asset che non
 * cambia mai fra un deploy e l'altro. `sharp` è già presente in
 * `node_modules` (dipendenza transitiva, già autorizzato in
 * `package.json.allowScripts`): non è una dipendenza nuova della fase.
 *
 * Il glifo è lo stesso `Sprout` di `lucide-react` usato in
 * `app/icon.tsx`/`app/apple-icon.tsx` (via `lib/pwa-icon.ts`) e in
 * `components/UI/BrandHeader.tsx`. ⚠️ I tre path sono DUPLICATI qui, non
 * importati da `lib/pwa-icon.ts`: questo script gira come Node puro fuori
 * dalla build Next e non può importare un modulo TypeScript. Se il glifo
 * cambia, va cambiato in entrambi i posti — sono due, non tre, perché
 * `app/icon.tsx` e `app/apple-icon.tsx` condividono già `lib/pwa-icon.ts`.
 */

import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SPROUT_PATHS = [
	"M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3",
	"M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4",
	"M5 21h14",
];

const TSUKI = "#f5f1e8";
const MIDORI = "#6f8a63";

const OUT_DIR = join(process.cwd(), "public");

/**
 * @param {number} size lato del quadrato, in px
 * @param {number} fraction quanto del canvas occupa il glifo (0-1)
 * @param {boolean} opaque se true, riempie SEMPRE lo sfondo (serve per
 *   apple-touch-icon: iOS ignora l'alpha e riempirebbe di nero il resto)
 */
function buildSvg(size, fraction) {
	// Il glifo lucide vive nel suo viewBox 0..24: scalarlo di `k` lo porta a
	// occupare `fraction` del lato del canvas, e lo spessore del tratto (2,
	// nello spazio pre-scala) scala insieme a lui — stesse proporzioni a ogni
	// dimensione, esattamente come rendere <Sprout size={N}> nell'app.
	const k = (size * fraction) / 24;
	const offset = (size - 24 * k) / 2;
	const paths = SPROUT_PATHS.map(
		(d) =>
			`<path d="${d}" fill="none" stroke="${MIDORI}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`,
	).join("");

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
		<rect width="${size}" height="${size}" fill="${TSUKI}" />
		<g transform="translate(${offset} ${offset}) scale(${k})">${paths}</g>
	</svg>`;
}

/**
 * `fraction` più basse lasciano più margine:
 * - 0.62 per le icone "any" — riempiono bene senza toccare i bordi;
 * - 0.42 per la maskable — Android può ritagliare un cerchio/squircle e
 *   mangiarsi fino a ~20% per lato; il glifo resta dentro la safe zone anche
 *   nel ritaglio più aggressivo (verificare comunque visivamente, es. su
 *   maskable.app, prima di dare per buono);
 * - 0.62 per apple-touch-icon — iOS arrotonda gli angoli da sé, non ritaglia
 *   in forme arbitrarie come Android.
 */
const TARGETS = [
	{ file: "icon-192.png", size: 192, fraction: 0.62 },
	{ file: "icon-512.png", size: 512, fraction: 0.62 },
	{ file: "icon-512-maskable.png", size: 512, fraction: 0.42 },
	{ file: "apple-touch-icon.png", size: 180, fraction: 0.62 },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const { file, size, fraction } of TARGETS) {
	const svg = buildSvg(size, fraction);
	const dest = join(OUT_DIR, file);
	await sharp(Buffer.from(svg)).png().toFile(dest);
	console.log(`✅ ${file} (${size}×${size})`);
}

console.log("\nGenerate. Verificare a vista con Read prima di committare —");
console.log("un'icona corretta in SVG e sbagliata da rasterizzata non è teorica.");
