import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAnalyticsData } from "@/app/(main)/action";
import { getAccountOptions } from "@/app/(main)/conti/actions";
import { getSelectedAccount } from "@/lib/accounts-server";
import { getI18n } from "@/lib/i18n/server";
import { isAnalyticsPeriod, periodoLabel } from "@/lib/analytics";
import { DISPLAY_CURRENCY, fill, formatDate, formatMoney } from "@/lib/i18n/format";
import MonthlyLineChart from "@/components/features/MonthlyLineChart";
import SpendingPieChart from "@/components/features/SpendingPieChart";
import PrintButton from "@/components/features/PrintButton";

/**
 * Il report stampabile (Fase 23b, issue #60).
 *
 * ## Il PDF non lo genera Seichi — lo genera il browser
 *
 * `window.print()` e nient'altro: zero dipendenze. I grafici sono già SVG nel
 * DOM, quindi restano **vettoriali** sulla carta, mentre una libreria di cattura
 * li rasterizzerebbe; e su iOS la finestra di stampa offre "Salva su File", che
 * è il PDF senza che l'app scriva un byte. Rinuncia dichiarata: niente report
 * generato dal server, quindi un domani spedirne uno per email sarebbe un lavoro
 * nuovo e non un'estensione di questo.
 *
 * ## ⚠️ Il report non introduce un solo numero nuovo
 *
 * Ogni cifra viene da `getAnalyticsData()`, la stessa che alimenta `/analisi` —
 * `entrate` e `uscite` comprese, che quella funzione calcolava già e ora
 * restituisce. Ricalcolarle qui avrebbe creato la quarta definizione di
 * "uscita", dopo che la review della 20a ha dovuto unificarne tre che
 * divergevano già fra loro.
 *
 * ⚠️ E qui conta più che altrove perché **un documento si archivia**: una parola
 * o una cifra sbagliata su una schermata si corregge col deploy successivo, la
 * stessa su un foglio salvato resta per sempre e nessuna correzione la raggiunge.
 */
