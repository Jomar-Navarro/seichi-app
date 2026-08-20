"use client";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUpIcon } from "@/lib/seichi-icons";
import { ICON_MAP } from "@/lib/icon-map";
import { INVESTMENT_TYPE_FALLBACK } from "@/lib/investment-types";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, fill, formatMoney, plural } from "@/lib/i18n/format";
import type { InvestmentData } from "@/types";


const CHART_COLORS = ["ao", "murasaki", "kin", "midori", "aka", "kiri"] as const;

/**
 * Accento → inchiostro, esplicito.
 *
 * Prima il colore del testo si costruiva con `var(--ink-${accent})`: con
 * `accent = "kiri"` — che è nella rotazione ed è anche il colore di "altro" —
 * usciva `var(--ink-kiri)`, che allora non esisteva. Una variabile CSS
 * inesistente non fa rumore, e il badge perdeva il colore in silenzio.
 * Con una mappa il compilatore vede tutti i nomi e il difetto non è più
 * esprimibile.
 */
const ACCENT_INK: Record<(typeof CHART_COLORS)[number], string> = {
	ao: "var(--ink-ao)",
	murasaki: "var(--ink-murasaki)",
	kin: "var(--ink-kin)",
	midori: "var(--ink-midori)",
	aka: "var(--ink-aka)",
	kiri: "var(--ink-kiri)",
};

function EmptyState() {
	const { t } = useI18n();

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
			<p className="text-[18px] font-semibold mb-2.5">{t.investments.emptyTitle}</p>
			{/* Cita il nome del tipo: viene dalla stessa fonte del selettore nel
			    modale, così le due schermate non possono chiamarlo in due modi. */}
			<p className="text-sm text-muted leading-relaxed max-w-65">
				{fill(t.investments.emptyDescription, {
					type: t.transactionTypes.investimento.label,
				})}
			</p>
		</div>
	);
}

