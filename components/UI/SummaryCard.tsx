import { ElementType } from "react";
import { numberFormatter } from "@/lib/transaction-utils";

interface SummaryCardProps {
	label: string;
	amount: number;
	icon: ElementType;
	color: string;
	trend?: number[];
	progress?: number;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
	if (values.length < 2) return null;
	const max = Math.max(...values, 1);
	const W = 56, H = 26;
	const pts = values
		.map((v, i) => {
			const x = (i / (values.length - 1)) * W;
			const y = H - 4 - (v / max) * (H - 8);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
	return (
		<svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
			<polyline
				points={pts}
				stroke={color}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity={0.75}
			/>
		</svg>
	);
}

function CircularProgress({ progress, color }: { progress: number; color: string }) {
	const r = 13;
	const circ = 2 * Math.PI * r;
	const offset = circ * (1 - Math.min(Math.max(progress, 0), 100) / 100);
	return (
		<svg width={32} height={32} viewBox="0 0 32 32" fill="none">
			<circle cx={16} cy={16} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
			<circle
				cx={16}
				cy={16}
				r={r}
				stroke={color}
				strokeWidth="2.5"
				strokeDasharray={circ}
				strokeDashoffset={offset}
				strokeLinecap="round"
				transform="rotate(-90 16 16)"
			/>
		</svg>
	);
}

export default function SummaryCard({ label, amount, icon, color, trend, progress }: SummaryCardProps) {
	const Icon = icon;
	return (
		<div className="rounded-2xl p-4 border border-subtle card-shadow bg-surface backdrop-blur-md flex flex-col gap-3">
			<div className="flex items-start justify-between">
				<div
					className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
					style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
				>
					<Icon size={17} style={{ color }} />
				</div>
				{progress !== undefined ? (
					<CircularProgress progress={progress} color={color} />
				) : trend ? (
					<Sparkline values={trend} color={color} />
				) : null}
			</div>
			<div>
				<p className="text-lg font-bold tracking-tight">
					€ {numberFormatter.format(amount)}
				</p>
				<p className="text-xs text-muted mt-0.5">{label}</p>
			</div>
		</div>
	);
}
