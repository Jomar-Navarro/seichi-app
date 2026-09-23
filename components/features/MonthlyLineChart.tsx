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
	/**
	 * Il grafico dentro la card di `/analisi` da `lg:` (issue #108).
	 *
	 * Il mockup desktop mette il KPI "Flusso" DENTRO la card del grafico, con la
	 * legenda a destra — mentre sul telefono il KPI sta sopra, fuori. Per non
	 * rendere il KPI due volte, da `lg:` il guscio di questo componente diventa
	 * `display: contents`: sparisce (vetro, anello, padding) e legenda e grafico
	 * diventano celle della griglia della PAGINA, che porta la card con dentro
	 * anche il KPI.
	 *
	 * ⚠️ Il report stampabile NON lo passa, e deve restare così: il documento
	 * (Fase 23b) non ha KPI in testa al grafico e non deve cambiare di un pixel.
	 */
	inCard?: boolean;
}

export default function MonthlyLineChart({ trend, animated = true, inCard = false }: MonthlyLineChartProps) {
	const { t } = useI18n();
	const id = useId();
	const gradE = `gradientEntrate-${id}`;
	const gradU = `gradientUscite-${id}`;
	// Classi complete e statiche, scelte da `inCard`: Tailwind non genera classi
	// composte a runtime, quindi ogni variante deve comparire intera nel sorgente.
	const swatch = inCard ? "inline-block w-2.5 h-0.75 rounded-full lg:w-3.5 lg:h-[2.5px]" : "inline-block w-2.5 h-0.75 rounded-full";

	return (
		/*
			issue #81 — anello (`shadow-[...]`) invece di bordo. NIENTE
			`overflow-hidden`: il tooltip di Recharts si posiziona dentro questo
			stesso contenitore e può sporgere vicino ai bordi; ritagliarlo lo
			taglierebbe. Il ritaglio di `backdrop-filter` sull'angolo resta quindi
			un residuo aperto, come per la barra di navigazione.
		*/
		<div
			className={`rounded-[26px] pt-4.5 px-4 pb-3 bg-surface backdrop-blur-[18px] shadow-[inset_0_1px_0_var(--shadow-inset),inset_0_0_0_1px_var(--border)]${
				inCard ? " lg:contents" : ""
			}`}
		>
			{/* Con `inCard`, da `lg:` la legenda sale in alto a destra, accanto al KPI. */}
			<div
				className={`flex items-center gap-4 mb-4${
					inCard ? " lg:col-start-2 lg:row-start-1 lg:self-start lg:mt-0.5 lg:mb-0" : ""
				}`}
			>
				<div className="flex items-center gap-1.75">
					<span className={`${swatch} bg-midori`} />
					<span className="text-xs text-muted">{t.analytics.legendIncome}</span>
				</div>
				<div className="flex items-center gap-1.75">
					<span className={`${swatch} bg-aka`} />
					<span className="text-xs text-muted">{t.analytics.legendExpenses}</span>
				</div>
			</div>
			{/*
				L'altezza varia per breakpoint (Fase 28b: più spazio da `lg:` in
				su) — `ResponsiveContainer` vuole un numero fisso in `height`, non
				una classe, quindi la misura viene dal contenitore (`h-40 lg:h-56`)
				e Recharts la legge con `height="100%"`. Dentro la card di
				`/analisi` (`inCard`) il grafico prende tutta la seconda riga e da
				`xl:` sale a 270px, la misura del mockup desktop.
			*/}
			<div className={inCard ? "h-40 lg:h-56 xl:h-67.5 lg:col-span-2 lg:row-start-2" : "h-40 lg:h-56"}>
				<ResponsiveContainer width="100%" height="100%">
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
							// issue #81 — anello (box-shadow), non bordo: il colore è traslucido.
							boxShadow: "var(--border) 0px 0px 0px 1px inset",
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
		</div>
	);
}
