"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, Lock, TriangleAlert } from "lucide-react";
import PinPad from "@/components/UI/PinPad";
import SubmitButton from "@/components/UI/SubmitButton";
import { useI18n } from "@/components/features/I18nProvider";
import { fill } from "@/lib/i18n/format";
import {
	APP_LOCK_PIN_LENGTH,
	APP_LOCK_REJECT_DISPLAY_MS,
	clearPin,
	hasStoredPin,
	readStoredPin,
	savePin,
} from "@/lib/app-lock";

/**
 * `/impostazioni/blocco` (Fase 26a) — imposta, cambia o rimuove il PIN.
 *
 * Dal design (`PinSetupCard.dc.html`): badge + titolo + sottotitolo che
 * cambiano per passo, indicatore di progresso a 3 tappe, schermata finale
 * "PIN impostato" con un bottone esplicito invece di tornare subito al
 * riposo. ⚠️ Il design mostra anche uno switch biometrico funzionante e una
 * riga "richiedi il PIN dopo N minuti" TOCCABILE, nella schermata finale: non
 * adottati — il biometrico non esiste ancora (Fase 26b) e la finestra di
 * grazia è una costante (`APP_LOCK_GRACE_MS`), non una preferenza. Mostrarli
 * prometterebbe funzioni che l'app non ha.
 *
 * ⚠️ `mismatch` NON è un valore di `step`, ed è deliberato: è un booleano
 * (`mismatchShowing`) sovrapposto allo step "create-confirm". Se fosse un
 * terzo `step`, `key={step}` sul PinPad (sotto) rimonterebbe un'istanza
 * NUOVA — vuota — proprio nell'istante in cui il design vuole mostrare le 6
 * cifre appena digitate, piene e rosse. Restando sullo stesso step il pad è
 * la STESSA istanza per tutta la finestra di lettura dell'errore, e passa a
 * "create-enter" (quindi si svuota) solo alla fine di quella finestra.
 */
type Step = "idle" | "create-enter" | "create-confirm" | "done" | "verify-current";

const badgeIcon: Record<"lock" | "alert" | "check", ReactNode> = {
	lock: <Lock size={26} strokeWidth={1.7} />,
	alert: <TriangleAlert size={26} strokeWidth={1.7} />,
	check: <Check size={28} strokeWidth={2} />,
};

