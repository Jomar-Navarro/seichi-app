import { ImageResponse } from "next/og";
import { sproutIconElement } from "@/lib/pwa-icon";

/**
 * Icona per il bookmark/tab di Safari iOS (Fase 25). Stesso glifo di
 * `app/icon.tsx` (`lib/pwa-icon.ts`, `sproutIconElement`), dimensione
 * diversa (180×180 è lo standard `apple-touch-icon`).
 *
 * ⚠️ Sfondo OPACO, non trasparente: iOS ignora il canale alpha e riempie di
 * nero qualunque zona trasparente. `sproutIconElement` disegna sempre uno
 * sfondo pieno (`background: TSUKI`), quindi non serve altro qui.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
	return new ImageResponse(sproutIconElement(180, 128), { ...size });
}
