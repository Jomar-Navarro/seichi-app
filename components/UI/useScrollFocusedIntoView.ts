"use client";

import { useEffect, type RefObject } from "react";

/**
 * Tempo lasciato alla tastiera per aprirsi (e al layout viewport, già
 * ristretto da `interactive-widget=resizes-content` in `app/layout.tsx`, per
 * assestarsi) prima di misurare dove serve scorrere. Troppo corto e si
 * misura contro una geometria ancora vecchia; non c'è un evento del browser
 * a cui agganciarsi con certezza — l'animazione della tastiera su iOS dura
 * sui 250-300ms.
 */
const SCROLL_INTO_VIEW_DELAY_MS = 300;

const NON_TEXT_INPUT_TYPES = new Set([
	"checkbox",
	"radio",
	"range",
	"color",
	"file",
	"button",
	"submit",
	"reset",
	"image",
]);

function isTextEntry(el: HTMLElement): boolean {
	if (el instanceof HTMLTextAreaElement) return true;
	if (el instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(el.type);
	return false;
}

/**
 * issue #69 (Fase 27, punto 4 — tastiera). `interactive-widget=resizes-content`
 * (`app/layout.tsx`) fa sì che il layout viewport si restringa quando compare
 * la tastiera, ed è il prerequisito perché `dvh` e un bottone `fixed` restino
 * sopra di lei — ma non basta da solo.
 *
 * ⚠️ Lo scroll automatico "porta il campo a fuoco dentro l'area visibile" che
 * i browser fanno di serie per un `<input>` è un'euristica pensata per lo
 * scroll del DOCUMENTO. Non è affidabile per un contenitore `overflow-y: auto`
 * annidato dentro un antenato `position: fixed` — che è la forma di OGNI
 * foglio di questo progetto (`BottomSheetShell`, il form dentro
 * `TransactionModal`): quel contenitore non fa parte dello scroll principale
 * che l'euristica nativa considera.
 *
 * Un `ref` al div che scorre: un `focusin` su un campo di testo al suo
 * interno lo riporta in vista da solo, con un margine (`block: "center"`)
 * invece di incollarlo al bordo — dove tornerebbe a toccare la tastiera al
 * primo pixel di scroll accidentale.
 */
export function useScrollFocusedIntoView(containerRef: RefObject<HTMLElement | null>) {
	useEffect(() => {
		const maybeContainer = containerRef.current;
		if (!maybeContainer) return;
		// Tipo esplicito non-null: senza, TS resetta la narrowing di
		// `maybeContainer` dentro `handleFocusIn` (una funzione che il
		// controllo di flusso tratta come invocabile in un momento futuro
		// imprecisato, quindi non fidabile).
		const container: HTMLElement = maybeContainer;

		let timer: ReturnType<typeof setTimeout> | null = null;

		/*
		 * ⚠️ In ascolto sul DOCUMENTO, non sul contenitore, e ogni focusin
		 * annulla PRIMA di guardare dove sia andato il focus — non solo
		 * quando il nuovo bersaglio è un campo di testo.
		 *
		 * La prima versione ascoltava solo sul contenitore e usciva subito
		 * per un bersaglio non testuale: spostare il focus dalla descrizione
		 * al bottone della data (`DatePicker`, un `<button>`) entro i 300ms
		 * lasciava il timer del campo precedente VIVO, e scattava sul campo
		 * ormai sfocato mentre l'utente stava scegliendo la data — un salto
		 * di scroll a metà gesto. Un caso gemello: il bottone "Salva" di
		 * `TransactionForm` è un FRATELLO del contenitore che scorre (non un
		 * suo discendente), quindi un focusin lì non faceva nemmeno scattare
		 * l'ascoltatore — stesso timer fantasma, mai annullato.
		 *
		 * Ascoltare sul documento e verificare `contains()` qui dentro
		 * risolve entrambi: qualunque cambio di focus, ovunque avvenga,
		 * annulla il pendente; se ne pianifica uno nuovo solo quando il
		 * bersaglio è DENTRO questo contenitore ed è un campo di testo.
		 */
		function handleFocusIn(e: FocusEvent) {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}

			const target = e.target;
			if (
				!(target instanceof HTMLElement) ||
				!container.contains(target) ||
				!isTextEntry(target)
			) {
				return;
			}

			timer = setTimeout(() => {
				target.scrollIntoView({ block: "center", behavior: "smooth" });
			}, SCROLL_INTO_VIEW_DELAY_MS);
		}

		document.addEventListener("focusin", handleFocusIn);
		return () => {
			document.removeEventListener("focusin", handleFocusIn);
			if (timer) clearTimeout(timer);
		};
		// `containerRef` in dipendenza: è un useRef, stabile per l'intera vita
		// del componente, quindi non fa rigirare l'effetto — lo dichiara senza
		// bisogno di un eslint-disable.
	}, [containerRef]);
}
