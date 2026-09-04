import { ImageResponse } from "next/og";
import { SPROUT_PATHS, TSUKI, MIDORI } from "@/lib/pwa-icon";

/**
 * Icona per il bookmark/tab di Safari iOS (Fase 25). Stesso glifo di
 * `app/icon.tsx`, dimensione diversa (180×180 è lo standard `apple-touch-icon`).
 *
 * ⚠️ Sfondo OPACO, non trasparente: iOS ignora il canale alpha e riempie di
 * nero qualunque zona trasparente — lo stesso avviso che vale per
 * `public/apple-touch-icon.png` generato da `scripts/generate-pwa-icons.mjs`
 * per l'icona di installazione. Qui il colore pieno è già la scelta di
 * default di `ImageResponse` quando il div ha un `background` esplicito,
 * quindi non serve altro.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: TSUKI,
				}}
			>
				<svg
					width="128"
					height="128"
					viewBox="0 0 24 24"
					fill="none"
					stroke={MIDORI}
					strokeWidth={1.5}
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					{SPROUT_PATHS.map((d) => (
						<path key={d} d={d} />
					))}
				</svg>
			</div>
		),
		{ ...size },
	);
}
