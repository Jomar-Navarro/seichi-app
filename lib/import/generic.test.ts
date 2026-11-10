import { describe, expect, it } from "vitest";

import { parseGeneric, type GenericMapping } from "./generic";
import { analyze, importKeyFor } from "./index";

const MAPPING: GenericMapping = { date: 0, amount: 1, description: 2 };
const HEADER = ["Data", "Importo", "Descrizione"];
const ROWS = [
	["01/03/2026", "-3,50", "Caffè Bar"],
	// Lo stesso caffè, riesportato con uno spazio e un punto in più.
	["01/03/2026", "-3,50", "caffè  bar!"],
	["01/03/2026", "100,00", "Bonifico Mario"],
	// Al centesimo vale zero: non è un movimento (#123).
	["02/03/2026", "0,0001", "arrotondato a zero"],
	// Al centesimo sul valore ASSOLUTO: 0,13, non 0,12 (#123).
	["02/03/2026", "-0,125", "Commissione"],
	["31/02/2026", "-5,00", "data impossibile"],
	["03/03/2026", "", "importo vuoto"],
];

describe("parseGeneric", () => {
	const r = parseGeneric([HEADER, ...ROWS], MAPPING);

	it("il contatore di occorrenza tiene distinti due movimenti identici", () => {
		expect(r.rows.map((x) => x.key)).toEqual([
			"generico:2026-03-01|-3.50|caffè bar#1",
			"generico:2026-03-01|-3.50|caffè bar#2",
			"generico:2026-03-01|100.00|bonifico mario#1",
			"generico:2026-03-02|-0.13|commissione#1",
		]);
	});

	it("le righe senza data, senza importo o a zero si contano fra le illeggibili", () => {
		expect(r.unreadable).toBe(3);
	});

	it("l'importo è al centesimo e senza segno; il verso è a parte", () => {
		const commissione = r.rows.find((x) => x.description === "Commissione");
		expect(commissione).toMatchObject({ amount: 0.13, direction: "uscita" });
	});

	it("due gruppi, uno per verso", () => {
		expect(r.groups).toHaveLength(2);
		expect(r.groups.find((g) => g.direction === "uscita")).toMatchObject({
			count: 3,
			total: 7.13,
			suggested: "spesa",
		});
		expect(r.groups.find((g) => g.direction === "entrata")).toMatchObject({
			count: 1,
			suggested: "entrata",
			allowed: ["entrata", "trasferimento", "ignora"],
		});
	});

	it("al reimport di un file sovrapposto entra solo la riga nuova", () => {
		const again = parseGeneric([HEADER, ...ROWS, ["01/03/2026", "-3,50", "Caffè Bar"]], MAPPING);
		const before = new Set(r.rows.map((x) => x.key));
		expect(again.rows.map((x) => x.key).filter((k) => !before.has(k))).toEqual([
			"generico:2026-03-01|-3.50|caffè bar#3",
		]);
	});

	it("ripara il mojibake, e senza colonna descrizione usa la data", () => {
		const fixed = parseGeneric([HEADER, ["05/03/2026", "-1,00", "CaffÃ¨"]], MAPPING);
		expect(fixed.rows[0].description).toBe("Caffè");
		const bare = parseGeneric([HEADER, ["05/03/2026", "-1,00", "x"]], { ...MAPPING, description: null });
		expect(bare.rows[0]).toMatchObject({ description: "2026-03-05", key: "generico:2026-03-05|-1.00|#1" });
	});
});

describe("analyze", () => {
	const generic = [HEADER, ...ROWS].map((r) => r.join(";")).join("\n");

	it("un file sconosciuto chiede le colonne, con qualche riga d'esempio", () => {
		const a = analyze(generic);
		expect(a.kind).toBe("mappatura");
		if (a.kind !== "mappatura") return;
		expect(a.header).toEqual(HEADER);
		expect(a.sample).toEqual(ROWS.slice(0, 3));
	});

	it("con le colonne lo legge col profilo generico", () => {
		const a = analyze(generic, MAPPING);
		expect(a.kind === "letto" && a.result.source).toBe("generico");
	});

	it("un estratto Trade Republic si annuncia da solo, anche con una mappatura", () => {
		const tr = "date,type,asset_class,amount,transaction_id\n2026-01-01,BUY,FUND,-1,t1";
		const a = analyze(tr, MAPPING);
		expect(a.kind === "letto" && a.result.source).toBe("trade_republic");
	});
});

describe("importKeyFor (#118)", () => {
	it("la chiave generica porta il conto del file", () => {
		expect(importKeyFor("generico", "generico:2026-03-01|-3.50|caffè bar#1", "conto-a")).toBe(
			"generico:conto-a:2026-03-01|-3.50|caffè bar#1",
		);
	});

	it("quella di Trade Republic no: è un evento, non una riga", () => {
		expect(importKeyFor("trade_republic", "trade_republic:t-1", "conto-a")).toBe("trade_republic:t-1");
	});

	it("lo stesso movimento su due conti dà due chiavi", () => {
		const key = "generico:2026-03-31|-2.00|bollo#1";
		expect(importKeyFor("generico", key, "a")).not.toBe(importKeyFor("generico", key, "b"));
	});
});
