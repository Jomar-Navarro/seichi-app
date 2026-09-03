"use client";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, fill, formatMoney } from "@/lib/i18n/format";

interface SpendingPieChartProps {
	spese: { name: string; color: string; total: number }[];
	periodo?: string;
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

/**
 * Scala monocromatica dell'accento uscite, come nel design.
 *
 * Prima le fette erano rosso/blu/oro/viola, cioè i colori che altrove
 * significano uscite, investimenti, risparmi e ricorrenti: qui sono TUTTE
 * uscite, e usare quei colori faceva leggere il grafico come se mostrasse
 * categorie di natura diversa. Una sola tinta declinata dice la cosa giusta —
 * un'unica quantità divisa in parti.
 *
 * Le sfumature nascono da `--color-aka`, che cambia col tema, quindi la scala
 * resta corretta in chiaro e in scuro senza una seconda tabella di valori.
 */
const CHART_RAMP = [
	"color-mix(in srgb, var(--color-aka) 80%, black)",
	"var(--color-aka)",
	// La pausa neutra della scala. NON `--color-kiri`: quello non è ridefinito
	// in `.dark`, quindi sarebbe stata l'unica fetta a non seguire il tema —
	// un cuneo grigio identico in chiaro e in scuro dentro un grafico rosso.
	// `--text-muted` invece cambia, e mescolato con aka resta nella famiglia.
	"color-mix(in srgb, var(--color-aka) 30%, var(--text-muted))",
	"color-mix(in srgb, var(--color-aka) 78%, white)",
	"color-mix(in srgb, var(--color-aka) 55%, white)",
	"color-mix(in srgb, var(--color-aka) 60%, black)",
];

export default function SpendingPieChart({
	spese,
	periodo = "mese",
	animated = true,
}: SpendingPieChartProps) {
	const { locale, t } = useI18n();
	/** Importi con i decimali, nel formato del locale. */
	const money = (v: number) =>
		formatMoney(v, { locale, currency: DISPLAY_CURRENCY, decimals: 2 });

	const totale = spese.reduce((acc, s) => acc + s.total, 0);
	const data = spese.map((s, i) => ({
		...s,
		fill: CHART_RAMP[i % CHART_RAMP.length],
	}));

	if (spese.length === 0) {
		const periodoLabel = t.analytics.windows[periodo as keyof typeof t.analytics.windows] ?? t.analytics.windows.mese;
		return (
			<>
				<p className="text-[14.5px] font-semibold mt-5 mb-3.5 text-foreground">
					{t.analytics.spendingByCategory}
				</p>
				<p className="text-[13px] text-muted text-center py-6">
					{fill(t.analytics.noSpending, { window: periodoLabel })}
				</p>
			</>
		);
	}

	return (
		<>
			<p className="text-[14.5px] font-semibold mt-5 mb-3.5 text-foreground">
				{t.analytics.spendingByCategory}
			</p>
			<div className="flex items-center gap-5">
				{/* Donut */}
				<div className="relative w-32 h-32 shrink-0">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={data}
								dataKey="total"
								nameKey="name"
								isAnimationActive={animated}
								innerRadius="62%"
								outerRadius="90%"
								strokeWidth={2}
								// Separatore = colore del fondo. Con --color-yoru disegnava un
								// anello di inchiostro attorno al donut in tema chiaro, e serve
								// davvero solo ora che le fette sono sfumature della stessa tinta.
								stroke="var(--background-secondary)"
							/>
							<Tooltip
								contentStyle={{
									background: "var(--modal-bg)",
									// issue #81 — anello (box-shadow), non bordo: il colore è traslucido.
									boxShadow: "var(--border) 0px 0px 0px 1px inset",
									borderRadius: 12,
									fontSize: 12,
									color: "var(--text-primary)",
								}}
								formatter={(value) => [
									money(Number(value)),
									"",
								]}
							/>
						</PieChart>
					</ResponsiveContainer>
					{/* Centro */}
					<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5">
						<p className="text-[9.5px] text-muted uppercase tracking-[0.08em] leading-none">
							{t.analytics.spendingLabel}
						</p>
						<p className="text-[15px] font-semibold text-foreground leading-none">
							{money(totale)}
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
									<span className="text-[12.5px] text-foreground">{s.name}</span>
								</div>
								<span className="text-[12.5px] text-muted">{pct}%</span>
							</div>
						);
					})}
				</div>
			</div>
		</>
	);
}
