"use client";

import { FREQUENCIES } from "@/lib/recurring";
import type { Frequency } from "@/types";

interface FrequencySelectorProps {
	value: Frequency;
	onChange: (f: Frequency) => void;
	color: string;
}

export default function FrequencySelector({ value, onChange, color }: FrequencySelectorProps) {
	return (
		<div className="grid grid-cols-3 gap-2">
			{FREQUENCIES.map((f) => {
				const selected = value === f.id;
				return (
					<button
						key={f.id}
						type="button"
						onClick={() => onChange(f.id)}
						className="py-2.5 rounded-xl text-[12.5px] font-medium border transition-all"
						style={{
							background: selected
								? `color-mix(in srgb, ${color} 16%, transparent)`
								: "var(--color-card)",
							borderColor: selected ? color : "var(--color-subtle)",
							color: selected ? color : "var(--text-secondary)",
						}}
					>
						{f.label}
					</button>
				);
			})}
		</div>
	);
}
