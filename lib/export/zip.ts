/**
 * Scrittura ZIP — il contenitore dell'archivio completo (issue #162).
 *
 * ⚠️ Scritto a mano e senza dipendenze, deciso con Jomar il 2026-11-18.
 * Node 24 ha già i due pezzi difficili: `zlib.crc32()` e `deflateRawSync()`. Il
 * resto è il formato di APPNOTE.TXT (PKWARE) ridotto a ciò che l'archivio usa:
 * intestazione locale, dati, indice centrale, record di chiusura. `fflate` è
 * piccola e senza dipendenze, ma resta codice altrui da tenere allineato per un
 * compito che la libreria standard copre (CLAUDE.md, «una dipendenza si
 * aggiunge quando serve»). `archiver` porta una catena di stream: scartata.
 *
 * ## Le scelte del formato
 *
 * - **Ogni voce arriva intera.** Una ricevuta pesa al massimo 2 MB
 *   (`ATTACHMENT_MAX_BYTES`) e un JSON sta in memoria comunque: CRC e
 *   dimensioni si conoscono PRIMA di scrivere l'intestazione locale, quindi
 *   niente *data descriptor* (bit 3), che alcuni lettori gestiscono male.
 * - **Il flag 0x0800**: i nomi sono UTF-8. Senza, Esplora risorse e l'app File
 *   di iOS li leggerebbero come CP437, e «città» diventerebbe illeggibile.
 * - **Niente ZIP64.** Un archivio con più di 65.535 voci o oltre 4 GB non si
 *   scrive: `fitsInZip()` lo dice prima di cominciare, e il writer solleva
 *   `ZipLimitError` se ci si arriva lo stesso. Un file troncato o con gli
 *   offset sbagliati sarebbe un archivio che dice il falso; un errore no.
 * - **Ora in formato MS-DOS**, senza fuso: è la data dell'export, letta
 *   dall'orologio del server (UTC). Tocca il «modificato il» dei file estratti,
 *   non un numero.
 *
 * Il modulo è puro: niente rete, niente Supabase. Lo prova `zip.test.ts`.
 */

import { crc32, deflateRawSync } from "node:zlib";

/** Il limite delle voci senza ZIP64: il campo è a 16 bit. */
export const ZIP_MAX_ENTRIES = 0xffff;

/** Il limite di offset e dimensioni senza ZIP64: i campi sono a 32 bit. */
export const ZIP_MAX_BYTES = 0xffffffff;

/** Metodo 0: i byte così come sono. Metodo 8: deflate. */
const STORE = 0;
const DEFLATE = 8;

/** Bit 11 dei flag: nome e commento sono UTF-8. */
const UTF8_FLAG = 0x0800;

/** «Versione 2.0»: deflate e cartelle, nient'altro. */
const VERSION = 20;

const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const END_RECORD = 22;

/** Un archivio che non entra nei campi del formato senza ZIP64. */
export class ZipLimitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ZipLimitError";
	}
}

/**
 * Entra in uno ZIP senza ZIP64? Si chiede PRIMA di aprire lo stream: dopo lo
 * stato 200 è già partito, e un errore non può più diventare una risposta.
 *
 * `bytes` è la somma dei contenuti non compressi: un limite superiore della
 * dimensione finale, a cui si aggiunge il costo fisso di ogni voce.
 */
export function fitsInZip(entries: number, bytes: number, nameBytes = 0): boolean {
	if (entries > ZIP_MAX_ENTRIES) return false;
	const overhead = entries * (LOCAL_HEADER + CENTRAL_HEADER) + 2 * nameBytes + END_RECORD;
	return bytes + overhead <= ZIP_MAX_BYTES;
}

/**
 * Data e ora nel formato MS-DOS: due interi a 16 bit, con i secondi a passi di
 * due e gli anni dal 1980. Prima del 1980 il formato non sa contare: si
 * ripiega sul 1° gennaio 1980.
 */
export function dosDateTime(d: Date): { time: number; date: number } {
	if (d.getUTCFullYear() < 1980) return { time: 0, date: (1 << 5) | 1 };
	return {
		time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
		date: ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
	};
}

/**
 * Un nome di voce accettabile: relativo, con le barre in avanti, senza `..` né
 * percorsi assoluti. I nomi li costruisce il server, ma un nome sbagliato qui
 * diventerebbe un file scritto fuori dalla cartella di chi estrae (*zip slip*):
 * la difesa costa una riga.
 */
