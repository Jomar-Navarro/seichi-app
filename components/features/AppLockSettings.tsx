"use client";

import { useState, useSyncExternalStore } from "react";
import PinPad from "@/components/UI/PinPad";
import SubmitButton from "@/components/UI/SubmitButton";
import { useI18n } from "@/components/features/I18nProvider";
import { APP_LOCK_PIN_LENGTH, clearPin, hasStoredPin, readStoredPin, savePin } from "@/lib/app-lock";

/**
 * `/impostazioni/blocco` (Fase 26a) — imposta, cambia o rimuove il PIN.
 *
 * ⚠️ Quattro stati soli, non sei: "crea" e "nuovo PIN durante un cambio" sono
 * la STESSA schermata ("Crea un PIN" → "Conferma il PIN") — chi arriva a
 * `create-enter` da `idle` o da `verify-current` non fa differenza per
 * questo componente, solo per come ci è arrivato.
 */
type Step = "idle" | "create-enter" | "create-confirm" | "verify-current";

export default function AppLockSettings({ initialHasPin }: { initialHasPin: boolean }) {
	const { t } = useI18n();

	// `hasPin` è DERIVATO da localStorage, non uno stato proprio: niente
	// `useEffect`+`setState` (render a cascata, vietato dal lint) per
	// riconciliare server e client — lo stesso pattern già in `PwaStatus`
	// per lo stesso motivo. Il cookie letto dal server (`initialHasPin`) è
	// solo il suggerimento per il PRIMO render (evita il lampo "Imposta
	// PIN" su chi ne ha già uno); da lì in poi `hasStoredPin()` viene
	// riletta a ogni render — compreso quello che segue `savePin()`/
	// `clearPin()` più sotto, che è come questo valore si aggiorna senza
	// bisogno di un proprio `setState`.
	const hasPin = useSyncExternalStore(
		() => () => {},
		hasStoredPin,
		() => initialHasPin,
	);

	const [step, setStep] = useState<Step>("idle");
	const [afterVerify, setAfterVerify] = useState<"change" | "remove" | null>(null);
	const [firstPin, setFirstPin] = useState<string | null>(null);
	const [rejected, setRejected] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function reset() {
		setStep("idle");
		setAfterVerify(null);
		setFirstPin(null);
		setError(null);
		setRejected(false);
	}

	function onVerifyCurrent(pin: string) {
		// `pin` è quello appena digitato; l'unico PIN vero è quello salvato.
		if (pin !== readStoredPin()) {
			setRejected(true);
			setError(t.appLock.wrongPin);
			setTimeout(() => setRejected(false), 500);
			return;
		}
		setError(null);
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
		setError(null);
		setStep("create-confirm");
	}

	function onCreateConfirm(pin: string) {
		if (pin !== firstPin) {
			setRejected(true);
			setError(t.appLock.mismatch);
			setTimeout(() => {
				setRejected(false);
				// Si ricomincia da capo, non solo la conferma: due cifre
				// digitate diverse due volte di fila non dicono quale delle
				// due l'utente intendesse davvero.
				setFirstPin(null);
				setStep("create-enter");
			}, 500);
			return;
		}
		savePin(pin);
		reset();
	}

	/* ---------------------------------------------------------- passi di inserimento --- */

	if (step === "verify-current" || step === "create-enter" || step === "create-confirm") {
		const title =
			step === "verify-current"
				? t.appLock.currentTitle
				: step === "create-enter"
					? t.appLock.createTitle
					: t.appLock.confirmTitle;
		const onComplete =
			step === "verify-current" ? onVerifyCurrent : step === "create-enter" ? onCreateFirst : onCreateConfirm;

		return (
			<div className="flex flex-col items-center pt-6">
				<h2 className="text-base font-semibold mb-8 text-center">{title}</h2>
				{/* `key={step}` — senza, "create-enter" e "create-confirm" sono la
				    STESSA istanza di PinPad (stesso punto dell'albero), quindi la
				    seconda eredita il `value` già pieno della prima: ogni pressione
				    successiva trova il pad già a 4/4 cifre e non fa nulla, la
				    schermata resta bloccata su "Conferma il PIN" per sempre. La
				    key forza un'istanza NUOVA a ogni passo, cifre incluse. */}
				<PinPad
					key={step}
					length={APP_LOCK_PIN_LENGTH}
					onComplete={onComplete}
					rejected={rejected}
					deleteLabel={t.appLock.deleteKey}
				/>
				<p
					className="text-[13px] font-medium mt-6 text-center h-5"
					style={{ color: "var(--ink-aka)", opacity: error ? 1 : 0 }}
				>
					{error}
				</p>
				<button
					type="button"
					onClick={reset}
					className="text-[13px] font-medium text-muted underline underline-offset-2 mt-2"
				>
					{t.common.cancel}
				</button>
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
