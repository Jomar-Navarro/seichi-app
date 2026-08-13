/**
 * Un lettore CSV minimo, senza dipendenze.
 *
 * ⚠️ Scritto a mano e non con una libreria perché la regola del progetto è che
 * una dipendenza si aggiunge quando serve, non quando è comoda: qui il formato
 * che serve leggere è RFC 4180 più due concessioni (delimitatore e BOM), e la
 * superficie è una funzione di sessanta righe. Una libreria porterebbe con sé
 * rilevamento di tipi, streaming e trasformazioni che questo import non usa.
 *
 * ⚠️ **`text.split(",")` NON è un lettore CSV**, ed è la tentazione da evitare:
 * l'export di Trade Republic ha campi quotati che contengono virgole — per
 * esempio `"Buy trade IE00BK5BQT80 Vanguard Funds PLC - …, quantity: 0.802560"`.
 * Spezzando sulle virgole quella riga acquisisce una colonna in più e tutto ciò
 * che le sta a destra slitta di posto: l'`import_key` finirebbe nel campo
 * sbagliato, e il guasto si vedrebbe come una deduplica che non funziona, non
 * come un errore di parsing.
 */

/** Il carattere che separa i campi. Riconosciuto dalla prima riga. */
export type Delimiter = "," | ";" | "\t";

const DELIMITERS: Delimiter[] = [",", ";", "\t"];

/**
 * Indovina il separatore contando le occorrenze FUORI dalle virgolette nella
 * prima riga.
 *
 * ⚠️ Il conteggio deve ignorare il contenuto dei campi quotati, o un export
 * italiano con `"1.234,56"` dentro un file separato da `;` verrebbe letto come
 * separato da `,`. È il caso che rende il rilevamento ingenuo sbagliato proprio
 * sui file per cui serve.
 */
export function detectDelimiter(text: string): Delimiter {
	const firstLine = text.slice(0, text.indexOf("\n") === -1 ? undefined : text.indexOf("\n"));

	let best: Delimiter = ",";
	let bestCount = -1;

	for (const d of DELIMITERS) {
		let count = 0;
		let quoted = false;
		for (let i = 0; i < firstLine.length; i++) {
			const c = firstLine[i];
			if (c === '"') quoted = !quoted;
			else if (c === d && !quoted) count++;
		}
		if (count > bestCount) {
			bestCount = count;
			best = d;
		}
	}

	return best;
}

/**
 * Trasforma il testo di un CSV in una matrice di stringhe.
 *
 * Gestisce virgolette, virgolette raddoppiate (`""` = un `"` letterale),
 * ritorni a capo dentro un campo quotato, CRLF e BOM. Le righe interamente
 * vuote vengono scartate: molti export ne lasciano una in fondo, e senza il
 * filtro produrrebbe una transazione fantasma con tutti i campi vuoti.
 */
