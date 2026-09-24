/**
 * Se su questo dispositivo la sidebar desktop si VEDE (review post-merge
 * dell'issue #108).
 *
 * Il footer della sidebar — avatar, nome, "N conti attivi" — costa due query
 * (`profiles` e il conteggio dei conti), e le paga ogni render del layout di
 * `(main)`: il caricamento completo e ogni `revalidatePath("/", "layout")`,
 * cioè ogni movimento salvato. Ma la rail è `hidden lg:flex`: sul telefono le
 * query giravano per un footer che nessuno vede, e la `profiles` era condivisa
 * con la pagina solo sulla home.
 *
 * ⚠️ Il server NON sa quanto è larga la finestra: la larghezza è una proprietà
 * del browser e non viaggia negli header. È il caso del secondo cookie del
 * tema (Fase 18, `THEME_RESOLVED_COOKIE`), e la soluzione è la stessa: la
 * scrive il client, che la conosce, e il server la legge alla richiesta
 * successiva.
 *
 * ⚠️ Cookie ASSENTE = sidebar visibile, cioè si fanno le query. È il
 * comportamento di prima, e sbagliare in questo verso costa due query una
 * volta sola — la prima visita da un telefono, dopo la quale il client scrive
 * "0". Sbagliare nell'altro verso lascerebbe la rail di un desktop senza
 * footer fino al render successivo.
 *
 * Questo modulo non importa `next/headers`: lo usano sia il layout (lettura)
 * sia la sidebar (scrittura).
 */

export const SIDEBAR_COOKIE = "seichi-sidebar";

/**
 * Il breakpoint da cui la rail esiste: `lg:` di Tailwind v4, che è
 * `@media (width >= 64rem)`. Scritto in `rem` come lo scrive Tailwind — non
 * `1024px` — così i due coincidono anche con una dimensione di carattere di
 * base diversa da quella di default.
 */
export const SIDEBAR_MEDIA_QUERY = "(min-width: 64rem)";

/** Un anno, come gli altri cookie di preferenza: il dispositivo non cambia larghezza da solo. */
const MAX_AGE = 60 * 60 * 24 * 365;

/** Dal valore grezzo del cookie. Assente o sconosciuto = visibile (vedi sopra). */
export function sidebarVisibleFromCookie(value: string | undefined): boolean {
	return value !== "0";
}

/** Solo client. Niente `httpOnly`: non è un segreto, e lo scrive il browser. */
export function writeSidebarCookie(visible: boolean) {
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${SIDEBAR_COOKIE}=${visible ? "1" : "0"}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
}
