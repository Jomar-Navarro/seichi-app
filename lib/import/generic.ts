import { parseAmount, parseDate, repairMojibake } from "./csv";
import { sortGroups } from "./trade-republic";
import type { Direction, ParseResult, ParsedGroup, ParsedRow } from "./types";

/**
 * Il profilo generico: un CSV qualsiasi, con le colonne indicate dall'utente.
 *
 * ⚠️ Non è un secondo importatore accanto a quello di Trade Republic: è lo
 * STESSO motore con la mappatura chiesta invece che riconosciuta. La direzione
 * di dipendenza conta — un lettore Trade Republic è un caso particolare del
 * generico, non viceversa — ed è la ragione per cui questo file esiste dal primo
 * giorno: costruendo prima il profilo specifico, il passo di mappatura sarebbe
 * dovuto rientrare a forza in un flusso disegnato senza spazio per lui.
 */

export interface GenericMapping {
	/** Indice della colonna con la data. */
	date: number;
	/** Indice della colonna con l'importo, col segno. */
	amount: number;
	/** Indice della descrizione, oppure `null` se il file non ne ha una. */
	description: number | null;
}

/**
 * Riduce una descrizione alla sua forma confrontabile, per la chiave di
 * deduplica: spazi normalizzati, minuscolo, niente punteggiatura di contorno.
 * Serve perché lo stesso movimento riesportato può differire di uno spazio.
 */
function normalize(value: string): string {
	return value
		.toLowerCase()
		.replace(/\s+/g, " ")
		.replace(/[^\p{L}\p{N} ]/gu, "")
		.trim();
}

export function parseGeneric(rows: string[][], mapping: GenericMapping): ParseResult {
	const parsed: ParsedRow[] = [];
	const groups = new Map<string, ParsedGroup>();
	let unreadable = 0;

	/*
	 * ⚠️ **Il contatore di occorrenza, che è il cuore di questo profilo.**
	 *
	 * Senza una chiave naturale la deduplica deve comporre `data + importo +
	 * descrizione` — e due movimenti identici nello stesso giorno producono la
	 * stessa chiave, quindi il secondo verrebbe scartato come duplicato. Non è
	 * un caso di scuola: l'estratto reale su cui questa fase è stata progettata
	 * contiene due bonifici da 100,00 € in entrata lo stesso giorno, a 42
	 * secondi di distanza. Una deduplica ingenua perde 100 €.
	 *
	 * E il difetto è **peggiore** del suo contrario, che è il motivo per cui la
	 * soluzione va nella direzione di importare più righe e non meno: un
	 * duplicato si vede nella lista e si cancella in due tocchi, una riga mai
	 * importata non si vede affatto — non c'è nulla da guardare.
	 *
	 * Il contatore riparte da capo a ogni file, ed è proprio questo che lo fa
	 * funzionare al reimport: se un file successivo che si sovrappone contiene
	 * TRE caffè uguali dove il primo ne aveva due, le prime due chiavi
	 * collidono e vengono saltate, la terza è nuova e viene scritta.
	 *
	 * Limite residuo, dichiarato: due movimenti realmente distinti ma identici
	 * in data, importo e descrizione, presenti in DUE file diversi, restano
	 * indistinguibili. Non è chiudibile senza un identificativo nel file — che
	 * è esattamente ciò che Trade Republic fornisce e una banca qualsiasi no.
	 */
	const seen = new Map<string, number>();

	for (let r = 1; r < rows.length; r++) {
		const row = rows[r];
		const date = parseDate(row[mapping.date]);
		const net = parseAmount(row[mapping.amount]);

		if (!date || net === null || net === 0) {
			unreadable++;
			continue;
		}

		const description =
			mapping.description === null ? "" : repairMojibake((row[mapping.description] ?? "").trim());

		const base = `${date}|${net.toFixed(2)}|${normalize(description)}`;
		const occurrence = (seen.get(base) ?? 0) + 1;
		seen.set(base, occurrence);

		const direction: Direction = net > 0 ? "entrata" : "uscita";
		const groupId = `movimenti|${direction}|`;

		parsed.push({
			key: `generico:${base}#${occurrence}`,
			date,
			amount: Math.abs(net),
			direction,
			description: description || date,
			groupId,
			investmentType: null,
		});

		const existing = groups.get(groupId);
		if (existing) {
			existing.count++;
			existing.total = Math.round((existing.total + Math.abs(net)) * 100) / 100;
		} else {
			groups.set(groupId, {
				id: groupId,
				kind: "movimenti",
				detail: null,
				direction,
				count: 1,
				total: Math.abs(net),
				/*
				 * Due soli gruppi, uno per verso — e nessun raggruppamento per
				 * descrizione, che qui sarebbe testo libero senza struttura. È
				 * meno comodo del profilo Trade Republic, ed è la differenza che
				 * il riconoscimento automatico compra: un file conosciuto sa
				 * dire *perché* le sue righe stanno insieme, uno qualsiasi no.
				 */
				suggested: direction === "entrata" ? "entrata" : "spesa",
				allowed:
					direction === "entrata"
						? ["entrata", "trasferimento", "ignora"]
						: ["spesa", "abbonamento", "investimento", "risparmio", "trasferimento", "ignora"],
				noteKey: null,
				locked: false,
			});
		}
	}

	return { source: "generico", rows: parsed, groups: sortGroups([...groups.values()]), unreadable };
}
