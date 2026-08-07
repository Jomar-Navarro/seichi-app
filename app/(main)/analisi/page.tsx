import { Suspense } from "react";
import { getAnalyticsData } from "../action";
import SpendingPieChart from "@/components/features/SpendingPieChart";
import MonthlyLineChart from "@/components/features/MonthlyLineChart";
import AnalyticsTabs from "@/components/features/AnalyticsTabs";
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
	searchParams: Promise<{ periodo?: string }>;
}) {
	const { periodo = "mese" } = await searchParams;
	const analytics = await getAnalyticsData(periodo);
	const { locale, t } = await getI18n();
	if ("error" in analytics) return <p>{t.home.error}</p>;

	const isPositive = analytics.saldoMese >= 0;

	return (
		<div className="px-5 pt-7 pb-36 flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-2xl font-bold">{t.analytics.title}</h1>
				<p className="text-sm text-muted">{periodoLabel(periodo, locale, t)}</p>
			</div>

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
