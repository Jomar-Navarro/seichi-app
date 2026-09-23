import { Suspense } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { redirect } from "next/navigation";
import { getAnalyticsData } from "../action";
import { getAccounts } from "../conti/actions";
import SpendingPieChart from "@/components/features/SpendingPieChart";
import FixedOutflowsLink from "@/components/features/FixedOutflowsLink";
import MonthlyLineChart from "@/components/features/MonthlyLineChart";
import AnalyticsTabs from "@/components/features/AnalyticsTabs";
import AccountSelector from "@/components/features/AccountSelector";
import { getSelectedAccount } from "@/lib/accounts-server";
import { getI18n } from "@/lib/i18n/server";
import { periodoLabel } from "@/lib/analytics";
import { DISPLAY_CURRENCY, currencySymbol, splitAmount } from "@/lib/i18n/format";

export default async function AnalyticsPage({
	searchParams,
}: {
	searchParams: Promise<{ periodo?: string; conto?: string }>;
}) {
	const { periodo = "mese", conto } = await searchParams;

	/*
	 * Stessa memoria della home (`getSelectedAccount`): scegliendo un conto là,
	 * questa pagina lo eredita.
	 *
	 * ⚠️ È il motivo per cui il selettore qui NON è una comodità in più ma la
	 * metà mancante di una funzione. Prima il filtro esisteva solo in home, e per
	 * analizzare un conto bisognava tornare indietro, selezionarlo e ripartire dal
	 * collegamento "Analisi": tre passaggi per cambiare una variabile, che è il
	 * modo più affidabile di far smettere qualcuno di usare un filtro.
	 */
	const { id: accountId } = await getSelectedAccount(conto);

	// I conti servono comunque, ora: il selettore c'è anche senza filtro attivo.
	const [analytics, accountsResult] = await Promise.all([
		getAnalyticsData(periodo, accountId),
		getAccounts(),
	]);
	const { locale, t } = await getI18n();
	if ("error" in analytics) return <p>{t.home.error}</p>;

	/*
	 * ⚠️ I conti DEGRADANO, non bloccano: un errore qui non deve far sparire i
	 * grafici. Il selettore semplicemente non compare e la pagina resta quella di
	 * prima della fase — stesso trattamento già riservato ai conti in home.
	 */
	const accounts = "error" in accountsResult ? [] : accountsResult.data;
	if ("error" in accountsResult) {
		console.error("[analisi] getAccounts:", accountsResult.error);
	}

	/*
	 * ⚠️ Un conto che non è (più) tuo NON deve produrre una pagina che mente.
	 *
	 * In 20a qui non serviva: l'id arrivava solo dal link della home, che il
	 * controllo lo faceva già. Dalla memoria in cookie può arrivare anche da solo,
	 * e senza guardia i grafici resterebbero filtrati su un id fantasma — cioè
	 * vuoti — mentre il chip, non trovandolo fra i conti, scriverebbe "Tutti i
	 * conti". Stesso difetto della home, stessa cura, stesso motivo per cui il
	 * ritorno porta `?conto=` vuoto invece di niente: un parametro presente batte
	 * il cookie, quindi la destinazione non può rimbalzare indietro.
	 */
	if (accountId && accounts.length > 0 && !accounts.some((a) => a.id === accountId)) {
		redirect(`/analisi?periodo=${periodo}&conto=`);
	}

	/*
	 * ⚠️ Il nome del conto sotto il periodo NON c'è più, e non perché la regola
	 * "se la pagina è filtrata deve dirlo" sia decaduta: a dirlo è ora il chip del
	 * selettore, che porta lo stesso nome ed è pure il comando per cambiarlo.
	 * Tenerli entrambi sarebbe la stessa parola due volte a tre centimetri di
	 * distanza. Se un domani il selettore sparisse da qui, questa riga va rimessa.
	 */
	const isPositive = analytics.saldoMese >= 0;
	/*
	 * Il Flusso spezzato in intero e decimali, come le cifre grandi della home:
	 * da `lg:` i decimali sono più piccoli e smorzati (mockup desktop, issue
	 * #108). Sotto `lg:` lo span eredita tutto dal paragrafo, quindi il telefono
	 * legge la stessa stringa di prima — "+ € 1.540,70" — carattere per carattere:
	 * il valore è in modulo, e il segno resta quello tipografico scritto qui.
	 */
	const flow = splitAmount(Math.abs(analytics.saldoMese), locale);

	return (
		<div className="px-5 pt-7 pb-36 flex flex-col lg:px-10 lg:pt-9 lg:pb-12 lg:max-w-6xl lg:mx-auto lg:w-full">
			{/*
				Header.

				⚠️ Da `lg:` titolo, selettore, periodo e report stanno su UNA riga
				(mockup desktop, issue #108) e sul telefono restano due righe come
				prima. Le due righe diventano `lg:contents`, così i loro figli entrano
				tutti nella stessa riga flex, e `order` rimette il periodo DOPO il
				selettore. L'ordine del TAB non ne soffre: il periodo è testo, i due
				soli comandi — selettore e report — restano nell'ordine in cui si
				vedono.
			*/}
			<div className="lg:flex lg:items-center lg:gap-4.5 lg:mb-6">
				<div className="flex items-center justify-between mb-4 lg:contents">
					<h1 className="text-2xl font-bold lg:text-[30px] lg:font-semibold lg:tracking-[-0.6px]">{t.analytics.title}</h1>
					<p className="text-sm text-muted text-right lg:order-1 lg:ml-auto lg:text-[13px]">{periodoLabel(periodo, locale, t)}</p>
				</div>

				{/*
					Il selettore conti e l'ingresso al report, sulla STESSA riga.

					⚠️ Il collegamento stava su una riga propria, sotto i tab, e aggiungeva
					un'altra fascia di pagina per una sola parola mentre accanto al chip
					restava metà riga vuota. Su uno schermo da telefono lo spazio
					verticale è la risorsa scarsa: un comando secondario si mette dove uno
					spazio esiste già, non se ne apre uno nuovo.

					⚠️ `keepParams` conserva il periodo: senza, scegliere un conto mentre
					si guarda l'anno riportava al mese, cioè cambiava DUE variabili per un
					tocco solo — e quella non scelta cambia in silenzio.

					⚠️ `ml-auto` e non `justify-between`: senza conti il selettore non viene
					reso affatto, e `justify-between` con un figlio solo lo appoggerebbe a
					SINISTRA — il comando salterebbe da un lato all'altro a seconda di
					quanti conti hai. Da `lg:` a spingere a destra è il periodo, e il
					report lo segue: diventa una pastiglia, come nel mockup.
				*/}
				<div className="flex items-center gap-3 mb-4 lg:contents">
					{accounts.length > 0 && (
						<div className="lg:ml-2.5">
							<AccountSelector
								accounts={accounts}
								selectedId={accountId}
								basePath="/analisi"
								keepParams={{ periodo }}
							/>
						</div>
					)}
					<Link
						href={`/analisi/report?periodo=${periodo}${accountId ? `&conto=${accountId}` : ""}`}
						className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-secondary lg:order-2 lg:ml-0 lg:gap-2 lg:py-2.5 lg:px-4 lg:rounded-2xl lg:bg-surface lg:ring-border lg:text-[13px]"
					>
						<Printer size={13} className="text-muted lg:size-4" />
						{t.analytics.report.open}
					</Link>
				</div>
			</div>

			{/* Tab selector — useSearchParams richiede Suspense */}
			<Suspense fallback={<div className="h-10 rounded-2xl segment-tab" />}>
				<AnalyticsTabs />
			</Suspense>

			{/*
				Il corpo.

				Sul telefono è la colonna di sempre: KPI, grafico, donut, uscite fisse.
				Da `lg:` (mockup desktop, issue #108) il KPI entra nella card del
				grafico e il donut ne ha una sua; da `xl:` le due metà si affiancano,
				`1.55fr 1fr`. Non prima: a `lg:` la colonna utile è ~690px, e la card
				del grafico in 400 non terrebbe il KPI e la legenda sulla stessa riga.

				⚠️ I contenitori aggiunti non spostano niente sul telefono: le distanze
				sono i margini di prima (`mt-5` del KPI e del titolo del donut, `mt-4`
				delle uscite fisse), che ora si fondono attraverso contenitori senza
				bordi né padding e arrivano uguali.
			*/}
			<div className="lg:mt-6 xl:grid xl:grid-cols-[1.55fr_1fr] xl:gap-5 xl:items-start">
				{/*
					KPI + grafico: da `lg:` UNA card, griglia a due colonne — KPI a
					sinistra, legenda a destra, grafico sotto a tutta larghezza. Il guscio
					del grafico sparisce (`inCard` → `lg:contents`) e questa card ne
					riprende vetro e anello, così non è una card dentro una card.

					⚠️ Vetro SENZA `backdrop-filter`: qui dietro c'è solo il gradiente di
					fondo, che sfocato resta identico, e un filtro su un elemento
					arrotondato è il caso di Firefox della issue #81. Anello come
					`box-shadow`, mai un bordo — gli stessi valori del guscio che sostituisce.
				*/}
				<div className="lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-6 lg:gap-y-5 lg:rounded-[28px] lg:pt-6.5 lg:px-7 lg:pb-5.5 lg:bg-surface lg:shadow-[inset_0_1px_0_var(--shadow-inset),inset_0_0_0_1px_var(--border)]">
					{/* KPI Flusso */}
					<div className="mt-5 mb-4 lg:m-0 lg:col-start-1 lg:row-start-1 lg:min-w-0">
						<p className="text-[13px] text-muted mb-1.5 lg:text-[12.5px] lg:mb-2.5">{t.analytics.netFlow}</p>
						<div className="flex items-center gap-2.5 lg:flex-wrap">
							<p className="text-[34px] font-semibold tracking-[-0.5px] text-foreground lg:text-[40px] lg:tracking-[-1px] lg:leading-none">
								{isPositive ? "+" : "−"} {currencySymbol(DISPLAY_CURRENCY, locale)} {flow.integer}
								<span className="lg:text-2xl lg:font-medium lg:tracking-[-0.4px] lg:text-muted">{flow.decimal}</span>
							</p>
							{analytics.variazionePct !== null ? (
								/*
								 * Da `lg:` la variazione diventa una pastiglia tinta del proprio
								 * segno. La tinta è un riempimento (accento al 12%), il testo resta
								 * l'inchiostro — la regola accento/inchiostro della Fase 18.
								 */
								<span
									className={`inline-flex items-center gap-1 text-[12px] font-medium lg:px-2.5 lg:py-1 lg:rounded-full ${
										analytics.variazionePct >= 0
											? "text-midori-ink lg:bg-[color-mix(in_srgb,var(--color-midori)_12%,transparent)]"
											: "text-aka-ink lg:bg-[color-mix(in_srgb,var(--color-aka)_12%,transparent)]"
									}`}
								>
									<svg
										width="10"
										height="10"
										viewBox="0 0 10 10"
										fill="none"
										className={analytics.variazionePct >= 0 ? "rotate-0" : "rotate-180"}
									>
										<path
											d="M5 8.5V1.5M5 1.5L2 4.5M5 1.5L8 4.5"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
									{Math.abs(analytics.variazionePct)}%
								</span>
							) : periodo === "tutto" ? null : (
								/*
								 * ⚠️ Su «tutto» questa riga NON si mostra: `variazionePct` è null per
								 * costruzione — prima di tutta la storia non c'è niente con cui
								 * confrontarsi — e la frase di ripiego dice "— primo mese", che su un
								 * arco di quattro anni è semplicemente falsa.
								 */
								<span className="text-[12px] font-medium text-muted">{t.analytics.firstMonth}</span>
							)}
						</div>
					</div>

					{/* Area chart — da `lg:` legenda e grafico sono celle della card qui sopra. */}
					<MonthlyLineChart trend={analytics.trend} inCard />
				</div>

				{/*
					La colonna destra: donut e uscite fisse, 20px fra l'una e l'altra da
					`lg:`. Il `div` attorno al donut non è decorativo: il componente rende
					titolo e card come due fratelli, e il `gap` della colonna finirebbe
					anche FRA titolo e card.
				*/}
				<div className="lg:mt-5 lg:flex lg:flex-col lg:gap-5 xl:mt-0">
					{/* Donut spese — senza guscio proprio; da `lg:` la card la aggiunge `inCard`. */}
					<div>
						<SpendingPieChart spese={analytics.spese} periodo={periodo} inCard />
					</div>

					{/*
						Scorciatoia verso le ricorrenti (issue #86): il donut sopra esclude
						gli abbonamenti di proposito, quindi subito sotto è il posto dove
						l'assenza si spiega da sola — "le tue spese variabili sono queste,
						le tue uscite fisse sono di là".
					*/}
					<FixedOutflowsLink />
				</div>
			</div>
		</div>
	);
}
