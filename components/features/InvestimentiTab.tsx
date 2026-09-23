"use client";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUpIcon } from "@/lib/seichi-icons";
import { ICON_MAP } from "@/lib/icon-map";
import { INVESTMENT_TYPE_FALLBACK } from "@/lib/investment-types";
import { useI18n } from "./I18nProvider";
import {
	DISPLAY_CURRENCY,
	currencySymbol,
	fill,
	formatMoney,
	splitAmount,
} from "@/lib/i18n/format";
import { useDonutTooltipPosition } from "@/components/UI/useDonutTooltipPosition";
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
				className="w-18 h-18 rounded-3xl flex items-center justify-center mb-5 card-shadow-ring"
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
	// Prima del return anticipato: le regole degli Hook vietano di chiamarlo
	// solo quando ci sono posizioni.
	const { style: tooltipStyle, pieHandlers } = useDonutTooltipPosition();

	if (!data || data.positions.length === 0) return <EmptyState />;

	const { total, variazionePct, byType, positions } = data;
	/*
	 * La cifra grande del desktop (#108) spezza intero e decimali, come il saldo
	 * di `/conti`: stesso `splitAmount`, quindi lo stesso meno tipografico e la
	 * stessa parte decimale in ogni lingua. Su mobile resta `money(total)`.
	 */
	const { sign, integer, decimal } = splitAmount(total, locale);

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
		/*
		 * xl: due colonne `1.05fr 1fr` del mockup desktop (#108) — a sinistra ciò
		 * che RIASSUME (capitale versato, composizione), a destra ciò che ELENCA
		 * (posizioni, per tipologia). Sotto xl una colonna sola, nell'ordine di
		 * sempre: a lg il contenuto è largo ≈688px, e la cifra da 46px col donut
		 * accanto a un elenco schiaccerebbero entrambi.
		 *
		 * `min-w-0` sulle due colonne: una traccia `fr` non scende sotto il
		 * min-content dei suoi figli, e un nome di posizione lungo — che le righe
		 * troncano — l'avrebbe allargata a spese dell'altra.
		 *
		 * ⚠️ Il riepilogo "N posizioni attive · N tipologie" non sta più qui: è
		 * nell'intestazione della pagina, dove il mockup lo mette sotto il titolo.
		 */
		<div className="flex flex-col xl:grid xl:grid-cols-[1.05fr_1fr] xl:gap-5 xl:items-start">
			<div className="flex flex-col min-w-0">
				{/* Portfolio value card */}
				{/* box-shadow (ombra portata + inset) e non il solo inset: senza la
				    portata la card non stacca dal fondo ed è quella che nel design
				    la fa galleggiare. */}
				{/* ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto. */}
				<div className="relative mt-5 rounded-[28px] overflow-hidden box-shadow-ring lg:mt-7">
					<div className="absolute inset-0 bg-surface backdrop-blur-[22px]" />
					{/*
						lg: la tinta ao del mockup desktop (#108) — fondo al 7% e anello
						dello stesso accento, sopra il vetro e sotto il contenuto. Un velo
						a parte, e non un secondo `background` sul vetro, così su mobile
						la card resta esattamente quella di prima.
						⚠️ Arrotondato anche lui: l'anello è un `box-shadow` (issue #81,
						mai un bordo traslucido su un raggio), e disegnato su un
						rettangolo verrebbe tagliato agli angoli dal ritaglio del guscio.
					*/}
					<div
						className="hidden lg:block absolute inset-0 rounded-[28px]"
						style={{
							background: "color-mix(in srgb, var(--color-ao) 7%, transparent)",
							boxShadow: "color-mix(in srgb, var(--color-ao) 22%, transparent) 0px 0px 0px 1px inset",
						}}
					/>
					<div className="relative pt-5 px-5.5 pb-5.5 lg:pt-6.5 lg:px-7 lg:pb-6.5">
					<p className="text-[11px] text-muted uppercase tracking-widest lg:tracking-[2px]">
						{t.investments.portfolioValue}
					</p>
					<p className="text-[36px] font-semibold tracking-[-0.5px] mt-2 text-foreground lg:hidden">
						{money(total)}
					</p>
					{/* lg: 46px con i decimali a 28px attenuati, come il saldo di `/conti`. */}
					<p className="hidden lg:flex items-baseline gap-0.5 mt-2.5 font-semibold tracking-tight leading-[1.1] text-foreground">
						<span className="text-[28px] mr-1">{currencySymbol(DISPLAY_CURRENCY, locale)}</span>
						<span className="text-[46px]">{sign}{integer}</span>
						<span className="text-[28px] font-medium text-muted">{decimal}</span>
					</p>
					{variazionePct !== null && (
						<p
							className={`text-[12px] mt-1.5 flex items-center gap-1 lg:text-[12.5px] lg:mt-2.5 ${
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
				</div>

				{/* Composizione — visibile solo con almeno 2 posizioni */}
				{chartItems.length >= 2 && (
					<>
						<p className="text-[14.5px] font-semibold mt-5 mb-3.5 text-foreground lg:text-[15px] lg:mb-3">
							{t.investments.composition}
						</p>
						{/*
							lg: donut e legenda dentro una card (#108) — il titolo resta
							FUORI, come per le posizioni. Su mobile guscio e vetro non
							esistono: il donut resta sul fondo, com'era.
							⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto.
						*/}
						<div className="lg:relative lg:rounded-[26px] lg:overflow-hidden lg:card-shadow-ring">
							<div className="hidden lg:block absolute inset-0 bg-surface backdrop-blur-[18px]" />
							<div className="flex items-center gap-5 lg:relative lg:p-6.5 lg:gap-7">
							{/* lg: 168px, la misura del mockup desktop (#108) — la 28b l'aveva
							    portato a 208px quando il donut stava da solo su tutta la riga. */}
							<div className="relative w-40 h-40 lg:w-42 lg:h-42 shrink-0">
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
											{...pieHandlers}
										/>
										{/*
										 * issue #86 punto 5 — stesso donut-con-etichetta-al-centro di
										 * SpendingPieChart, stesso difetto e stessa cura: vedi il
										 * commento lì (e `useDonutTooltipPosition`) per il perché.
										 */}
										<Tooltip
											contentStyle={{
												// issue #86 punto 5 — superficie SOLIDA, non `--modal-bg`
												// (pensato per i modali, sopra un overlay che ne
												// nasconde la trasparenza): vedi il commento gemello in
												// SpendingPieChart.tsx.
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
								<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5">
									<p className="text-[9.5px] text-muted uppercase tracking-[0.08em] leading-none">
										{t.investments.total}
									</p>
									<p className="text-[15px] font-semibold text-foreground leading-none">
										{money(total)}
									</p>
								</div>
							</div>

							{/*
								Su mobile la legenda è una colonna con le percentuali in
								colonna a destra; da lg le voci vanno a capo una accanto
								all'altra, come nel mockup — la card è abbastanza larga da
								tenerne due o tre per riga.
							*/}
							<div className="flex-1 flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:gap-x-5 lg:gap-y-3">
								{chartItems.map((pos) => (
									<div
										key={pos.category_id}
										className="flex items-center justify-between lg:justify-start lg:gap-2"
									>
										<div className="flex items-center gap-2.25">
											<span
												className="inline-block w-2 h-2 rounded-full shrink-0 lg:w-2.25 lg:h-2.25"
												style={{ background: pos.fill }}
											/>
											<span className="text-[12.5px] text-foreground truncate max-w-20 lg:text-[13px] lg:max-w-36">
												{pos.label}
											</span>
										</div>
										<span className="text-[12.5px] text-muted shrink-0 lg:text-[13px]">{pos.pct}%</span>
									</div>
								))}
							</div>
							</div>
						</div>
					</>
				)}
			</div>

			<div className="flex flex-col min-w-0">
				{/* Posizioni — a xl apre la colonna destra, allineata alla card a sinistra. */}
				<p className="text-[14.5px] font-semibold mt-5 mb-3 text-foreground lg:text-[15px] xl:mt-7">
					{t.investments.positions}
				</p>
				{/*
					Una colonna sola a ogni larghezza. ⚠️ Revisione DELIBERATA della
					28b, che da lg le metteva in griglia a 2 colonne: il mockup desktop
					(#108) le vuole righe larghe, con l'importo a destra sulla stessa
					linea del nome — e in tessere a metà larghezza quell'importo non ci
					starebbe accanto a un nome lungo.
				*/}
				<div className="flex flex-col gap-2.5">
					{items.map((pos) => {
						const Icon = ICON_MAP[pos.icon] ?? TrendingUpIcon;
						const accent = `var(--color-${pos.accent})`;

						/*
							⚠️ Il badge compare SOLO se la posizione ha una tipologia sola (#56).

							Una categoria raccoglie righe di asset diversi — la decisione
							dell'import è per gruppo, `investment_type` sta sulla riga — quindi
							su una posizione mista NON esiste un badge corretto: quella "ETF"
							dichiarava "Crypto", che era la tipologia della prima riga
							d'acquisto. A dire cosa contiene è ora la sezione "Per tipologia".

							⚠️ `<= 1` e non `=== 1`: zero tipologie NOTE significa "non si sa"
							(righe inserite a mano, dove il form non scrive `investment_type`),
							non "sono diverse". Là il ripiego "Altro" è un'affermazione vera, e
							nasconderlo direbbe che la posizione ne contiene più d'una.

							Un elemento solo, montato in due posti: sotto il nome su mobile,
							accanto al nome da lg (#108). Scritto due volte, stile e regola
							avrebbero potuto divergere.
						*/
						const badge =
							pos.typeCount <= 1 ? (
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
							) : null;

						return (
							/* ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto. */
							<div
								key={pos.category_id}
								className="relative rounded-[20px] overflow-hidden shadow-[inset_0_1px_0_var(--shadow-inset),inset_0_0_0_1px_var(--border)] lg:rounded-[22px]"
							>
							<div className="absolute inset-0 bg-surface backdrop-blur-[18px]" />
							<div className="relative px-3.5 py-3 lg:px-5 lg:py-4.5">
								<div className="flex items-center gap-2.5 lg:gap-3.5">
									<div
										className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 lg:w-10 lg:h-10 lg:rounded-[13px]"
										style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
									>
										<Icon size={17} strokeWidth={1.5} style={{ color: accent }} />
									</div>

									<div className="flex-1 min-w-0">
										<div className="lg:flex lg:items-center lg:gap-2">
											<p className="text-[13.5px] font-semibold truncate lg:text-[14.5px]">{pos.name}</p>
											{badge && <span className="hidden lg:inline-flex shrink-0">{badge}</span>}
										</div>
										<div className="flex items-center gap-1.5 mt-0.5 lg:hidden">
											{badge}
											{/* ⚠️ Niente "0%" su una posizione liquidata: la percentuale è
											    la quota del capitale ancora versato, e per un netto
											    negativo quella quota non esiste. Scrivere 0% direbbe "pesa
											    nulla nel portafoglio" al posto di "non è più nel
											    portafoglio", che è un'altra affermazione. */}
											{pos.total > 0 && (
												<span className="text-[11px] text-muted">{pos.pct}%</span>
											)}
										</div>
										{/* lg: "Investito · 93%" sotto il nome (#108) — stessa regola
										    del mobile: la quota solo per un netto positivo. */}
										<p className="hidden lg:block text-[11.5px] text-muted mt-0.5">
											{t.investments.invested}
											{pos.total > 0 && ` · ${pos.pct}%`}
										</p>
									</div>

									{/* lg: l'importo sulla riga del nome, a destra. */}
									<span className="hidden lg:block text-[15px] font-semibold shrink-0">
										{money(pos.total)}
									</span>
								</div>

								{/* Riga a sé, come nel design: l'importo non compete più con il
								    nome per lo spazio orizzontale, che sui nomi lunghi troncava.
								    Da lg la riga è abbastanza larga da riportarlo accanto al nome. */}
								<div className="flex items-center justify-between mt-2.5 text-[12.5px] lg:hidden">
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
									lg: rientrata sotto il nome (40px di tessera + 14 di distacco).
								*/}
								{pos.total < 0 && (
									<p className="text-[11px] text-midori-ink mt-1.5 leading-snug lg:text-[11.5px] lg:mt-2 lg:pl-13.5">
										{t.investments.negativeNote}
									</p>
								)}
							</div>
							</div>
						);
					})}
				</div>

				{/*
					Per tipologia (#61).

					⚠️ Esiste perché l'intestazione DICHIARAVA «N tipologie» e poi la
					pagina non le mostrava: `byType` veniva calcolato per intero —
					etichetta, colore, totale, percentuale, con il denominatore separato
					introdotto dalla 21b — e il componente ne usava solo `.length`.
					L'app contava ad alta voce una ripartizione che poi buttava via.

					⚠️ E la partizione buttata era proprio quella informativa dopo un
					import: la decisione è per GRUPPO, quindi le posizioni tendono a una
					voce sola — la vista per categoria collassa esattamente quando
					l'altra diventa interessante.

					Sotto le due, e non un secondo donut: una fetta al 100% non è una
					composizione, e il problema non era il numero di fette.
				*/}
				{byType.length >= 2 && (
					<>
						<p className="text-[14.5px] font-semibold mt-5 mb-3 text-foreground lg:text-[15px]">
							{t.investments.byTypeTitle}
						</p>
						{/* ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto. */}
						<div className="relative rounded-[20px] overflow-hidden shadow-[inset_0_1px_0_var(--shadow-inset),inset_0_0_0_1px_var(--border)] lg:rounded-[22px]">
						<div className="absolute inset-0 bg-surface backdrop-blur-[18px]" />
						<div className="relative px-3.5 py-1 lg:px-5 lg:py-1.5">
							{byType.map((slice) => (
								<div
									key={slice.type}
									className="py-2.5 border-b border-subtle last:border-b-0 lg:py-3.5"
								>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2.25 min-w-0">
										<span
											className="inline-block w-2 h-2 rounded-full shrink-0 lg:w-2.25 lg:h-2.25"
											/*
											 * ⚠️ `var(--color-…)` e NON `slice.color` nudo: `INVESTMENT_TYPE_COLOR`
											 * contiene NOMI DI TOKEN ("ao", "kin"), non colori CSS.
											 * `background: ao` è una dichiarazione invalida — il pallino non si
											 * disegna e basta, senza un errore da nessuna parte.
											 *
											 * ⚠️ È la famiglia di difetti che questo progetto insegue dalla Fase 18
											 * (*una variabile CSS inesistente non fa rumore*), in una veste che
											 * `audit:tokens` NON vede: lo script confronta le `var(--…)` scritte e
											 * le classi Tailwind generate, e qui non c'è né l'una né l'altra.
											 */
											style={{ background: `var(--color-${slice.color})` }}
										/>
										<span className="text-[12.5px] text-foreground truncate lg:text-[13.5px]">{slice.label}</span>
									</div>
									<div className="flex items-center gap-2.5 shrink-0">
										<span className="text-[12.5px] font-semibold lg:text-[13.5px]">{money(slice.total)}</span>
										{/* Stessa regola delle posizioni: niente 0% su un netto negativo. */}
										{slice.total > 0 && (
											<span className="text-[11px] text-muted w-8 text-right lg:text-[12px] lg:w-10.5">{slice.pct}%</span>
										)}
									</div>
								</div>
								{/*
									lg: la barra da 5px del mockup (#108) — la stessa quota
									scritta accanto, disegnata. Pista tinta dallo stesso accento,
									come le barre dei budget. ⚠️ Solo per un netto positivo, per la
									stessa ragione della percentuale: una pista vuota sotto un
									netto negativo direbbe "pesa 0%", che è un'altra affermazione.
									Anche qui `var(--color-…)`: `slice.color` è un nome di token.
								*/}
								{slice.total > 0 && (
									<div
										className="hidden lg:block h-1.25 mt-2.5 rounded-full overflow-hidden"
										style={{ background: `color-mix(in srgb, var(--color-${slice.color}) 16%, transparent)` }}
									>
										<div
											className="h-full rounded-full"
											style={{ width: `${slice.pct}%`, background: `var(--color-${slice.color})` }}
										/>
									</div>
								)}
								</div>
							))}
						</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