export default function AppLockSettings({ initialHasPin }: { initialHasPin: boolean }) {
	const { t } = useI18n();

	// `hasPin` è DERIVATO da localStorage, non uno stato proprio: niente
	// `useEffect`+`setState` (render a cascata, vietato dal lint) per
	// riconciliare server e client — lo stesso pattern già in `PwaStatus`.
	// Il cookie letto dal server (`initialHasPin`) è solo il suggerimento per
	// il PRIMO render; da lì `hasStoredPin()` viene riletta a ogni render,
	// compreso quello che segue `savePin()`/`clearPin()` più sotto.
	const hasPin = useSyncExternalStore(
		() => () => {},
		hasStoredPin,
		() => initialHasPin,
	);

	const [step, setStep] = useState<Step>("idle");
	const [afterVerify, setAfterVerify] = useState<"change" | "remove" | null>(null);
	const [firstPin, setFirstPin] = useState<string | null>(null);
	const [rejected, setRejected] = useState(false);
	const [mismatchShowing, setMismatchShowing] = useState(false);

	function reset() {
		setStep("idle");
		setAfterVerify(null);
		setFirstPin(null);
		setRejected(false);
		setMismatchShowing(false);
	}

	function onVerifyCurrent(pin: string) {
		if (pin !== readStoredPin()) {
			setRejected(true);
			setTimeout(() => setRejected(false), APP_LOCK_REJECT_DISPLAY_MS);
			return;
		}
		if (afterVerify === "remove") {
			clearPin();
			reset();
			return;
		}
		// afterVerify === "change": il PIN attuale è confermato, si passa a
		// scegliere quello nuovo — la STESSA schermata dell'impostazione.
		setStep("create-enter");
	}

	function onCreateFirst(pin: string) {
		setFirstPin(pin);
		setStep("create-confirm");
	}

	function onCreateConfirm(pin: string) {
		if (pin !== firstPin) {
			setRejected(true);
			setMismatchShowing(true);
			setTimeout(() => {
				setRejected(false);
				setMismatchShowing(false);
				setFirstPin(null);
				setStep("create-enter");
			}, APP_LOCK_REJECT_DISPLAY_MS);
			return;
		}
		savePin(pin);
		setStep("done");
	}

	/* ---------------------------------------------------------- i quattro/cinque passi --- */

	if (step !== "idle") {
		const length = APP_LOCK_PIN_LENGTH;
		const content =
			step === "verify-current"
				? {
						badge: "lock" as const,
						title: t.appLock.currentTitle,
						subtitle: rejected ? t.appLock.wrongPin : t.appLock.currentSubtitle,
					}
				: step === "create-enter"
					? {
							badge: "lock" as const,
							title: t.appLock.createTitle,
							subtitle: fill(t.appLock.createSubtitle, { length }),
						}
					: step === "create-confirm" && mismatchShowing
						? {
								badge: "alert" as const,
								title: t.appLock.mismatchTitle,
								subtitle: t.appLock.mismatchSubtitle,
							}
						: step === "create-confirm"
							? {
									badge: "lock" as const,
									title: t.appLock.confirmTitle,
									subtitle: fill(t.appLock.confirmSubtitle, { length }),
								}
							: {
									badge: "check" as const,
									title: t.appLock.doneTitle,
									subtitle: fill(t.appLock.doneSubtitle, { length }),
								};

		// Tre tappe: create → confirm → done. "mismatch" resta sulla tappa 2,
		// perché è ancora lo step "create-confirm" (vedi sopra). "verify-current"
		// non fa parte di questo percorso — non è un passo verso un PIN nuovo,
		// è il cancello prima di raggiungerlo, quindi niente indicatore.
		const stepIndex =
			step === "create-enter" ? 1 : step === "create-confirm" ? 2 : step === "done" ? 3 : 0;

		const onComplete =
			step === "verify-current"
				? onVerifyCurrent
				: step === "create-enter"
					? onCreateFirst
					: onCreateConfirm;

		return (
			<div className="flex flex-col items-center pt-4">
				{stepIndex > 0 && (
					<div className="flex justify-center gap-1.75 mb-8">
						{[1, 2, 3].map((i) => (
							<span
								key={i}
								className="w-6.5 h-0.75 rounded-full transition-colors"
								style={{ background: i <= stepIndex ? "var(--color-midori)" : "var(--border)" }}
							/>
						))}
					</div>
				)}

				<div
					className="w-15 h-15 rounded-[22px] flex items-center justify-center mb-5 ring-border"
					style={{
						background: "var(--card)",
						color: content.badge === "alert" ? "var(--color-aka)" : "var(--text-primary)",
						boxShadow:
							content.badge === "alert"
								? "var(--color-aka) 0px 0px 0px 1px inset"
								: undefined,
					}}
				>
					{badgeIcon[content.badge]}
				</div>

				<h2 className="text-lg font-semibold mb-1.5 text-center">{content.title}</h2>
				<p className="text-[12.5px] text-muted leading-relaxed mb-7 text-center max-w-65 min-h-8.5">
					{content.subtitle}
				</p>

				{step === "done" ? (
					<SubmitButton label={t.appLock.doneContinue} onClick={reset} className="mt-2" />
				) : (
					<>
						<PinPad
							key={step}
							length={APP_LOCK_PIN_LENGTH}
							onComplete={onComplete}
							rejected={rejected}
							deleteLabel={t.appLock.deleteKey}
						/>
						{!mismatchShowing && (
							<button
								type="button"
								onClick={reset}
								className="text-[13px] font-medium text-muted underline underline-offset-2 mt-6"
							>
								{t.common.cancel}
							</button>
						)}
					</>
				)}
			</div>
		);
	}

	/* ---------------------------------------------------------- riposo --- */

	return (
		<div>
			<p className="text-[13px] text-muted leading-relaxed mb-7">{t.appLock.disclaimer}</p>

			{!hasPin ? (
				<SubmitButton label={t.appLock.setPin} onClick={() => setStep("create-enter")} />
			) : (
				<div className="space-y-3">
					<SubmitButton
						label={t.appLock.changePin}
						variant="ghost"
						onClick={() => {
							setAfterVerify("change");
							setStep("verify-current");
						}}
					/>
					<SubmitButton
						label={t.appLock.removePin}
						danger
						onClick={() => {
							setAfterVerify("remove");
							setStep("verify-current");
						}}
					/>
				</div>
			)}
		</div>
	);
}
