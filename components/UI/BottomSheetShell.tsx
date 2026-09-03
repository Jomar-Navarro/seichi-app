"use client";

import type { ReactNode } from "react";

interface BottomSheetShellProps {
	onClose: () => void;
	children: ReactNode;
	/**
	 * ⚠️ Opzionale, e non un dimenticanza da colmare per gli altri quattro
	 * fogli: solo `CoachBubble` aveva già `role="dialog"` prima di questa
	 * estrazione. Aggiungerlo agli altri quattro sarebbe una correzione di
	 * accessibilità — legittima, ma un'altra fase, non un effetto collaterale
	 * di una correzione di rendering. Quando presente, va sul pannello — è lì
	 * che appartiene semanticamente il ruolo — non sul contenuto interno.
	 */
	ariaLabel?: string;
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
 */
export default function BottomSheetShell({ onClose, children, ariaLabel }: BottomSheetShellProps) {
	return (
		<div className="fixed inset-0 z-50 flex items-end">
			<div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

			<div
				{...(ariaLabel ? { role: "dialog", "aria-modal": true, "aria-label": ariaLabel } : {})}
				className="relative w-full rounded-t-4xl modal-shadow border-t border-l border-r border-subtle overflow-hidden"
			>
				{/* Il vetro: riempie il guscio, non ha angoli propri da ritagliare. */}
				<div className="absolute inset-0 bg-modal backdrop-blur-2xl" />

				<div
					className="relative flex flex-col pt-3.5 px-6 pb-8"
					style={{ maxHeight: "90dvh", overflowY: "auto" }}
				>
					<div className="w-10 h-1 rounded-full mx-auto mb-1 bg-modal-handle shrink-0" />
					{children}
				</div>
			</div>
		</div>
	);
}
