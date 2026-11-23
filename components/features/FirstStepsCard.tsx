"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useI18n } from "@/components/features/I18nProvider";
import { useUIStore } from "@/store/useUIStore";
import { fill } from "@/lib/i18n/format";
import {
	FIRST_STEP_KEYS,
	firstStepsDoneCount,
	nextFirstStep,
	type FirstStepKey,
	type FirstStepsState,
} from "@/lib/first-steps";
import { dismissFirstSteps } from "@/app/(main)/first-steps-actions";
import { logClientError } from "@/lib/client-errors";

/**
 * Le pietre di passaggio (tobi-ishi): ognuna con la sua forma e un piccolo
 * scarto in altezza, come un sentiero e non una fila di caselle. Lo scarto vale
 * solo sul telefono, dove le pietre stanno in riga; da `lg:` sono in colonna
 * accanto ai nomi, e una pietra fuori asse sembrerebbe un errore.
 */
const STONES: Record<FirstStepKey, { w: number; h: number; radius: string; dy: string }> = {
	balance: { w: 34, h: 28, radius: "46% 54% 50% 50% / 55% 48% 52% 45%", dy: "1px" },
	transaction: { w: 30, h: 27, radius: "52% 48% 45% 55% / 48% 56% 44% 52%", dy: "-4px" },
	budget: { w: 35, h: 29, radius: "50% 50% 55% 45% / 44% 52% 48% 56%", dy: "3px" },
	goal: { w: 31, h: 26, radius: "55% 45% 48% 52% / 52% 46% 54% 48%", dy: "-2px" },
};

/**
 * Dove si fa ogni voce. La transazione non ha un indirizzo: apre il modale del
 * movimento, come il +. Il budget globale si imposta in Impostazioni, nella
 * sezione inline `GlobalBudgetSection` (anche sul telefono, non in una
 * sottopagina): l'ancora `#budget` porta lì invece che in cima alla pagina.
 */
const HREF: Record<Exclude<FirstStepKey, "transaction">, string> = {
	balance: "/conti",
	budget: "/impostazioni#budget",
	goal: "/risparmi",
};

const CTA = "btn-primary inline-flex items-center h-11 px-5 rounded-full text-[15px] font-medium";

/**
 * La card «Primi passi» in home (#163), design B «pietre di passaggio»: le
 * quattro voci come pietre, e per intero UNA voce sola — la prossima — con il
 * perché e il pulsante che la fa. Ogni pietra è un pulsante che mostra la sua
 * voce: l'ordine è un consiglio, non un obbligo.
 *
 * Le voci si spuntano da sole dai dati (`first_steps()`); qui arriva solo la
 * fotografia. Dopo un salvataggio la home si rilegge da sé
 * (`DashboardRefresher`), e con lei la card.
 *
 * Un DOM solo per i due breakpoint: sul telefono le pietre in riga senza testo
 * (il nome sta nell'`aria-label`), da `lg:` in colonna con i nomi a fianco e la
 * voce aperta a destra.
 */
