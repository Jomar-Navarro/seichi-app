import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAnalyticsData } from "../action";
import { getAccounts } from "../conti/actions";
import SpendingPieChart from "@/components/features/SpendingPieChart";
import MonthlyLineChart from "@/components/features/MonthlyLineChart";
import AnalyticsTabs from "@/components/features/AnalyticsTabs";
import AccountSelector from "@/components/features/AccountSelector";
import { getSelectedAccount } from "@/lib/accounts-server";
import { getI18n } from "@/lib/i18n/server";
import { DISPLAY_CURRENCY, capitalize, formatDate, formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/it";

/**
 * L'intestazione del periodo: "Ultima settimana", "2026", "Agosto 2026".
 *
 * ⚠️ `MESI_LUNGHI` non esiste più: era un array di dodici nomi di mese in
 * italiano, e `Intl` li conosce per ogni lingua. La maiuscola iniziale la mette
 * `capitalize`, perché `Intl` restituisce "agosto" minuscolo mentre qui il
 * design vuole "Agosto". L'anno da solo non si traduce.
 */
function periodoLabel(periodo: string, locale: Locale, t: Dictionary): string {
	const now = new Date();
	if (periodo === "settimana") return t.analytics.lastWeek;
	if (periodo === "anno") return String(now.getFullYear());
	return capitalize(formatDate(now, locale, { month: "long", year: "numeric" }));
}

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

	return (
		<div className="px-5 pt-7 pb-36 flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-2xl font-bold">{t.analytics.title}</h1>
				<p className="text-sm text-muted text-right">{periodoLabel(periodo, locale, t)}</p>
			</div>

			{/*
				Il selettore conti, lo stesso della home.
				⚠️ `keepParams` conserva il periodo: senza, scegliere un conto mentre
				si guarda l'anno riportava al mese, cioè cambiava DUE variabili per un
				tocco solo — e quella non scelta cambia in silenzio.
			*/}
			{accounts.length > 0 && (
				<div className="mb-4">
					<AccountSelector
						accounts={accounts}
						selectedId={accountId}
						basePath="/analisi"
						keepParams={{ periodo }}
					/>
				</div>
			)}

			{/* Tab selector — useSearchParams richiede Suspense */}
			<Suspense fallback={<div className="h-10 rounded-2xl segment-tab" />}>
				<AnalyticsTabs />
			</Suspense>

			{/* KPI Flusso netto */}
			<div className="mt-5 mb-4">
				<p className="text-[13px] text-muted mb-1.5">{t.analytics.netFlow}</p>
				<div className="flex items-center gap-2.5">
					<p className="text-[34px] font-semibold tracking-[-0.5px] text-foreground">
						{isPositive ? "+" : "−"} {formatMoney(Math.abs(analytics.saldoMese), { locale, currency: DISPLAY_CURRENCY, decimals: 2 })}
					</p>
					{analytics.variazionePct !== null ? (
						<span
							className={`inline-flex items-center gap-1 text-[12px] font-medium ${
								analytics.variazionePct >= 0 ? "text-midori-ink" : "text-aka-ink"
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
					) : (
						<span className="text-[12px] font-medium text-muted">{t.analytics.firstMonth}</span>
					)}
				</div>
			</div>

			{/* Area chart */}
			<MonthlyLineChart trend={analytics.trend} />

			{/* Donut spese (no card wrapper) */}
			<SpendingPieChart spese={analytics.spese} periodo={periodo} />
		</div>
	);
}
