import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/UI/PageHeader";
import ExportPanel from "@/components/features/ExportPanel";
import ArchiveDownload from "@/components/features/ArchiveDownload";
import ForgetExportError from "@/components/features/ForgetExportError";
import { parseExportError, type ExportError } from "@/lib/export/download-error";
import { rateLimitMessage } from "@/lib/rate-limit";
import type { Dictionary } from "@/lib/i18n/dictionaries/it";
import type { Locale } from "@/lib/i18n/config";

/**
 * L'export dei movimenti in CSV (Fase 23a, issue #37) e, sotto, l'archivio
 * completo di tutti i dati (#162).
 *
 * ⚠️ Conti e categorie si caricano QUI, come nella pagina di import: servono ai
 * selettori, e un client component che li caricasse da sé li richiederebbe a
 * ogni apertura di una tendina.
 *
 * ⚠️ **Il conto ricordato nel cookie NON si legge, deliberatamente.** Quel
 * cookie segue le viste che si consultano — home, analisi e, dalla #148,
 * Movimenti — e regge solo perché là la selezione è sempre visibile in un chip
 * e si annulla con un tocco. Qui produrrebbe un file filtrato per una scelta
 * fatta in un'altra schermata, cioè uno stato che finisce dentro un documento
 * salvato: una pagina sbagliata si corregge al tocco dopo, un file archiviato
 * no. (Fino alla #148 questo commento citava `/transazioni` come precedente;
 * la ragione dell'export è sua, e resta anche ora che Movimenti ricorda.)
 */
/**
 * La frase di un errore di download (#162), dal dizionario: l'URL porta solo
 * il codice. Il limite compone l'attesa con la frase del suo tetto.
 */
function exportErrorMessage(t: Dictionary, locale: Locale, error: ExportError): string {
	switch (error.code) {
		case "filtro":
			return t.export.errors.badFilter;
		case "lettura":
			return t.export.errors.failed;
		case "limite":
			return rateLimitMessage(t, locale, error.target === "csv" ? "export" : "archive", error.wait);
		case "troppo-grande":
			return t.export.archive.errors.tooLarge;
		case "rete":
			return t.errors.authUnavailable;
	}
}

export default async function EsportaPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { supabase, user, t, locale } = await requireUser();
	if (!user) redirect("/sign");

	/*
	 * ⚠️ L'errore di un download (#162). Le rotte rispondono a un errore con un
	 * rinvio qui e un CODICE, mai con un testo: i comandi sono `<a>` nudi, e un
	 * testo sarebbe una pagina bianca senza tasto indietro nella PWA installata.
	 * Un codice sconosciuto si ignora (`parseExportError`).
	 */
	const downloadError = parseExportError(await searchParams);
	const errorMessage = downloadError ? exportErrorMessage(t, locale, downloadError) : null;

	const [accountsRes, categoriesRes, countRes, receiptsRes] = await Promise.all([
		/*
		 * ⚠️ Anche gli ARCHIVIATI, al contrario dell'import.
		 *
		 * Là un conto archiviato è una destinazione sbagliata per righe nuove; qui
		 * è una parte di storia che si vuole poter tirare fuori proprio perché è
		 * chiusa. Escluderlo renderebbe inesportabili i movimenti di un conto che
		 * non si userà più — cioè quelli che più probabilmente si vogliono salvare.
		 */
		supabase
			.from("accounts")
			.select("id, name, archived")
			.eq("user_id", user.id)
			.order("created_at", { ascending: true }),
		supabase
			.from("categories")
			.select("id, name, type")
			.eq("user_id", user.id)
			.order("name", { ascending: true }),
		/*
		 * ⚠️ Serve a NON mostrare il comando quando non c'è niente da esportare.
		 * Un pulsante vivo che scarica un file con la sola riga di intestazione si
		 * legge come un guasto dell'app, non come "non hai ancora movimenti".
		 *
		 * Il filtro esplicito su `user_id` è ridondante con la RLS ed è voluto,
		 * come nella pagina impostazioni: se quella policy venisse allentata, il
		 * conteggio non deve diventare globale senza che nessuno se ne accorga.
		 */
		supabase
			.from("transactions")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id),
		// #162 · quante ricevute entreranno nell'archivio: dice quanto aspettare.
		supabase
			.from("attachments")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id),
	]);

	if (accountsRes.error) console.error("[export] conti:", accountsRes.error.message);
	if (categoriesRes.error) console.error("[export] categorie:", categoriesRes.error.message);

	/*
	 * ⚠️ Una lettura FALLITA non è "non hai movimenti".
	 *
	 * Scartando l'errore, un guasto di rete faceva sparire il comando e la
	 * pagina affermava che non c'è niente da esportare — una bugia sui propri
	 * dati, e senza via d'uscita: chi la legge non ricarica, se ne va. È la
	 * classe già corretta in Fase 22, dove `getAttachments` rispondeva a una
	 * query fallita con un elenco vuoto, cioè "nessuna ricevuta".
	 *
	 * Nel dubbio si MOSTRA il comando: se davvero non c'è niente da esportare
	 * si otterrà un file con la sola intestazione o un errore leggibile —
	 * entrambi preferibili a una funzione che scompare senza spiegazione.
	 */
	if (countRes.error) console.error("[export] conteggio movimenti:", countRes.error.message);
	const hasTransactions = countRes.error !== null || (countRes.count ?? 0) > 0;

	// Un conteggio non letto NON è «nessuna ricevuta» (#124): la riga si omette.
	if (receiptsRes.error) console.error("[export] conteggio ricevute:", receiptsRes.error.message);
	const receiptCount = receiptsRes.error ? null : (receiptsRes.count ?? 0);

	// `pb-34` come ogni altra pagina di impostazioni: la `BottomNav` è `fixed`, e
	// con un padding più corto l'ultimo elemento finisce sotto la barra.
	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34 lg:max-w-2xl lg:mx-auto lg:w-full">
			<PageHeader title={t.export.title} backHref="/impostazioni" className="mb-5" />
			<ExportPanel
				accounts={accountsRes.data ?? []}
				categories={categoriesRes.data ?? []}
				hasTransactions={hasTransactions}
				error={downloadError?.target === "csv" ? errorMessage : null}
			/>
			<ArchiveDownload
				t={t}
				locale={locale}
				receiptCount={receiptCount}
				error={downloadError?.target === "archivio" ? errorMessage : null}
			/>
			{downloadError && <ForgetExportError target={downloadError.target} />}
		</div>
	);
}
