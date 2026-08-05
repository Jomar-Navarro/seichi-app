"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_LABELS, type ThemeChoice } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";

const OPTIONS: { value: ThemeChoice; icon: typeof Sun }[] = [
	{ value: "light", icon: Sun },
	{ value: "dark", icon: Moon },
	{ value: "system", icon: Monitor },
];

export default function ThemeSection() {
	const { choice, resolved, setChoice } = useTheme();

	// Con "sistema" la scelta da sola non dice cosa si sta vedendo, ed è proprio
	// la differenza che rende utile il terzo stato: la si scrive.
	const detail =
		choice === "system"
			? `segue il sistema · ora ${THEME_LABELS[resolved]}`
			: `sempre ${THEME_LABELS[choice]}`;

	return (
		// La card e l'etichetta di sezione le mette SettingsGroup: rifarle qui
		// significava tenere allineati a mano quattro punti a ogni ritocco.
		<div className="p-4">
			<div className="flex items-center gap-3 mb-3.5">
				<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
					{resolved === "dark" ? (
						<Moon size={17} className="text-secondary" />
					) : (
						<Sun size={17} className="text-secondary" />
					)}
				</span>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium">Aspetto</p>
					<p className="text-[12.5px] text-muted mt-0.5 truncate">{detail}</p>
				</div>
			</div>

			<div
				className="grid grid-cols-3 gap-1 p-1 rounded-2xl segment-tab"
				role="radiogroup"
				aria-label="Aspetto"
			>
				{OPTIONS.map(({ value, icon: Icon }) => {
					const active = choice === value;
					return (
						<button
							key={value}
							type="button"
							role="radio"
							aria-checked={active}
							onClick={() => setChoice(value)}
							className={`flex items-center justify-center gap-2 h-10 rounded-xl text-[13px] font-medium cursor-pointer ${
								active ? "active-tab" : "text-muted active:opacity-70"
							}`}
						>
							<Icon size={15} />
							{THEME_LABELS[value]}
						</button>
					);
				})}
			</div>
		</div>
	);
}
