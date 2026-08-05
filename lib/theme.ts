/**
 * Tema chiaro/scuro (Fase 18).
 *
 * La preferenza vive in un COOKIE, non in localStorage. Il motivo è che la
 * classe `.dark` sta su `<html>`, che viene emesso dal root layout — un server
 * component. Il cookie viaggia con la richiesta, quindi il server sa già quale
 * tema rendere e il primo byte è quello giusto: niente flash e niente
 * `suppressHydrationWarning`, che serve solo a zittire il mismatch causato da
 * uno script inline che legge localStorage dopo l'arrivo dell'HTML.
 *
 * Questo modulo non importa `next/headers`: deve poter essere usato anche dai
 * client component. La lettura lato server sta in `app/layout.tsx`.
 */

/** Cosa ha scelto l'utente. */
export type ThemeChoice = "light" | "dark" | "system";

/** Cosa viene effettivamente reso: "system" qui non esiste, è già risolto. */
export type ResolvedTheme = "light" | "dark";

/** Scelta dell'utente. */
export const THEME_COOKIE = "seichi-theme";

/**
 * Valore risolto quando la scelta è "system".
 *
 * Serve un secondo cookie perché `prefers-color-scheme` è una proprietà del
 * browser e NON viaggia negli header: il server, da solo, non saprebbe cosa sia
 * il "sistema" dell'utente. Lo scrive il client, che invece lo conosce.
 * Con questo in mano il server emette sempre una risposta esplicita, e
 * `globals.css` resta a due soli blocchi (`:root` chiaro, `.dark` scuro) —
 * nessuna duplicazione dei ~50 token dentro una media query.
 */
export const THEME_RESOLVED_COOKIE = "seichi-theme-resolved";

/**
 * Primissima visita, nessun cookie ancora scritto: si rende scuro, cioè
 * l'aspetto che l'app ha sempre avuto. Il `ThemeProvider` corregge al mount se
 * il sistema dice altro — un solo lampo, una sola volta, e mai più.
 */
export const DEFAULT_CHOICE: ThemeChoice = "system";
export const DEFAULT_RESOLVED: ResolvedTheme = "dark";

/** Un anno: la preferenza non deve scadere mentre l'utente non usa l'app. */
const MAX_AGE = 60 * 60 * 24 * 365;

export function isThemeChoice(value: unknown): value is ThemeChoice {
	return value === "light" || value === "dark" || value === "system";
}

export function isResolvedTheme(value: unknown): value is ResolvedTheme {
	return value === "light" || value === "dark";
}

/** Etichette italiane per la UI — sentence case, come tutto il resto. */
export const THEME_LABELS: Record<ThemeChoice, string> = {
	light: "chiaro",
	dark: "scuro",
	system: "sistema",
};

/* ---------------------------------------------------------------- client --- */

/** Cosa dice il sistema operativo in questo momento. Solo lato client. */
export function systemTheme(): ResolvedTheme {
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Da scelta a tema reso. */
export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
	return choice === "system" ? systemTheme() : choice;
}

/**
 * Applica la classe subito, senza aspettare il server.
 *
 * È ciò che rende il cambio istantaneo: il cookie serve al PROSSIMO caricamento,
 * questa riga al fotogramma corrente.
 */
export function applyThemeClass(resolved: ResolvedTheme) {
	document.documentElement.classList.toggle("dark", resolved === "dark");
}

/**
 * Persiste la preferenza per le richieste successive.
 *
 * Niente `httpOnly`: il client deve poterli rileggere per sapere se sta
 * seguendo il sistema. Un tema non è un segreto, non c'è nulla da proteggere.
 */
export function writeThemeCookies(choice: ThemeChoice, resolved: ResolvedTheme) {
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	const attrs = `; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
	document.cookie = `${THEME_COOKIE}=${choice}${attrs}`;
	document.cookie = `${THEME_RESOLVED_COOKIE}=${resolved}${attrs}`;
}
