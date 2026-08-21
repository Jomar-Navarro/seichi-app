"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
	ATTACHMENT_MAX_BYTES,
	ATTACHMENT_MIME,
	RECEIPT_BUCKET,
	SIGNED_URL_TTL,
	receiptPath,
} from "@/lib/attachments";
import { fill } from "@/lib/i18n/format";
import type { Attachment } from "@/types";

/**
 * Gli allegati di un movimento, già firmati.
 *
 * ⚠️ L'URL si firma QUI e non si memorizza: una firma scade, quindi una colonna
 * che la contenesse diventerebbe falsa da sola dopo qualche minuto, senza che
 * nulla la aggiorni. In colonna sta il `storage_path`, che non cambia mai.
 */
export async function getAttachments(
	transactionId: string,
): Promise<{ data: Attachment[] } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { data, error } = await supabase
		.from("attachments")
		.select("id, transaction_id, storage_path, mime_type, size_bytes, created_at")
		.eq("user_id", user.id)
		.eq("transaction_id", transactionId)
		.order("created_at", { ascending: true });

	if (error) {
		console.error("[attachments] getAttachments:", error.message);
		return { error: t.common.genericError };
	}

	const rows = data ?? [];
	if (rows.length === 0) return { data: [] };

	const { data: signed, error: signError } = await supabase.storage
		.from(RECEIPT_BUCKET)
		.createSignedUrls(rows.map((r) => r.storage_path), SIGNED_URL_TTL);

	if (signError) {
		console.error("[attachments] createSignedUrls:", signError.message);
		return { error: t.common.genericError };
	}

	/*
	 * ⚠️ Le firme si riabbinano per PATH, non per posizione nell'array.
	 *
	 * `createSignedUrls` restituisce un elemento per input, ma ciascuno può
	 * portare un proprio `error` — un file rimosso a mano dal bucket, per dire.
	 * Fidandosi dell'indice, un solo elemento fallito sposterebbe tutti quelli
	 * dopo di lui: ogni ricevuta mostrerebbe l'immagine di un'altra. Un difetto
	 * che non produce errori e che si vede solo se conosci le tue ricevute.
	 */
	const urlByPath = new Map(
		(signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path ?? "", s.signedUrl]),
	);

	return {
		data: rows.map((r) => ({
			...r,
			// `null` = il file non è firmabile (sparito dal bucket). La UI lo mostra
			// come rotto invece di far finta che non esista: una riga senza file è
			// un fatto da vedere, non da nascondere.
			url: urlByPath.get(r.storage_path) ?? null,
		})),
	};
}

/** Il conteggio per una lista di movimenti — per il segnaposto nella lista. */
export async function getAttachmentCounts(
	transactionIds: string[],
): Promise<Record<string, number>> {
	if (transactionIds.length === 0) return {};
	const { supabase, user } = await requireUser();
	if (!user) return {};

	const { data, error } = await supabase
		.from("attachments")
		.select("transaction_id")
		.eq("user_id", user.id)
		.in("transaction_id", transactionIds);

	if (error) {
		// ⚠️ Degrada, non blocca: il segnaposto è un di più, e la lista movimenti
		// deve restare leggibile anche se questa query fallisce.
		console.error("[attachments] getAttachmentCounts:", error.message);
		return {};
	}

	const counts: Record<string, number> = {};
	for (const row of data ?? []) {
		counts[row.transaction_id] = (counts[row.transaction_id] ?? 0) + 1;
	}
	return counts;
}

