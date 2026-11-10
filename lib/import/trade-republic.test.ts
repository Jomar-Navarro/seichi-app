import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";
import { isTradeRepublic, parseTradeRepublic } from "./trade-republic";
import type { GroupTarget, ParseResult } from "./types";

/*
 * Un estratto sintetico con la forma di quello vero (`pytr`): ogni riga
 * esercita una regola scritta in `trade-republic.ts`.
 */
const HEADER =
	"date,type,asset_class,name,amount,fee,tax,description,transaction_id,counterparty_name,counterparty_iban,payment_reference";
const LINES = [
	// Il versamento del 07/03/2024: 201,40 − 1,40 = 200,00 tondi.
	"2024-03-07,TRANSFER_INSTANT_INBOUND,,,201.400000,-1.400000,,Incoming transfer from Mario,t-in,Mario Rossi,IT60X0542811101000000123456,",
	// `amount` non è la cassa: la commissione sta a parte.
	'2026-01-10,BUY,FUND,Vanguard FTSE All-World,-24.970000,-1.000000,,"Buy trade IE00BK5BQT80, quantity: 0.2",t-buy1,,,',
	"2026-01-11,BUY,CRYPTO,Bitcoin,-50.000000,-1.000000,,,t-buy2,,,",
	"2026-01-12,BUY,BOND,Btp Italia,-10.000000,,,,t-buy3,,,",
	"2026-02-01,SELL,STOCK,Apple,300.000000,-1.000000,-10.000000,,t-sell1,,,",
	// Una vendita in perdita di CASSA: le commissioni superano il ricavo.
	"2026-02-02,SELL,STOCK,Tiny,0.500000,-1.000000,,,t-sell2,,,",
	// Il bollo: `amount` zero, il movimento sta in `tax`.
	"2026-03-31,TAX_OPTIMIZATION,,,0.000000,,-2.000000,Imposta di bollo,t-tax,,,",
	// Un trasloco di custodia: importi vuoti, nessun movimento di cassa.
	"2026-04-01,MIGRATION,FUND,Vanguard,,,,,t-mig,,,",
	"2026-04-02,CARD_TRANSACTION,,PAM,-12.300000,,,,t-card1,,,",
	"2026-04-03,CARD_TRANSACTION,,PAM,-7.700000,,,,t-card2,,,",
	"2026-04-04,CARD_TRANSACTION,,CaffÃ¨ Roma,-2.000000,,,,t-card3,,,",
	// L'IBAN solo nel testo libero, come sulle righe più vecchie.
	"2026-04-05,TRANSFER_INSTANT_OUTBOUND,,,-100.000000,,,Outgoing transfer to DE89370400440532013000,t-out,,,",
	// Illeggibili: senza data, senza identità.
	",BUY,FUND,X,-1.000000,,,,t-nodate,,,",
	"2026-04-06,BUY,FUND,X,-1.000000,,,,,,,",
	"2026-04-07,WEIRD_THING,,,5.000000,,,boh,t-weird,,,",
	"2026-04-08,INTEREST_PAYMENT,,,1.230000,,,Interest,t-int,,,",
];

const parse = (): ParseResult => parseTradeRepublic(parseCsv([HEADER, ...LINES].join("\n")));
const row = (r: ParseResult, id: string) => r.rows.find((x) => x.key === `trade_republic:${id}`);
const group = (r: ParseResult, id: string) => r.groups.find((g) => g.id === id);

describe("isTradeRepublic", () => {
	it("riconosce l'intestazione, senza badare a maiuscole e spazi", () => {
		expect(isTradeRepublic(HEADER.split(","))).toBe(true);
		expect(isTradeRepublic([" Date ", "TYPE", "Amount", "transaction_id", "asset_class"])).toBe(true);
	});

	it("senza asset_class un estratto con `type` non passa per un broker", () => {
		expect(isTradeRepublic(["date", "type", "amount", "transaction_id"])).toBe(false);
		expect(isTradeRepublic(["Data", "Importo", "Descrizione"])).toBe(false);
	});
});

