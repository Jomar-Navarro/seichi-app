interface SparklineProps {
	values: number[];
	color: string;
	width?: number;
	height?: number;
	opacity?: number;
	pad?: number;
}

export default function Sparkline({
	values,
	color,
	width = 56,
	height = 26,
	opacity = 0.75,
	pad = 4,
}: SparklineProps) {
	if (values.length < 2) return null;
	const max = Math.max(...values, 1);
	const pts = values
		.map((v, i) => {
			const x = (i / (values.length - 1)) * width;
			const y = height - pad - (v / max) * (height - pad * 2);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			fill="none"
			className="shrink-0"
		>
			<polyline
				points={pts}
				stroke={color}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity={opacity}
			/>
		</svg>
	);
}