export async function uploadAttachment(
	formData: FormData,
): Promise<{ data: Attachment } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const transactionId = String(formData.get("transactionId") ?? "");
	const file = formData.get("file");

	if (!transactionId) return { error: t.common.genericError };
	if (!(file instanceof File) || file.size === 0) {
		return { error: t.errors.noFileSelected };
	}

	/*
	 * ⚠️ Il controllo di dimensione è QUI oltre che nel bucket, e i due non sono
	 * ridondanti: questo produce una frase leggibile con il limite scritto
	 * dentro, quello regge anche contro una richiesta costruita a mano.
	 *
	 * Se `ATTACHMENT_MAX_BYTES` superasse `bodySizeLimit` di next.config.ts, il
	 * rifiuto arriverebbe dal FRAMEWORK prima di entrare qui, con un errore che
	 * non dice niente all'utente. È il motivo per cui quella catena di quattro
	 * numeri va tenuta allineata a mano (vedi `lib/attachments.ts`).
	 */
	if (file.size > ATTACHMENT_MAX_BYTES) {
		return {
			// Il numero viene dalla COSTANTE, non dalla traduzione: così la frase non
			// può dichiarare un limite diverso da quello che il codice applica.
			error: fill(t.attachments.errors.tooLarge, {
				max: ATTACHMENT_MAX_BYTES / 1024 / 1024,
			}),
		};
	}

	const ext = ATTACHMENT_MIME[file.type];
	if (!ext) return { error: t.errors.unsupportedFormat };

	const path = receiptPath(user.id, ext);

	const { error: uploadError } = await supabase.storage
		.from(RECEIPT_BUCKET)
		.upload(path, file, { contentType: file.type, upsert: false });

	if (uploadError) {
		console.error("[attachments] upload:", uploadError.message);
		return { error: t.common.genericError };
	}

	const { data: row, error: insertError } = await supabase
		.from("attachments")
		.insert({
			user_id: user.id,
			transaction_id: transactionId,
			storage_path: path,
			mime_type: file.type,
			size_bytes: file.size,
		})
		.select("id, transaction_id, storage_path, mime_type, size_bytes, created_at")
		.single();

	if (insertError) {
		/*
		 * ⚠️ Compensazione: il file è già nel bucket, ma la riga che lo indica non
		 * esiste. Lasciarlo significherebbe un file che nessuna schermata può più
		 * mostrare e nessuna cancellazione può più raggiungere — un orfano creato
		 * dal percorso d'errore, che è il modo più silenzioso di accumularli.
		 *
		 * Stesso gesto che `uploadAvatar` fa nel proprio ramo di errore.
		 */
		await supabase.storage.from(RECEIPT_BUCKET).remove([path]);
		console.error("[attachments] insert:", insertError.message);
		// Il caso tipico è una transazione che non è (più) dell'utente: la FK
		// composita della 20260818 la rifiuta, ed è esattamente ciò che deve fare.
		return { error: t.attachments.errors.notSaved };
	}

	const { data: signed } = await supabase.storage
		.from(RECEIPT_BUCKET)
		.createSignedUrl(path, SIGNED_URL_TTL);

	revalidatePath("/", "layout");
	return { data: { ...row, url: signed?.signedUrl ?? null } };
}

export async function deleteAttachment(id: string): Promise<{ error?: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { data: row, error: readError } = await supabase
		.from("attachments")
		.select("storage_path")
		.eq("id", id)
		.eq("user_id", user.id)
		.single();

	if (readError || !row) return { error: t.common.genericError };

	/*
	 * ⚠️ Prima il FILE, poi la riga — e l'ordine è ciò che rende ogni fallimento
	 * recuperabile.
	 *
	 * Al contrario, la riga sparirebbe e il file resterebbe **irraggiungibile per
	 * sempre**: nessuna schermata lo mostra, nessuna cancellazione lo trova. Un
	 * orfano silenzioso.
	 *
	 * Così invece: se la rimozione del file fallisce ci fermiamo e non è cambiato
	 * niente (l'allegato è ancora lì, si riprova); se fallisce la riga, resta una
	 * riga che punta a un file assente — visibile come rotta, e il secondo tentativo
	 * la toglie, perché `remove()` su un file già assente non è un errore.
	 */
	const { error: removeError } = await supabase.storage
		.from(RECEIPT_BUCKET)
		.remove([row.storage_path]);

	if (removeError) {
		console.error("[attachments] remove:", removeError.message);
		return { error: t.common.genericError };
	}

	const { error } = await supabase
		.from("attachments")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) {
		console.error("[attachments] delete row:", error.message);
		return { error: t.common.genericError };
	}

	revalidatePath("/", "layout");
	return {};
}

