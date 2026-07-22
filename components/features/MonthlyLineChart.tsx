"use client";
import { useId } from "react";
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
} from "recharts";

interface MonthlyLineChartProps {
	trend: { mese: string; entrate: number; uscite: number }[];
}

export default function MonthlyLineChart({ trend }: MonthlyLineChartProps) {
	const id = useId();
	const gradE = `gradientEntrate-${id}`;
	const gradU = `gradientUscite-${id}`;

	return (
		<div className="rounded-[26px] pt-4.5 px-4 pb-3 bg-[rgba(230,233,239,0.05)] border border-[rgba(230,233,239,0.08)] backdrop-blur-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
			<div className="flex items-center gap-4 mb-4">
				<div className="flex items-center gap-1.75">
					<span className="inline-block w-2.5 h-0.75 rounded-full bg-midori" />
					<span className="text-xs text-kiri">Entrate</span>
				</div>
				<div className="flex items-center gap-1.75">
					<span className="inline-block w-2.5 h-0.75 rounded-full bg-aka" />
					<span className="text-xs text-kiri">Uscite</span>
				</div>
			</div>
			<ResponsiveContainer width="100%" height={160}>
				<AreaChart
					data={trend}
					margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
				>
					<defs>
						<linearGradient id={gradE} x1="0" y1="0" x2="0" y2="1">
							<stop
								offset="5%"
								stopColor="var(--color-midori)"
								stopOpacity={0.2}
							/>
							<stop
								offset="95%"
								stopColor="var(--color-midori)"
								stopOpacity={0}
							/>
						</linearGradient>
						<linearGradient id={gradU} x1="0" y1="0" x2="0" y2="1">
							<stop
								offset="5%"
								stopColor="var(--color-aka)"
								stopOpacity={0.2}
							/>
							<stop offset="95%" stopColor="var(--color-aka)" stopOpacity={0} />
						</linearGradient>
					</defs>
					<XAxis
						dataKey="mese"
						tick={{ fill: "var(--color-kiri)", fontSize: 11 }}
						axisLine={false}
						tickLine={false}
						padding={{ left: 12, right: 12 }}
					/>
					<YAxis hide />
					<Tooltip
						contentStyle={{
							background: "var(--color-hane)",
							border: "1px solid rgba(255,255,255,0.10)",
							borderRadius: 12,
							fontSize: 12,
							color: "var(--color-tsuki)",
						}}
						formatter={(value) => [`€ ${Number(value).toFixed(2)}`, ""]}
					/>
					<Area
						type="monotone"
						dataKey="entrate"
						stroke="var(--color-midori)"
						strokeWidth={2}
						fill={`url(#${gradE})`}
						dot={false}
						activeDot={{ r: 4, fill: "var(--color-midori)" }}
					/>
					<Area
						type="monotone"
						dataKey="uscite"
						stroke="var(--color-aka)"
						strokeWidth={2}
						fill={`url(#${gradU})`}
						dot={false}
						activeDot={{ r: 4, fill: "var(--color-aka)" }}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
