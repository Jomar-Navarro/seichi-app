import { ElementType } from "react";

interface SummaryCardProps {
	label: string;
	amount: number;
	icon: ElementType;
	color: string;
}

const numberFormatter = new Intl.NumberFormat("it-IT", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export default function SummaryCard({
	label,
	amount,
	icon,
	color,
}: SummaryCardProps) {
	const Icon = icon;
	return (
		<div className="rounded-2xl p-4 border border-subtle card-shadow bg-surface backdrop-blur-md flex flex-col gap-3">
			<div
				className="w-9 h-9 rounded-xl flex items-center justify-center"
				style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
			>
				<Icon size={17} style={{ color }} />
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
