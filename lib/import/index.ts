import { parseCsv } from "./csv";
import { parseGeneric, type GenericMapping } from "./generic";
import { isTradeRepublic, parseTradeRepublic } from "./trade-republic";
import type { ParseResult } from "./types";

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
