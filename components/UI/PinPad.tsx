"use client";

import { useState } from "react";
import { Delete } from "lucide-react";

/**
 * Tastierino numerico per il PIN (Fase 26a) — griglia 3 colonne come il
 * tastierino importo di `TransactionModal` (issue #86/#81: card semplice,
 * anello invece di bordo), ma logica propria: qui non c'è un totale da
 * comporre, solo N cifre da contare.
 */

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

interface PinPadProps {
	length: number;
	/** Chiamato UNA volta, quando l'utente ha digitato tutte le cifre. */
	onComplete: (pin: string) => void;
	/**
	 * Il chiamante ha rifiutato l'ultimo PIN completato: il pad si scuote e si
	 * svuota da solo. Non si svuota MAI da sé al completamento — sennò un
	 * secondo tentativo partirebbe da un pad già vuoto senza che l'utente
	 * abbia visto perché.
	 */
	rejected?: boolean;
	disabled?: boolean;
	/** Testo del tasto cancella per i lettori di schermo — dal dizionario del chiamante. */
	deleteLabel: string;
}

export default function PinPad({ length, onComplete, rejected, disabled, deleteLabel }: PinPadProps) {
	const [value, setValue] = useState("");

	// Svuotamento sincrono al CAMBIO del prop, durante il render — non in un
	// `useEffect` (che qui darebbe un render a cascata evitabile, vietato dal
	// lint): è il pattern "adjusting state when a prop changes" di React.
	// `prevRejected` è l'unico modo di sapere, durante il render, se `rejected`
	// è appena diventato vero rispetto al giro precedente.
	const [prevRejected, setPrevRejected] = useState(rejected);
	if (rejected !== prevRejected) {
		setPrevRejected(rejected);
		if (rejected) setValue("");
	}

	// `press` è ridefinita a ogni render e chiusa sul `value` di QUESTO render —
	// non serve l'updater funzionale `setValue(v => …)`, e non doverlo usare è
	// ciò che permette a `onComplete` di stare qui invece che dentro l'updater.
	//
	// ⚠️ Ci stava, con `queueMicrotask` a rimandarlo "fuori dal render". Sbagliato:
	// l'updater funzionale può essere invocato PIÙ VOLTE da React (lo fa già in
	// sviluppo, sotto Strict Mode, apposta per scovare updater impuri) — ed
	// `onComplete` con un effetto collaterale dentro era esattamente quell'errore.
	// Il sintomo: sulla schermata di blocco i tentativi falliti salivano di 2 alla
	// volta, e "hai dimenticato il PIN?" compariva dopo 2 cifre digitate, non 3.
	function press(key: string) {
		if (disabled || key === "") return;
		if (key === "⌫") {
			setValue(value.slice(0, -1));
			return;
		}
		if (value.length >= length) return;
		const next = value + key;
		setValue(next);
		if (next.length === length) onComplete(next);
	}

	return (
		<div>
			<div className={`flex items-center justify-center gap-4 mb-10 ${rejected ? "zg-shake" : ""}`}>
				{Array.from({ length }).map((_, i) => (
					<span
						key={i}
						className="w-3.5 h-3.5 rounded-full transition-colors"
						style={{
							background: i < value.length ? "var(--color-midori)" : "var(--seg-bg)",
						}}
					/>
				))}
			</div>

			<div className="grid grid-cols-3 gap-3">
				{KEYS.map((key, i) =>
					key === "" ? (
						<div key={i} />
					) : (
						<button
							key={i}
							type="button"
							disabled={disabled}
							onPointerDown={(e) => {
								e.preventDefault();
								press(key);
							}}
							aria-label={key === "⌫" ? deleteLabel : key}
							className="h-16 rounded-2xl bg-card ring-border text-2xl font-medium flex items-center justify-center active:opacity-70 disabled:opacity-50"
						>
							{key === "⌫" ? <Delete size={20} /> : key}
						</button>
					),
				)}
			</div>
		</div>
	);
}
