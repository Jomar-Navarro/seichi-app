import { cookies } from "next/headers";
import type { MetadataRoute } from "next";
import { getI18n } from "@/lib/i18n/server";
import {
	DEFAULT_RESOLVED,
	isResolvedTheme,
	THEME_RESOLVED_COOKIE,
} from "@/lib/theme";

/**
 * Manifest PWA (Fase 25). Route Handler nativo di Next — zero dipendenze,
 * sostituisce quello che altrove sarebbe un `public/manifest.json` statico.
 *
 * ⚠️ Usa `cookies()`, una Request-time API: per Next questo lo rende un
 * Route Handler DINAMICO invece che cacheable (vedi la doc del file
 * convention). È voluto, non un effetto collaterale — è lo stesso principio
 * di ogni altra pagina di questa app: il cookie decide, il primo byte è
 * quello giusto. Senza, l'icona sulla home screen e la schermata di splash
 * userebbero sempre gli stessi colori, indipendenti dal tema scelto.
 *
 * `name`/`description` riusano `t.meta.*` — le stesse stringhe già mostrate
 * in `<title>`/`<meta name="description">` da `generateMetadata()` in
 * `app/layout.tsx`. Nessuna chiave di dizionario nuova.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
	const { t } = await getI18n();
	const store = await cookies();
	const rawResolved = store.get(THEME_RESOLVED_COOKIE)?.value;
	const resolved = isResolvedTheme(rawResolved) ? rawResolved : DEFAULT_RESOLVED;

	// ⚠️ `--background` in globals.css è un radial-gradient, non un colore — un
	// manifest non sa disegnare un gradiente. Qui si usa lo stop dominante di
	// ciascun tema (il centro dell'ellisse, in alto): `--color-tsuki` in chiaro
	// (la "carta" del progetto, non ridefinita in `.dark` — stesso token già
	// scelto per lo sfondo del report stampabile, Fase 23b) e il primo stop del
	// gradiente scuro (`#1a2436`) in scuro. Sono i due unici colori dell'app che
	// compaiono anche FUORI da una pagina renderizzata — schermata di splash
	// Android, colore della barra di stato — quindi vanno duplicati come hex:
	// un manifest non può leggere `var(--color-tsuki)`.
	const background = resolved === "dark" ? "#1a2436" : "#f5f1e8";
	const theme = resolved === "dark" ? "#1a2436" : "#f5f1e8";

	return {
		name: t.meta.title,
		short_name: "Seichi",
		description: t.meta.description,
		start_url: "/",
		display: "standalone",
		background_color: background,
		theme_color: theme,
		icons: [
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{
				src: "/icon-512-maskable.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	};
}
