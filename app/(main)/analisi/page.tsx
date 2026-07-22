import { Suspense } from "react";
import { getAnalyticsData } from "../action";
import SpendingPieChart from "@/components/features/SpendingPieChart";
import MonthlyLineChart from "@/components/features/MonthlyLineChart";
import AnalyticsTabs from "@/components/features/AnalyticsTabs";
import { numberFormatter } from "@/lib/transaction-utils";

const MESI_LUNGHI = [
	"Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
	"Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function periodoLabel(periodo: string): string {
	const now = new Date();
	if (periodo === "settimana") return "Ultima settimana";
	if (periodo === "anno") return String(now.getFullYear());
	return `${MESI_LUNGHI[now.getMonth()]} ${now.getFullYear()}`;
}

export default async function AnalyticsPage({
	searchParams,
}: {
	searchParams: Promise<{ periodo?: string }>;
}) {
	const { periodo = "mese" } = await searchParams;
	const analytics = await getAnalyticsData(periodo);
	if ("error" in analytics) return <p>Errore</p>;

	const isPositive = analytics.saldoMese >= 0;

	return (
		<div className="px-5 pt-7 pb-36 flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-2xl font-bold">Analisi</h1>
				<p className="text-sm text-kiri">{periodoLabel(periodo)}</p>
			</div>

			{/* Tab selector — useSearchParams richiede Suspense */}
			<Suspense fallback={<div className="h-10 rounded-2xl bg-[rgba(230,233,239,0.04)] border border-[rgba(230,233,239,0.09)]" />}>
				<AnalyticsTabs />
			</Suspense>

			{/* KPI Flusso netto */}
			<div className="mt-5 mb-4">
				<p className="text-[13px] text-kiri mb-1.5">Flusso netto</p>
				<div className="flex items-center gap-2.5">
					<p className="text-[34px] font-semibold tracking-[-0.5px] text-tsuki">
						{isPositive ? "+" : "−"} € {numberFormatter.format(Math.abs(analytics.saldoMese))}
					</p>
					{analytics.variazionePct !== null ? (
						<span
							className={`inline-flex items-center gap-1 text-[12px] font-medium ${
								analytics.variazionePct >= 0 ? "text-midori" : "text-aka"
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
						<span className="text-[12px] font-medium text-kiri">— primo mese</span>
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