export default async function ReportPage({
	searchParams,
}: {
	searchParams: Promise<{ periodo?: string; conto?: string }>;
}) {
	const { periodo: richiesto, conto } = await searchParams;

	/*
	 * ⚠️ Il periodo si VALIDA, non si passa così com'è.
	 *
	 * `getAnalyticsData` su un valore che non riconosce ripiega sul mese senza
	 * dirlo: su `/analisi` lo si vedrebbe dal titolo accanto, ma un documento
	 * stampato viaggia da solo e dichiarerebbe un arco di tempo mostrandone un
	 * altro. Stessa regola dell'export (23a), dove un filtro non riconosciuto
	 * viene rifiutato invece che ignorato; qui si ripiega sul default esplicito,
	 * perché il titolo del foglio dirà comunque quale periodo è.
	 */
	const periodo = isAnalyticsPeriod(richiesto) ? richiesto : "mese";

	/*
	 * ⚠️ Il conto ricordato SI eredita, al contrario della pagina di export.
	 *
	 * Là un filtro invisibile sarebbe finito dentro un file senza che nulla lo
	 * dicesse; qui il documento **porta scritto** il nome del conto nella propria
	 * intestazione, quindi la selezione è dichiarata sul foglio stesso. È anche
	 * ciò che rende il report la vista che stavi guardando, invece di una seconda
	 * schermata da riconfigurare.
	 */
	const { id: accountId } = await getSelectedAccount(conto);

	const [analytics, accountsResult] = await Promise.all([
		getAnalyticsData(periodo, accountId),
		/*
		 * ⚠️ `getAccountOptions()` e non `getAccounts()`: qui serve solo un NOME.
		 * La seconda passa da `account_balances`, che aggrega ogni transazione di
		 * ogni conto — una scansione dell'archivio per scrivere due parole
		 * nell'intestazione. Il report non ha un selettore, quindi dei saldi non sa
		 * che farsene.
		 */
		getAccountOptions(),
	]);
	const { locale, t } = await getI18n();

	if ("error" in analytics) return <p className="p-5">{t.home.error}</p>;

	/*
	 * ⚠️⚠️ Qui NON si degrada come su `/analisi`, ed è la differenza fra una
	 * schermata e un documento.
	 *
	 * Là un errore nella lettura dei conti fa sparire il chip e la pagina resta
	 * quella di prima. Qui l'intestazione scriverebbe **"Tutti i conti"** —
	 * perché il nome non si risolve — sopra numeri che restano filtrati sul
	 * conto ricordato: un'affermazione falsa, stampata e archiviata.
	 *
	 * È la stessa regola della 23a (*meglio nessun file di un file che afferma
	 * il falso*), e vale solo quando un conto è davvero selezionato: senza
	 * filtro "Tutti i conti" è vero comunque, e la pagina può proseguire.
	 */
	if ("error" in accountsResult) {
		console.error("[report] getAccountOptions:", accountsResult.error);
		if (accountId) return <p className="p-5">{t.home.error}</p>;
	}
	const accounts = "error" in accountsResult ? [] : accountsResult.data;

	/*
	 * ⚠️ Stessa guardia di `/analisi`: un conto che non è (più) tuo produrrebbe un
	 * documento con tutti i numeri a zero e l'intestazione che nomina un conto
	 * inesistente. `?conto=` vuoto è un'istruzione che batte il cookie, quindi la
	 * destinazione non può rimbalzare indietro.
	 */
	if (accountId && accounts.length > 0 && !accounts.some((a) => a.id === accountId)) {
		redirect(`/analisi/report?periodo=${periodo}&conto=`);
	}

	const nomeConto = accounts.find((a) => a.id === accountId)?.name ?? t.accounts.all;
	const money = (v: number) =>
		formatMoney(v, { locale, currency: DISPLAY_CURRENCY, decimals: 2 });
	const positivo = analytics.saldoMese >= 0;

	/*
	 * ⚠️ `pb-12` e non `pb-34` come le altre pagine: qui la `BottomNav` non
	 * c'è affatto (vedi `DOCUMENT_ROUTES`), quindi lo spazio che le altre le
	 * riservano sarebbe vuoto e basta. `print:pb-0` toglie anche questo: in
	 * stampa un margine in fondo può bastare a far uscire un secondo foglio
	 * bianco, e `print:p-0` sull'articolo non lo copre — è un altro elemento.
	 */
	return (
		<div className="px-5 pt-7 pb-12 print:pb-0">
			{/* Il guscio dell'app: comandi, non documento. */}
			<div className="no-print flex items-center justify-between mb-5">
				{/* ⚠️ Porta indietro anche il conto: senza, `/analisi` rilegge il cookie
				    e può mostrare un conto diverso da quello appena stampato. */}
				<Link
					href={`/analisi?periodo=${periodo}&conto=${accountId ?? ""}`}
					className="w-10 h-10 rounded-2xl bg-card ring-border flex items-center justify-center active:opacity-80"
					aria-label={t.analytics.title}
				>
					<ArrowLeft size={17} className="text-secondary" />
				</Link>
				<PrintButton />
			</div>

			{/*
				⚠️ `paper`: il documento è chiaro anche quando l'app è in tema scuro.
				Non è un blocco `@media print` che ridichiara i token — sarebbe una
				seconda lista di 43 valori — ma la stessa lista di `:root` condivisa per
				selettore. Vedi la nota in testa a `globals.css`.

				Vale già a schermo, di proposito: così ciò che vedi è ciò che stampi.
			*/}
			{/*
				issue #81 — l'anello (`ring-border`, box-shadow) sostituisce il bordo
				a SCHERMO. In STAMPA `.paper * { box-shadow: none }` lo azzera già —
				ma qui va bene così: `print:border-0` voleva zero bordo anche prima,
				perché sulla carta è il margine di pagina a delimitare il foglio.
			*/}
			<article className="paper rounded-[26px] ring-border p-6 print:p-0 print:shadow-none print:rounded-none">
				{/* Intestazione */}
				<header className="print-block">
					<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled">
						{t.analytics.report.title}
					</p>
					<h1 className="text-[26px] font-bold tracking-[-0.4px] mt-1 text-foreground">
						{periodoLabel(periodo, locale, t)}
					</h1>
					{/*
						⚠️ Il conto c'è SEMPRE, anche quando è "Tutti i conti".
						Su uno schermo il chip accanto dice cosa stai guardando; un foglio
						viaggia da solo, e l'assenza della riga si legge come "tutti" tanto
						quanto come "non lo so". Scriverlo toglie la domanda.
					*/}
					<p className="text-[13px] text-secondary mt-1.5">{nomeConto}</p>
					<p className="text-[12px] text-muted mt-0.5">
						{fill(t.analytics.report.generatedOn, {
							date: formatDate(new Date(), locale, {
								day: "numeric",
								month: "long",
								year: "numeric",
							}),
						})}
					</p>
				</header>

				{/* Flusso */}
				<section className="print-block mt-7">
					<p className="text-[13px] text-muted">{t.analytics.netFlow}</p>
					{/*
						⚠️ Il segno è tipografico e il colore NON c'è: l'importo resta
						`text-foreground`, cioè inchiostro su carta.

						A schermo `/analisi` lo lascia neutro per la stessa ragione, ma qui
						si aggiunge quella della stampa: un verde tenue su bianco a 600 dpi
						è quasi illeggibile, e su una stampante in bianco e nero il colore
						sparisce del tutto portandosi via l'unica differenza fra un mese
						positivo e uno negativo. Il segno la porta sempre.
					*/}
					<p className="text-[34px] font-semibold tracking-[-0.5px] text-foreground mt-1">
						{positivo ? "+" : "−"} {money(Math.abs(analytics.saldoMese))}
					</p>
					<p className="text-[12px] text-muted mt-1.5">{t.analytics.report.flowExplain}</p>
				</section>

				{/* Entrate e uscite del periodo */}
				<section className="print-block grid grid-cols-2 gap-3 mt-6">
					{/*
						issue #81 — `ring-border` è un box-shadow, e `.paper * { box-shadow:
						none }` lo azzera in stampa: qui la separazione fra le due colonne
						deve restare visibile sulla carta, quindi `print:border` la
						ripristina come bordo VERO (in stampa il bug di Firefox non esiste,
						è un rendering completamente diverso).
					*/}
					<div className="rounded-2xl ring-border p-4 print:border print:border-subtle">
						<p className="text-[12px] text-muted">{t.analytics.legendIncome}</p>
						<p className="text-[19px] font-semibold text-midori-ink mt-1">
							{money(analytics.entrate)}
						</p>
					</div>
					<div className="rounded-2xl ring-border p-4 print:border print:border-subtle">
						<p className="text-[12px] text-muted">{t.analytics.legendExpenses}</p>
						<p className="text-[19px] font-semibold text-aka-ink mt-1">
							{money(analytics.uscite)}
						</p>
					</div>
				</section>

				{/* Andamento */}
				<section className="print-block mt-7">
					<p className="text-[14.5px] font-semibold text-foreground mb-3">
						{t.analytics.report.trendTitle}
					</p>
					{/*
						⚠️ `animated={false}`: Recharts anima al mount, e chi apre il report
						per stamparlo preme Stampa subito — catturando il grafico a metà
						disegno, che sulla carta resta così per sempre.
					*/}
					<MonthlyLineChart trend={analytics.trend} animated={false} />
				</section>

				{/* Spese per categoria */}
				<section className="print-block mt-2">
					<SpendingPieChart spese={analytics.spese} periodo={periodo} animated={false} />
				</section>
			</article>
		</div>
	);
}
