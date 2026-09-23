"use client";

import { Check, Pencil } from "lucide-react";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { ICON_MAP } from "@/lib/icon-map";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, fill, formatDate, formatMoney, plural } from "@/lib/i18n/format";
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
		// Solo sotto `lg:`: da lì la percentuale sta nella riga dell'importo e
		// l'avanzamento nella barra (mockup desktop, issue #108).
		<div className="relative w-12 h-12 shrink-0 lg:hidden">
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

	/*
	 * Quanto manca al traguardo, per la riga "mancano € X" del layout desktop.
	 * Non è una cifra nuova: è la distanza fra i due numeri che la card già
	 * mostra, la stessa sottrazione del coach (`goalsClosest` in lib/coach.ts).
	 *
	 * ⚠️ Arrotondata all'euro PRIMA di formattarla, come farà `formatMoney`: il
	 * verbo si accorda su QUEL numero. Scegliendo la forma su 1,4 o su 0,6 si
	 * scriverebbe "mancano € 1".
	 */
	const missing = hasTarget
		? Math.round(Math.max(0, goal.target_amount! - goal.saved_amount))
		: 0;

	// Cerca icona nei goal-icon prima, poi nei category icon
	const Icon = GOAL_ICON_MAP[goal.icon] ?? ICON_MAP[goal.icon];

	return (
		// ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto. Il bordo era
		// inline (`borderColor: "var(--border)"`, mai la classe `border-subtle`)
		// e per questo era sfuggito al primo giro di correzioni: stesso bug,
		// anello invece di bordo (`ring-border`), sul guscio.
		<button
			onClick={() => onEdit(goal)}
			className="relative w-full text-left rounded-3xl lg:rounded-[26px] overflow-hidden active:opacity-75 transition-opacity ring-border lg:cursor-pointer"
		>
			<div
				className="absolute inset-0"
				style={{
					// Lo stato "completato" era cablato su valori chiari (marrone al 4%):
					// giusto per caso in tema chiaro, invisibile in scuro.
					background: completed ? "var(--seg-bg)" : "var(--surface)",
					backdropFilter: completed ? "none" : "blur(18px)",
					WebkitBackdropFilter: completed ? "none" : "blur(18px)",
					boxShadow: `inset 0 1px 0 ${completed ? "transparent" : "var(--shadow-inset)"}`,
				}}
			/>
			{/*
				Da `lg:` (issue #108) la card del mockup desktop: più aria, l'importo in
				grande con la percentuale a destra, una barra al posto dell'anello.
				`min-h-54` è la stessa altezza della tessera tratteggiata "Nuovo
				obiettivo" che chiude la griglia (DashedAddButton): con la griglia in
				`items-start` le due misure devono coincidere per costruzione, non per
				una somma di padding che torna. Il piede (importo, barra, "mancano")
				scende in fondo con `mt-auto`, così in una riga gli importi stanno
				sulla stessa linea anche fra una card con traguardo e una senza.
			*/}
			<div className="relative p-4.5 lg:p-6 lg:min-h-54 lg:flex lg:flex-col">
			<div className="flex items-center gap-3 lg:gap-3.5">
				<span
					className="w-10 h-10 lg:w-11 lg:h-11 shrink-0 rounded-2xl lg:rounded-[15px] flex items-center justify-center"
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
						className="text-[15px] lg:text-[16.5px] font-semibold leading-tight truncate"
						style={{ color: completed ? "var(--color-kiri)" : "var(--color-foreground)" }}
					>
						{goal.name}
					</p>
					<p className="text-xs text-muted mt-0.5 lg:mt-1">
						{completed
							? fill(t.goals.reached, { date: formatTargetDate(goal.target_date, locale) })
							: goal.target_date
								? fill(t.goals.deadline, { date: formatTargetDate(goal.target_date, locale) })
								: t.goals.noDeadline}
					</p>
				</div>

				{hasTarget && <CircularRing percent={percent} completed={completed} />}

				{/* Da `lg:` una pastiglia da 32px, come il bottone "modifica" del
				    mockup. Resta decorativa: il bottone è l'intera card, e un
				    <button> annidato sarebbe markup interattivo dentro markup
				    interattivo. */}
				<span className="w-6 h-6 lg:w-8 lg:h-8 shrink-0 rounded-lg lg:rounded-[11px] lg:bg-control flex items-center justify-center"
					style={{ opacity: completed ? 0.4 : 0.65 }}>
					<Pencil size={13} strokeWidth={1.5} className="text-muted lg:size-3.5" />
				</span>
			</div>

			{/* `lg:pt-5` è lo stacco minimo dall'intestazione: `mt-auto` da solo
			    scenderebbe a zero su una card già alta quanto il suo minimo. */}
			<p className="text-[12.5px] mt-3.5 font-medium lg:mt-auto lg:pt-5 lg:flex lg:items-baseline lg:gap-1.5 lg:leading-tight">
				<span
					className="lg:text-[27px] lg:font-semibold"
					style={{ color: completed ? "var(--color-kiri)" : "var(--color-foreground)" }}
				>
					{formatAmount(goal.saved_amount, locale)}
				</span>
				{hasTarget && (
					// ⚠️ `text-muted` anche da `lg:`, contro il `text-disabled` del
					// mockup: il traguardo è un dato, non un suggerimento, e il token
					// "disabled" è per le etichette di sezione e gli hint.
					<span className="text-muted font-normal lg:text-[13px]">
						{" "}
						{t.goals.of} {formatAmount(goal.target_amount!, locale)}
					</span>
				)}
				{/* La percentuale che sotto `lg:` sta dentro l'anello — con lo stesso
				    segno di spunta quando l'obiettivo è raggiunto. */}
				{hasTarget &&
					(completed ? (
						<Check size={15} className="hidden lg:block lg:ml-auto lg:self-center text-muted" />
					) : (
						<span
							className="hidden lg:block lg:ml-auto lg:text-[13px] lg:font-semibold"
							style={{ color: "var(--ink-kin)" }}
						>
							{percent}%
						</span>
					))}
			</p>

			{/* La barra che prende il posto dell'anello da `lg:`: stessa tinta di
			    fondo, stesso stato "completato" spento. */}
			{hasTarget && (
				<div
					className="hidden lg:block mt-3.5 h-[7px] rounded-[4px] overflow-hidden"
					style={{ background: `color-mix(in srgb, var(--color-kin) ${completed ? 12 : 18}%, transparent)` }}
				>
					<div
						className="h-full rounded-[4px]"
						style={{
							width: `${Math.max(0, percent)}%`,
							background: completed ? "var(--color-kiri)" : "var(--color-kin)",
							opacity: completed ? 0.6 : 1,
						}}
					/>
				</div>
			)}

			{/*
				⚠️ Solo se manca davvero qualcosa. Su un obiettivo raggiunto lo dice già
				la riga "Raggiunto" sotto il nome; a meno di mezzo euro dal traguardo,
				"mancano € 0" sarebbe un non-fatto enunciato come osservazione — la
				classe già corretta nel coach (24b).
			*/}
			{hasTarget && !completed && missing >= 1 && (
				<p className="hidden lg:block mt-3 text-xs text-disabled">
					{fill(plural(t.goals.remaining, missing, locale), {
						amount: formatAmount(missing, locale),
					})}
				</p>
			)}
			</div>
		</button>
	);
}
