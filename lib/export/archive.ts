/**
 * L'archivio completo — ciò che va DENTRO lo ZIP (issue #162).
 *
 * La rotta `/impostazioni/esporta/archivio` legge e spedisce; qui ci sono le
 * decisioni su nomi, contenuti e testi, come funzioni pure (le prova
 * `archive.test.ts`). Storia: `docs/storia/issue-162-archivio.md`.
 *
 * ## Le scelte, decise con Jomar il 2026-11-18
 *
 * - **Un JSON per tabella** in `data/`, con i nomi delle colonne del database:
 *   è la parte per i programmi, e un programma non deve cambiare a seconda della
 *   lingua di chi ha scaricato. Nomi fissi anche per `manifest.json`.
 * - **La parte per la persona nella sua lingua**: `LEGGIMI.txt`, il CSV dei
 *   movimenti (lo stesso dell'export, su tutto il periodo), la cartella delle
 *   ricevute e la foto profilo.
 * - **Restano fuori**, deliberatamente:
 *   - `user_id`: uguale su ogni riga, non dice niente;
 *   - `storage_path`: un indirizzo interno del bucket; al suo posto `file`, il
 *     nome dentro l'archivio;
 *   - `rate_events`: un registro contro gli abusi, non un dato fornito
 *     dall'utente, e le sue righe scadute si cancellano da sole;
 *   - `job_runs`: non appartiene a nessun utente;
 *   - il PIN del blocco: un segreto che vive solo sul dispositivo.
 * - **Re-importabilità non promessa**, per le ragioni della 23a.
 */

import type { Dictionary } from "@/lib/i18n/dictionaries/it";
import type { Locale } from "@/lib/i18n/config";
import { fill, plural } from "@/lib/i18n/format";
import { ATTACHMENT_MIME } from "@/lib/attachments";

/** Cambia quando cambia la forma dei file per i programmi. */
export const ARCHIVE_FORMAT_VERSION = 1;

/** La cartella dei JSON: fissa, come i nomi delle colonne. */
export const ARCHIVE_DATA_DIR = "data";

/**
 * Le tabelle nell'ordine in cui compaiono, con il nome del loro file.
 * `profile` è al singolare perché è UN oggetto, non un elenco di righe.
 */
export const ARCHIVE_TABLES = [
	"profile",
	"accounts",
	"categories",
	"transactions",
	"recurring_rules",
	"budgets",
	"notifications",
	"imports",
	"attachments",
] as const;
export type ArchiveTable = (typeof ARCHIVE_TABLES)[number];

export const dataFile = (table: ArchiveTable) => `${ARCHIVE_DATA_DIR}/${table}.json`;

/**
 * `seichi-archivio-AAAA-MM-GG.zip`, fisso in ogni lingua come
 * `seichi-movimenti-…` del CSV. La data è dell'orologio del server (UTC): fra
 * mezzanotte e le due ora italiana porta il giorno prima, accettato come per il
 * CSV — tocca un nome, non un numero.
 */
export function archiveFileName(now: Date): string {
	return `seichi-archivio-${now.toISOString().slice(0, 10)}.zip`;
}

