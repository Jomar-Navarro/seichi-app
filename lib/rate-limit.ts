import type { Dictionary } from "@/lib/i18n/dictionaries/it";
import type { Locale } from "@/lib/i18n/config";
import { fill, formatRetryIn } from "@/lib/i18n/format";
import type { SupabaseServerClient } from "@/lib/supabase/server";

/**
 * Limiti di frequenza per utente (#161).
 *
 * Le soglie stanno SOLO nel database (`consume_rate_limit()`, migration
 * `20261119_rate_limits`): l'app non le conosce, legge soltanto quanti secondi
 * aspettare. Due copie divergerebbero, e la frase direbbe un tetto falso.
 *
 * Il perimetro, deciso con Jomar: ricevute e avatar nelle loro action, l'export
 * nella sua rotta, l'import DENTRO `import_transactions()` — che una RPC diretta
 * salterebbe la action. Storia: `docs/storia/issue-161-limiti.md`.
 */
export type RateLimitAction = "receipt" | "import" | "export" | "avatar" | "archive";

/**
 * Il codice con cui `import_transactions()` rifiuta un import oltre il tetto,
 * con i secondi nel `details`. Proprio, e non uno standard: `54000` («program
 * limit exceeded») lo confonderebbe con un guasto vero.
 */
export const RATE_LIMITED_SQLSTATE = "SR429";

export type RateLimitCheck =
	/**
	 * 0: concessa, e già registrata. Altrimenti rifiutata, con i secondi che
	 * mancano perché si liberi un posto.
	 */
	| { wait: number }
	/** Il contatore non ha risposto: NON è un via libera. */
	| { error: { message: string; code?: string } };

/**
 * Consuma un posto del tetto, o dice quanto aspettare.
 *
 * ⚠️ Un guasto del contatore ferma l'azione (`error`), non la lascia passare:
 * un limite che si spegne quando il database ha problemi non limita niente, e
 * l'azione che segue fallirebbe comunque sullo stesso database.
 */
export async function consumeRateLimit(
	supabase: SupabaseServerClient,
	action: RateLimitAction,
): Promise<RateLimitCheck> {
	const { data, error } = await supabase.rpc("consume_rate_limit", { p_action: action });
	if (error) return { error };
	return { wait: data };
}

/**
 * I secondi da aspettare, se l'errore è il rifiuto del tetto dell'import;
 * altrimenti `null`, e l'errore resta un guasto da registrare.
 *
 * Un `SR429` senza un numero valido nel `details` non si traduce in un'attesa
 * inventata: torna `null`, e il chiamante dice «errore» invece di un tempo falso.
 */
export function retryAfterFromError(error: { code?: string; details?: string | null }): number | null {
	if (error.code !== RATE_LIMITED_SQLSTATE) return null;
	const seconds = Number(error.details);
	return Number.isInteger(seconds) && seconds > 0 ? seconds : null;
}

/** La frase del rifiuto: azione e attesa, nella lingua dell'utente. */
export function rateLimitMessage(
	t: Dictionary,
	locale: Locale,
	action: RateLimitAction,
	seconds: number,
): string {
	return fill(t.errors.rateLimit[action], { when: formatRetryIn(seconds, locale) });
}
