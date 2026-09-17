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
		const container = containerRef.current;
		if (!container) return;

		let timer: ReturnType<typeof setTimeout> | null = null;

		function handleFocusIn(e: FocusEvent) {
			const target = e.target;
			if (!(target instanceof HTMLElement) || !isTextEntry(target)) return;

			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				target.scrollIntoView({ block: "center", behavior: "smooth" });
			}, SCROLL_INTO_VIEW_DELAY_MS);
		}

		container.addEventListener("focusin", handleFocusIn);
		return () => {
			container.removeEventListener("focusin", handleFocusIn);
			if (timer) clearTimeout(timer);
		};
		// `containerRef` in dipendenza: è un useRef, stabile per l'intera vita
		// del componente, quindi non fa rigirare l'effetto — lo dichiara senza
		// bisogno di un eslint-disable.
	}, [containerRef]);
}