export function parseCsv(text: string, delimiter?: Delimiter): string[][] {
	// Il BOM sopravvive a `fetch`/`File.text()` e si attaccherebbe al nome della
	// prima colonna, che diventerebbe `﻿datetime` e non corrisponderebbe a
	// nessuna intestazione attesa — un guasto che si legge come "file non
	// riconosciuto" mentre il file è perfetto.
	const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
	const sep = delimiter ?? detectDelimiter(src);

	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;

	const endField = () => {
		row.push(field);
		field = "";
	};
	const endRow = () => {
		endField();
		if (row.some((v) => v.trim() !== "")) rows.push(row);
		row = [];
	};

	for (let i = 0; i < src.length; i++) {
		const c = src[i];

		if (quoted) {
			if (c === '"') {
				if (src[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					quoted = false;
				}
			} else {
				field += c;
			}
			continue;
		}

		if (c === '"') quoted = true;
		else if (c === sep) endField();
		else if (c === "\n") endRow();
		else if (c === "\r") continue; // CRLF: il \n che segue chiude la riga
		else field += c;
	}

	// L'ultima riga non è seguita da un a capo se il file non termina con uno.
	if (field !== "" || row.length > 0) endRow();

	return rows;
}

/**
 * Ripara il testo passato due volte per una decodifica sbagliata.
 *
 * ⚠️ L'export di `pytr` contiene `AusfÃ¼hrung` al posto di `Ausführung`: i byte
 * UTF-8 di `ü` (`C3 BC`) sono stati letti come due caratteri latin-1 e poi
 * riscritti in UTF-8. Non è un difetto nostro e non lo possiamo evitare a monte,
 * ma importarlo così com'è vorrebbe dire scrivere quel refuso dentro
 * `transactions.notes`, dove resta per sempre.
 *
 * La riparazione è il giro inverso, e si applica **solo** se riesce: si
 * ricostruiscono i byte originali e si prova a decodificarli come UTF-8 con
 * `fatal: true`. Se la stringa non era mojibake la decodifica fallisce, e si
 * tiene l'originale. È il motivo per cui questo non può rovinare un testo sano.
 */
export function repairMojibake(value: string): string {
	// Le sequenze rivelatrici. Senza questo filtro si tenterebbe la conversione
	// su ogni campo di ogni riga, per poi scartarla quasi sempre.
	if (!/[ÃÂ]|â€/.test(value)) return value;

	const bytes = new Uint8Array(value.length);
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		// Un carattere fuori da latin-1 non può essere il risultato di quella
		// decodifica sbagliata: la stringa non è mojibake, si lascia stare.
		if (code > 0xff) return value;
		bytes[i] = code;
	}

	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return value;
	}
}

/**
 * Il numero come lo scrive un estratto conto, oppure `null`.
 *
 * Accetta sia `1234.56` (Trade Republic, e ogni export tecnico) sia `1.234,56`
 * (formato italiano, che compare negli export delle banche). La distinzione si
 * fa dall'**ultimo separatore presente**: se è una virgola, è quello decimale e
 * i punti sono migliaia; altrimenti il contrario.
 *
 * ⚠️ Torna `null` e non `0` per un campo vuoto o illeggibile. Sono cose diverse:
 * `TAX_OPTIMIZATION` ha un importo che vale davvero zero, mentre `MIGRATION` ha
 * il campo vuoto — e trattarli allo stesso modo funzionerebbe per caso oggi e
 * smetterebbe di funzionare al primo profilo di import in cui zero è un valore
 * legittimo da scrivere.
 */
export function parseAmount(raw: string | undefined): number | null {
	if (raw == null) return null;

	const cleaned = raw.trim().replace(/\s| |€|EUR/gi, "");
	if (cleaned === "") return null;

	const lastComma = cleaned.lastIndexOf(",");
	const lastDot = cleaned.lastIndexOf(".");

	let normalized: string;
	if (lastComma > lastDot) {
		normalized = cleaned.replace(/\./g, "").replace(",", ".");
	} else {
		normalized = cleaned.replace(/,/g, "");
	}

	const n = Number(normalized);
	return Number.isFinite(n) ? n : null;
}

/**
 * La data come `YYYY-MM-DD`, oppure `null`.
 *
 * ⚠️ **Non si passa da `new Date(stringa)`.** Su un formato ambiguo come
 * `03/04/2026` il costruttore applica la convenzione americana e restituisce il
 * 4 marzo invece del 3 aprile, senza errore — cioè la classe di difetto che
 * questo progetto ha già incontrato con `en-US` nella Fase 19, dove l'unico
 * sintomo era una data plausibile e sbagliata. Qui i formati sono riconosciuti
 * uno per uno e quelli ambigui sono letti **giorno prima**, che è la
 * convenzione europea di ogni banca che questa app possa incontrare.
 */
export function parseDate(raw: string | undefined): string | null {
	if (raw == null) return null;
	const value = raw.trim();
	if (value === "") return null;

	// ISO, con o senza parte oraria: `2026-07-31`, `2026-07-31T16:37:36Z`.
	const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
	if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

	// Europeo: `31/07/2026`, `31-07-2026`, `31.07.2026`.
	const eu = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
	if (eu) {
		const day = eu[1].padStart(2, "0");
		const month = eu[2].padStart(2, "0");
		if (Number(month) > 12) return null;
		return `${eu[3]}-${month}-${day}`;
	}

	return null;
}
