import { parseCsv } from "./csv";
import { parseGeneric, type GenericMapping } from "./generic";
import { isTradeRepublic, parseTradeRepublic } from "./trade-republic";
import type { ImportSource, ParseResult } from "./types";

export * from "./types";
export type { GenericMapping } from "./generic";

/*
 * ⚠️ `parseDate`, `parseAmount` e `repairMojibake` NON si riesportano da qui,
 * benché siano pubbliche in `./csv` per i due profili e per i test.
 *
 * `lib/i18n/format.ts` esporta a sua volta una `parseDate` che fa un'altra cosa
 * (legge una data del database per `Intl`, non una colonna di CSV). Riesportando
 * la nostra, un file che importasse da entrambi si troverebbe due funzioni
 * omonime con firme compatibili — e sceglierne una per sbaglio darebbe una data
 * plausibile e sbagliata, cioè il difetto che non si vede.
 */

/**
 * Il limite di dimensione del file.
 *
 * ⚠️ **Va tenuto allineato a `bodySizeLimit` in `next.config.ts`**, esattamente
 * come `AVATAR_MAX_BYTES`: quel limite vale sul body HTTP grezzo e scatta PRIMA
 * che la server action venga eseguita, quindi un file più grande verrebbe
 * rifiutato dal framework con un errore che non dice nulla di utile. Il tetto è
 * 3 MB; qui si sta sotto perché il multipart aggiunge boundary e header.
 *
 * Per dare la misura: l'estratto Trade Republic di tre anni su cui questa fase è
 * stata progettata pesa **circa 40 KB**. Due megabyte sono decenni.
 */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Cosa si può dire di un file appena letto.
 *
 * ⚠️ Due esiti e non uno, perché il passo di mappatura **esiste solo quando
 * serve**: se l'intestazione si annuncia da sola, chiedere all'utente quale
 * colonna sia l'importo è una domanda di cui conosciamo già la risposta — e una
 * domanda inutile in un flusso a tre passi è un passo intero sprecato.
 */
export type ImportAnalysis =
	| { kind: "letto"; result: ParseResult }
	| {
			/** Profilo non riconosciuto: servono le colonne dall'utente. */
			kind: "mappatura";
			header: string[];
			/** Le prime righe, per far vedere cosa contengono le colonne. */
			sample: string[][];
	  };

/**
 * Legge il testo di un CSV e decide come trattarlo.
 *
 * `mapping` arriva solo al secondo giro, dopo che l'utente ha indicato le
 * colonne: al primo si passa `undefined` e la funzione risponde `mappatura` se
 * non riconosce il file.
 */
export function analyze(text: string, mapping?: GenericMapping): ImportAnalysis {
	const rows = parseCsv(text);
	const header = rows[0] ?? [];

	if (isTradeRepublic(header)) {
		return { kind: "letto", result: parseTradeRepublic(rows) };
	}

	if (mapping) {
		return { kind: "letto", result: parseGeneric(rows, mapping) };
	}

	return { kind: "mappatura", header, sample: rows.slice(1, 4) };
}

/**
 * La chiave di deduplica come arriva al database, per il conto del file (#118).
 *
 * ⚠️ **Il profilo generico la lega al CONTO; Trade Republic no**, e la
 * differenza sta in cosa identifica la chiave.
 *
 * Quella generica è `data | importo | descrizione #occorrenza`: descrive una
 * riga, non un evento. Due conti della stessa banca hanno righe identiche — il
 * bollo trimestrale, il canone del mese — e senza il conto il secondo estratto
 * produceva le stesse chiavi del primo: `on conflict do nothing` le saltava e il
 * resoconto le contava fra i "già presenti", mentre su QUEL conto non c'erano.
 * Il saldo restava sbagliato per sempre, e reimportare non serviva.
 *
 * Quella di Trade Republic è l'id del movimento nel file: un evento reale, che
 * appartiene a un conto solo. Legarla al conto permetterebbe di importare lo
 * stesso estratto su due conti, cioè di contare due volte lo stesso denaro —
 * l'errore che l'annullamento dell'import esiste per rimediare, non per
 * favorire.
 *
 * Le righe generiche importate prima della #118 hanno la chiave senza conto:
 * le allinea `20260820_import_key_account.sql`, o un reimport dello stesso
 * file le duplicherebbe.
 */
export function importKeyFor(source: ImportSource, key: string, accountId: string): string {
	return source === "generico" ? key.replace(/^generico:/, `generico:${accountId}:`) : key;
}
