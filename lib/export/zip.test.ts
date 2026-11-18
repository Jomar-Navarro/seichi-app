import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";

import { ZipLimitError, ZipWriter, dosDateTime, fitsInZip, isSafeEntryName } from "./zip";
import { readZip } from "../../tests/e2e/support/zip";

/**
 * Lo ZIP dell'archivio completo (#162). Il lettore viene da
 * `tests/e2e/support/zip.ts`, scritto senza toccare lo scrittore: un errore
 * nelle intestazioni condiviso fra i due non si vedrebbe.
 */
const enc = (s: string) => new TextEncoder().encode(s);
const STAMP = new Date("2026-11-18T10:21:34Z");

function build(entries: [string, Uint8Array, boolean][]): Buffer {
	const zip = new ZipWriter(STAMP);
	const parts = entries.map(([name, data, compress]) => zip.entry(name, data, { compress }));
	parts.push(zip.finish());
	return Buffer.concat(parts);
}

describe("ZipWriter (#162)", () => {
	it("il CRC di zlib è quello di APPNOTE: il vettore noto", () => {
		expect((crc32("123456789") >>> 0).toString(16)).toBe("cbf43926");
	});

	it("un archivio si rilegge: nomi, contenuti, ordine", () => {
		const json = enc(JSON.stringify({ righe: Array.from({ length: 50 }, (_, i) => ({ i, nota: "caffè" })) }));
		const jpeg = new Uint8Array(2000).map((_, i) => (i * 7919) % 251);
		const file = build([
			["LEGGIMI.txt", enc("ciao"), true],
			["dati/movimenti.json", json, true],
			["ricevute/2026-11-01_a.jpg", jpeg, false],
		]);
		const read = readZip(file);
		expect(read.map((e) => e.name)).toEqual(["LEGGIMI.txt", "dati/movimenti.json", "ricevute/2026-11-01_a.jpg"]);
		expect(new TextDecoder().decode(read[1].data)).toBe(new TextDecoder().decode(json));
		expect(Buffer.compare(read[2].data, Buffer.from(jpeg))).toBe(0);
	});

	it("i JSON si comprimono, le immagini restano «store»", () => {
		const json = enc("x".repeat(5000));
		const jpeg = new Uint8Array(300).map((_, i) => (i * 7919) % 251);
		const [a, b] = readZip(build([
			["a.json", json, true],
			["b.jpg", jpeg, false],
		]));
		expect(a.method).toBe(8);
		expect(b.method).toBe(0);
	});

	it("un contenuto che il deflate non riduce resta «store» anche se richiesto", () => {
		// Pochi byte: l'intestazione del deflate li renderebbe più lunghi.
		const [e] = readZip(build([["a.txt", enc("ab"), true]]));
		expect(e.method).toBe(0);
	});

	it("un file vuoto è una voce valida", () => {
		const [e] = readZip(build([["vuoto.json", new Uint8Array(0), true]]));
		expect(e.data.length).toBe(0);
	});

	it("i nomi sono UTF-8 e lo dichiarano (flag 0x0800)", () => {
		const [e] = readZip(build([["ricevute/città-é.jpg", enc("x"), false]]));
		expect(e.name).toBe("ricevute/città-é.jpg");
		expect(e.flags & 0x0800).toBe(0x0800);
	});

	it("un archivio senza voci è uno ZIP valido", () => {
		expect(readZip(build([]))).toEqual([]);
	});

	it("written conta ogni byte spedito", () => {
		const zip = new ZipWriter(STAMP);
		const a = zip.entry("a.txt", enc("ciao"), { compress: false });
		const end = zip.finish();
		expect(zip.written).toBe(a.length + end.length);
	});

	it("rifiuta i nomi che uscirebbero dalla cartella (zip slip)", () => {
		for (const bad of ["", "/etc/x", "../x", "a/../../x", "a\\b", "C:/x", "a//b", "./a"]) {
			expect(isSafeEntryName(bad), bad).toBe(false);
			expect(() => new ZipWriter(STAMP).entry(bad, enc("x"), { compress: false })).toThrow();
		}
		expect(isSafeEntryName("dati/conti.json")).toBe(true);
	});

	it("non scrive dopo finish(), e non chiude due volte", () => {
		const zip = new ZipWriter(STAMP);
		zip.finish();
		expect(() => zip.entry("a", enc("x"), { compress: false })).toThrow();
		expect(() => zip.finish()).toThrow();
	});
});

describe("i limiti senza ZIP64 (#162)", () => {
	it("fitsInZip dice no PRIMA: troppe voci, troppi byte", () => {
		expect(fitsInZip(300, 600 * 1024 * 1024)).toBe(true);
		expect(fitsInZip(65_535, 0)).toBe(true);
		expect(fitsInZip(65_536, 0)).toBe(false);
		expect(fitsInZip(10, 0xffffffff)).toBe(false);
	});

	it("il writer solleva ZipLimitError oltre le 65.535 voci", () => {
		const zip = new ZipWriter(STAMP);
		const empty = new Uint8Array(0);
		for (let i = 0; i < 65_535; i++) zip.entry(`f${i}`, empty, { compress: false });
		expect(() => zip.entry("una-di-troppo", empty, { compress: false })).toThrow(ZipLimitError);
	});
});

describe("dosDateTime (#162)", () => {
	it("anni dal 1980, mesi da 1, secondi a passi di due", () => {
		const { time, date } = dosDateTime(STAMP);
		expect(date >> 9).toBe(2026 - 1980);
		expect((date >> 5) & 0xf).toBe(11);
		expect(date & 0x1f).toBe(18);
		expect(time >> 11).toBe(10);
		expect((time >> 5) & 0x3f).toBe(21);
		expect((time & 0x1f) * 2).toBe(34);
	});

	it("prima del 1980 ripiega sul primo giorno che il formato conosce", () => {
		expect(dosDateTime(new Date("1970-01-01T00:00:00Z"))).toEqual({ time: 0, date: (1 << 5) | 1 });
	});
});
