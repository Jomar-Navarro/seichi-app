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
import { useI18n } from "./I18nProvider";

interface MonthlyLineChartProps {
	trend: { mese: string; entrate: number; uscite: number }[];
	/**
	 * ⚠️ `animated` esiste per la STAMPA (Fase 23b), e il default resta `true`.
	 *
	 * Recharts anima al mount: chi apre il report e preme subito Stampa cattura
	 * il grafico **a metà disegno**, e sulla carta resta così per sempre. Non è
	 * un caso di laboratorio — è il gesto normale, perché la pagina esiste per
	 * essere stampata. A schermo l'animazione resta, che è dove serve.
	 */
	animated?: boolean;
}

export default function MonthlyLineChart({ trend, animated = true }: MonthlyLineChartProps) {
	const { t } = useI18n();
	const id = useId();
	const gradE = `gradientEntrate-${id}`;
	const gradU = `gradientUscite-${id}`;

	return (
		/*
			issue #81 — anello (`shadow-[...]`) invece di bordo. NIENTE
			`overflow-hidden`: il tooltip di Recharts si posiziona dentro questo
			stesso contenitore e può sporgere vicino ai bordi; ritagliarlo lo
			taglierebbe. Il ritaglio di `backdrop-filter` sull'angolo resta quindi
			un residuo aperto, come per la barra di navigazione.
		*/
		<div className="rounded-[26px] pt-4.5 px-4 pb-3 bg-surface backdrop-blur-[18px] shadow-[inset_0_1px_0_var(--shadow-inset),inset_0_0_0_1px_var(--border)]">
			<div className="flex items-center gap-4 mb-4">
				<div className="flex items-center gap-1.75">
					<span className="inline-block w-2.5 h-0.75 rounded-full bg-midori" />
					<span className="text-xs text-muted">{t.analytics.legendIncome}</span>
				</div>
				<div className="flex items-center gap-1.75">
					<span className="inline-block w-2.5 h-0.75 rounded-full bg-aka" />
					<span className="text-xs text-muted">{t.analytics.legendExpenses}</span>
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
							// --color-hane non è mai esistito: la dichiarazione era
							// invalida e lo sfondo spariva. Vedi l'avvertenza in
							// CLAUDE.md — una variabile CSS inesistente non fa rumore.
							background: "var(--modal-bg)",
							border: "1px solid var(--border)",
							borderRadius: 12,
							fontSize: 12,
							color: "var(--text-primary)",
						}}
						formatter={(value) => [`€ ${Number(value).toFixed(2)}`, ""]}
					/>
					<Area
						type="monotone"
						dataKey="entrate"
						isAnimationActive={animated}
						stroke="var(--color-midori)"
						strokeWidth={2}
						fill={`url(#${gradE})`}
						dot={false}
						activeDot={{ r: 4, fill: "var(--color-midori)" }}
					/>
					<Area
						type="monotone"
						dataKey="uscite"
						isAnimationActive={animated}
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