export default function FirstStepsCard({ state }: { state: FirstStepsState }) {
	const { t } = useI18n();
	const openTransactionModal = useUIStore((s) => s.openTransactionModal);
	const next = nextFirstStep(state);
	// `null` = il pannello «completati»: è la vista iniziale solo a voci tutte fatte.
	const [selected, setSelected] = useState<FirstStepKey | null>(next);
	// La card sparisce subito al tocco; se la chiusura fallisce torna, e lo dice.
	const [hidden, setHidden] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (hidden) return null;

	const copy = t.firstSteps;
	const finished = next === null;
	// `selected` è `null` solo all'inizio, e solo a voci tutte fatte.
	const showingFinished = selected === null;

	async function dismiss() {
		setError(null);
		setHidden(true);
		try {
			const result = await dismissFirstSteps();
			if ("error" in result) {
				setHidden(false);
				setError(result.error);
			}
		} catch (e) {
			logClientError("[primi passi] chiusura:", e);
			setHidden(false);
			setError(t.common.genericError);
		}
	}

	return (
		<section
			aria-labelledby="first-steps-title"
			className="relative rounded-3xl overflow-hidden card-shadow-ring lg:rounded-[28px]"
		>
			<div className="absolute inset-0 bg-surface backdrop-blur-md" />
			<div className="relative flex flex-col gap-2.5 pt-3.5 pr-3 pb-5 pl-5 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-x-10 lg:gap-y-1 lg:pt-4 lg:pr-5 lg:pb-6 lg:pl-6.5">
				<div className="flex items-center gap-3 min-h-11 lg:col-span-2">
					<h2 id="first-steps-title" className="text-[15px] font-semibold text-secondary">
						{copy.title}
					</h2>
					<p className="text-[13px] text-muted tabular-nums">
						{fill(copy.progress, { done: firstStepsDoneCount(state), total: FIRST_STEP_KEYS.length })}
					</p>
					{/*
						Il comando che chiude sta qui finché la voce aperta non è il
						pannello «completati», che ha il suo «Chiudi» come pulsante
						principale: due comandi uguali nella stessa card sarebbero uno
						di troppo.
					*/}
					{!showingFinished && (
						<button
							type="button"
							onClick={dismiss}
							className="ml-auto h-11 px-2.5 text-sm text-muted"
						>
							{finished ? copy.close : copy.dismiss}
						</button>
					)}
				</div>

				{error && (
					<p role="alert" className="text-sm text-aka-ink lg:col-span-2">
						{error}
					</p>
				)}

				<ul aria-label={copy.stepsLabel} className="flex items-center gap-0.5 lg:flex-col lg:items-stretch lg:gap-0">
					{FIRST_STEP_KEYS.map((key, i) => {
						const done = state.done[key];
						const isSelected = selected === key;
						const stone = STONES[key];
						const label = copy.steps[key].label;
						const aria = done ? copy.stepAriaDone : key === next ? copy.stepAriaNext : copy.stepAria;
						return (
							<li key={key}>
								<button
									type="button"
									onClick={() => setSelected(key)}
									aria-pressed={isSelected}
									aria-label={fill(aria, { n: i + 1, label })}
									className="flex items-center justify-center w-11 h-11 rounded-xl lg:w-full lg:h-auto lg:min-h-11 lg:justify-start lg:gap-3 lg:text-left"
								>
									{/*
										Il riquadro fisso da `lg:` allinea i nomi: le pietre hanno
										larghezze diverse, e in colonna ogni nome partiva da un x
										diverso (visto negli scatti del collaudo).
									*/}
									<span aria-hidden="true" className="flex items-center justify-center shrink-0 lg:w-7">
										<span
											className={`flex items-center justify-center shrink-0 translate-y-(--dy) lg:translate-y-0 lg:scale-[0.72] ${
												done ? "bg-midori" : isSelected ? "" : "bg-[color-mix(in_srgb,var(--text-muted)_38%,transparent)]"
											} ${isSelected ? "ring-2 ring-foreground" : ""}`}
											style={
												{
													width: stone.w,
													height: stone.h,
													borderRadius: stone.radius,
													"--dy": stone.dy,
												} as CSSProperties
											}
										>
											{done && <Check size={14} strokeWidth={2.6} className="text-on-accent" />}
										</span>
									</span>
									<span
										aria-hidden="true"
										className={`hidden lg:inline text-sm ${
											isSelected ? "font-semibold text-foreground" : done ? "text-muted" : "text-foreground"
										}`}
									>
										{label}
									</span>
								</button>
							</li>
						);
					})}
				</ul>

				{/* `aria-live`: toccando una pietra cambia il testo qui, e lo screen reader lo legge. */}
				<div
					aria-live="polite"
					className="flex flex-col gap-1.5 pt-1.5 pr-2 lg:pt-1 lg:pl-10 lg:pr-0 lg:shadow-[inset_1px_0_0_var(--border)]"
				>
					{selected === null ? (
						<>
							<h3 className="text-[21px] leading-tight font-semibold tracking-[-0.2px] lg:text-[23px]">
								{copy.finishedTitle}
							</h3>
							<p className="text-[15px] leading-relaxed text-muted max-w-[34ch]">{copy.finishedText}</p>
							<div className="flex pt-2">
								<button type="button" onClick={dismiss} className={CTA}>
									{copy.close}
								</button>
							</div>
						</>
					) : (
						<>
							{state.done[selected] && (
								<p className="flex items-center gap-1.5 text-[13px] font-medium text-midori-ink">
									<Check size={14} strokeWidth={2.2} aria-hidden="true" />
									{copy.done}
								</p>
							)}
							<h3 className="text-[21px] leading-tight font-semibold tracking-[-0.2px] lg:text-[23px]">
								{copy.steps[selected].label}
							</h3>
							<p className="text-[15px] leading-relaxed text-muted max-w-[34ch]">{copy.steps[selected].why}</p>
							<div className="flex flex-wrap items-center gap-x-4 pt-2">
								{selected === "transaction" ? (
									<button type="button" onClick={() => openTransactionModal()} className={CTA}>
										{copy.steps.transaction.action}
									</button>
								) : (
									<Link href={HREF[selected]} className={CTA}>
										{copy.steps[selected].action}
									</Link>
								)}
								{selected === "transaction" && !state.hasImport && (
									<Link
										href="/impostazioni/importa"
										className="py-3 text-sm text-secondary underline underline-offset-3"
									>
										{copy.importLink}
									</Link>
								)}
							</div>
						</>
					)}
				</div>
			</div>
		</section>
	);
}
