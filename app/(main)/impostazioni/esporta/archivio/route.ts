import { NextResponse, type NextRequest } from "next/server";
import { requireLiveUser } from "@/lib/auth";
import { readAll } from "@/lib/read-all";
import { consumeRateLimit } from "@/lib/rate-limit";
import { exportErrorRedirect } from "@/lib/export/download-response";
import type { ExportError } from "@/lib/export/download-error";
import { RECEIPT_BUCKET } from "@/lib/attachments";
import { toCsv } from "@/lib/export/csv";
import { transactionCsvHeader, transactionCsvRows } from "@/lib/export/transactions-csv";
import { ZipWriter, fitsInZip } from "@/lib/export/zip";
import {
	archiveFileName,
	archiveManifest,
	archiveReadme,
	avatarExtension,
	avatarStoragePath,
	dataFile,
	jsonBytes,
	receiptEntryName,
	withoutOwner,
	type ArchiveTable,
	type AvatarStatus,
} from "@/lib/export/archive";
import type { SupabaseServerClient } from "@/lib/supabase/server";

/**
 * L'archivio completo: tutti i dati dell'utente in uno ZIP (issue #162).
 *
 * Un Route Handler per la ragione del CSV della 23a: un `Content-Disposition`
 * lo scarica il browser da sé, anche su iOS, e qui in più la risposta è uno
 * STREAM — una server action dovrebbe tenere l'intero archivio in memoria.
 * Storia e scelte: `docs/storia/issue-162-archivio.md`.
 *
 * ## L'ordine, che è la correttezza
 *
 * 1. **Utente VIVO** (`requireLiveUser()`): l'email finisce in un file salvato,
 *    e le claims dopo un cambio portano l'indirizzo vecchio per un'ora.
 * 2. **Il tetto** (`archive`, 3 al giorno): prima di qualunque lettura, perché
 *    le letture stesse sono il lavoro. Una lettura che poi fallisce consuma il
 *    suo posto, come nel CSV: un tetto che si potesse girare a vuoto non
 *    limiterebbe le letture.
 * 3. **TUTTO il database, prima dello stream.** Dopo la prima riga lo stato 200
 *    è già partito e un errore non può più diventare una risposta: una tabella
 *    letta male diventerebbe un `[]` scritto in un file, cioè «non hai conti».
 *    Meglio nessun file di un file che afferma il falso (23a, #124).
 * 4. **Le ricevute nello stream**, una dopo l'altra dal bucket privato con il
 *    client dell'utente (valgono le policy dello Storage). In memoria restano
 *    la ricevuta corrente e le poche già chieste in anticipo.
 *
 * ⚠️ Una ricevuta che non si scarica si riprova una volta, poi si SALTA e si
 * DICHIARA (`manifest.json`, `LEGGIMI.txt`, `file: null` in
 * `attachments.json`). Troncare la connessione lascerebbe un file corrotto che
 * alcuni browser salvano comunque, e un archivio di 300 ricevute non si perde
 * per una.
 */

/**
 * Il tempo massimo della funzione, in secondi: conta anche lo streaming. 300 è
 * il tetto del piano Hobby con Fluid compute; senza Fluid compute il limite
 * della piattaforma è più basso e questo valore viene ridotto.
 */
export const maxDuration = 300;

/**
 * Quante ricevute si chiedono in anticipo mentre si spedisce la corrente.
 * L'ordine nell'archivio resta quello dell'elenco: si anticipa il download,
 * non la scrittura. Quattro tengono al massimo ~8 MB in memoria (2 MB l'una).
 */
const PREFETCH = 4;

/**
 * ⚠️ Ogni errore torna alla pagina dell'export con un codice, mai con un
 * testo: il comando è un `<a>` nudo, e un testo sarebbe una pagina bianca
 * senza tasto indietro nella PWA installata. Vedi `lib/export/download-error.ts`.
 */
const fail = (req: NextRequest, error: ExportError) => exportErrorRedirect(req, error);