export default function InvestimentiTab({
	data,
}: {
	data: InvestmentData | null;
}) {
	const { locale, t } = useI18n();
	/** Importi con i decimali, nel formato del locale. */
	const money = (v: number) =>
		formatMoney(v, { locale, currency: DISPLAY_CURRENCY, decimals: 2 });

	if (!data || data.positions.length === 0) return <EmptyState />;

	const { total, variazionePct, byType, positions } = data;

	const items = positions.map((pos, i) => {
		const typeKey = (pos.investment_type ??
				INVESTMENT_TYPE_FALLBACK) as keyof typeof t.investments.types;
		// Il colore viene dalla ROTAZIONE, non dalla tipologia: due posizioni ETF
		// prenderebbero lo stesso accento e il donut mostrerebbe due fette
		// identiche con due pallini identici in legenda, cioè illeggibile.
		// La tipologia resta comunque scritta a parole sul badge.
		const accent = CHART_COLORS[i % CHART_COLORS.length];
		return {
			...pos,
			label: pos.name,
			typeLabel:
				t.investments.types[typeKey] ?? t.investments.types[INVESTMENT_TYPE_FALLBACK],
			accent,
			fill: `var(--color-${accent})`,
			ink: ACCENT_INK[accent],
		};
	});

	/*
	 * ⚠️ Il donut vede solo le posizioni POSITIVE, e non è una preferenza
	 * estetica: una fetta di torta non sa rappresentare un valore negativo.
	 * Recharts la disegnerebbe comunque — con un angolo negativo che si somma
	 * agli altri — e il risultato sarebbe un anello che gira al contrario, con
	 * percentuali che non tornano.
	 *
	 * Una posizione può risultare negativa quando è stata liquidata per più di
	 * quanto vi era stato versato (c'erano plusvalenze). Sparisce dal grafico ma
	 * NON dall'elenco sotto, dove è scritta col suo segno e con la frase che
	 * spiega perché: azzerarla direbbe "qui non hai mai versato niente", che è
	 * falso. La regola è quella della 17a — un numero assente è meglio di uno
	 * sbagliato — applicata al posto giusto: il grafico tace, l'elenco parla.
	 */
	const chartItems = items.filter((i) => i.total > 0);

	return (
		<>
			{/* Summary line */}
			<p className="text-[12.5px] text-muted mt-1">
				{plural(t.investments.positionCount, positions.length, locale)} ·{" "}
				{plural(t.investments.typeCount, byType.length, locale)}
			</p>

			{/* Portfolio value card */}
			{/* box-shadow (ombra portata + inset) e non il solo inset: senza la
			    portata la card non stacca dal fondo ed è quella che nel design
			    la fa galleggiare. */}
			<div className="mt-5 rounded-[28px] pt-5 px-5.5 pb-5.5 bg-surface border border-subtle backdrop-blur-[22px] box-shadow">
				<p className="text-[11px] text-muted uppercase tracking-widest">
					{t.investments.portfolioValue}
				</p>
				<p className="text-[36px] font-semibold tracking-[-0.5px] mt-2 text-foreground">
					{money(total)}
				</p>
				{variazionePct !== null && (
					<p
						className={`text-[12px] mt-1.5 flex items-center gap-1 ${
							variazionePct >= 0 ? "text-midori-ink" : "text-aka-ink"
						}`}
					>
						<span>{variazionePct >= 0 ? "↑" : "↓"}</span>
						<span>
							{variazionePct >= 0 ? "+" : ""}
							{variazionePct}% {t.investments.vsLastMonth}
						</span>
					</p>
				)}
			</div>

			{/* Composizione — visibile solo con almeno 2 posizioni */}
			{chartItems.length >= 2 && (
				<>
					<p className="text-[14.5px] font-semibold mt-5 mb-3.5 text-foreground">
						{t.investments.composition}
					</p>
					<div className="flex items-center gap-5">
						<div className="relative w-40 h-40 shrink-0">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={chartItems}
										dataKey="total"
										nameKey="label"
										innerRadius="60%"
										outerRadius="85%"
										strokeWidth={2}
										// Il separatore è il colore del FONDO, non inchiostro: cablato
										// su --color-yoru somigliava allo sfondo scuro per caso, e in
										// chiaro disegnava un anello scuro fra le fette.
										stroke="var(--background-secondary)"
									/>
									<Tooltip
										contentStyle={{
											background: "var(--modal-bg)",
											border: "1px solid var(--border)",
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
							<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5">
								<p className="text-[9.5px] text-muted uppercase tracking-[0.08em] leading-none">
									{t.investments.total}
								</p>
								<p className="text-[15px] font-semibold text-foreground leading-none">
									{money(total)}
								</p>
							</div>
						</div>

						<div className="flex-1 flex flex-col gap-2.5">
							{chartItems.map((pos) => (
								<div key={pos.category_id} className="flex items-center justify-between">
									<div className="flex items-center gap-2.25">
										<span
											className="inline-block w-2 h-2 rounded-full shrink-0"
											style={{ background: pos.fill }}
										/>
										<span className="text-[12.5px] text-foreground truncate max-w-20">{pos.label}</span>
									</div>
									<span className="text-[12.5px] text-muted shrink-0">{pos.pct}%</span>
								</div>
							))}
						</div>
					</div>
				</>
			)}

			{/* Posizioni */}
			<p className="text-[14.5px] font-semibold mt-5 mb-3 text-foreground">
				{t.investments.positions}
			</p>
			<div className="flex flex-col gap-2.5">
				{items.map((pos) => {
					const Icon = ICON_MAP[pos.icon] ?? TrendingUpIcon;
					const accent = `var(--color-${pos.accent})`;

					return (
						<div
							key={pos.category_id}
							className="rounded-[20px] px-3.5 py-3 bg-surface border border-subtle backdrop-blur-[18px] shadow-[inset_0_1px_0_var(--shadow-inset)]"
						>
							<div className="flex items-center gap-2.5">
								<div
									className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
									style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
								>
									<Icon size={17} strokeWidth={1.5} style={{ color: accent }} />
								</div>

								<div className="flex-1 min-w-0">
									<p className="text-[13.5px] font-semibold truncate">{pos.name}</p>
									<div className="flex items-center gap-1.5 mt-0.5">
										<span
											className="text-[10.5px] font-medium px-1.75 py-px rounded-full"
											style={{
												// Tinta dall'accento, testo dall'inchiostro: sulla pastiglia
												// chiara l'accento pieno non arriva a 4,5:1.
												background: `color-mix(in srgb, ${accent} 13%, transparent)`,
												color: pos.ink,
											}}
										>
											{pos.typeLabel}
										</span>
										{/* ⚠️ Niente "0%" su una posizione liquidata: la percentuale è
										    la quota del capitale ancora versato, e per un netto
										    negativo quella quota non esiste. Scrivere 0% direbbe "pesa
										    nulla nel portafoglio" al posto di "non è più nel
										    portafoglio", che è un'altra affermazione. */}
										{pos.total > 0 && (
											<span className="text-[11px] text-muted">{pos.pct}%</span>
										)}
									</div>
								</div>
							</div>

							{/* Riga a sé, come nel design: l'importo non compete più con il
							    nome per lo spazio orizzontale, che sui nomi lunghi troncava. */}
							<div className="flex items-center justify-between mt-2.5 text-[12.5px]">
								<span className="text-muted">{t.investments.invested}</span>
								<span className="font-semibold">
									{money(pos.total)}
								</span>
							</div>

							{/*
								⚠️ Un netto negativo senza spiegazione si legge come un errore
								dell'app, non come un fatto sul portafoglio: "− € 45,20 investito"
								non vuol dire niente finché non si sa che hai ripreso più di quanto
								avevi messo. La frase è l'unica cosa che trasforma un numero
								inspiegabile in un'informazione — ed è il motivo per cui la
								posizione si mostra invece di azzerarla.
							*/}
							{pos.total < 0 && (
								<p className="text-[11px] text-midori-ink mt-1.5 leading-snug">
									{t.investments.negativeNote}
								</p>
							)}
						</div>
					);
				})}
			</div>
		</>
	);
}