export function isSafeEntryName(name: string): boolean {
	if (name === "" || name.startsWith("/") || name.includes("\\") || /^[a-zA-Z]:/.test(name)) return false;
	return name.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

type CentralRecord = {
	name: Uint8Array;
	method: number;
	crc: number;
	compressed: number;
	size: number;
	offset: number;
};

/**
 * Lo scrittore. Si usa così: `entry()` per ogni file, nell'ordine in cui deve
 * comparire, e alla fine `finish()`. Ogni chiamata restituisce i byte da
 * spedire subito: lo scrittore non trattiene i contenuti, solo l'indice
 * (qualche decina di byte per voce).
 */
export class ZipWriter {
	private readonly records: CentralRecord[] = [];
	private offset = 0;
	private finished = false;
	private readonly stamp: { time: number; date: number };
	private readonly encoder = new TextEncoder();

	constructor(modified: Date) {
		this.stamp = dosDateTime(modified);
	}

	/** I byte scritti finora: serve ai test e al registro del collaudo. */
	get written(): number {
		return this.offset;
	}

	/**
	 * Una voce. `compress` sceglie deflate; se il deflate non rende più piccolo il
	 * contenuto (un JPEG è già compresso) la voce resta «store», e il lettore non
	 * paga la decompressione per niente.
	 */
	entry(name: string, data: Uint8Array, { compress }: { compress: boolean }): Uint8Array {
		if (this.finished) throw new Error("ZipWriter: voce dopo finish()");
		if (!isSafeEntryName(name)) throw new Error(`ZipWriter: nome non valido: ${name}`);
		if (this.records.length >= ZIP_MAX_ENTRIES) throw new ZipLimitError("troppe voci per uno ZIP senza ZIP64");

		const nameBytes = this.encoder.encode(name);
		if (nameBytes.length > 0xffff) throw new Error("ZipWriter: nome troppo lungo");

		const crc = crc32(data) >>> 0;
		let method = STORE;
		let payload = data;
		if (compress && data.length > 0) {
			const deflated = deflateRawSync(data);
			if (deflated.length < data.length) {
				method = DEFLATE;
				payload = deflated;
			}
		}

		const end = this.offset + LOCAL_HEADER + nameBytes.length + payload.length;
		if (data.length > ZIP_MAX_BYTES || end > ZIP_MAX_BYTES) {
			throw new ZipLimitError("archivio oltre i 4 GB di uno ZIP senza ZIP64");
		}

		const header = new Uint8Array(LOCAL_HEADER + nameBytes.length);
		const v = new DataView(header.buffer);
		v.setUint32(0, 0x04034b50, true);
		v.setUint16(4, VERSION, true);
		v.setUint16(6, UTF8_FLAG, true);
		v.setUint16(8, method, true);
		v.setUint16(10, this.stamp.time, true);
		v.setUint16(12, this.stamp.date, true);
		v.setUint32(14, crc, true);
		v.setUint32(18, payload.length, true);
		v.setUint32(22, data.length, true);
		v.setUint16(26, nameBytes.length, true);
		v.setUint16(28, 0, true);
		header.set(nameBytes, LOCAL_HEADER);

		this.records.push({
			name: nameBytes,
			method,
			crc,
			compressed: payload.length,
			size: data.length,
			offset: this.offset,
		});
		this.offset = end;

		const out = new Uint8Array(header.length + payload.length);
		out.set(header, 0);
		out.set(payload, header.length);
		return out;
	}

	/** L'indice centrale e il record di chiusura: l'ultimo pezzo del file. */
	finish(): Uint8Array {
		if (this.finished) throw new Error("ZipWriter: finish() due volte");
		this.finished = true;

		const size = this.records.reduce((sum, r) => sum + CENTRAL_HEADER + r.name.length, 0);
		if (this.offset + size + END_RECORD > ZIP_MAX_BYTES) {
			throw new ZipLimitError("indice oltre i 4 GB di uno ZIP senza ZIP64");
		}

		const out = new Uint8Array(size + END_RECORD);
		const v = new DataView(out.buffer);
		let p = 0;
		for (const r of this.records) {
			v.setUint32(p, 0x02014b50, true);
			v.setUint16(p + 4, VERSION, true); // «made by»: MS-DOS, 2.0
			v.setUint16(p + 6, VERSION, true);
			v.setUint16(p + 8, UTF8_FLAG, true);
			v.setUint16(p + 10, r.method, true);
			v.setUint16(p + 12, this.stamp.time, true);
			v.setUint16(p + 14, this.stamp.date, true);
			v.setUint32(p + 16, r.crc, true);
			v.setUint32(p + 20, r.compressed, true);
			v.setUint32(p + 24, r.size, true);
			v.setUint16(p + 28, r.name.length, true);
			v.setUint16(p + 30, 0, true); // extra
			v.setUint16(p + 32, 0, true); // commento
			v.setUint16(p + 34, 0, true); // disco
			v.setUint16(p + 36, 0, true); // attributi interni
			v.setUint32(p + 38, 0, true); // attributi esterni
			v.setUint32(p + 42, r.offset, true);
			out.set(r.name, p + CENTRAL_HEADER);
			p += CENTRAL_HEADER + r.name.length;
		}

		v.setUint32(p, 0x06054b50, true);
		v.setUint16(p + 4, 0, true);
		v.setUint16(p + 6, 0, true);
		v.setUint16(p + 8, this.records.length, true);
		v.setUint16(p + 10, this.records.length, true);
		v.setUint32(p + 12, size, true);
		v.setUint32(p + 16, this.offset, true);
		v.setUint16(p + 20, 0, true);

		this.offset += out.length;
		return out;
	}
}
