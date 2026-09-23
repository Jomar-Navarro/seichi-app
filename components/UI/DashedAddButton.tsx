import { Plus } from "lucide-react";

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
 * pagine: scritto due volte, il tratteggio e il raggio divergerebbero alla
 * prima modifica, come le due geometrie dell'interruttore prima di
 * `SwitchVisual` (Fase 18).
 *
 * ⚠️ Il tratteggio è un SVG, non un `border-dashed`. Un bordo di colore
 * traslucido (`--border` è sempre `rgba`) su un elemento arrotondato è proprio
 * il difetto di Firefox della issue #81, e l'anello con cui lo si è chiuso
 * ovunque — un `box-shadow` — non sa disegnare un tratteggio: è la ragione per
 * cui il riquadro di `ImportFlow` era rimasto un residuo dichiarato. Un
 * `<rect>` con `stroke-dasharray` si arrotonda con `rx` in ogni motore.
 *
 * ⚠️ Il tratto è largo 1 e il rettangolo è rientrato di mezzo pixel, con
 * l'`<svg>` in `overflow-visible`: così la linea va dal bordo del riquadro a
 * 1px verso l'interno su TUTTO il perimetro. La prima stesura usava un tratto
 * da 2 ritagliato a metà dall'svg — ma il ritaglio agisce solo sui lati dritti:
 * gli archi degli angoli stanno dentro il riquadro, e lì il tratto restava
 * intero, angoli da 2px su lati da 1px (review del #108).
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
			<svg
				aria-hidden
				className="absolute left-[0.5px] top-[0.5px] w-[calc(100%-1px)] h-[calc(100%-1px)] overflow-visible pointer-events-none"
			>
				<rect
					width="100%"
					height="100%"
					rx={radius - 0.5}
					ry={radius - 0.5}
					fill="none"
					strokeWidth={1}
					strokeDasharray="6 5"
					className="stroke-subtle transition-colors group-hover:stroke-muted"
				/>
			</svg>
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
