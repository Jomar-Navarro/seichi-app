"use client";

import { AlertTriangle } from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { budgetColor, budgetInk } from "@/lib/budget";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, fill, formatMoney, lookup } from "@/lib/i18n/format";
import type { BudgetOverview, BudgetWithSpending } from "@/types";

function BudgetCard({ budget }: { budget: BudgetWithSpending }) {
	const { locale, t } = useI18n();
	/** Importi arrotondati all'euro: nelle card i centesimi sono rumore. */
	const money = (v: number) =>
		formatMoney(v, { locale, currency: DISPLAY_CURRENCY });
	const isGlobal = budget.categoryId === null;
	const baseColor = isGlobal
		? "var(--color-aka)"
		: `var(--color-${budget.category?.color ?? "kiri"})`;
	const color = budgetColor(budget.status);
	const sforato = budget.status === "sforato";

	const Icon = isGlobal ? null : ICON_MAP[budget.category?.icon ?? ""];

	// Il bordo usa `border-subtle` come ogni altra superficie. Il token è
	// `--border`, esposto a Tailwind come `--color-subtle`: un `--color-border`
	// non esiste, e passarlo inline faceva ripiegare il bordo su currentColor,
	// cioè il bianco del testo. Solo lo stato sforato lo sovrascrive.
	return (
		/* ⚠️ TRE livelli — issue #81. Guscio (bordo, ritaglio) → vetro → contenuto. */
		<div
			className="relative min-w-39 rounded-3xl ring-border overflow-hidden"
			style={
				sforato
					? { borderColor: "color-mix(in srgb, var(--color-aka) 35%, transparent)" }
					: undefined
			}
		>
			<div className="absolute inset-0 bg-card backdrop-blur-lg" />
			<div className="relative p-4">
			{sforato && (
				<span
					className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
					style={{ background: "color-mix(in srgb, var(--color-aka) 18%, transparent)" }}
				>
					<AlertTriangle size={11} strokeWidth={2} style={{ color: "var(--color-aka)" }} />
				</span>
			)}

			<span
				className="w-8 h-8 rounded-[11px] flex items-center justify-center mb-3"
				style={{ background: `color-mix(in srgb, ${baseColor} 13%, transparent)` }}
			>
				{Icon ? (
					<Icon size={17} strokeWidth={1.5} style={{ color: baseColor }} />
				) : (
					<span className="text-[13px] font-semibold" style={{ color: baseColor }}>
						€
					</span>
				)}
			</span>

			<div className="text-sm font-semibold truncate pr-4">
				{isGlobal ? t.budget.variableExpenses : budget.category?.name}
			</div>

			<div className="text-[11px] text-muted/80 mb-1.5 mt-0.5">
				{lookup(t.budgetPeriods, budget.period, (p) => p.window, "")}
			</div>

			<div className="text-[12.5px] text-muted mb-3">
				{/* L'inchiostro e non `color`: quello colora la barra, che è un
				    riempimento. Qui è la cifra che il rosso esiste per far notare, e
				    sull'accento in chiaro stava sotto il neutro che le sta accanto. */}
				<span
					className="font-medium"
					style={{ color: sforato ? budgetInk(budget.status) : "var(--text-primary)" }}
				>
					{money(budget.spent)}
				</span>{" "}
				/ {money(budget.amount)}
			</div>

			<div
				className="h-1.5 rounded-full overflow-hidden"
				style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
			>
				<div
					className="h-full rounded-full transition-all"
					style={{ width: `${budget.pct}%`, background: color, opacity: sforato ? 1 : 0.8 }}
				/>
			</div>
			</div>
		</div>
	);
}

export default function BudgetCards({ overview }: { overview: BudgetOverview }) {
	const { locale, t } = useI18n();
	const { global, perCategory, fixedOutflowsThisMonth } = overview;
	const cards = [...(global ? [global] : []), ...perCategory];

	// Nessun budget impostato: niente sezione. Uno stato vuoto qui sarebbe un
	// invito a configurare qualcosa in una pagina che serve a leggere i movimenti.
	if (cards.length === 0) return null;

	// Intestazione neutra: prima seguiva il periodo del globale ("Budget del
	// mese"), che con periodi misti era una dichiarazione falsa sulle card
	// accanto. La finestra ora la porta ogni card, che è dove serve.
	return (
		<div className="mb-5">
			<div className="flex items-baseline justify-between mb-3">
				<h2 className="text-[13px] font-semibold text-muted tracking-wide">
					{t.budget.sectionTitle}
				</h2>
				{/* "del mese" va detto qui: senza più quella parola nell'intestazione,
				    questa cifra resterebbe senza arco temporale. */}
				{global && fixedOutflowsThisMonth > 0 && (
					<span className="text-[11px] text-muted/80">
						{fill(t.budget.fixedThisMonth, {
							amount: formatMoney(fixedOutflowsThisMonth, {
								locale,
								currency: DISPLAY_CURRENCY,
							}),
						})}
					</span>
				)}
			</div>

			<div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-1">
				{cards.map((b) => (
					<BudgetCard key={b.budgetId} budget={b} />
				))}
			</div>
		</div>
	);
}
