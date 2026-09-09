"use client";

import { useRef, useState } from "react";
import { Delete } from "lucide-react";

/**
 * Tastierino numerico per il PIN (Fase 26a) — dal design `PinCard`/
 * `PinSetupCard`: tasti CIRCOLARI con le lettere della tastiera telefonica
 * sotto ogni cifra (puramente decorativo, nessuna funzione), pallini che
 * diventano un ANELLO vuoto invece di un cerchio pieno finché non sono
 * toccati. Non riprende il tastierino importo di `TransactionModal`
 * (issue #86/#81): quello compone un totale, questo conta cifre — stessa
 * ispirazione visiva, logica indipendente.
 */

const LETTERS: Record<string, string> = {
	2: "ABC",
	3: "DEF",
	4: "GHI",
	5: "JKL",
	6: "MNO",
	7: "PQRS",
	8: "TUV",
	9: "WXYZ",
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

/**
 * Assorbe il PROSSIMO click, ovunque cada, una volta sola — poi si toglie.
 *
 * ⚠️ Il "click fantasma": su mobile il browser sintetizza comunque un click
 * di compatibilità dopo un tocco, anche con `preventDefault()` sul
 * `pointerdown` che l'ha preceduto. Di norma non si vede, perché il click
 * arriva sulla STESSA riga toccata. Ma l'ultima cifra del PIN fa scattare
 * `onComplete`, che nel chiamante cambia schermo ALL'ISTANTE (sblocco,
 * passo successivo del wizard…): quando il click sintetico arriva, il
 * tastierino non c'è più, e il browser lo fa atterrare su QUALUNQUE bottone
 * si trovi ORA in quella posizione — non quello che l'utente ha toccato
 * davvero. Sintomo riportato: l'ultima cifra "clicca" un bottone dietro,
 * e porta altrove.
 *
 * Si intercetta in fase di CATTURA (prima che l'evento raggiunga qualunque
 * `onClick` di React) e si cancella subito con `preventDefault` +
 * `stopPropagation`. Il timeout è solo una rete di sicurezza: se nessun
 * click fantasma arrivasse mai (la maggioranza dei casi, la maggior parte
 * dei browser), l'ascoltatore non deve restare armato in attesa di un tocco
 * successivo del tutto legittimo.
 */
function swallowNextClick() {
	const swallow = (e: Event) => {
		e.preventDefault();
		e.stopPropagation();
	};
	document.addEventListener("click", swallow, { capture: true, once: true });
	setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 400);
}

interface PinPadProps {
	length: number;
	/** Chiamato UNA volta, quando l'utente ha digitato tutte le cifre. */
	onComplete: (pin: string) => void;
	/**
	 * Il chiamante ha rifiutato l'ultimo PIN completato: i pallini restano
	 * PIENI e passano al colore d'errore (non si svuotano subito, o l'utente
	 * non farebbe in tempo a vedere che aveva finito di digitare) e il pad si
	 * scuote. Il pad si svuota da sé solo quando `rejected` torna a `false` —
	 * il chiamante decide per quanto tempo tenerlo acceso
	 * (`APP_LOCK_REJECT_DISPLAY_MS`).
	 */
	rejected?: boolean;
	disabled?: boolean;
	/** Testo del tasto cancella per i lettori di schermo — dal dizionario del chiamante. */
	deleteLabel: string;
}

