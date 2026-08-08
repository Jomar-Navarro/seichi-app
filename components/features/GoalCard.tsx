"use client";

import { Check, Pencil } from "lucide-react";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { ICON_MAP } from "@/lib/icon-map";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, fill, formatDate, formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { GoalWithProgress } from "@/types";

/**
 * ⚠️ Passa da `formatMoney` e non da `style: "currency"`.
 *
 * Quest'ultimo, con `it-IT`, produce "180 €" — corretto per la convenzione
 * italiana, ma tutto il resto dell'app scrive "€ 180" (card budget, importi
 * delle transazioni, saldo). Era l'unico punto che usava l'altra disposizione,
 * e in inglese sarebbe diventato un terzo formato ancora ("€180"). Ora segue la
 * stessa convenzione di ogni altra cifra: simbolo davanti, spazio, numero.
 */
function formatAmount(n: number, locale: Locale): string {
	return formatMoney(n, { locale, currency: DISPLAY_CURRENCY });
}

function formatTargetDate(
	target_date: string | null | undefined,
	locale: Locale,
): string {
	if (!target_date) return "—";
	return formatDate(target_date, locale, { month: "short", year: "numeric" });
}

function CircularRing({ percent, completed }: { percent: number; completed: boolean }) {
	const clamped = Math.min(100, Math.max(0, percent));
	const dash = completed ? 100 : clamped;

	return (
		<div className="relative w-12 h-12 shrink-0">
			<svg width="48" height="48" viewBox="0 0 42 42">
				<circle cx="21" cy="21" r="15.9155" fill="none"
					stroke="var(--color-kin)" strokeWidth="4"
					opacity={completed ? 0.12 : 0.18}
				/>
				<circle cx="21" cy="21" r="15.9155" fill="none"
					stroke={completed ? "var(--color-kiri)" : "var(--color-kin)"}
					strokeWidth="4" strokeLinecap="round"
					strokeDasharray={`${dash} ${100 - dash}`}
					strokeDashoffset="25"
					opacity={completed ? 0.6 : 1}
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				{completed ? (
					<Check size={14} className="text-muted" />
				) : (
					<span className="text-[11px] font-semibold" style={{ color: "var(--ink-kin)" }}>
						{clamped}%
					</span>
				)}
			</div>
		</div>
	);
}

interface GoalCardProps {
	goal: GoalWithProgress;
	onEdit: (goal: GoalWithProgress) => void;
}

export default function GoalCard({ goal, onEdit }: GoalCardProps) {
	const { locale, t } = useI18n();
	const hasTarget = goal.target_amount != null && goal.target_amount > 0;
	const percent = hasTarget
		? Math.min(100, Math.round((goal.saved_amount / goal.target_amount!) * 100))
		: 0;
	const completed = hasTarget && percent >= 100;

	// Cerca icona nei goal-icon prima, poi nei category icon
	const Icon = GOAL_ICON_MAP[goal.icon] ?? ICON_MAP[goal.icon];

	return (
		<button
			onClick={() => onEdit(goal)}
			className="w-full text-left rounded-3xl p-4.5 border active:opacity-75 transition-opacity"
			style={{
				// Lo stato "completato" era cablato su valori chiari (marrone al 4%):
				// giusto per caso in tema chiaro, invisibile in scuro.
				background: completed ? "var(--seg-bg)" : "var(--surface)",
				borderColor: "var(--border)",
				backdropFilter: completed ? "none" : "blur(18px)",
				WebkitBackdropFilter: completed ? "none" : "blur(18px)",
				boxShadow: `inset 0 1px 0 ${completed ? "transparent" : "var(--shadow-inset)"}`,
			}}
		>
			<div className="flex items-center gap-3">
				<span
					className="w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center"
					style={{
						background: completed
							? "var(--icon-btn-bg)"
							: "color-mix(in srgb, var(--color-kin) 14%, transparent)",
					}}
				>
					{Icon && (
						<Icon
							size={19} strokeWidth={1.5}
							style={{ color: completed ? "var(--color-kiri)" : "var(--color-kin)" }}
						/>
					)}
				</span>

				<div className="flex-1 min-w-0">
					<p
						className="text-[15px] font-semibold leading-tight truncate"
						style={{ color: completed ? "var(--color-kiri)" : "var(--color-foreground)" }}
					>
						{goal.name}
					</p>
					<p className="text-xs text-muted mt-0.5">
						{completed
							? fill(t.goals.reached, { date: formatTargetDate(goal.target_date, locale) })
							: goal.target_date
								? fill(t.goals.deadline, { date: formatTargetDate(goal.target_date, locale) })
								: t.goals.noDeadline}
					</p>
				</div>

				{hasTarget && <CircularRing percent={percent} completed={completed} />}

				<span className="w-6 h-6 shrink-0 rounded-lg flex items-center justify-center"
					style={{ opacity: completed ? 0.4 : 0.65 }}>
					<Pencil size={13} strokeWidth={1.5} className="text-muted" />
				</span>
			</div>

			<p className="text-[12.5px] mt-3.5 font-medium">
				<span style={{ color: completed ? "var(--color-kiri)" : "var(--color-foreground)" }}>
					{formatAmount(goal.saved_amount, locale)}
				</span>
				{hasTarget && (
					<span className="text-muted font-normal">
						{" "}
						{t.goals.of} {formatAmount(goal.target_amount!, locale)}
					</span>
				)}
			</p>
		</button>
	);
}
