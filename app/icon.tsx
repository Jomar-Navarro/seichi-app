import { ImageResponse } from "next/og";
import { SPROUT_PATHS, TSUKI, MIDORI } from "@/lib/pwa-icon";

/**
 * Icona per la tab del browser (Fase 25). Convenzione nativa Next
 * (`ImageResponse`/Satori) — zero file statici da mantenere, zero
 * dipendenze. Sostituisce visivamente `app/favicon.ico` (rimasto quello
 * scaffoldato di default, mai personalizzato) con il marchio reale
 * dell'app: lo stesso `Sprout` di `lucide-react` usato in
 * `components/UI/BrandHeader.tsx`, non un logo nuovo.
 *
 * Le costanti del glifo sono condivise con `app/apple-icon.tsx` via
 * `lib/pwa-icon.ts`. NON con `scripts/generate-pwa-icons.mjs`: quello
 * gira come script Node puro, fuori dalla build Next, e non può importare
 * un modulo TypeScript — da qui la piccola duplicazione dei tre path,
 * commentata nello script stesso.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
					width="22"
					height="22"
					viewBox="0 0 24 24"
					fill="none"
					stroke={MIDORI}
					strokeWidth={2}
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
