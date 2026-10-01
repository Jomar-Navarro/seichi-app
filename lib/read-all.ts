/**
 * Il lettore a blocchi, in un posto solo.
 *
 * Nato come `leggiTutte` dentro `app/(main)/action.ts` per le serie storiche
 * di `/analisi` (23b), spostato qui dalla review della #120: le cancellazioni
 * con ricevute avevano bisogno della stessa cautela, e una terza copia scritta
 * a mano era l'occasione di dimenticarne un pezzo — il fusibile, l'ordinamento.
 * Fuori da `"use server"` perché non è un'azione: da là ogni funzione esportata
 * diventerebbe raggiungibile con una POST.
 */

/**
 * Quante righe per blocco.
 *
 * ⚠️ DEVE restare sotto il *Max rows* di PostgREST (1000 su questo progetto).
 * Il ciclo si ferma quando un blocco torna incompleto: se il tetto del server
 * scendesse sotto questo valore, il PRIMO blocco tornerebbe già corto e la
 * lettura si fermerebbe lì — reintroducendo il troncamento silenzioso che
 * questo lettore esiste per impedire. È la stessa regola di `IN_CHUNK` e di
 * `SEARCH_SCAN_LIMIT`, e come quelle va riletta se si tocca la Data API.
 *
 * 500 e non 1000 per la ragione di sempre: un margine che coincide col limite
 * esterno non è un margine.
 */
export const READ_ALL_CHUNK = 500;

/**
 * Un fermo contro un ciclo infinito, non un limite di prodotto.
 *
 * Stesso ruolo di `MAX_CHUNKS` nel Route Handler dell'export (23a): se un
 * blocco tornasse sempre pieno per un difetto nostro, il server resterebbe
 * appeso. Meglio un errore che una risposta che non arriva mai.
 */
const READ_ALL_MAX_CHUNKS = 200;

/**
 * Legge TUTTE le righe di una query, a blocchi.
 *
 * ⚠️⚠️ PostgREST ha un tetto proprio — *Max rows = 1000* su questo progetto — e
 * lo applica senza dire niente: senza questo lettore una query senza limite
 * restituisce le prime mille righe e basta, e nessun errore da nessuna parte.
 *
 * ⚠️⚠️ `crea` DEVE ordinare per una chiave UNIVOCA (di solito `id`). Senza un
 * ordinamento totale i blocchi sono query distinte che Postgres è libero di
 * ordinare diversamente a ogni giro, e una riga finisce in due blocchi mentre
 * un'altra in nessuno. Misurato nella 23b abbassando il blocco a 5: il Flusso
 * di «tutto» usciva € 2.766,12 invece di € 6.068,95.
 *
 * `label` finisce nel log quando scatta il fusibile, per sapere QUALE lettura
 * non si è chiusa.
 */
export async function readAll<T>(
	crea: (
		from: number,
		to: number,
	) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
	label: string,
): Promise<{ rows: T[]; error: string | null }> {
	const rows: T[] = [];
	for (let giro = 0; giro < READ_ALL_MAX_CHUNKS; giro++) {
		const from = giro * READ_ALL_CHUNK;
		const { data, error } = await crea(from, from + READ_ALL_CHUNK - 1);
		if (error) return { rows, error: error.message };
		const blocco = data ?? [];
		rows.push(...blocco);
		if (blocco.length < READ_ALL_CHUNK) return { rows, error: null };
	}

	// Centomila righe senza mai un blocco corto: è un difetto nostro, non un
	// archivio grande. Si dichiara invece di restituire dati a metà.
	console.error(`[${label}] troppi blocchi: la lettura non si è mai chiusa`);
	return { rows, error: `${label}: lettura non conclusa` };
}
