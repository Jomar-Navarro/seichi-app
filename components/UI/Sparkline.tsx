interface SparklineProps {
	values: number[];
	color: string;
	/** Sistema di coordinate — e misura resa, se `className` non ne fissa un'altra. */
	width?: number;
	height?: number;
	opacity?: number;
	pad?: number;
	/**
	 * Classi sull'`<svg>` (issue #108). Se fissano larghezza e altezza — anche
	 * per breakpoint, es. `lg:w-15.5 lg:h-6` — `width`/`height` restano solo il
	 * sistema di coordinate: il disegno si stira (`preserveAspectRatio="none"`)
	 * e il tratto NO (`non-scaling-stroke`), quindi la stessa linea serve la
	 * tessera da telefono e quella da desktop senza un secondo SVG.
	 *
	 * Senza classi di misura non cambia nulla: l'svg è grande quanto il suo
	 * `viewBox`, la scala è 1 e le due proprietà sopra non hanno effetto.
	 */
	className?: string;
	/** L'area sotto la linea, della stessa tinta con questa opacità. Assente = nessuna area. */
	areaOpacity?: number;
	/**
	 * QUANDO l'area si vede (es. `hidden xl:inline`). La scorciatoia Analisi della
	 * home la mostra solo quando diventa un grafico vero, non nella versione in
	 * riga del telefono — che resta la linea nuda di sempre.
	 */
	areaClassName?: string;
}

export default function Sparkline({
	values,
	color,
	width = 56,
	height = 26,
	opacity = 0.75,
	pad = 4,
	className,
	areaOpacity,
	areaClassName,
}: SparklineProps) {
	if (values.length < 2) return null;
	/*
	 * ⚠️ Il minimo include lo ZERO: per ogni serie ≥ 0 (entrate, spese,
	 * investimenti, risparmi) vale 0 e la formula si riduce a `v / max`, cioè il
	 * disegno di sempre, ancorato al fondo. Serve al flusso (issue #108), che può
	 * scendere sotto zero: con `v / max` un mese negativo finiva sotto il
	 * riquadro, fuori dal disegno. `max − min` è sempre ≥ 1.
	 */
	const min = Math.min(...values, 0);
	const max = Math.max(...values, 1);
	const pts = values
		.map((v, i) => {
			const x = (i / (values.length - 1)) * width;
			const y = height - pad - ((v - min) / (max - min)) * (height - pad * 2);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="none"
			fill="none"
			className={className ? `shrink-0 ${className}` : "shrink-0"}
		>
			{areaOpacity !== undefined && (
				// Chiusa sul fondo del riquadro: la linea parte da x=0 e finisce a
				// x=width, quindi bastano i due angoli in basso.
				<polygon
					points={`0,${height} ${pts} ${width},${height}`}
					fill={color}
					fillOpacity={areaOpacity}
					className={areaClassName}
				/>
			)}
			<polyline
				points={pts}
				stroke={color}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity={opacity}
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
