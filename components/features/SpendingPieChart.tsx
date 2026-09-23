"use client";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, fill, formatMoney } from "@/lib/i18n/format";
import { useDonutTooltipPosition } from "@/components/UI/useDonutTooltipPosition";

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
	/**
	 * Donut e legenda dentro una card di vetro da `lg:`, su `/analisi` (issue
	 * #108). Il titolo resta FUORI dalla card, come nel mockup desktop — ed è
	 * il motivo per cui la card non può metterla la pagina attorno al
	 * componente: il titolo lo rende lui.
	 *
	 * ⚠️ Il report stampabile NON lo passa: il documento (Fase 23b) resta com'è.
	 */
	inCard?: boolean;
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
	inCard = false,
}: SpendingPieChartProps) {
	const { locale, t } = useI18n();
	/** Importi con i decimali, nel formato del locale. */
	const money = (v: number) =>
		formatMoney(v, { locale, currency: DISPLAY_CURRENCY, decimals: 2 });
	const { style: tooltipStyle, pieHandlers } = useDonutTooltipPosition();

	/*
	 * Le classi di `inCard`, scritte intere: Tailwind non genera classi composte
	 * a runtime. La card è vetro SENZA `backdrop-filter`: su `/analisi` dietro
	 * c'è solo il gradiente di fondo, che sfocato resta identico, e un filtro su
	 * un elemento arrotondato è proprio il caso di Firefox della issue #81 —
	 * l'anello è un `box-shadow` (`ring-border`), mai un bordo.
	 */
	const titleClass = inCard
		? "text-[14.5px] font-semibold mt-5 mb-3.5 text-foreground lg:mt-0 lg:text-[15px]"
		: "text-[14.5px] font-semibold mt-5 mb-3.5 text-foreground";
	const card = inCard ? " lg:rounded-[26px] lg:p-6 lg:bg-surface lg:ring-border" : "";

	const totale = spese.reduce((acc, s) => acc + s.total, 0);
	const data = spese.map((s, i) => ({
		...s,
		fill: CHART_RAMP[i % CHART_RAMP.length],
	}));

	if (spese.length === 0) {
		const periodoLabel = t.analytics.windows[periodo as keyof typeof t.analytics.windows] ?? t.analytics.windows.mese;
		return (
			<>
				<p className={titleClass}>
					{t.analytics.spendingByCategory}
				</p>
				<p className={`text-[13px] text-muted text-center py-6${card}`}>
					{fill(t.analytics.noSpending, { window: periodoLabel })}
				</p>
			</>
		);
	}

	return (
		<>
			<p className={titleClass}>
				{t.analytics.spendingByCategory}
			</p>
			{/*
				Con `inCard`, da `lg:` il donut scende a 150px (mockup desktop) e la
				riga va a capo (`flex-wrap`): la legenda sta accanto finché ha almeno
				144px, altrimenti passa sotto — succede nella colonna stretta di `xl:`
				con nomi lunghi. Il tetto a 288px le evita, nella colonna larga di
				`lg:`, un nome e la sua percentuale ai due capi della card.
			*/}
			<div className={`flex items-center gap-5${inCard ? " lg:flex-wrap" : ""}${card}`}>
				{/* Donut — lg: più grande (Fase 28b), stesso trattamento di InvestimentiTab. */}
				<div
					className={
						inCard
							? "relative w-32 h-32 lg:w-37.5 lg:h-37.5 shrink-0"
							: "relative w-32 h-32 lg:w-44 lg:h-44 shrink-0"
					}
				>
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
								{...pieHandlers}
							/>
							{/*
							 * issue #86 punto 5 — di default Recharts segue il dito e finiva
							 * SOPRA l'etichetta al centro dell'anello ("SPESE · € …"),
							 * sovrapponendo due scritte. `useDonutTooltipPosition` (vedi lì
							 * per il perché) ancora il tooltip appena fuori dal bordo esterno
							 * dell'anello, dal lato della fetta toccata — mai verso il centro.
							 */}
							<Tooltip
								contentStyle={{
									/*
									 * issue #86 punto 5 — `--modal-bg` è pensato per i modali,
									 * che stanno sopra uno sfondo già scurito da un overlay: la
									 * sua trasparenza (85% in scuro) lì non si nota. Qui il
									 * tooltip galleggia sopra al grafico o alla card sotto, senza
									 * overlay, e restava leggibile a metà. `--background-secondary`
									 * (alias `--color-deep`) è la superficie SOLIDA già usata
									 * dagli altri elementi flottanti dell'app (tendine di
									 * `Select`, `DatePicker`, `Filterbar` — tutte `bg-deep`).
									 */
									background: "var(--background-secondary)",
									// issue #81 — anello (box-shadow), non bordo: il colore è traslucido.
									boxShadow: "var(--border) 0px 0px 0px 1px inset",
									borderRadius: 12,
									fontSize: 12,
									color: "var(--text-primary)",
								}}
								wrapperStyle={tooltipStyle ?? undefined}
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
				<div className={inCard ? "flex-1 flex flex-col gap-2.5 lg:min-w-36 lg:max-w-72" : "flex-1 flex flex-col gap-2.5"}>
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
