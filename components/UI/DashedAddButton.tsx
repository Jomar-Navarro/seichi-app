import { Plus } from "lucide-react";
import DashedBorder from "./DashedBorder";

interface DashedAddButtonProps {
	label: string;
	onClick: () => void;
	/**
	 * "row": una riga in fondo a una lista (Conti — icona e testo in linea);
	 * "tile": una tessera in fondo a una griglia (Obiettivi — icona sopra il
	 * testo, alta quanto le card accanto).
	 */
	variant?: "row" | "tile";
	className?: string;
}

/**
 * Il riquadro tratteggiato "Nuovo …" che chiude una lista o una griglia
 * (issue #108 — mockup desktop di Conti e Obiettivi). Uno solo per le due
 * pagine: scritto due volte, il raggio e il resto del disegno divergerebbero
 * alla prima modifica, come le due geometrie dell'interruttore prima di
 * `SwitchVisual` (Fase 18).
 *
 * Il tratteggio stesso è `DashedBorder.tsx`, condiviso anche col bottone
 * "Aggiungi ricevuta" di `AttachmentPicker` (issue #126) — vedi lì per il
 * perché è un SVG e non un `border-dashed`.
 */
export default function DashedAddButton({
	label,
	onClick,
	variant = "row",
	className = "",
}: DashedAddButtonProps) {
	const tile = variant === "tile";
	// Gli stessi raggi delle card accanto (22 le righe conto, 26 le card
	// obiettivo), o il tratteggio non combacerebbe con la lista che chiude.
	const radius = tile ? 26 : 22;

	return (
		<button
			type="button"
			onClick={onClick}
			className={`group relative w-full flex items-center justify-center text-muted cursor-pointer transition-colors hover:bg-surface ${
				tile ? "flex-col gap-3 p-6 min-h-54" : "gap-2.5 p-4.5"
			} ${className}`}
			style={{ borderRadius: radius }}
		>
			<DashedBorder radius={radius} />
			{tile ? (
				<span className="w-10.5 h-10.5 rounded-[14px] bg-control flex items-center justify-center">
					<Plus size={19} strokeWidth={1.8} />
				</span>
			) : (
				<Plus size={17} strokeWidth={1.8} />
			)}
			<span className="text-[13.5px] font-medium">{label}</span>
		</button>
	);
}
