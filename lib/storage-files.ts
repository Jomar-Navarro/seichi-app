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
 * passare di qui, e deve raccogliere i path PRIMA del delete
 * (`receiptPathsOf()`): dopo, quali file fossero non è più scritto da nessuna
 * parte.
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
 * Quante voci legge ogni giro di `purgeStorageFolder`.
 *
 * ⚠️⚠️ È il difetto della #120. Senza opzioni `list()` usa il default di
 * storage-js, `{ limit: 100, offset: 0 }`: eliminando un account con 250
 * ricevute ne venivano rimosse 100, **senza errore**, e la RPC cancellava poi
 * utente e righe lasciando le altre 150 nel bucket per sempre — documenti con
 * IBAN, nomi e importi che nessuno avrebbe più potuto né vedere né cancellare.
 * Il troncamento non è un fallimento, quindi il "se fallisce ci fermiamo"
 * scritto accanto non scattava.
 *
 * Non può superare `STORAGE_REMOVE_CHUNK`: ogni giro rimuove ciò che ha letto
 * in una richiesta sola.
 */
export const STORAGE_LIST_PAGE = 1000;

/**
 * Il fusibile: oltre questo numero di giri ci si ferma con un errore.
 *
 * Un ciclo che non svuota mai la cartella è un guasto, non una cartella grande
 * (200 × 1000 file) — e senza tetto, dentro l'eliminazione di un account,
 * resterebbe appeso invece di dirlo. Stesso ruolo del fusibile di `readAll()`.
 */
const STORAGE_PURGE_MAX_ROUNDS = 200;

/** Quanto in basso si scende nelle sottocartelle prima di dichiarare un guasto. */
const STORAGE_PURGE_MAX_DEPTH = 5;

/**
 * Rimuove una lista di file, a blocchi.
 *
 * Restituisce il PRIMO errore e non si ferma lì: ogni chiamante preferisce che
 * resti il minor numero possibile di file.
 *
 * ⚠️ Un errore nullo NON basta a dire che i file sono spariti: con una policy
 * che nega la cancellazione `remove()` risponde senza errore e senza aver tolto
 * niente. La risposta però elenca gli oggetti cancellati davvero, e se sono
 * meno di quelli chiesti lo si dice — un path che arriva da una riga del
 * database e non si trova nel bucket è un'anomalia da leggere nei log, non un
 * successo.
 */
export async function removeStorageFiles(
	client: StorageClient,
	bucket: string,
	paths: string[],
): Promise<{ error: string | null }> {
	let primo: string | null = null;
	let rimossi = 0;
	for (let i = 0; i < paths.length; i += STORAGE_REMOVE_CHUNK) {
		const { data, error } = await client.storage
			.from(bucket)
			.remove(paths.slice(i, i + STORAGE_REMOVE_CHUNK));
		if (error) primo ??= error.message;
		else rimossi += (data ?? []).length;
	}
	if (!primo && rimossi < paths.length) {
		primo = `${paths.length - rimossi} file su ${paths.length} non rimossi da ${bucket} (assenti o negati)`;
	}
	return { error: primo };
}

/**
 * Svuota la cartella `folder` di un bucket, saltando `keep` (l'avatar appena
 * caricato, nel caso di `uploadAvatar`).
 *
 * ⚠️ Legge SEMPRE la prima pagina, rimuove ciò che trova e ricomincia, finché
 * la pagina non contiene più niente da togliere. Non pagina con un offset, e
 * la scelta è ciò che la rende indipendente da tetti che non conosciamo: con un
 * offset, una pagina più corta del richiesto andava presa per l'ultima, e se il
 * server un giorno tagliasse sotto `STORAGE_LIST_PAGE` l'elenco si fermerebbe
 * al primo giro (review della #120). Così una pagina tagliata costa solo un
 * giro in più.
 *
 * L'ultimo giro, quello che trova la cartella vuota, È la verifica: il
 * risultato non può dire "fatto" su un bucket ancora pieno. Per lo stesso
 * motivo un giro che non rimuove niente è un errore — un `remove()` negato da
 * una policy farebbe girare il ciclo a vuoto. Costa una lettura in più anche
 * quando la cartella si svuota al primo giro (un cambio di avatar fa
 * lettura, rimozione, lettura): è la prova, ed è il punto.
 *
 * ⚠️ Le voci con `id` nullo sono SOTTOCARTELLE: `list()` è piatta e le
 * restituisce come segnaposto. Avatar e ricevute vivono a un livello solo
 * (`{user_id}/{uuid}.{ext}`, vedi la `20260818`), quindi oggi non ne esistono;
 * se un giorno comparissero si svuotano anche loro invece di saltarle, o
 * l'eliminazione dell'account le abbandonerebbe dichiarando successo.
 *
 * Restituisce l'errore invece di ingoiarlo: è il chiamante a decidere se
 * fermarsi (`deleteAccount`) o proseguire (`uploadAvatar`, dove un file di
 * troppo è innocuo).
 *
 * `pageSize` esiste per il collaudo: il ciclo si prova abbassandolo, non
 * sperando che i dati di prova bastino a riempire una pagina da 1000.
 */
export async function purgeStorageFolder(
	client: StorageClient,
	bucket: string,
	folder: string,
	{ keep, pageSize = STORAGE_LIST_PAGE }: { keep?: string; pageSize?: number } = {},
): Promise<{ error: string | null }> {
	const r = await purgeRounds(client, bucket, folder, keep, pageSize, 0);
	return { error: "error" in r ? r.error : null };
}

async function purgeRounds(
	client: StorageClient,
	bucket: string,
	folder: string,
	keep: string | undefined,
	pageSize: number,
	depth: number,
): Promise<{ removed: number } | { error: string }> {
	// Almeno 2: con `keep` in cima, una pagina da 1 conterrebbe solo lui e il
	// ciclo dichiarerebbe vuota una cartella piena.
	const limit = Math.min(Math.max(pageSize, 2), STORAGE_REMOVE_CHUNK);
	let total = 0;

	for (let giro = 0; giro < STORAGE_PURGE_MAX_ROUNDS; giro++) {
		const { data, error } = await client.storage.from(bucket).list(folder, { limit, offset: 0 });
		if (error) return { error: error.message };

		const rows = data ?? [];
		const files = rows
			.filter((f) => f.id !== null)
			.map((f) => `${folder}/${f.name}`)
			.filter((p) => p !== keep);
		const subfolders = rows.filter((f) => f.id === null).map((f) => `${folder}/${f.name}`);

		if (files.length === 0 && subfolders.length === 0) return { removed: total };

		let progress = 0;
		for (const sub of subfolders) {
			if (depth >= STORAGE_PURGE_MAX_DEPTH) {
				return { error: `sottocartelle oltre ${STORAGE_PURGE_MAX_DEPTH} livelli in ${bucket}/${sub}` };
			}
			const r = await purgeRounds(client, bucket, sub, undefined, pageSize, depth + 1);
			if ("error" in r) return r;
			progress += r.removed;
		}

		if (files.length > 0) {
			const { data: gone, error: removeError } = await client.storage.from(bucket).remove(files);
			if (removeError) return { error: removeError.message };
			progress += (gone ?? []).length;
		}

		if (progress === 0) {
			return { error: `${files.length} file in ${bucket}/${folder} non rimossi (cancellazione negata?)` };
		}
		total += progress;
	}

	return { error: `${bucket}/${folder} non si svuota dopo ${STORAGE_PURGE_MAX_ROUNDS} giri` };
}
