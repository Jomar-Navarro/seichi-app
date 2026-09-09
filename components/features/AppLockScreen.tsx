"use client";

import { useState, useTransition } from "react";
import { Sprout } from "lucide-react";
import PinPad from "@/components/UI/PinPad";
import { useI18n } from "@/components/features/I18nProvider";
import { fill } from "@/lib/i18n/format";
import {
	APP_LOCK_PIN_LENGTH,
	APP_LOCK_REJECT_DISPLAY_MS,
	clearPin,
	readStoredPin,
} from "@/lib/app-lock";
import { signOut } from "@/app/(main)/impostazioni/actions";

/**
 * Schermata di sblocco (Fase 26a) — velo a schermo intero, montato da
 * `AppLockProvider` finché `locked` è vero. Nessun modo di attraversarla
 * senza il PIN corretto: niente tap-fuori, niente Esc.
 *
 * Dal design (`PinCard.dc.html`): titolo e sottotitolo SCAMBIANO contenuto
 * quando il PIN è sbagliato, invece di aggiungere un terzo blocco di testo —
 * "Bentornato" diventa "PIN non corretto", non un avviso in più sotto.
 *
 * ⚠️ Copre il contenuto SOTTO di sé, ma non lo sostituisce: `{children}`
 * resta montato nel DOM (è un Server Component, i numeri sono già nell'HTML
 * arrivato dal server — vedi `lib/app-lock.ts`). Coerente con la promessa
 * dichiarata nell'issue #67: blocco dell'interfaccia, non dei dati.
 *
 * ⚠️ Il design mostra anche "Restano N tentativi prima del blocco
 * temporaneo" e un tasto impronta/"Usa la password". Non adottati: qui non
 * c'è né un blocco temporaneo reale né un secondo fattore biometrico — dirlo
 * sarebbe promettere ciò che l'app non fa. Resta la via d'uscita onesta già
 * costruita: "Esci e accedi di nuovo".
 *
 * ⚠️ Quella frase era scritta nel dizionario (`signOutAndReset`) ma MAI
 * collegata — trovato dal code-review: il bottone usava
 * `t.appLock.forgotPin` ("Hai dimenticato il PIN?") come UNICA etichetta,
 * e un tocco eseguiva `forgotPin()` all'istante — sign-out immediato senza
 * conferma, dietro una domanda che non lo lasciava intuire. Ora è in due
 * passi, come `DeleteAccountFlow`: il primo tocco rivela il comando VERO
 * (`signOutAndReset`), il secondo lo esegue.
 */

/** Dopo quanti errori mostrare la via d'uscita, non subito — un comando
 *  sempre visibile e per lo più inerte insegna a ignorarlo (stessa regola
 *  di "Azzera filtri", issue #9). */
const SHOW_ESCAPE_AFTER_ATTEMPTS = 3;

export default function AppLockScreen({ onUnlock }: { onUnlock: () => void }) {
	const { t } = useI18n();
	const [rejected, setRejected] = useState(false);
	const [attempts, setAttempts] = useState(0);
	const [confirmingForgot, setConfirmingForgot] = useState(false);
	const [signingOut, startSignOut] = useTransition();

	function check(pin: string) {
		if (pin === readStoredPin()) {
			onUnlock();
			return;
		}
		setRejected(true);
		setAttempts((n) => n + 1);
		// `rejected` torna false dopo la finestra di lettura dell'errore, non
		// subito: i pallini restano pieni e rossi abbastanza a lungo perché
		// l'utente veda che il PIN digitato è stato letto ed era sbagliato,
		// invece di sparire nell'istante stesso in cui finisce di digitare.
		setTimeout(() => setRejected(false), APP_LOCK_REJECT_DISPLAY_MS);
	}

	function forgotPin() {
		startSignOut(async () => {
			// `clearPin()` PRIMA, non dopo: `signOut()` fa `redirect()` di suo,
			// cioè lancia e non ritorna mai — qualunque riga scritta DOPO
			// `await signOut()` non girerebbe mai, quindi il PIN non verrebbe
			// mai tolto. Nel caso raro in cui `signOut()` fallisse davvero
			// (rete assente), resta un residuo accettabile: il blocco sparisce
			// ma la sessione resta quella di prima — non un utente chiuso fuori.
			clearPin();
			await signOut();
		});
	}

	return (
		<div
			className="fixed inset-0 z-60 flex flex-col items-center justify-center px-7 overflow-hidden"
			style={{ background: "var(--background)" }}
		>
			<div className="circle-1" />
			<div className="circle-3" />

			<div className="relative flex flex-col items-center w-full max-w-xs">
				<div className="relative w-16 h-16 rounded-3xl ring-border overflow-hidden mb-6">
					<div className="absolute inset-0 bg-surface-elevated backdrop-blur-md" />
					<div className="relative w-full h-full flex items-center justify-center">
						<Sprout size={28} className="text-midori" />
					</div>
				</div>

				<h1 className="text-lg font-semibold mb-1.5 text-center">
					{rejected ? t.appLock.wrongPinTitle : t.appLock.unlockTitle}
				</h1>
				<p className="text-[13px] text-muted mb-9 text-center min-h-8.5">
					{rejected
						? t.appLock.wrongPin
						: fill(t.appLock.enterPin, { length: APP_LOCK_PIN_LENGTH })}
				</p>

				<PinPad
					length={APP_LOCK_PIN_LENGTH}
					onComplete={check}
					rejected={rejected}
					disabled={signingOut}
					deleteLabel={t.appLock.deleteKey}
				/>

				{attempts >= SHOW_ESCAPE_AFTER_ATTEMPTS &&
					(confirmingForgot ? (
						<button
							type="button"
							onClick={forgotPin}
							disabled={signingOut}
							className="text-[13px] font-semibold mt-7 disabled:opacity-50"
							style={{ color: "var(--ink-aka)" }}
						>
							{signingOut ? "…" : t.appLock.signOutAndReset}
						</button>
					) : (
						<button
							type="button"
							onClick={() => setConfirmingForgot(true)}
							className="text-[13px] font-medium text-muted underline underline-offset-2 mt-7"
						>
							{t.appLock.forgotPin}
						</button>
					))}
			</div>
		</div>
	);
}
