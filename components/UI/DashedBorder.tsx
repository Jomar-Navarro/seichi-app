interface DashedBorderProps {
	/** Lo stesso raggio dell'elemento che lo ospita, in px. */
	radius: number;
}

/**
 * Il tratteggio dell'issue #81, in SVG e non in `border-dashed`.
 *
 * ⚠️ Un bordo di colore traslucido (`--border` è sempre `rgba`) su un angolo
 * arrotondato è il difetto Firefox della #81, e l'anello con cui lo si è
 * chiuso ovunque — un `box-shadow` — non sa disegnare un tratteggio. Un
 * `<rect>` con `stroke-dasharray` si arrotonda con `rx`/`ry` in ogni motore.
 *
 * Condiviso da `DashedAddButton` e dal bottone "Aggiungi ricevuta" di
 * `AttachmentPicker` (issue #126): scritto due volte, tratteggio e raggio
 * divergerebbero alla prima modifica — la stessa lezione già pagata da
 * `SwitchVisual`, estratto da `Switch`/`TransactionForm` per lo stesso motivo.
 *
 * Il tratto è largo 1 e il rettangolo è rientrato di mezzo pixel, con l'`<svg>`
 * in `overflow-visible`: così la linea va dal bordo del riquadro a 1px verso
 * l'interno su TUTTO il perimetro. Un tratto da 2 ritagliato a metà dall'svg
 * lascerebbe angoli da 2px su lati da 1px — il ritaglio agisce solo sui lati
 * dritti, non sugli archi.
 *
 * Il genitore può portare la classe `group` per far scurire il tratteggio
 * all'hover (`DashedAddButton`): senza, il modificatore non scatta mai ed è
 * innocuo.
 */
export default function DashedBorder({ radius }: DashedBorderProps) {
	return (
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
	);
}
