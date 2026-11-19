"use client";

import type { ReactNode } from "react";
import { useDialog } from "./useDialog";

interface ConfirmDialogProps {
	/** Il titolo visibile, che è anche il nome del dialog. */
	title: string;
	onClose: () => void;
	/** Il corpo e i comandi: la domanda, l'eventuale errore, Annulla e conferma. */
	children: ReactNode;
}

/**
 * Il guscio delle conferme centrate (#165): eliminare una categoria, eliminare
 * una ricorrente.
 *
 * Fino alla #165 i due blocchi erano ricopiati a mano in `CategoryManager` e
 * `RecurringManager`, e nessuno dei due era un dialog: niente ruolo, niente
 * nome, sfondo raggiungibile col Tab. Un guscio solo, perché la correzione non
 * si applichi a uno e non al suo gemello (lezione 3 di CLAUDE.md).
 *
 * Si monta all'apertura, come ogni pannello: `{pending && <ConfirmDialog />}`.
 *
 * ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto.
 */
export default function ConfirmDialog({ title, onClose, children }: ConfirmDialogProps) {
	const { rootRef, dialogProps, titleId } = useDialog(onClose);

	return (
		<div ref={rootRef} className="fixed inset-0 z-50 flex items-center justify-center px-8">
			<div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
			{/* `outline-none`: il fuoco arriva sul pannello all'apertura. */}
			<div
				{...dialogProps}
				className="relative w-full max-w-xs rounded-3xl overflow-hidden modal-shadow-ring outline-none"
			>
				<div className="absolute inset-0 bg-modal backdrop-blur-2xl" />
				<div className="relative p-6">
					<h3 id={titleId} className="text-[17px] font-semibold mb-2">
						{title}
					</h3>
					{children}
				</div>
			</div>
		</div>
	);
}
