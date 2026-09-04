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
 * build possono leggere una custom property CSS. `--color-midori` non
 * cambia fra i temi (è un accento finanziario, stabile per costruzione —
 * vedi CLAUDE.md, Design System), quindi un solo valore basta per entrambi.
 *
 * Usato da `app/icon.tsx` e `app/apple-icon.tsx` (import diretto, girano
 * nella build Next). NON da `scripts/generate-pwa-icons.mjs`: quello è
 * Node puro, eseguito fuori dalla build, e non può importare un modulo
 * TypeScript — i tre path sono duplicati lì con un commento che spiega
 * perché.
 */
export const SPROUT_PATHS = [
	"M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3",
	"M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4",
	"M5 21h14",
];

export const TSUKI = "#f5f1e8";
export const MIDORI = "#6f8a63";
