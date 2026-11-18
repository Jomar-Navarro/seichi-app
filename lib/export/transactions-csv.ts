/**
 * Le righe del CSV dei movimenti, in un posto solo (Fase 23a, spostate qui
 * dalla #162).
 *
 * Fino alla #162 le costruiva la rotta del download. L'archivio completo
 * contiene lo stesso file, su tutto il periodo: con due copie della stessa
 * tabella, la prima correzione applicata a una sola avrebbe fatto dire due cose
 * diverse a due file che si chiamano uguale (CLAUDE.md, «un numero mostrato in
 * due posti viene dalla stessa funzione»).
 *
 * Funzione pura: le letture le fa il chiamante, che risponde anche dei loro
 * errori. Le note sul segno e sul tipo stanno qui accanto al codice che le
 * applica.
 */

import type { Dictionary } from "@/lib/i18n/dictionaries/it";
import { lookup } from "@/lib/i18n/format";
import { amountSign } from "@/lib/transaction-utils";
import type { CsvValue } from "./csv";

/** Ciò che serve di un movimento per scriverne la riga. */
export type CsvTransaction = {
	id: string;
	date: string;
	type: string;
	amount: number;
	account_id: string;
	to_account_id: string | null;
	notes: string | null;
	/** Il nome della categoria, già risolto dal chiamante; `null` se non ne ha. */
	categoryName: string | null;
};

/** L'intestazione del file, nella lingua dell'utente. */
export function transactionCsvHeader(t: Dictionary): CsvValue[] {
	const c = t.export.columns;
	return [c.date, c.type, c.category, c.account, c.toAccount, c.amount, c.notes, c.attachments];
}

/**
 * Una riga per movimento, nell'ordine ricevuto; l'intestazione la mette il
 * chiamante con `transactionCsvHeader()`, una volta sola anche se legge a
 * blocchi.
 *
 * `conto` è il conto da cui si guarda (il filtro dell'export), o `null`: decide
 * il segno di un trasferimento. `attachmentCounts` deve essere COMPLETO: un
 * conteggio mancante qui diventerebbe uno zero scritto in un file salvato, e i
 * chiamanti si fermano prima se la lettura non lo è (#124).
 */
export function transactionCsvRows(
	transactions: CsvTransaction[],
	{
		accountName,
		attachmentCounts,
		conto,
		t,
	}: {
		accountName: Map<string, string>;
		attachmentCounts: Record<string, number>;
		conto: string | null;
		t: Dictionary;
	},
): CsvValue[][] {
	const rows: CsvValue[][] = [];

	for (const tx of transactions) {
		/*
		 * ⚠️ Il segno è quello che l'app MOSTRA, non uno inventato per il file:
		 * `amountSign()` guarda il conto filtrato, quindi un trasferimento è `−`
		 * sull'origine e `+` sulla destinazione. Senza conto selezionato resta
		 * senza segno, ed è positivo — la colonna "Tipo" accanto dice che è un
		 * trasferimento. Il file e la lista devono dire la stessa cosa, o
		 * diventano due risposte alla stessa domanda.
		 *
		 * ⚠️ Conseguenza dichiarata: SENZA un conto scelto, sommare la colonna
		 * Importo in un foglio di calcolo **sovrastima**, perché i trasferimenti
		 * vi entrano col segno più pur non essendo né entrate né uscite. Non è
		 * un difetto risolvibile in questa colonna: senza un punto di vista il
		 * segno di un trasferimento non esiste (è la stessa ragione per cui la
		 * lista lo lascia neutro), e azzerarlo o svuotare la cella perderebbe un
		 * dato vero. Chi vuole un totale sommabile esporta un conto per volta —
		 * là ogni riga ha un segno, e la somma riconcilia col saldo.
		 */
		const sign = amountSign(tx, conto);

		rows.push([
			// ⚠️ Solo la data, senza orario: `transactions.date` è un `timestamp
			// without time zone`, quindi tagliare i primi dieci caratteri è
			// leggerlo come è scritto, senza conversioni di fuso. È anche l'unica
			// parte che l'app mostra.
			tx.date.slice(0, 10),
			/*
			 * ⚠️ `t.transactionTypes[…].label` e NON `t.typesSingular`.
			 *
			 * Il secondo serve alla UI delle categorie e **non contiene**
			 * `trasferimento` né `disinvestimento` — deliberatamente, perché nessuno
			 * dei due può avere una categoria propria. Usandolo qui, `lookup()`
			 * ripiegava sull'id del database: la colonna Tipo diceva "Spesa" per
			 * cinque tipi e `trasferimento` minuscolo per il sesto — e in un file
			 * INGLESE sarebbe comparsa la parola italiana.
			 *
			 * `t.transactionTypes` descrive i tipi di MOVIMENTO, li ha tutti e sette,
			 * ed è la stessa etichetta che l'utente legge sulle card del modale.
			 * Il ripiego resta comunque, perché il tipo arriva dal database.
			 */
			lookup(t.transactionTypes, tx.type, (entry) => entry.label, tx.type),
			tx.categoryName ?? "",
			accountName.get(tx.account_id) ?? "",
			tx.to_account_id ? (accountName.get(tx.to_account_id) ?? "") : "",
			sign === "−" ? -tx.amount : tx.amount,
			tx.notes ?? "",
			attachmentCounts[tx.id] ?? 0,
		]);
	}

	return rows;
}