/** Un oggetto JSON come byte: indentato, perché lo apre anche una persona. */
export function jsonBytes(value: unknown): Uint8Array {
	return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

/** Toglie `user_id` da ogni riga: è lo stesso ovunque. */
export function withoutOwner<T extends { user_id?: unknown }>(rows: T[]): Omit<T, "user_id">[] {
	return rows.map((row) => {
		const copy = { ...row };
		delete copy.user_id;
		return copy;
	});
}

/**
 * Il nome di una ricevuta dentro l'archivio:
 * `ricevute/2026-11-03_<id della ricevuta>.jpg`.
 *
 * La data del MOVIMENTO in testa, perché in una cartella ordinata per nome le
 * ricevute si mettono in fila come nella vita; l'id dopo, perché due ricevute
 * dello stesso giorno non collidano e perché `attachments.json` le ritrova.
 *
 * ⚠️ L'estensione dal tipo MIME, non dal path del bucket: è il dato che il
 * database garantisce (`ATTACHMENT_MIME` è allineato al bucket). Un tipo che un
 * giorno uscisse da quell'elenco riceve `.bin` invece di un'estensione
 * inventata.
 */
export function receiptEntryName(
	folder: string,
	attachment: { id: string; mime_type: string },
	transactionDate: string | null,
): string {
	const ext = ATTACHMENT_MIME[attachment.mime_type] ?? "bin";
	const day = transactionDate && /^\d{4}-\d{2}-\d{2}/.test(transactionDate) ? transactionDate.slice(0, 10) : null;
	return `${folder}/${day ? `${day}_` : ""}${attachment.id}.${ext}`;
}

/**
 * Il path dell'avatar nel bucket `avatars`, letto dal suo URL pubblico; `null`
 * se l'avatar non è un file nostro (la foto di Google di un accesso OAuth) o
 * non è dell'utente.
 *
 * ⚠️ Il controllo del proprietario non è pignoleria: `avatar_url` è una
 * colonna che l'utente scrive, quindi un URL che punta alla cartella di un
 * altro si scaricherebbe dal bucket pubblico e finirebbe nell'archivio di chi
 * l'ha scritto come se fosse suo.
 */
export function avatarStoragePath(avatarUrl: string | null, userId: string): string | null {
	if (!avatarUrl) return null;
	let pathname: string;
	try {
		pathname = new URL(avatarUrl).pathname;
	} catch {
		return null;
	}
	const marker = "/storage/v1/object/public/avatars/";
	const at = pathname.indexOf(marker);
	if (at < 0) return null;
	let path: string;
	try {
		path = decodeURIComponent(pathname.slice(at + marker.length));
	} catch {
		return null;
	}
	const [folder, file, ...rest] = path.split("/");
	if (folder !== userId || !file || rest.length > 0 || file.startsWith(".")) return null;
	return path;
}

/** L'estensione della foto profilo, dal suo path; `jpg` se non si capisce. */
export function avatarExtension(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	return Object.values(ATTACHMENT_MIME).includes(ext) ? ext : "jpg";
}

/** Come è andata la foto profilo. */
export type AvatarStatus = "included" | "missing" | "none" | "external";

export type ArchiveManifest = {
	format: "seichi-archive";
	version: number;
	created_at: string;
	files: {
		readme: string;
		transactions_csv: string;
		receipts_folder: string;
		avatar: string | null;
	};
	rows: Record<ArchiveTable, number>;
	receipts: { expected: number; included: number; missing: string[] };
	avatar: AvatarStatus;
};

/**
 * L'indice per i programmi. Si scrive per ULTIMO, insieme a `LEGGIMI.txt`:
 * solo allora si sa quali ricevute sono davvero entrate. Lo ZIP mette l'indice
 * centrale in coda, quindi aggiungere un file dopo le ricevute non costa niente.
 */
export function archiveManifest(input: Omit<ArchiveManifest, "format" | "version">): ArchiveManifest {
	return { format: "seichi-archive", version: ARCHIVE_FORMAT_VERSION, ...input };
}

/**
 * `LEGGIMI.txt`, nella lingua dell'utente: una sezione per file, una riga per
 * tabella, come leggere i numeri, e — solo se ce ne sono — le ricevute mancanti.
 *
 * Testo semplice con il BOM e gli a capo di Windows: è il file che si apre con
 * un doppio clic, e il Blocco note di Windows meno recente senza BOM legge «è»
 * come «Ã¨».
 */
export function archiveReadme(
	t: Dictionary,
	locale: Locale,
	{
		now,
		avatarFile,
		avatar,
		missingReceipts,
	}: {
		now: Date;
		avatarFile: string | null;
		avatar: AvatarStatus;
		missingReceipts: string[];
	},
): string {
	const a = t.export.archive;
	const r = a.readme;
	const iso = now.toISOString();
	const lines: string[] = [
		r.title,
		fill(r.generated, { date: iso.slice(0, 10), time: iso.slice(11, 16) }),
		"",
		r.intro,
		"",
		r.filesHeading,
		`- ${fill(r.files.readme, { file: a.files.readme })}`,
		`- ${r.files.manifest}`,
		`- ${fill(r.files.csv, { file: a.files.transactionsCsv })}`,
		`- ${r.files.data}`,
		`- ${fill(r.files.receipts, { folder: a.files.receipts })}`,
	];
	if (avatarFile) lines.push(`- ${fill(r.files.avatar, { file: avatarFile })}`);

	lines.push("", r.tablesHeading, ...ARCHIVE_TABLES.map((table) => `- ${r.tables[table]}`));
	lines.push(
		"",
		r.notesHeading,
		`- ${r.notes.amounts}`,
		`- ${r.notes.dates}`,
		`- ${r.notes.balance}`,
		`- ${r.notes.budgets}`,
	);

	if (missingReceipts.length > 0 || avatar === "missing") {
		lines.push("", r.missingHeading);
		if (missingReceipts.length > 0) {
			lines.push(plural(r.missing, missingReceipts.length, locale), ...missingReceipts.map((id) => `- ${id}`));
		}
		if (avatar === "missing") lines.push(r.avatarMissing);
	}

	return `﻿${lines.join("\r\n")}\r\n`;
}
