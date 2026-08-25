import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/UI/PageHeader";
import ExportPanel from "@/components/features/ExportPanel";

/**
 * L'export dei movimenti in CSV (Fase 23a, issue #37).
 *
 * ⚠️ Conti e categorie si caricano QUI, come nella pagina di import: servono ai
 * selettori, e un client component che li caricasse da sé li richiederebbe a
 * ogni apertura di una tendina.
 *
 * ⚠️ **Il conto ricordato nel cookie NON si legge, deliberatamente.** Quel
 * cookie segue le due viste che rispondono a *"come sto andando"* — home e
 * analisi — e regge solo perché là la selezione è sempre visibile in un chip.
 * Qui produrrebbe un file filtrato per una scelta fatta in un'altra schermata,
 * cioè uno stato invisibile che finisce dentro un documento salvato. È la stessa
 * ragione per cui `/transazioni` non lo eredita.
 */
export default async function EsportaPage() {
	const { supabase, user, t } = await requireUser();
	if (!user) redirect("/sign");

	const [accountsRes, categoriesRes, countRes] = await Promise.all([
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

	// `pb-34` come ogni altra pagina di impostazioni: la `BottomNav` è `fixed`, e
	// con un padding più corto l'ultimo elemento finisce sotto la barra.
	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<PageHeader title={t.export.title} backHref="/impostazioni" className="mb-5" />
			<ExportPanel
				accounts={accountsRes.data ?? []}
				categories={categoriesRes.data ?? []}
				hasTransactions={hasTransactions}
			/>
		</div>
	);
}
