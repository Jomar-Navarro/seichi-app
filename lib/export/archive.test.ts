import { describe, expect, it } from "vitest";

import {
	ARCHIVE_TABLES,
	archiveFileName,
	archiveManifest,
	archiveReadme,
	avatarExtension,
	avatarStoragePath,
	receiptEntryName,
	withoutOwner,
} from "./archive";
import { it as itDict } from "../i18n/dictionaries/it";
import { en } from "../i18n/dictionaries/en";

const UID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-18T10:21:34Z");

describe("i nomi dentro l'archivio (#162)", () => {
	it("il file porta la data, fisso in ogni lingua", () => {
		expect(archiveFileName(NOW)).toBe("seichi-archivio-2026-11-18.zip");
	});

	it("una ricevuta: data del movimento, id, estensione dal tipo MIME", () => {
		const att = { id: "aaaa", mime_type: "image/webp" };
		expect(receiptEntryName("ricevute", att, "2026-11-03T12:00:00")).toBe("ricevute/2026-11-03_aaaa.webp");
		// Un tipo fuori dall'elenco non inventa un'estensione.
		expect(receiptEntryName("receipts", { id: "b", mime_type: "application/pdf" }, "2026-11-03")).toBe(
			"receipts/2026-11-03_b.bin",
		);
		// Senza data leggibile resta l'id, che basta a distinguerla.
		expect(receiptEntryName("ricevute", att, null)).toBe("ricevute/aaaa.webp");
	});
});

describe("avatarStoragePath (#162)", () => {
	const base = "http://127.0.0.1:54321/storage/v1/object/public/avatars";

	it("un avatar nostro: il path dentro il bucket", () => {
		expect(avatarStoragePath(`${base}/${UID}/x.jpg`, UID)).toBe(`${UID}/x.jpg`);
	});

	it("un avatar esterno (Google) non si scarica", () => {
		expect(avatarStoragePath("https://lh3.googleusercontent.com/a/abc=s96-c", UID)).toBeNull();
		expect(avatarStoragePath(null, UID)).toBeNull();
		expect(avatarStoragePath("non un url", UID)).toBeNull();
	});

	// ⚠️ `avatar_url` lo scrive l'utente: un URL verso la cartella di un altro non
	// deve portare il file altrui nel proprio archivio.
	it("la cartella di un altro utente, o un percorso che ne esce, no", () => {
		expect(avatarStoragePath(`${base}/22222222-2222-4222-8222-222222222222/x.jpg`, UID)).toBeNull();
		expect(avatarStoragePath(`${base}/${UID}/../altro/x.jpg`, UID)).toBeNull();
		expect(avatarStoragePath(`${base}/${UID}/sub/x.jpg`, UID)).toBeNull();
		expect(avatarStoragePath(`${base}/${UID}/%2e%2e`, UID)).toBeNull();
	});

	it("l'estensione dal path, jpg se non si capisce", () => {
		expect(avatarExtension(`${UID}/x.PNG`)).toBe("png");
		expect(avatarExtension(`${UID}/x.exe`)).toBe("jpg");
	});
});

describe("i contenuti (#162)", () => {
	it("user_id esce da ogni riga, il resto resta", () => {
		expect(withoutOwner([{ id: "a", user_id: UID, name: "Conto" }])).toEqual([{ id: "a", name: "Conto" }]);
	});

	it("il manifest dichiara formato e versione", () => {
		const m = archiveManifest({
			created_at: NOW.toISOString(),
			files: { readme: "LEGGIMI.txt", transactions_csv: "movimenti.csv", receipts_folder: "ricevute", avatar: null },
			rows: Object.fromEntries(ARCHIVE_TABLES.map((t) => [t, 0])) as never,
			receipts: { expected: 2, included: 1, missing: ["x"] },
			avatar: "none",
		});
		expect(m.format).toBe("seichi-archive");
		expect(m.version).toBe(1);
		expect(m.receipts.missing).toEqual(["x"]);
	});
});

describe("LEGGIMI.txt (#162)", () => {
	const base = { now: NOW, avatarFile: null, avatar: "none" as const, missingReceipts: [], currency: "EUR" };

	it("BOM, a capo di Windows, ogni tabella nominata", () => {
		const text = archiveReadme(itDict, "it", base);
		expect(text.charCodeAt(0)).toBe(0xfeff);
		expect(text).toContain("\r\n");
		expect(text.replace(/\r\n/g, "").includes("\n")).toBe(false);
		for (const table of ARCHIVE_TABLES) expect(text).toContain(`data/${table}.json`);
		expect(text).toContain("Creato il 2026-11-18 alle 10:21 (UTC).");
		expect(text).toContain("LEGGIMI.txt — questo file.");
	});

	it("nella lingua dell'utente, con i nomi dei file di quella lingua", () => {
		const text = archiveReadme(en, "en", base);
		expect(text).toContain("README.txt — this file.");
		expect(text).toContain("transactions.csv");
		expect(text).not.toContain("movimenti.csv");
	});

	it("senza mancanze, nessuna sezione «Cosa manca»", () => {
		expect(archiveReadme(itDict, "it", base)).not.toContain("Cosa manca");
	});

	it("le ricevute mancanti si dichiarano, con il plurale giusto e gli id", () => {
		const one = archiveReadme(itDict, "it", { ...base, missingReceipts: ["r1"] });
		expect(one).toContain("Cosa manca");
		expect(one).toContain("1 ricevuta non si è potuta scaricare");
		expect(one).toContain("- r1");
		const two = archiveReadme(itDict, "it", { ...base, missingReceipts: ["r1", "r2"] });
		expect(two).toContain("2 ricevute non si sono potute scaricare");
	});

	it("la foto mancante si dichiara anche senza ricevute mancanti", () => {
		const text = archiveReadme(itDict, "it", { ...base, avatar: "missing" });
		expect(text).toContain("Cosa manca");
		expect(text).toContain("La foto profilo non si è potuta scaricare");
		expect(text).not.toContain("ricevuta non si è");
	});

	// #171: «la valuta è quella del profilo» mandava a cercarla in profile.json.
	it("la valuta si dice per nome; senza profilo la riga tace", () => {
		expect(archiveReadme(itDict, "it", { ...base, currency: "USD" })).toContain("Gli importi sono in USD, la valuta del profilo.");
		expect(archiveReadme(en, "en", { ...base, currency: "JPY" })).toContain("Amounts are in JPY");
		const none = archiveReadme(itDict, "it", { ...base, currency: null });
		expect(none).not.toContain("Gli importi sono in");
		expect(none).toContain("Gli importi sono sempre positivi");
	});

	it("la foto inclusa compare fra i file", () => {
		const text = archiveReadme(itDict, "it", { ...base, avatar: "included", avatarFile: "foto-profilo.jpg" });
		expect(text).toContain("foto-profilo.jpg — la tua foto profilo.");
	});
});
