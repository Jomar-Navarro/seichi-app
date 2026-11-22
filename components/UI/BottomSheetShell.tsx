"use client";

import { useRef, type ReactNode } from "react";
import { useDialog } from "./useDialog";
import { useScrollFocusedIntoView } from "./useScrollFocusedIntoView";

interface BottomSheetShellProps {
	onClose: () => void;
	children: ReactNode;
	/**
	 * L'`id` del titolo visibile del foglio (#165), che dà il nome al dialog.
	 *
	 * ⚠️ Obbligatorio: fino alla #165 c'era un `ariaLabel` facoltativo, e lo
	 * passava solo `CoachBubble` — gli altri quattro fogli erano testo qualunque
	 * per uno screen reader. Il titolo lo disegna il foglio, quindi l'`id` nasce
	 * lì (`useId()`) e il guscio lo collega al pannello.
	 */
	titleId: string;
}

/**
 * Il guscio comune a cinque fogli — Account, Categoria, Obiettivo, Ricorrente,
 * Coach — che prima ripetevano la STESSA struttura, carattere per carattere.
 *
 * ⚠️ Estratto per correggere l'issue #81 (i quadrati di Firefox), e la
 * correzione ha richiesto DUE tentativi.
 *
 * Il primo — `overflow-hidden` sull'elemento che porta insieme
 * `rounded-t-4xl` e `backdrop-blur-2xl` — è la correzione più citata per
 * questo bug, ed è quella sbagliata qui: **provata guardando l'app vera da
 * Firefox, e i quadrati restavano.** Non bastava nemmeno spostare lo scroll
 * su un contenitore interno (che pure serviva per un motivo suo, vedi sotto):
 * il problema non è "manca il ritaglio", è che Firefox non ritaglia bene
 * `backdrop-filter` e `border-radius` **quando stanno sullo stesso elemento**,
 * comunque sia configurato quell'elemento.
 *
 * La correzione che ha retto: separare le due proprietà su elementi DIVERSI.
 *   1. **Guscio** (`rounded-t-4xl overflow-hidden`, bordi, ombra) — NIENTE
 *      `backdrop-filter`. È lui a ritagliare, e lo fa bene perché Firefox non
 *      ha bug su `overflow-hidden` da solo.
 *   2. **Vetro** (`absolute inset-0`, `backdrop-blur-2xl bg-modal`) — riempie
 *      ESATTAMENTE il guscio, e non ha un proprio `border-radius`: niente da
 *      ritagliare male, perché il ritaglio lo fa già il guscio attorno a lui.
 *   3. **Contenuto** (`relative`, dopo il vetro nell'ordine del DOM — dipinge
 *      sopra senza bisogno di uno z-index esplicito) — porta il tetto di
 *      altezza e lo scroll (`maxHeight: 90dvh`, `overflowY: auto`), che PRIMA
 *      stava insieme a `backdrop-filter`+`border-radius` sullo stesso elemento:
 *      era proprio quella combinazione a rendere impossibile un `overflow:
 *      hidden` sul guscio senza spegnere lo scroll insieme ai quadrati.
 *
 * ⚠️ Manico e contenuto restano DENTRO la stessa area che scorre — esattamente
 * come prima: un foglio molto pieno poteva già far scorrere il manico fuori
 * vista. Non è una regressione introdotta qui, è il comportamento di sempre;
 * cambiarlo sarebbe un'altra decisione, non una correzione del rendering.
 *
 * ⚠️⚠️ Un TERZO difetto, trovato dopo, sullo stesso bug: Firefox non ritaglia
 * bene un `border-radius` nemmeno con un `border` traslucido normale, senza
 * alcun `backdrop-filter` di mezzo — verificato dal vivo disattivando SOLO la
 * dichiarazione del bordo, su un elemento che non aveva sfocatura alcuna. Il
 * guscio qui aveva ancora `border-t border-l border-r border-subtle`: fissava
 * il primo bug (sfocatura+raggio) e ricreava il secondo (bordo+raggio) sullo
 * stesso elemento. `modal-shadow-ring` sostituisce il bordo con un
 * `box-shadow: inset`, che Firefox ritaglia correttamente da solo — vedi la
 * nota in `globals.css`.
 *
 * ⚠️ Fase 28d — da `lg:` in su il foglio diventa un dialog CENTRATO, non più
 * ancorato al fondo: `lg:items-center lg:justify-center`, larghezza
 * `lg:max-w-md` (verificato contro il contenuto reale dei cinque fogli —
 * griglie a colonne fisse, mai più strette con più spazio), angoli TUTTI
 * arrotondati (`lg:rounded-4xl`, non solo quelli in alto) e manico nascosto
 * (`lg:hidden`: nessuno swipe da mouse).
 *
 * ⚠️⚠️ L'ombra cambia utility, non solo intensità. `modal-shadow-ring` è
 * un'ombra DIREZIONALE (`0px -24px 70px`, solo verso l'alto): corretta per un
 * foglio il cui fondo è fuori schermo, sbagliata per un dialog che fluttua
 * libero su tutti i lati — mancherebbe l'ombra sotto. `lg:box-shadow-ring`
 * (già esistente in `globals.css` per i box a caduta simmetrica) la
 * sostituisce interamente sopra il breakpoint: stesso schema — classe base +
 * variante `lg:` sulla stessa proprietà — già usato da `LoginForm.tsx` per lo
 * stesso issue #81.
 */
