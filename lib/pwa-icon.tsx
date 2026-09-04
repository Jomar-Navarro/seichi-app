import type { CSSProperties, ReactElement } from "react";

/**
 * Il marchio dell'app per manifest/icone PWA (Fase 25).
 *
 * Non è un logo nuovo: sono i tre `<path>` del `Sprout` di `lucide-react`
 * (v1.21.0, `node_modules/lucide-react/dist/esm/icons/sprout.mjs`), lo
 * stesso glifo già usato in `components/UI/BrandHeader.tsx` come marchio
 * dell'app su welcome/onboarding. `viewBox="0 0 24 24"` è il default di
 * lucide-react (`defaultAttributes.mjs`).
 *
 * Colori: `--color-tsuki`/`--color-midori` di `app/globals.css`, duplicati
 * come hex perché né `ImageResponse`/Satori né uno script Node fuori dalla
 * build possono leggere una custom property CSS.
 *
 * ⚠️ **Non perché siano invarianti fra i temi — non lo sono**: `.dark`
 * ridefinisce `--color-midori` a `#67b89a` (più pastello, per restare
 * leggibile su fondo scuro — la stessa regola del Design System per cui gli
 * accenti si invertono fra i due temi). La ragione vera è un'altra: un'icona
 * sulla home screen o il colore di una schermata di splash non "seguono" il
 * tema di QUESTA sessione — sono un'identità visiva fissata una volta, come
 * il colore di un logo su una confezione. Qui si prende deliberatamente il
 * valore CHIARO dei due token, non uno "medio" o "quello che capita".
 *
 * Usato da `app/icon.tsx`, `app/apple-icon.tsx` e `app/manifest.ts` (import
 * diretto, girano nella build Next). NON da `scripts/generate-pwa-icons.mjs`:
 * quello è Node puro, eseguito fuori dalla build, e non può importare un
 * modulo TypeScript — i tre path sono duplicati lì con un commento che
 * spiega perché.
 */
export const SPROUT_PATHS = [
	"M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3",
	"M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4",
	"M5 21h14",
];

export const TSUKI = "#f5f1e8";
export const MIDORI = "#6f8a63";

/**
 * L'unico markup che `app/icon.tsx` e `app/apple-icon.tsx` disegnano —
 * quadrato `TSUKI`, glifo centrato in `MIDORI`. Cambia solo la dimensione
 * (32px per il favicon, 180px per l'apple-touch-icon): lo spessore del
 * tratto scala con lei perché `strokeWidth` è nello spazio PRE-scala del
 * glifo (`viewBox 0 0 24 24`), non un pixel assoluto — la stessa logica di
 * `scripts/generate-pwa-icons.mjs`, che la commenta per esteso.
 */
export function sproutIconElement(canvasSize: number, glyphSize: number): ReactElement {
	const wrapper: CSSProperties = {
		width: "100%",
		height: "100%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		background: TSUKI,
	};
	// canvas 32px → tratto 2 (proporzione originale lucide); scala con la
	// dimensione del glifo perché un tratto fisso sparirebbe a 180px o
	// ingrasserebbe a 22px.
	const strokeWidth = (2 * glyphSize) / 22;

	return (
		<div style={wrapper}>
			<svg
				width={glyphSize}
				height={glyphSize}
				viewBox="0 0 24 24"
				fill="none"
				stroke={MIDORI}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				{SPROUT_PATHS.map((d) => (
					<path key={d} d={d} />
				))}
			</svg>
		</div>
	);
}
