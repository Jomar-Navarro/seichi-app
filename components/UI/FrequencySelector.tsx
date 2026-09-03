"use client";

import { FREQUENCIES } from "@/lib/recurring";
import { useI18n } from "@/components/features/I18nProvider";
import type { Frequency } from "@/types";

interface FrequencySelectorProps {
	value: Frequency;
	onChange: (f: Frequency) => void;
	color: string;
}

export default function FrequencySelector({ value, onChange, color }: FrequencySelectorProps) {
	const { t } = useI18n();

	return (
		<div className="grid grid-cols-3 gap-2">
			{FREQUENCIES.map((f) => {
				const selected = value === f;
				return (
					<button
						key={f}
						type="button"
						onClick={() => onChange(f)}
						// issue #81 — selezionato: bordo VERO (colore opaco, sicuro). A
						// riposo: anello (`--border` è traslucido, un bordo vero lì
						// romperebbe l'angolo su Firefox).
						className={`py-2.5 rounded-xl text-[12.5px] font-medium transition-all ${selected ? "border" : ""}`}
						style={{
							background: selected
								? `color-mix(in srgb, ${color} 16%, transparent)`
								: "var(--color-card)",
							borderColor: selected ? color : undefined,
							boxShadow: selected ? undefined : "var(--border) 0px 0px 0px 1px inset",
							color: selected ? color : "var(--text-secondary)",
						}}
					>
						{t.frequencies[f].label}
					</button>
				);
			})}
		</div>
	);
}