/** Un file di un bucket come byte, o `null` dopo due tentativi falliti. */
async function download(
	supabase: SupabaseServerClient,
	bucket: string,
	path: string,
	signal: AbortSignal,
): Promise<Uint8Array | null> {
	for (let attempt = 1; attempt <= 2; attempt++) {
		if (signal.aborted) return null;
		try {
			const { data, error } = await supabase.storage.from(bucket).download(path);
			if (error || !data) throw error ?? new Error("risposta vuota");
			return new Uint8Array(await data.arrayBuffer());
		} catch (e) {
			// Il path no: è l'indirizzo di un documento privato. Bastano il bucket e
			// il tentativo per leggere il guasto; l'id della ricevuta lo scrive
			// l'archivio stesso.
			console.error(`[archivio] download da ${bucket}, tentativo ${attempt}:`, e instanceof Error ? e.message : e);
		}
	}
	return null;
}

export async function GET(req: NextRequest) {
	const { supabase, user, t, locale, unreachable } = await requireLiveUser("archivio");

	// GoTrue che non risponde non è una sessione scaduta (#124): un errore che si
	// riprova, non un rinvio al login.
	if (!user) {
		if (unreachable) return fail(req, { target: "archivio", code: "rete" });
		return NextResponse.redirect(new URL("/sign", req.url));
	}

	const limit = await consumeRateLimit(supabase, "archive");
	if ("error" in limit) {
		console.error("[archivio] limite:", limit.error.code, limit.error.message);
		return fail(req, { target: "archivio", code: "lettura" });
	}
	if (limit.wait > 0) return fail(req, { target: "archivio", code: "limite", wait: limit.wait });

	/*
	 * Le letture. Ogni tabella a blocchi con `readAll()`, ordinata sull'`id`
	 * (univoco): PostgREST tronca in silenzio a 1000 righe, e una paginazione
	 * senza ordine totale perde righe. Il filtro esplicito su `user_id` è
	 * ridondante con la RLS ed è voluto: se una policy si allentasse, l'archivio
	 * non deve diventare quello di tutti.
	 */
	const uid = user.id;
	const [profileRes, accounts, categories, transactions, rules, budgets, notifications, imports, attachments] =
		await Promise.all([
			// ⚠️ `*` e non un elenco di colonne: una colonna aggiunta domani deve
			// entrare nell'archivio da sola, non uscirne in silenzio perché nessuno
			// ha aggiornato questa riga (la migrazione a campione, CLAUDE.md).
			supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
			readAll((from, to) => supabase.from("accounts").select("*").eq("user_id", uid).order("id").range(from, to), "archivio: conti"),
			readAll((from, to) => supabase.from("categories").select("*").eq("user_id", uid).order("id").range(from, to), "archivio: categorie"),
			readAll((from, to) => supabase.from("transactions").select("*").eq("user_id", uid).order("id").range(from, to), "archivio: movimenti"),
			readAll((from, to) => supabase.from("recurring_rules").select("*").eq("user_id", uid).order("id").range(from, to), "archivio: ricorrenti"),
			readAll((from, to) => supabase.from("budgets").select("*").eq("user_id", uid).order("id").range(from, to), "archivio: budget"),
			readAll((from, to) => supabase.from("notifications").select("*").eq("user_id", uid).order("id").range(from, to), "archivio: notifiche"),
			readAll((from, to) => supabase.from("imports").select("*").eq("user_id", uid).order("id").range(from, to), "archivio: import"),
			readAll((from, to) => supabase.from("attachments").select("*").eq("user_id", uid).order("id").range(from, to), "archivio: ricevute"),
		]);

	const failed = [
		profileRes.error?.message,
		accounts.error,
		categories.error,
		transactions.error,
		rules.error,
		budgets.error,
		notifications.error,
		imports.error,
		attachments.error,
	].filter(Boolean);
	if (failed.length > 0) {
		console.error("[archivio] letture:", failed);
		return fail(req, { target: "archivio", code: "lettura" });
	}

	const now = new Date();
	const files = t.export.archive.files;

	/*
	 * Il profilo: TUTTE le colonne di `profiles` tranne `id` (uguale a quello
	 * dell'utente, come `user_id` nelle altre tabelle), più ciò che sta in Auth
	 * — l'email di ADESSO e i metodi di accesso (`identities`, dall'utente
	 * vivo). Il profilo manca solo per un account rotto: restano i campi di Auth,
	 * niente di inventato.
	 */
	const profileRow: Record<string, unknown> = { ...(profileRes.data ?? {}) };
	delete profileRow.id;
	const profile = {
		...profileRow,
		email: user.email ?? null,
		sign_in_methods: [...new Set((user.identities ?? []).map((i) => i.provider))].sort(),
		account_created_at: user.created_at,
	};

	// La foto: un file nostro si scarica, un URL esterno (Google) resta un URL.
	const avatarPath = avatarStoragePath(profileRes.data?.avatar_url ?? null, uid);
	const avatarFile = avatarPath ? `${files.avatar}.${avatarExtension(avatarPath)}` : null;

	/*
	 * Il CSV dei movimenti, lo stesso dell'export (`transactionCsvRows()`), su
	 * tutto il periodo e senza conto: i trasferimenti restano senza segno, come
	 * nell'export senza filtro. Ordinato come la lista, dal più recente.
	 */
	const accountName = new Map(accounts.rows.map((a) => [a.id, a.name]));
	const categoryName = new Map(categories.rows.map((c) => [c.id, c.name]));
	const attachmentCounts: Record<string, number> = {};
	for (const a of attachments.rows) attachmentCounts[a.transaction_id] = (attachmentCounts[a.transaction_id] ?? 0) + 1;
	const byDate = [...transactions.rows].sort((a, b) =>
		a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
	);
	const csv = new TextEncoder().encode(
		toCsv(
			[
				transactionCsvHeader(t),
				...transactionCsvRows(
					byDate.map((tx) => ({ ...tx, categoryName: tx.category_id ? (categoryName.get(tx.category_id) ?? null) : null })),
					{ accountName, attachmentCounts, conto: null, t },
				),
			],
			locale,
		),
	);

	// I JSON pronti PRIMA dello stream, tranne `attachments`, che dice anche
	// quali file sono entrati e si scrive dopo le ricevute.
	const dataJson: [ArchiveTable, Uint8Array][] = [
		["profile", jsonBytes(profile)],
		["accounts", jsonBytes(withoutOwner(accounts.rows))],
		["categories", jsonBytes(withoutOwner(categories.rows))],
		["transactions", jsonBytes(withoutOwner(transactions.rows))],
		["recurring_rules", jsonBytes(withoutOwner(rules.rows))],
		["budgets", jsonBytes(withoutOwner(budgets.rows))],
		["notifications", jsonBytes(withoutOwner(notifications.rows))],
		["imports", jsonBytes(withoutOwner(imports.rows))],
	];

	const txDate = new Map(transactions.rows.map((tx) => [tx.id, tx.date]));
	const receipts = attachments.rows.map((a) => ({
		row: a,
		name: receiptEntryName(files.receipts, a, txDate.get(a.transaction_id) ?? null),
	}));

	/*
	 * ⚠️ I limiti dello ZIP senza ZIP64 si controllano QUI, dove un errore è
	 * ancora una risposta. La stima è per eccesso: i contenuti non compressi, più
	 * un margine per `attachments.json`, manifest e LEGGIMI, che crescono con il
	 * numero di ricevute.
	 */
	const knownBytes =
		dataJson.reduce((sum, [, bytes]) => sum + bytes.length, 0) +
		csv.length +
		attachments.rows.reduce((sum, a) => sum + a.size_bytes, 0) +
		(avatarPath ? 2 * 1024 * 1024 : 0) +
		receipts.length * 1024 +
		256 * 1024;
	const entries = dataJson.length + 1 + receipts.length + (avatarPath ? 1 : 0) + 3;
	if (!fitsInZip(entries, knownBytes, receipts.reduce((sum, r) => sum + r.name.length * 2, 0))) {
		console.error(`[archivio] oltre i limiti dello ZIP: ${entries} voci, ~${knownBytes} byte`);
		return fail(req, { target: "archivio", code: "troppo-grande" });
	}

	const signal = req.signal;
	const zip = new ZipWriter(now);

	async function* produce(): AsyncGenerator<Uint8Array> {
		for (const [table, bytes] of dataJson) yield zip.entry(dataFile(table), bytes, { compress: true });
		yield zip.entry(files.transactionsCsv, csv, { compress: true });

		let avatar: AvatarStatus = profileRes.data?.avatar_url ? "external" : "none";
		if (avatarPath && avatarFile) {
			const bytes = await download(supabase, "avatars", avatarPath, signal);
			avatar = bytes ? "included" : "missing";
			if (bytes) yield zip.entry(avatarFile, bytes, { compress: false });
		}

		// Le ricevute: `PREFETCH` download in volo, scritte nell'ordine dell'elenco.
		const missing: string[] = [];
		/** id della ricevuta → nome nell'archivio, solo per quelle entrate. */
		const included = new Map<string, string>();
		const queue: Promise<Uint8Array | null>[] = [];
		let next = 0;
		for (const receipt of receipts) {
			while (queue.length < PREFETCH && next < receipts.length) {
				queue.push(download(supabase, RECEIPT_BUCKET, receipts[next++].row.storage_path, signal));
			}
			const bytes = await queue.shift()!;
			if (signal.aborted) return;
			if (!bytes) {
				missing.push(receipt.row.id);
				continue;
			}
			included.set(receipt.row.id, receipt.name);
			// Già compresse (JPEG, PNG, WebP): «store», il deflate non le riduce.
			yield zip.entry(receipt.name, bytes, { compress: false });
		}

		yield zip.entry(
			dataFile("attachments"),
			jsonBytes(
				attachments.rows.map((a) => ({
					id: a.id,
					transaction_id: a.transaction_id,
					mime_type: a.mime_type,
					size_bytes: a.size_bytes,
					created_at: a.created_at,
					// `null` per una ricevuta che non si è potuta scaricare: il JSON non
					// promette un file che non c'è.
					file: included.get(a.id) ?? null,
				})),
			),
			{ compress: true },
		);

		const rows: Record<ArchiveTable, number> = {
			profile: 1,
			accounts: accounts.rows.length,
			categories: categories.rows.length,
			transactions: transactions.rows.length,
			recurring_rules: rules.rows.length,
			budgets: budgets.rows.length,
			notifications: notifications.rows.length,
			imports: imports.rows.length,
			attachments: attachments.rows.length,
		};

		yield zip.entry(
			"manifest.json",
			jsonBytes(
				archiveManifest({
					created_at: now.toISOString(),
					files: {
						readme: files.readme,
						transactions_csv: files.transactionsCsv,
						receipts_folder: files.receipts,
						avatar: avatar === "included" ? avatarFile : null,
					},
					rows,
					receipts: { expected: receipts.length, included: included.size, missing },
					avatar,
				}),
			),
			{ compress: true },
		);
		yield zip.entry(
			files.readme,
			new TextEncoder().encode(
				archiveReadme(t, locale, {
					now,
					avatarFile: avatar === "included" ? avatarFile : null,
					avatar,
					missingReceipts: missing,
					currency: profileRes.data?.currency ?? null,
				}),
			),
			{ compress: true },
		);
		yield zip.finish();

		if (missing.length > 0 || avatar === "missing") {
			console.error(`[archivio] consegnato con ${missing.length} ricevute mancanti, avatar: ${avatar}`);
		}
	}

	const iterator = produce();
	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { value, done } = await iterator.next();
				if (done) controller.close();
				else controller.enqueue(value);
			} catch (e) {
				// Dopo il 200 un errore non è più una risposta: la connessione si
				// interrompe, e il browser segnala il download come fallito invece di
				// salvare un archivio a metà come se fosse intero.
				console.error("[archivio] interrotto:", e instanceof Error ? e.message : e);
				controller.error(e);
			}
		},
		async cancel() {
			// Chi scarica ha chiuso: si smette di chiedere ricevute al bucket.
			await iterator.return(undefined);
		},
	});

	return new NextResponse(stream, {
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="${archiveFileName(now)}"`,
			// ⚠️ L'intera storia finanziaria di una persona, ricevute comprese: mai
			// nella cache di un proxy o del browser.
			"Cache-Control": "private, no-store",
		},
	});
}
