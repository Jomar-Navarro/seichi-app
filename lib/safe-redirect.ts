/**
 * Normalizza il parametro `next` dei redirect di auth.
 *
 * Accetta solo percorsi interni. In particolare scarta `//host` e
 * `/\host`: il browser li interpreta come URL protocol-relative, quindi
 * lasciarli passare aprirebbe un open redirect verso un dominio esterno a
 * partire da un link di conferma email — il vettore classico per il phishing.
 */
export function safeNext(next: string | null, fallback = "/"): string {
	if (!next) return fallback;
	if (!next.startsWith("/")) return fallback;
	if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
	return next;
}
