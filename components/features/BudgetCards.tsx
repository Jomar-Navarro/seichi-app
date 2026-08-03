"use client";

import { AlertTriangle } from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { budgetColor, periodHeading } from "@/lib/budget";
import type { BudgetOverview, BudgetWithSpending } from "@/types";

/** Importi arrotondati all'euro: nelle card i centesimi sono rumore. */
const euro = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

function BudgetCard({ budget }: { budget: BudgetWithSpending }) {
	const isGlobal = budget.categoryId === null;
	const baseColor = isGlobal
		? "var(--color-aka)"
		: `var(--color-${budget.category?.color ?? "kiri"})`;
	const color = budgetColor(budget.status, baseColor);
	const sforato = budget.status === "sforato";

	const Icon = isGlobal ? null : ICON_MAP[budget.category?.icon ?? ""];

	// Il bordo usa `border-subtle` come ogni altra superficie. Il token è
	// `--border`, esposto a Tailwind come `--color-subtle`: un `--color-border`
	// non esiste, e passarlo inline faceva ripiegare il bordo su currentColor,
	// cioè il bianco del testo. Solo lo stato sforato lo sovrascrive.
	return (
		<div
			className="relative min-w-39 rounded-3xl p-4 bg-card border border-subtle backdrop-blur-lg"
			style={
				sforato
					? { borderColor: "color-mix(in srgb, var(--color-aka) 35%, transparent)" }
					: undefined
			}
		>
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

			<div className="text-sm font-semibold mb-1.5 truncate pr-4">
				{isGlobal ? "Spese variabili" : budget.category?.name}
			</div>

			<div className="text-[12.5px] text-muted mb-3">
				<span className="font-medium" style={{ color: sforato ? color : "var(--text-primary)" }}>
					€ {euro.format(budget.spent)}
				</span>{" "}
				/ € {euro.format(budget.amount)}
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
	);
}

export default function BudgetCards({ overview }: { overview: BudgetOverview }) {
	const { global, perCategory, fixedOutflowsThisMonth } = overview;
	const cards = [...(global ? [global] : []), ...perCategory];

	// Nessun budget impostato: niente sezione. Uno stato vuoto qui sarebbe un
	// invito a configurare qualcosa in una pagina che serve a leggere i movimenti.
	if (cards.length === 0) return null;

	// L'intestazione segue il periodo del globale, o del primo budget: con
	// periodi misti è comunque il riferimento più probabile per l'utente.
	const heading = periodHeading((global ?? perCategory[0]).period);

	return (
		<div className="mb-5">
			<div className="flex items-baseline justify-between mb-3">
				<h2 className="text-[13px] font-semibold text-muted tracking-wide">{heading}</h2>
				{global && fixedOutflowsThisMonth > 0 && (
					<span className="text-[11px] text-muted/80">
						uscite fisse € {euro.format(fixedOutflowsThisMonth)}
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
