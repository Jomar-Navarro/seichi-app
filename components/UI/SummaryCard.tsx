import { ElementType } from "react";
import { numberFormatter } from "@/lib/transaction-utils";
import Sparkline from "@/components/UI/Sparkline";

interface SummaryCardProps {
	label: string;
	amount: number;
	icon: ElementType;
	color: string;
	trend?: number[];
	progress?: number;
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
