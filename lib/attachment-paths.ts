import type { SupabaseServerClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/read-all";

/**
 * Quali righe di `transactions` sta per cancellare il chiamante — e quindi di
 * quali ricevute vanno tolti i file (#120).
 *
 * ⚠️ L'ambito è quello della CASCATA, non quello del delete scritto nel codice.
 * `deleteGoal` cancella esplicitamente i versamenti `risparmio`, ma poi la
 * categoria fa cascata su TUTTI i movimenti che la usano — e il tipo di una
 * categoria si può cambiare quando ha già dei movimenti. Una "spesa" diventata
 * obiettivo porta con sé spese con ricevute: raccogliendo i soli versamenti,
 * quei file restavano nel bucket. Trovato dalla review della #120.
 */
export type ReceiptScope =
	| { transaction: string }
	/** `type` restringe ai movimenti di quel tipo (i versamenti di un obiettivo). */
	| { category: string; type?: string }
	| { import: string };

/**
 * I path delle ricevute di un ambito, letti PRIMA che la cascata li cancelli.
 *
 * Una query sola su `attachments`, filtrata attraverso la transazione
 * (`transactions!inner`): restituisce direttamente i path, a blocchi, e non ha
 * bisogno di passare gli id dei movimenti dentro una `.in()` — che viaggia
 * nella query string e oltre ~215 uuid viene rifiutata dal proxy (`IN_CHUNK`).
 * La relazione è una sola, la FK composita `attachments_transaction_owner_fkey`,
 * quindi il nome della tabella basta a sceglierla.
 *
 * ⚠️ Restituisce un ERRORE, non un elenco parziale: i chiamanti si fermano
 * prima di cancellare. Niente è ancora stato toccato, quindi un guasto
 * passeggero si riprova gratis — mentre cancellando lo stesso, una lettura
 * fallita diventava un file orfano per sempre.
 */
export async function receiptPathsOf(
	supabase: SupabaseServerClient,
	userId: string,
	scope: ReceiptScope,
): Promise<{ paths: string[] } | { error: string }> {
	const { rows, error } = await readAll<{ storage_path: string }>((from, to) => {
		let q = supabase
			.from("attachments")
			.select("storage_path, transactions!inner(id)")
			.eq("user_id", userId);
		if ("transaction" in scope) q = q.eq("transaction_id", scope.transaction);
		else if ("category" in scope) {
			q = q.eq("transactions.category_id", scope.category);
			if (scope.type) q = q.eq("transactions.type", scope.type);
		} else q = q.eq("transactions.import_id", scope.import);
		// Ordinamento TOTALE: senza, i blocchi perdono righe (vedi `readAll`).
		return q.order("id", { ascending: true }).range(from, to);
	}, "ricevute");

	if (error) {
		console.error("[ricevute] lettura dei path prima di una cancellazione:", error, scope);
		return { error };
	}
	return { paths: rows.map((r) => r.storage_path) };
}
