"use server";

import { getTransactions } from "@/app/(main)/action";
import { getAccountOptions } from "@/app/(main)/conti/actions";
import { getCategories } from "@/app/(main)/impostazioni/actions";
import { TRANSACTIONS_PAGE_SIZE } from "@/lib/transaction-utils";

/**
 * Tutto ciò che serve ad APRIRE Movimenti, in una richiesta sola (#148).
 *
 * ⚠️ Esiste perché **Next spedisce le server action una alla volta**
 * (`server-actions.md`, verificato nella #122). Prima la pagina ne lanciava
 * quattro all'apertura — conti del filtro, categorie del filtro, movimenti,
 * ricevute — e gli effetti erano dichiarati in quell'ordine: la LISTA aspettava
 * in coda dietro ai dati dei due filtri. Qui le tre letture partono insieme sul
 * server, e le ricevute stanno già dentro la query dei movimenti
 * (`withAttachmentCounts`).
 *
 * Serve all'apertura e dopo un salvataggio, quando anche conti e categorie
 * possono essere cambiati. Un cambio di filtro chiede solo i movimenti.
 *
 * ⚠️ Conti e categorie DEGRADANO: senza, il filtro resta su "Tutti" ma la lista
 * si vede lo stesso — com'era prima, quando erano letture separate. I movimenti
 * no: senza di loro la pagina non ha niente da mostrare.
 *
 * ⚠️ `contoUnknown`: il conto chiesto non è fra quelli dell'utente (cancellato
 * altrove, o un cookie di un altro account sullo stesso browser). Con la RLS la
 * lista tornerebbe semplicemente vuota, e il chip direbbe "Tutti i conti" — non
 * trovando il nome — sopra dati filtrati su un id fantasma: la contraddizione
 * che la home corregge col redirect. Qui lo decide il chiamante, che sa se l'id
 * veniva dall'URL o dalla memoria.
 */
export async function getMovimentiData(filters: {
	tipo?: string;
	periodo?: string;
	conto?: string;
	categoria?: string;
	/** La prima pagina, o `SEARCH_SCAN_LIMIT` se un salvataggio arriva mentre si cerca. */
	limit?: number;
}) {
	const { limit = TRANSACTIONS_PAGE_SIZE, ...rest } = filters;
	const [transactions, accounts, categories] = await Promise.all([
		getTransactions({
			...rest,
			limit,
			offset: 0,
			withAttachmentCounts: true,
		}),
		getAccountOptions(),
		getCategories(),
	]);

	if ("error" in accounts) console.error("[movimenti] conti del filtro:", accounts.error);
	if ("error" in categories) console.error("[movimenti] categorie del filtro:", categories.error);

	const accountList = "data" in accounts ? accounts.data : null;
	const contoUnknown = Boolean(
		filters.conto && accountList && !accountList.some((a) => a.id === filters.conto),
	);

	return {
		transactions,
		accounts: accountList,
		categories: "data" in categories ? categories.data : null,
		contoUnknown,
	};
}
