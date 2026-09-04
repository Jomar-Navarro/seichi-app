import { ImageResponse } from "next/og";
import { sproutIconElement } from "@/lib/pwa-icon";

/**
 * Icona per la tab del browser (Fase 25). Convenzione nativa Next
 * (`ImageResponse`/Satori) — zero file statici da mantenere, zero
 * dipendenze. Sostituisce visivamente `app/favicon.ico` (rimasto quello
 * scaffoldato di default, mai personalizzato) con il marchio reale
 * dell'app: lo stesso `Sprout` di `lucide-react` usato in
 * `components/UI/BrandHeader.tsx`, non un logo nuovo.
 *
 * Il markup vero e proprio è in `lib/pwa-icon.ts` (`sproutIconElement`),
 * condiviso con `app/apple-icon.tsx`: le due icone differiscono solo per
 * dimensione, non per disegno.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
	return new ImageResponse(sproutIconElement(32, 22), { ...size });
}
