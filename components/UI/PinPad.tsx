"use client";

import { useRef, useState } from "react";
import { Delete, Fingerprint } from "lucide-react";

/**
 * Tastierino numerico per il PIN (Fase 26a) — dal design `PinCard`/
 * `PinSetupCard`: tasti CIRCOLARI con le lettere della tastiera telefonica
 * sotto ogni cifra (puramente decorativo, nessuna funzione), pallini che
 * diventano un ANELLO vuoto invece di un cerchio pieno finché non sono
 * toccati. Non riprende il tastierino importo di `TransactionModal`
 * (issue #86/#81): quello compone un totale, questo conta cifre — stessa
 * ispirazione visiva, logica indipendente.
 *
 * ⚠️ L'accesso biometrico, quando c'è, occupa il tasto in basso a sinistra
 * (dove sul tastierino telefonico sta l'asterisco) — dal design aggiornato:
 * non più un bottone separato sopra il pad. `AppLockScreen` decide se
 * passare `onBiometric`; senza, quella casella resta vuota come prima.
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
 * Vero se `key` è già la stessa cifra registrata da `ref` meno di
 * `windowMs` fa — e in ogni caso aggiorna `ref` al tentativo corrente.
 *
 * ⚠️ A livello di MODULO, non dentro `PinPad`: `Date.now()` è una chiamata
 * impura, e il lint di questo progetto la vieta nel corpo di un componente
 * (anche in una funzione annidata come `press`) — stesso motivo per cui
 * `chiaveLocale()` in `AttachmentPicker.tsx` vive fuori dal suo componente.
 * `ref` arriva come parametro esplicito invece che per chiusura.
 */
function isDuplicatePress(
	ref: { current: { key: string; time: number } | null },
	key: string,
	windowMs: number,
): boolean {
	const now = Date.now();
	const last = ref.current;
	const duplicate = last !== null && last.key === key && now - last.time < windowMs;
	ref.current = { key, time: now };
	return duplicate;
}

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
	/** Se presente, sostituisce con l'icona biometrica la casella vuota in
	 *  basso a sinistra della griglia. Il chiamante decide quando c'è
	 *  (`hasBiometricCredential()`), non questo componente. */
	onBiometric?: () => void;
	/** Aria-label del tasto biometrico — richiesto insieme a `onBiometric`. */
	biometricLabel?: string;
}

export default function PinPad({
	length,
	onComplete,
	rejected,
	disabled,
	deleteLabel,
	onBiometric,
	biometricLabel,
}: PinPadProps) {
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
	//
	// ⚠️ Trovato ancora sul telefono, dopo il fix del contatore qui sopra: quel
	// contatore accoppia un pointerdown con IL SUO click fantasma, ma non può
	// vedere un secondo `pointerdown` DUPLICATO per lo stesso tocco fisico
	// (hardware/browser che sintetizza due volte l'evento di discesa) — lì
	// sono due pressioni "legittime" dal suo punto di vista, perché non ha
	// modo di sapere che nascono dallo stesso dito. Serve una difesa
	// indipendente, sullo stesso RISULTATO invece che sulla causa: se la
	// STESSA cifra arriva due volte a meno di 300ms di distanza è quasi
	// certamente un duplicato, qualunque sia la sua origine — un dito vero
	// raramente ripete lo stesso tasto così in fretta, anche digitando svelto.
	const lastPressRef = useRef<{ key: string; time: number } | null>(null);

	function press(key: string) {
		// ⚠️ `rejected` blocca TUTTO, cancellare compreso — non solo le nuove
		// cifre. Trovato dal code-review: senza, la cancellazione (non era
		// coperta dal controllo `value.length >= length` qui sotto, che vale
		// solo per le cifre) restava viva durante la finestra di lettura
		// dell'errore, e si poteva togliere l'ultima cifra e ridigitarne una
		// diversa — un secondo `onComplete` prima che il primo timer del
		// chiamante fosse scaduto, due tentativi in corsa fra loro.
		if (disabled || rejected || key === "") return;
		if (isDuplicatePress(lastPressRef, key, 300)) return;

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
	// (pointerdown la esegue già), quindi si distingue con un CONTATORE: ogni
	// click fantasma si accoppia al PIÙ VECCHIO pointerdown non ancora
	// confermato, invece che a "un pointerdown qualsiasi appena successo".
	//
	// ⚠️ Trovato usando l'app vera, digitando in fretta: con un booleano solo
	// (versione precedente) due tocchi ravvicinati su cifre DIVERSE potevano
	// far "rubare" il reset al click sbagliato — pointerdown(A) alza il
	// flag, pointerdown(B) lo trova già alzato (nessun danno), il click
	// fantasma di A lo consuma correttamente PER SÉ ma lo riporta a `false`
	// anche per B, e il click fantasma di B — trovando il flag già basso —
	// veniva scambiato per un tocco da tastiera vero: la cifra B risultava
	// digitata due volte. Un contatore non ha questa ambiguità: ogni
	// pointerdown incrementa, ogni click consuma UNA unità qualunque cifra
	// l'abbia generata, quindi il conteggio resta corretto anche quando i
	// gesti di due tasti diversi si intrecciano.
	const pendingPointerPressesRef = useRef(0);

	// Generalizzata rispetto alla versione originale (che prendeva solo una
	// cifra) perché il tasto biometrico ha bisogno della STESSA deduplica
	// pointerdown/click, non di una copia scritta apposta — due implementazioni
	// dello stesso meccanismo sarebbero due occasioni di farle divergere.
	function onPointerDownAction(action: () => void) {
		pendingPointerPressesRef.current += 1;
		action();
		setTimeout(() => {
			pendingPointerPressesRef.current = Math.max(0, pendingPointerPressesRef.current - 1);
		}, 400);
	}
	function onClickAction(action: () => void) {
		if (pendingPointerPressesRef.current > 0) {
			pendingPointerPressesRef.current -= 1;
			return;
		}
		action();
	}
	function onPointerDownKey(key: string) {
		onPointerDownAction(() => press(key));
	}
	function onClickKey(key: string) {
		onClickAction(() => press(key));
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
					if (key === "") {
						if (!onBiometric) return <div key={i} className="w-19 h-19" />;
						return (
							<button
								key={i}
								type="button"
								disabled={disabled}
								onPointerDown={(e) => {
									e.preventDefault();
									onPointerDownAction(onBiometric);
								}}
								onClick={() => onClickAction(onBiometric)}
								aria-label={biometricLabel}
								// `touch-manipulation` (`touch-action: manipulation`): toglie al
								// browser l'ambiguità del doppio-tocco-per-zoom, la causa più
								// comune di eventi fantasma duplicati su bottoni non nativi.
								className="w-19 h-19 rounded-full flex items-center justify-center text-midori active:opacity-70 disabled:opacity-50 touch-manipulation"
							>
								<Fingerprint size={26} />
							</button>
						);
					}
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
							// `touch-manipulation`: vedi il commento sul tasto biometrico.
							className={
								isDelete
									? "w-19 h-19 rounded-full flex items-center justify-center text-muted active:opacity-70 disabled:opacity-50 touch-manipulation"
									: "w-19 h-19 rounded-full bg-card ring-border flex flex-col items-center justify-center gap-0.5 active:opacity-70 disabled:opacity-50 touch-manipulation"
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
