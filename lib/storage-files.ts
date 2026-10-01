import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Le cancellazioni di file dallo Storage, in un posto solo (issue #120).
 *
 * ⚠️ Stanno qui e non in un file `"use server"`: là ogni funzione esportata
 * diventa una server action raggiungibile con una POST diretta, e "rimuovi
 * questi path" senza toccare le righe che li indicano è un comando che nessuno
 * deve poter chiamare dall'esterno. Questo modulo riceve un client già
 * autenticato dal chiamante, che ha già deciso cosa cancellare.
 *
 * ⚠️ E i file in SQL non si toccano affatto: Supabase vieta il DELETE diretto su
 * `storage.objects` (Fase 16). Ogni cascade del database tiene pulite le righe e
 * lascia i file dove sono — per questo chi cancella righe con un allegato deve
 * passare di qui, e deve raccogliere i path PRIMA del delete: dopo, quali file
 * fossero non è più scritto da nessuna parte.
 */

/** Solo ciò che serve: un client di qualunque forma, purché abbia lo Storage. */
type StorageClient = Pick<SupabaseClient, "storage">;

/**
 * Quanti path in un solo `remove()`.
 *
 * L'API Storage rifiuta più di **1000 oggetti per richiesta**
 * (`MAX_OBJECTS_PER_REQUEST` in `src/storage/limits.ts` del server, letto il
 * 2026-10-01). Lo fa con un errore e non troncando, quindi coincidere col
 * limite qui non nasconde niente — al contrario di `SEARCH_SCAN_LIMIT`, che sta
 * sotto il tetto di PostgREST perché là il superamento è silenzioso.
 */
export const STORAGE_REMOVE_CHUNK = 1000;

/**
 * Quante voci per pagina di `list()`.
 *
 * ⚠️⚠️ È il difetto della #120. Senza opzioni `list()` usa il default di
 * storage-js, `{ limit: 100, offset: 0 }`: eliminando un account con 250
 * ricevute ne venivano rimosse 100, **senza errore**, e la RPC cancellava poi
 * utente e righe lasciando le altre 150 nel bucket per sempre — documenti con
 * IBAN, nomi e importi che nessuno avrebbe più potuto né vedere né cancellare.
 * Il troncamento non è un fallimento, quindi il "se fallisce ci fermiamo"
 * scritto accanto non scattava.
 *
 * Il server non pone un massimo a `limit`; si pagina comunque, e la verifica in
 * fondo a `purgeStorageFolder` copre anche un tetto che un giorno comparisse.
 */
export const STORAGE_LIST_PAGE = 1000;

/**
 * Il fusibile: oltre questo numero di pagine ci si ferma con un errore.
 *
 * Un elenco che non finisce mai è un guasto, non una cartella grande — e un
 * ciclo senza tetto dentro l'eliminazione di un account resterebbe appeso
 * invece di dirlo. Stesso ruolo di `ANALYTICS_MAX_CHUNKS`.
 */
const STORAGE_LIST_MAX_PAGES = 100;

/**
 * Rimuove una lista di file, a blocchi.
 *
 * Restituisce il PRIMO errore e non si ferma lì: ogni chiamante preferisce che
 * resti il minor numero possibile di file — chi registra e prosegue
 * (`deleteTransaction`, `deleteGoal`, `undoImport`) quanto chi si ferma
 * (`deleteAccount`), che comunque non distruggerà l'account.
 *
 * ⚠️ Un errore nullo NON dimostra che i file siano spariti: con una policy che
 * nega la cancellazione `remove()` risponde senza errore e senza aver tolto
 * niente. Dove conta davvero — l'eliminazione dell'account — la prova è la
 * rilettura di `purgeStorageFolder`, non questo valore.
 */
export async function removeStorageFiles(
	client: StorageClient,
	bucket: string,
	paths: string[],
): Promise<{ error: string | null }> {
	let primo: string | null = null;
	for (let i = 0; i < paths.length; i += STORAGE_REMOVE_CHUNK) {
		const { error } = await client.storage
			.from(bucket)
			.remove(paths.slice(i, i + STORAGE_REMOVE_CHUNK));
		if (error) primo ??= error.message;
	}
	return { error: primo };
}

/**
 * Tutti i file di una cartella, pagina per pagina.
 *
 * ⚠️ Le voci con `id` nullo sono SOTTOCARTELLE, non file: `list()` è piatta e le
 * restituisce come segnaposto. Avatar e ricevute vivono a un livello solo
 * (`{user_id}/{uuid}.{ext}`, vedi la `20260818`) proprio perché `list()` non
 * scende, quindi oggi non ne esistono. Se un giorno comparissero lo si scrive
 * nei log invece di tacere: i file là dentro non verrebbero né visti né rimossi.
 */
async function listFolder(
	client: StorageClient,
	bucket: string,
	folder: string,
	pageSize: number,
): Promise<{ paths: string[] } | { error: string }> {
	const paths: string[] = [];

	for (let page = 0; page < STORAGE_LIST_MAX_PAGES; page++) {
		const { data, error } = await client.storage
			.from(bucket)
			.list(folder, { limit: pageSize, offset: page * pageSize });
		if (error) return { error: error.message };

		const rows = data ?? [];
		for (const f of rows) {
			if (f.id === null) {
				console.error("[storage] sottocartella non rimossa:", `${bucket}/${folder}/${f.name}`);
				continue;
			}
			paths.push(`${folder}/${f.name}`);
		}
		// Una pagina non piena è l'ultima. Con una cartella che è un multiplo
		// esatto di `pageSize` costa una richiesta in più, che torna vuota.
		if (rows.length < pageSize) return { paths };
	}

	return {
		error: `più di ${STORAGE_LIST_MAX_PAGES * pageSize} voci in ${bucket}/${folder}`,
	};
}

/**
 * Svuota la cartella `folder` di un bucket, saltando `keep` (l'avatar appena
 * caricato, nel caso di `uploadAvatar`).
 *
 * Tre passi: elenca tutto, rimuove a blocchi, **rilegge**. L'ultimo non è
 * pignoleria: è l'unico modo di sapere che la cartella è davvero vuota. Un
 * `remove()` negato da una policy risponde senza errore, e un elenco troncato
 * da un tetto che non conosciamo sembrerebbe completo — in entrambi i casi senza
 * la rilettura il risultato sarebbe "fatto" su un bucket ancora pieno.
 *
 * Restituisce l'errore invece di ingoiarlo: è il chiamante a decidere se
 * fermarsi (`deleteAccount`) o proseguire (`uploadAvatar`, dove un file di
 * troppo è innocuo).
 *
 * `pageSize` esiste per il collaudo: la paginazione si prova abbassandolo, non
 * sperando che i dati di prova bastino a riempire una pagina da 1000.
 */
export async function purgeStorageFolder(
	client: StorageClient,
	bucket: string,
	folder: string,
	{ keep, pageSize = STORAGE_LIST_PAGE }: { keep?: string; pageSize?: number } = {},
): Promise<{ error: string | null }> {
	const listed = await listFolder(client, bucket, folder, pageSize);
	if ("error" in listed) return { error: listed.error };

	const stale = listed.paths.filter((p) => p !== keep);
	if (stale.length === 0) return { error: null };

	const removed = await removeStorageFiles(client, bucket, stale);
	if (removed.error) return removed;

	const after = await listFolder(client, bucket, folder, pageSize);
	if ("error" in after) return { error: after.error };

	const left = after.paths.filter((p) => p !== keep);
	if (left.length > 0) {
		return { error: `${left.length} file ancora presenti in ${bucket}/${folder} dopo la rimozione` };
	}
	return { error: null };
}