export default function BottomSheetShell({ onClose, children, titleId }: BottomSheetShellProps) {
	// #165 — ruolo, nome, fuoco, sfondo inerte, Esc, e la voce nella
	// cronologia che fa chiudere il foglio a Indietro (#86, #214). Vedi useDialog.
	const { rootRef, dialogProps } = useDialog(onClose, { labelledBy: titleId });

	// issue #69 — il campo a fuoco dentro questo scroll annidato in un
	// `fixed` non finisce da solo sopra la tastiera. Vedi useScrollFocusedIntoView.
	const scrollRef = useRef<HTMLDivElement>(null);
	useScrollFocusedIntoView(scrollRef);

	return (
		<div ref={rootRef} className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center lg:p-6">
			<div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

			{/* `outline-none`: il fuoco arriva sul pannello all'apertura (#165), e
			    un contorno attorno all'intero foglio non indica niente. I comandi
			    dentro tengono il loro. */}
			<div
				{...dialogProps}
				className="relative w-full lg:max-w-md rounded-t-4xl lg:rounded-4xl overflow-hidden modal-shadow-ring lg:box-shadow-ring outline-none"
			>
				{/* Il vetro: riempie il guscio, non ha angoli propri da ritagliare. */}
				<div className="absolute inset-0 bg-modal backdrop-blur-2xl" />

				<div
					ref={scrollRef}
					// issue #69 — overscroll-contain: senza, il rimbalzo a fine scroll
					// di questo contenitore annidato si propaga alla pagina sotto
					// (rubber-band/pull che scappa dal foglio).
					// Fase 28d — `maxHeight` sposta da inline a classi: un valore
					// inline non può differenziarsi per breakpoint, una classe sì.
					className="relative flex flex-col pt-3.5 px-6 scrollbar-none overscroll-contain max-h-[90dvh] lg:max-h-[85dvh]"
					// issue #86 — il foglio è flush col fondo reale dello schermo
					// (`items-end`, nessun margine): senza l'inset l'ultimo elemento
					// finisce ridosso alla home indicator. `max()` perché `pb-8` (32px)
					// resta il minimo voluto anche su un device senza notch, dove
					// l'inset è 0 — altrimenti lì si perderebbe il respiro attuale.
					style={{
						overflowY: "auto",
						paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
					}}
				>
					<div className="w-10 h-1 rounded-full mx-auto mb-1 bg-modal-handle shrink-0 lg:hidden" />
					{children}
				</div>
			</div>
		</div>
	);
}
