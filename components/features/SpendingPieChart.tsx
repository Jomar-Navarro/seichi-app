"use client";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { numberFormatter } from "@/lib/transaction-utils";

interface SpendingPieChartProps {
	spese: { name: string; color: string; total: number }[];
	periodo?: string;
}

const CHART_COLORS = ["aka", "ao", "kin", "murasaki", "midori", "kiri"];

export default function SpendingPieChart({ spese, periodo = "mese" }: SpendingPieChartProps) {
	const totale = spese.reduce((acc, s) => acc + s.total, 0);
	const data = spese.map((s, i) => ({
		...s,
		chartColor: CHART_COLORS[i % CHART_COLORS.length],
		fill: `var(--color-${CHART_COLORS[i % CHART_COLORS.length]})`,
	}));

	if (spese.length === 0) {
		const periodoLabel = periodo === "settimana" ? "questa settimana" : periodo === "anno" ? "quest'anno" : "questo mese";
		return (
			<>
				<p className="text-[14.5px] font-semibold mt-5 mb-3.5 text-tsuki">
					Spese per categoria
				</p>
				<p className="text-[13px] text-kiri text-center py-6">
					Nessuna spesa {periodoLabel}
				</p>
			</>
		);
	}

	return (
		<>
			<p className="text-[14.5px] font-semibold mt-5 mb-3.5 text-tsuki">
				Spese per categoria
			</p>
			<div className="flex items-center gap-5">
				{/* Donut */}
				<div className="relative w-40 h-40 shrink-0">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={data}
								dataKey="total"
								nameKey="name"
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
					{/* Centro */}
					<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5">
						<p className="text-[9.5px] text-kiri uppercase tracking-[0.08em] leading-none">
							Uscite
						</p>
						<p className="text-[15px] font-semibold text-tsuki leading-none">
							€ {numberFormatter.format(totale)}
						</p>
					</div>
				</div>

				{/* Legenda */}
				<div className="flex-1 flex flex-col gap-2.5">
					{data.map((s) => {
						const pct = totale > 0 ? Math.round((s.total / totale) * 100) : 0;
						return (
							<div key={s.name} className="flex items-center justify-between">
								<div className="flex items-center gap-2.25">
									<span
										className="inline-block w-2 h-2 rounded-full shrink-0"
										style={{ background: s.fill }}
									/>
									<span className="text-[12.5px] text-tsuki">{s.name}</span>
								</div>
								<span className="text-[12.5px] text-kiri">{pct}%</span>
							</div>
						);
					})}
				</div>
			</div>
		</>
	);
}
