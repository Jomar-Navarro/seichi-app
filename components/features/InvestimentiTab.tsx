"use client";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUpIcon } from "@/lib/seichi-icons";
import { ICON_MAP } from "@/lib/icon-map";
import { numberFormatter } from "@/lib/transaction-utils";
import type { InvestmentData } from "@/types";
import { INVESTMENT_TYPE_META as TYPE_META } from "@/lib/investment-types";

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center text-center py-16 px-6">
			<div
				className="w-18 h-18 rounded-3xl flex items-center justify-center mb-5 border border-subtle card-shadow"
				style={{ background: "var(--surface)" }}
			>
				<TrendingUpIcon
					size={30}
					strokeWidth={1.4}
					style={{ color: "var(--color-ao)" }}
				/>
			</div>
			<p className="text-[18px] font-semibold mb-2.5">
				Nessun investimento ancora
			</p>
			<p className="text-sm text-muted leading-relaxed max-w-65">
				Aggiungi una transazione di tipo "Investimento" per iniziare a tracciare
				il tuo portafoglio.
			</p>
		</div>
	);
}

export default function InvestimentiTab({
	data,
}: {
	data: InvestmentData | null;
}) {
	if (!data || data.positions.length === 0) return <EmptyState />;

	const { total, variazionePct, byType, positions } = data;

	const CHART_COLORS = ["ao", "murasaki", "kin", "midori", "aka", "kiri"];
	const donutData = positions.map((pos, i) => ({
		...pos,
		label: pos.name,
		chartColor: CHART_COLORS[i % CHART_COLORS.length],
		fill: `var(--color-${CHART_COLORS[i % CHART_COLORS.length]})`,
	}));

	return (
		<>
			{/* Summary line */}
			<p className="text-[12.5px] text-muted mt-1">
				{positions.length}{" "}
				{positions.length === 1 ? "posizione attiva" : "posizioni attive"} ·{" "}
				{byType.length} {byType.length === 1 ? "tipologia" : "tipologie"}
			</p>

			{/* Portfolio value card */}
			<div className="mt-5 rounded-[26px] pt-4.5 px-5 pb-5 bg-[rgba(230,233,239,0.05)] border border-[rgba(230,233,239,0.08)] backdrop-blur-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
				<p className="text-[11px] text-kiri uppercase tracking-widest">
					Valore portafoglio
				</p>
				<p className="text-[36px] font-semibold tracking-[-0.5px] mt-2 text-tsuki">
					€ {numberFormatter.format(total)}
				</p>
				{variazionePct !== null && (
					<p
						className={`text-[12px] mt-1.5 flex items-center gap-1 ${
							variazionePct >= 0 ? "text-midori" : "text-aka"
						}`}
					>
						<span>{variazionePct >= 0 ? "↑" : "↓"}</span>
						<span>
							{variazionePct >= 0 ? "+" : ""}
							{variazionePct}% rispetto al mese scorso
						</span>
					</p>
				)}
			</div>

			{/* Composizione — visibile solo con almeno 2 posizioni */}
			{positions.length >= 2 && (
				<>
					<p className="text-[14.5px] font-semibold mt-5 mb-3.5 text-tsuki">
						Composizione
					</p>
					<div className="flex items-center gap-5">
						<div className="relative w-40 h-40 shrink-0">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={donutData}
										dataKey="total"
										nameKey="label"
										innerRadius="60%"
										outerRadius="85%"
										strokeWidth={2}
										stroke="var(--color-yoru)"
									/>
									<Tooltip
										contentStyle={{
											background: "var(--color-hane)",
											border: "1px solid rgba(255,255,255,0.10)",
											borderRadius: 12,
											fontSize: 12,
											color: "var(--color-tsuki)",
										}}
										formatter={(value) => [
											`€ ${numberFormatter.format(Number(value))}`,
											"",
										]}
									/>
								</PieChart>
							</ResponsiveContainer>
							<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5">
								<p className="text-[9.5px] text-kiri uppercase tracking-[0.08em] leading-none">
									Totale
								</p>
								<p className="text-[15px] font-semibold text-tsuki leading-none">
									€ {numberFormatter.format(total)}
								</p>
							</div>
						</div>

						<div className="flex-1 flex flex-col gap-2.5">
							{donutData.map((pos) => (
								<div key={pos.category_id} className="flex items-center justify-between">
									<div className="flex items-center gap-2.25">
										<span
											className="inline-block w-2 h-2 rounded-full shrink-0"
											style={{ background: pos.fill }}
										/>
										<span className="text-[12.5px] text-tsuki truncate max-w-20">{pos.label}</span>
									</div>
									<span className="text-[12.5px] text-kiri shrink-0">{pos.pct}%</span>
								</div>
							))}
						</div>
					</div>
				</>
			)}

			{/* Posizioni */}
			<p className="text-[14.5px] font-semibold mt-5 mb-3 text-tsuki">
				Posizioni
			</p>
			<div className="flex flex-col gap-2.5">
				{positions.map((pos) => {
					const Icon = ICON_MAP[pos.icon] ?? TrendingUpIcon;
					const typeKey = pos.investment_type ?? "altro";
					const typeMeta = TYPE_META[typeKey] ?? TYPE_META.altro;

					return (
						<div
							key={pos.category_id}
							className="rounded-[22px] px-4 py-3.5 bg-card border border-subtle card-shadow"
						>
							<div className="flex items-center gap-3">
								<div
									className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
									style={{
										background: `color-mix(in srgb, var(--color-${typeMeta.color}) 14%, transparent)`,
									}}
								>
									<Icon
										size={18}
										strokeWidth={1.5}
										style={{ color: `var(--color-${typeMeta.color})` }}
									/>
								</div>

								<div className="flex-1 min-w-0">
									<p className="text-sm font-semibold truncate">{pos.name}</p>
									<div className="flex items-center gap-2 mt-0.5">
										<span
											className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md"
											style={{
												background: `color-mix(in srgb, var(--color-${typeMeta.color}) 18%, transparent)`,
												color: `var(--color-${typeMeta.color})`,
											}}
										>
											{typeMeta.label}
										</span>
										<span className="text-[11px] text-muted">{pos.pct}%</span>
									</div>
								</div>

								<div className="text-right shrink-0">
									<p className="text-[11px] text-muted">Investito</p>
									<p className="text-sm font-semibold mt-0.5">
										€ {numberFormatter.format(pos.total)}
									</p>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}
