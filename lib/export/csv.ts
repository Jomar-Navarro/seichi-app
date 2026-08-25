/**
 * Scrittura CSV — il rovescio di `lib/import/csv.ts` (Fase 23a, issue #37).
 *
 * ⚠️ Scritto a mano e senza dipendenze per la stessa ragione del lettore: il
 * formato da produrre è RFC 4180 più due concessioni (delimitatore per locale e
 * BOM), e la superficie è una funzione di quaranta righe. Una libreria
 * porterebbe streaming, inferenza di tipi e trasformazioni che questo export non
 * usa.
 *
 * ⚠️ **Questo file NON produce un formato re-importabile, ed è deciso.** Le
 * colonne portano NOMI e non uuid, quindi su un altro account non risolvono; e
 * una riga inserita a mano ha `import_key` NULL, dove i NULL restano distinti —
 * reimportare il proprio export duplicherebbe quelle righe e non le altre. Metà
 * file idempotente è peggio di nessuna idempotenza. Il file parla alla PERSONA e
 * al suo foglio di calcolo; per rimettere dati dentro Seichi c'è l'import.
 */

import type { Locale } from "@/lib/i18n/config";

/**
 * Il separatore di campo, per locale.
 *
 * ⚠️ Non è una preferenza estetica: un Excel italiano apre un file separato da
 * virgole mettendo **tutta la riga in una sola cella**, perché si aspetta il
 * punto e virgola. Lo scopo di questo file è aprirsi bene nel foglio di calcolo
 * di *quell'* utente, quindi il separatore segue la sua lingua.
 *
 * Residuo dichiarato: un file esportato in italiano e aperto in un Excel inglese
 * chiede la procedura guidata. È il prezzo di servire bene il caso normale.
 *
 * ⚠️ Il lettore dell'import riconosce entrambi da sé (`detectDelimiter`), quindi
 * i due file restano leggibili da questo stesso progetto — non è una promessa di
 * re-importabilità, è solo l'assenza di un'incompatibilità gratuita.
 */
export const CSV_DELIMITER: Record<Locale, string> = { it: ";", en: "," };

/**
 * Il separatore decimale, per locale.
 *
 * ⚠️ **Non può mai coincidere con `CSV_DELIMITER`**, o ogni importo spezzerebbe
 * la propria riga in due celle. Le due mappe vanno lette insieme: italiano
 * `;` + `,`, inglese `,` + `.`. Cambiarne una sola è il modo di rompere il file.
 */
const DECIMAL_SEPARATOR: Record<Locale, string> = { it: ",", en: "." };

/**
 * Il valore di una cella.
 *
 * ⚠️ La distinzione fra `string` e `number` NON è comodità di chiamata: decide
 * se applicare la difesa contro le formule. Un importo negativo comincia con un
 * meno, e proteggerlo lo trasformerebbe in testo — cioè romperebbe la colonna
 * che il foglio di calcolo deve poter sommare. Tipizzando le celle, "quali
 * colonne sono numeriche" ha una risposta sola invece di un elenco di indici da
 * tenere allineato a mano.
 *
 * `null` è la cella vuota, e resta distinto da `""` solo per chi legge il
 * codice: nel file sono la stessa cosa.
 */
export type CsvValue = string | number | null;

/** Il marcatore che dice a Excel "questo file è UTF-8". Vedi `toCsv`. */
const BOM = "\uFEFF";

/**
 * I caratteri che, in prima posizione, fanno interpretare la cella come una
 * FORMULA invece che come testo.
 *
 * ⚠️⚠️ `notes` è testo dell'utente, e lo sono anche i nomi di categoria e di
 * conto: è il **terzo** punto di questa app in cui il testo dell'utente diventa
 * sintassi, dopo `.or()` in `getTransactions` (da cui `isAccountId()`) e la
 * query string della Fase 22. Qui però la sintassi la esegue un altro programma,
 * sul computer di chi apre il file.
 *
 * Il tab e il ritorno a capo ci sono perché Excel li salta prima di decidere:
 * `\t=cmd` è una formula quanto `=cmd`.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Una cella di TESTO: protetta dalle formule e citata quando serve.
 *
 * L'apice iniziale è la difesa standard — in Excel e LibreOffice significa
 * "questa cella è testo" e non viene mostrato. In un editor di testo si vede,
 * ed è un costo accettato: la cella alterata è una nota che comincia con un
 * segno di operazione, cioè il caso raro, e l'alternativa è eseguire codice
 * arbitrario a casa di chi apre il file.
 */
function textCell(value: string, delimiter: string): string {
	const guarded = FORMULA_LEAD.test(value) ? `'${value}` : value;

	// Si cita anche per gli spazi ai bordi: senza virgolette molti lettori li
	// mangiano, e una nota che finisce con uno spazio cambierebbe in silenzio.
	const mustQuote =
		guarded.includes(delimiter) ||
		guarded.includes('"') ||
		guarded.includes("\n") ||
		guarded.includes("\r") ||
		guarded !== guarded.trim();

	return mustQuote ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/**
 * Una cella NUMERICA: separatore decimale del locale, nessun raggruppamento.
 *
 * ⚠️ Niente separatore delle migliaia, deliberatamente. `1.234,56` in italiano
 * costringerebbe a citare la cella e resta un numero solo per fortuna: molti
 * lettori lo importano come testo. Il raggruppamento è una decorazione di
 * lettura, e la aggiunge il foglio di calcolo con il proprio formato di cella.
 *
 * `String()` e non `Intl`: gli importi arrivano da `DECIMAL(10,2)`, quindi non
 * hanno code binarie da arrotondare, e `Intl` reintrodurrebbe proprio il
 * raggruppamento che qui non si vuole.
 */
function numberCell(value: number, locale: Locale): string {
	if (!Number.isFinite(value)) return "";
	return String(value).replace(".", DECIMAL_SEPARATOR[locale]);
}

/**
 * Le righe diventano il testo di un file CSV.
 *
 * ⚠️ **Il BOM va scritto.** Excel su Windows apre un UTF-8 senza BOM come
 * latin-1: "Caffè" diventa "CaffÃ¨". È esattamente il mojibake che
 * `repairMojibake()` esiste per RIPARARE nei file altrui — solo che stavolta a
 * produrlo saremmo noi, e nel file dell'utente resterebbe per sempre.
 * `parseCsv()` il BOM lo toglie già, quindi non disturba nemmeno il nostro
 * lettore.
 *
 * ⚠️ Fine riga **CRLF**, come prescrive RFC 4180. Non è pedanteria: alcune
 * versioni di Excel per Windows trattano un file con soli `\n` come una riga
 * unica.
 */
export function toCsv(rows: CsvValue[][], locale: Locale): string {
	const delimiter = CSV_DELIMITER[locale];

	const body = rows
		.map((row) =>
			row
				.map((value) => {
					if (value === null) return "";
					return typeof value === "number"
						? numberCell(value, locale)
						: textCell(value, delimiter);
				})
				.join(delimiter),
		)
		.join("\r\n");

	// L'a capo finale: molti strumenti si aspettano che l'ultima riga sia chiusa,
	// e `parseCsv` scarta comunque le righe vuote.
	return `${BOM}${body}\r\n`;
}
