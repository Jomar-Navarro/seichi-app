/**
 * Lingua dell'interfaccia (Fase 19).
 *
 * IL LOCALE NON STA NELL'URL. Le route restano quelle che sono (`/impostazioni`,
 * `/risparmi`): sono identificatori, non testo rivolto all'utente. Metterlo nel
 * percorso avrebbe imposto di spostare tutto sotto `app/[locale]/`, riadattare il
 * matching di `PUBLIC_PATHS` nel proxy e rivedere ogni `redirect()` e ogni
 * `emailRedirectTo` dei flussi auth — in cambio di URL condivisibili per lingua e
 * di SEO multilingua, che dietro un login non valgono nulla.
 *
 * La preferenza vive quindi in un COOKIE, esattamente come il tema della Fase 18 e
 * per lo stesso motivo: `<html lang>` lo emette il root layout, che è un server
 * component, e il cookie viaggia con la richiesta — il primo byte è già nella
 * lingua giusta.
 *
 * ⚠️ Ma qui, al contrario del tema, NON SERVE UN SECONDO COOKIE. Il tema ne ha due
 * perché `prefers-color-scheme` è una proprietà del browser e non viaggia negli
 * header, lasciando il server cieco sulla scelta "sistema". `Accept-Language`
 * invece viaggia eccome: il server può risolvere da sé anche alla primissima
 * visita, senza che il client gli scriva niente. È il caso speculare, e va sfruttato
 * invece di ricopiare la struttura del tema per simmetria.
 *
 * Questo modulo non importa `next/headers`: deve poter essere usato anche dai
 * client component. La lettura lato server sta in `lib/i18n/server.ts`.
 */

/** Le lingue che l'app parla. */
export const LOCALES = ["it", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** Italiano: è la lingua in cui l'app è nata e in cui è scritto ogni mockup. */
export const DEFAULT_LOCALE: Locale = "it";

export const LOCALE_COOKIE = "seichi-lang";

/** Un anno, come per il tema: la preferenza non deve scadere per inattività. */
const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Il tag da passare a `Intl` — che è un'altra cosa dalla lingua dell'interfaccia.
 *
 * ⚠️ Per l'inglese si usa `en-GB`, non `en-US`. Seichi è un'app europea in euro:
 * `en-US` scriverebbe le date come `8/7/2026` (mese per primo), cioè l'esatto
 * difetto che la Fase 18 aveva annotato come debito da chiudere qui. `en-GB` dà
 * `07/08/2026` e `€1,234.50`, che è ciò che si aspetta chi vive in Europa e
 * preferisce leggere l'inglese. La lingua è una scelta di lettura, non una
 * dichiarazione di residenza.
 */
export const INTL_LOCALE: Record<Locale, string> = {
	it: "it-IT",
	en: "en-GB",
};

/**
 * Il nome di ogni lingua NELLA LINGUA STESSA (endonimo).
 *
 * Non si traduce e non entra nei dizionari: un selettore di lingua che scrive
 * "Inglese" a chi cerca l'inglese è inutile proprio a chi ne ha bisogno — se non
 * capisci la lingua corrente non sai riconoscere il nome della tua.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
	it: "Italiano",
	en: "English",
};

export function isLocale(value: unknown): value is Locale {
	return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Da una stringa qualsiasi al tag canonico, o `null` se non la parliamo.
 *
 * ⚠️ Il minuscolo non è pedanteria: l'onboarding ha sempre scritto `"IT"`/`"EN"`
 * in `profiles.language` mentre le impostazioni leggevano `"it"`/`"en"`. Finora
 * nessuno consumava quel valore e il difetto era invisibile; da questa fase in poi
 * significherebbe app in italiano per chi ha scelto l'inglese alla registrazione.
 * Tollera anche i tag regionali (`en-GB` → `en`) perché la stessa funzione digerisce
 * gli header `Accept-Language`.
 */
export function normalizeLocale(value: unknown): Locale | null {
	if (typeof value !== "string") return null;
	const primary = value.trim().toLowerCase().split("-")[0];
	return isLocale(primary) ? primary : null;
}

/**
 * Sceglie la lingua leggendo `Accept-Language`.
 *
 * Ordina per fattore di qualità (`it;q=0.9`) e prende la prima che l'app parla.
 * Serve solo quando non c'è ancora un cookie — cioè alla primissima visita, prima
 * del login: in quel momento non esiste nemmeno un `profiles.language` da guardare,
 * e la scelta è fra questa e un italiano d'ufficio.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
	if (!acceptLanguage) return DEFAULT_LOCALE;

	const ranked = acceptLanguage
		.split(",")
		.map((part) => {
			const [tag, ...params] = part.split(";").map((s) => s.trim());
			const q = params
				.find((p) => p.startsWith("q="))
				?.slice(2);
			// Un `q` assente vale 1; uno illeggibile vale 0, così non scavalca nulla.
			const quality = q === undefined ? 1 : Number.parseFloat(q);
			return { tag, quality: Number.isFinite(quality) ? quality : 0 };
		})
		.filter((entry) => entry.quality > 0)
		.sort((a, b) => b.quality - a.quality);

	for (const { tag } of ranked) {
		const locale = normalizeLocale(tag);
		if (locale) return locale;
	}

	return DEFAULT_LOCALE;
}

/* ---------------------------------------------------------------- client --- */

/**
 * Persiste la lingua per le richieste successive.
 *
 * Niente `httpOnly`, come per il tema: non c'è nulla da proteggere. Il cookie è
 * la fonte per il RENDERING; `profiles.language` resta la persistenza fra
 * dispositivi e viene riseminato qui al login (vedi `lib/i18n/server.ts`).
 */
export function writeLocaleCookie(locale: Locale) {
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
}

/** Attributi del cookie per chi lo scrive dal server (server action o route). */
export const LOCALE_COOKIE_OPTIONS = {
	path: "/",
	maxAge: MAX_AGE,
	sameSite: "lax",
	httpOnly: false,
} as const;
