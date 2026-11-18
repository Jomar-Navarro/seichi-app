import { crc32, inflateRawSync } from "node:zlib";

/**
 * Un lettore ZIP minimo, per le PROVE dell'archivio (#162): i test di
 * `lib/export/zip.ts` e lo scenario end-to-end.
 *
 * ⚠️ Scritto indipendente dallo scrittore, di proposito: parte dal record di
 * chiusura in fondo al file come fa un estrattore vero, segue l'indice
 * centrale, confronta ogni voce con la sua intestazione locale e ricalcola il
 * CRC. Uno scrittore e un lettore che condividessero il codice delle
 * intestazioni sbaglierebbero insieme, e la prova resterebbe verde.
 */
export type ZipEntry = {
	name: string;
	method: number;
	flags: number;
	data: Buffer;
};

export function readZip(file: Buffer): ZipEntry[] {
	const eocd = file.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
	if (eocd < 0 || file.length - eocd !== 22) throw new Error("record di chiusura assente o non in fondo");
	const count = file.readUInt16LE(eocd + 10);
	if (file.readUInt16LE(eocd + 8) !== count) throw new Error("conteggi del record di chiusura discordi");
	const cdSize = file.readUInt32LE(eocd + 12);
	const cdOffset = file.readUInt32LE(eocd + 16);
	if (cdOffset + cdSize !== eocd) throw new Error("l'indice centrale non finisce dove comincia la chiusura");

	const entries: ZipEntry[] = [];
	let p = cdOffset;
	for (let i = 0; i < count; i++) {
		if (file.readUInt32LE(p) !== 0x02014b50) throw new Error(`voce ${i}: firma dell'indice sbagliata`);
		const flags = file.readUInt16LE(p + 8);
		const method = file.readUInt16LE(p + 10);
		const crc = file.readUInt32LE(p + 16);
		const compressed = file.readUInt32LE(p + 20);
		const size = file.readUInt32LE(p + 24);
		const nameLen = file.readUInt16LE(p + 28);
		const extraLen = file.readUInt16LE(p + 30);
		const commentLen = file.readUInt16LE(p + 32);
		const offset = file.readUInt32LE(p + 42);
		const name = file.subarray(p + 46, p + 46 + nameLen).toString("utf8");
		p += 46 + nameLen + extraLen + commentLen;

		if (file.readUInt32LE(offset) !== 0x04034b50) throw new Error(`${name}: firma locale sbagliata`);
		const localName = file.subarray(offset + 30, offset + 30 + file.readUInt16LE(offset + 26)).toString("utf8");
		if (localName !== name) throw new Error(`${name}: il nome locale è ${localName}`);
		if (file.readUInt32LE(offset + 14) !== crc) throw new Error(`${name}: CRC locale e centrale discordi`);
		const start = offset + 30 + file.readUInt16LE(offset + 26) + file.readUInt16LE(offset + 28);
		const raw = file.subarray(start, start + compressed);
		const data = method === 0 ? Buffer.from(raw) : method === 8 ? inflateRawSync(raw) : null;
		if (!data) throw new Error(`${name}: metodo ${method} sconosciuto`);
		if (data.length !== size) throw new Error(`${name}: ${data.length} byte invece di ${size}`);
		if (crc32(data) >>> 0 !== crc) throw new Error(`${name}: CRC sbagliato`);
		entries.push({ name, method, flags, data });
	}
	if (p !== eocd) throw new Error("l'indice centrale ha byte in più");
	return entries;
}
