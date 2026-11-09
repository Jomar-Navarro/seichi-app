/**
 * Movimento ridotto (issue #153) — la parte che il CSS non raggiunge.
 *
 * Le animazioni CSS si regolano da sé in `globals.css`, con una regola
 * `prefers-reduced-motion` accanto a ciascuna. Uno scorrimento chiesto da
 * JavaScript (`scrollTo`, `scrollIntoView`) invece no: `behavior: "smooth"` fa
 * scorrere la pagina anche a chi ha chiesto di ridurre il movimento, e uno
 * scorrimento lungo è proprio il movimento che dà fastidio a chi soffre di
 * cinetosi. Con movimento ridotto si salta, senza scorrere.
 *
 * Letto al momento del gesto, non sottoscritto: la preferenza cambia dalle
 * impostazioni del sistema, e il prossimo scorrimento la vede già.
 *
 * ⚠️ I grafici non passano di qui: Recharts 3 la legge da sé quando
 * `isAnimationActive` vale `"auto"`, che è il suo default. Vedi
 * `MonthlyLineChart` e `SpendingPieChart`.
 */
export function scrollBehavior(): ScrollBehavior {
	if (typeof window === "undefined" || !window.matchMedia) return "smooth";
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
