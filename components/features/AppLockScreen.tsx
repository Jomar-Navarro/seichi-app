"use client";

import { useState, useTransition } from "react";
import { Sprout } from "lucide-react";
import PinPad from "@/components/UI/PinPad";
import { useI18n } from "@/components/features/I18nProvider";
import { APP_LOCK_PIN_LENGTH, clearPin, readStoredPin } from "@/lib/app-lock";
import { signOut } from "@/app/(main)/impostazioni/actions";

/**
 * Schermata di sblocco (Fase 26a) — velo a schermo intero, montato da
 * `AppLockProvider` finché `locked` è vero. Nessun modo di attraversarla
 * senza il PIN corretto: niente tap-fuori, niente Esc.
 *
 * ⚠️ Copre il contenuto SOTTO di sé, ma non lo sostituisce: `{children}`
 * resta montato nel DOM (è un Server Component, i numeri sono già nell'HTML
 * arrivato dal server — vedi `lib/app-lock.ts`). Coerente con la promessa
 * dichiarata nell'issue #67: blocco dell'interfaccia, non dei dati.
 */

/** Dopo quanti errori mostrare la via d'uscita, non subito — un comando
 *  sempre visibile e per lo più inerte insegna a ignorarlo (stessa regola
 *  di "Azzera filtri", issue #9). */
const SHOW_ESCAPE_AFTER_ATTEMPTS = 3;

export default function AppLockScreen({ onUnlock }: { onUnlock: () => void }) {
	const { t } = useI18n();
	const [rejected, setRejected] = useState(false);
	const [attempts, setAttempts] = useState(0);
	const [signingOut, startSignOut] = useTransition();

	function check(pin: string) {
		if (pin === readStoredPin()) {
			onUnlock();
			return;
		}
		setRejected(true);
		setAttempts((n) => n + 1);
		// `rejected` torna false all'inizio del prossimo tentativo: PinPad
		// legge il fronte di salita per svuotarsi e scuotersi, non il valore
		// sostenuto — un secondo errore di fila non riscuoterebbe altrimenti.
		setTimeout(() => setRejected(false), 500);
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

				<h1 className="text-lg font-semibold mb-1.5 text-center">{t.appLock.unlockTitle}</h1>
				<p className="text-[13px] text-muted mb-9 text-center">{t.appLock.enterPin}</p>

				<PinPad
					length={APP_LOCK_PIN_LENGTH}
					onComplete={check}
					rejected={rejected}
					disabled={signingOut}
					deleteLabel={t.appLock.deleteKey}
				/>

				<p
					className="text-[13px] font-medium mt-6 text-center h-5"
					style={{ color: "var(--ink-aka)", opacity: rejected ? 1 : 0 }}
				>
					{t.appLock.wrongPin}
				</p>

				{attempts >= SHOW_ESCAPE_AFTER_ATTEMPTS && (
					<button
						type="button"
						onClick={forgotPin}
						disabled={signingOut}
						className="text-[13px] font-medium text-muted underline underline-offset-2 mt-4 disabled:opacity-50"
					>
						{signingOut ? "…" : t.appLock.forgotPin}
					</button>
				)}
			</div>
		</div>
	);
}