describe("parseTradeRepublic — le righe", () => {
	const r = parse();

	it("netto = amount + fee + tax, e il versamento torna tondo", () => {
		expect(row(r, "t-in")).toMatchObject({ amount: 200, direction: "entrata" });
		expect(row(r, "t-buy1")).toMatchObject({ amount: 25.97, direction: "uscita" });
		expect(row(r, "t-sell1")).toMatchObject({ amount: 289, direction: "entrata" });
		expect(row(r, "t-tax")).toMatchObject({ amount: 2, direction: "uscita" });
	});

	it("la vendita in perdita di cassa esce dal conto", () => {
		expect(row(r, "t-sell2")).toMatchObject({ amount: 0.5, direction: "uscita" });
	});

	it("la tipologia viene da asset_class, con ripiego", () => {
		expect(row(r, "t-buy1")?.investmentType).toBe("etf");
		expect(row(r, "t-buy2")?.investmentType).toBe("crypto");
		expect(row(r, "t-sell1")?.investmentType).toBe("azioni");
		expect(row(r, "t-buy3")?.investmentType).toBe("altro");
		expect(row(r, "t-card1")?.investmentType).toBeNull();
	});

	it("il testo leggibile: il nome per carte e trade, la descrizione altrove", () => {
		expect(row(r, "t-buy1")?.description).toBe("Vanguard FTSE All-World");
		expect(row(r, "t-card3")?.description).toBe("Caffè Roma");
		expect(row(r, "t-in")?.description).toBe("Incoming transfer from Mario");
	});

	it("senza data o senza identità la riga non si scrive, e si conta", () => {
		expect(r.unreadable).toBe(2);
		expect(r.rows).toHaveLength(LINES.length - 2);
		expect(r.source).toBe("trade_republic");
	});
});

describe("parseTradeRepublic — i gruppi", () => {
	const r = parse();

	it("una decisione per gruppo: carta per esercente, bonifico per controparte", () => {
		expect(group(r, "carta|uscita|PAM")).toMatchObject({ count: 2, total: 20, suggested: "spesa" });
		expect(group(r, "carta|uscita|Caffè Roma")?.count).toBe(1);
		expect(group(r, "trasferimentoIn|entrata|IT60X0542811101000000123456")?.suggested).toBe("trasferimento");
		expect(group(r, "trasferimentoOut|uscita|DE89370400440532013000")?.suggested).toBe("trasferimento");
		expect(group(r, "acquisti|uscita|")).toMatchObject({ count: 3, total: 86.97, suggested: "investimento" });
	});

	it("le vendite propongono il disinvestimento (#52), ma non quella in perdita di cassa", () => {
		expect(group(r, "vendite|entrata|")).toMatchObject({
			suggested: "disinvestimento",
			allowed: ["disinvestimento", "entrata", "ignora"],
		});
		expect(group(r, "vendite|uscita|")).toMatchObject({ suggested: null, allowed: ["spesa", "ignora"] });
	});

	it("senza cassa: bloccato su ignora", () => {
		expect(group(r, "senzaCassa|uscita|")).toMatchObject({
			suggested: "ignora",
			allowed: ["ignora"],
			locked: true,
			noteKey: "senzaCassa",
		});
	});

	it("un tipo sconosciuto non riceve proposte", () => {
		expect(group(r, "altro|entrata|")).toMatchObject({ suggested: null, noteKey: "altro" });
	});

	it("nessun gruppo ammette un bersaglio che va nel verso opposto", () => {
		const IN: GroupTarget[] = ["entrata", "disinvestimento"];
		const OUT: GroupTarget[] = ["spesa", "abbonamento", "investimento", "risparmio"];
		for (const g of r.groups) {
			const vietati = g.direction === "entrata" ? OUT : IN;
			expect(g.allowed.filter((a) => vietati.includes(a)), g.id).toEqual([]);
			if (g.suggested !== null) expect(g.allowed, g.id).toContain(g.suggested);
		}
	});

	it("in cima chi impedisce di proseguire, in fondo gli ignorati", () => {
		expect(r.groups.map((g) => g.id)).toEqual([
			// senza proposta
			"vendite|uscita|",
			"altro|entrata|",
			// proposti come trasferimento: manca l'altro conto
			"trasferimentoIn|entrata|IT60X0542811101000000123456",
			"trasferimentoOut|uscita|DE89370400440532013000",
			// il resto per peso
			"acquisti|uscita|",
			"carta|uscita|PAM",
			"vendite|entrata|",
			"imposte|uscita|",
			"carta|uscita|Caffè Roma",
			"interessi|entrata|",
			// bloccati
			"senzaCassa|uscita|",
		]);
	});
});