export default function PinPad({ length, onComplete, rejected, disabled, deleteLabel }: PinPadProps) {
	const [value, setValue] = useState("");

	// Svuotamento sincrono al CAMBIO del prop, durante il render — non in un
	// `useEffect` (render a cascata, vietato dal lint qui): è il pattern
	// "adjusting state when a prop changes" di React. Si svuota quando
	// `rejected` torna a FALSE, non quando diventa vero: il design vuole i
	// pallini pieni e rossi visibili per un istante, non un lampo.
	const [prevRejected, setPrevRejected] = useState(rejected);
	if (rejected !== prevRejected) {
		setPrevRejected(rejected);
		if (!rejected) setValue("");
	}

	// `press` è ridefinita a ogni render e chiusa sul `value` di QUESTO render —
	// non serve l'updater funzionale `setValue(v => …)`, e non doverlo usare è
	// ciò che permette a `onComplete` di stare qui invece che dentro l'updater.
	//
	// ⚠️ Ci stava, con `queueMicrotask` a rimandarlo "fuori dal render". Sbagliato:
	// l'updater funzionale può essere invocato PIÙ VOLTE da React (lo fa già in
	// sviluppo, sotto Strict Mode, apposta per scovare updater impuri) — ed
	// `onComplete` con un effetto collaterale dentro era esattamente quell'errore.
	function press(key: string) {
		// ⚠️ `rejected` blocca TUTTO, cancellare compreso — non solo le nuove
		// cifre. Trovato dal code-review: senza, la cancellazione (non era
		// coperta dal controllo `value.length >= length` qui sotto, che vale
		// solo per le cifre) restava viva durante la finestra di lettura
		// dell'errore, e si poteva togliere l'ultima cifra e ridigitarne una
		// diversa — un secondo `onComplete` prima che il primo timer del
		// chiamante fosse scaduto, due tentativi in corsa fra loro.
		if (disabled || rejected || key === "") return;
		if (key === "⌫") {
			setValue(value.slice(0, -1));
			return;
		}
		if (value.length >= length) return;
		const next = value + key;
		setValue(next);
		if (next.length === length) {
			swallowNextClick();
			onComplete(next);
		}
	}

	// ⚠️ Trovato dal code-review: i tasti avevano SOLO `onPointerDown`, mai
	// raggiungibile da tastiera — attivare un bottone a fuoco con Invio o
	// Spazio genera un `click`, non un `pointerdown`, quindi nessuna cifra
	// si poteva mai digitare senza un puntatore. `PinPad` è l'UNICO modo di
	// sbloccare l'app: senza questo, chi naviga solo da tastiera restava
	// chiuso fuori.
	//
	// `onClick` da solo raddoppierebbe la pressione per chi TOCCA lo schermo
	// (pointerdown la esegue già), quindi si distingue con un ref: se il
	// click arriva SUBITO dopo un pointerdown per la stessa cifra, è l'eco
	// di compatibilità del browser per lo stesso gesto — si ignora. Se
	// arriva senza un pointerdown appena precedente, è tastiera. Il timeout
	// è la stessa rete di sicurezza di `swallowNextClick`: se il browser non
	// sintetizzasse mai quell'eco, il flag non deve restare acceso in
	// attesa di un tocco da tastiera successivo e del tutto legittimo.
	const pointerHandledRef = useRef(false);

	function onPointerDownKey(key: string) {
		pointerHandledRef.current = true;
		press(key);
		setTimeout(() => {
			pointerHandledRef.current = false;
		}, 400);
	}
	function onClickKey(key: string) {
		if (pointerHandledRef.current) {
			pointerHandledRef.current = false;
			return;
		}
		press(key);
	}

	return (
		<div>
			<div className={`flex items-center justify-center gap-3.75 mb-8 ${rejected ? "zg-shake" : ""}`}>
				{Array.from({ length }).map((_, i) => {
					const filled = i < value.length;
					return (
						<span
							key={i}
							className="w-3.25 h-3.25 rounded-full transition-colors"
							style={
								filled
									? {
											background: rejected ? "var(--color-aka)" : "var(--color-midori)",
											transform: "scale(1.08)",
										}
									: {
											background: "transparent",
											boxShadow: `inset 0 0 0 1.5px ${rejected ? "var(--color-aka)" : "var(--border)"}`,
										}
							}
						/>
					);
				})}
			</div>

			<div className="grid grid-cols-3 gap-4 justify-items-center">
				{KEYS.map((key, i) => {
					if (key === "") return <div key={i} className="w-19 h-19" />;
					const letters = LETTERS[key];
					const isDelete = key === "⌫";
					return (
						<button
							key={i}
							type="button"
							disabled={disabled}
							onPointerDown={(e) => {
								e.preventDefault();
								onPointerDownKey(key);
							}}
							onClick={() => onClickKey(key)}
							aria-label={isDelete ? deleteLabel : key}
							className={
								isDelete
									? "w-19 h-19 rounded-full flex items-center justify-center text-muted active:opacity-70 disabled:opacity-50"
									: "w-19 h-19 rounded-full bg-card ring-border flex flex-col items-center justify-center gap-0.5 active:opacity-70 disabled:opacity-50"
							}
						>
							{isDelete ? (
								<Delete size={21} />
							) : (
								<>
									<span className="text-2xl font-medium">{key}</span>
									{/* Puramente decorativo — la tastiera telefonica del design,
									    non un aiuto funzionale: nessuna lingua le tratta diversamente. */}
									<span className="text-[8.5px] font-medium tracking-[1.4px] text-muted h-2.5">
										{letters ?? ""}
									</span>
								</>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
