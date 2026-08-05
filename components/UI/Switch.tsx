"use client";

interface SwitchProps {
	checked: boolean;
	onChange: (next: boolean) => void;
	/** Serve ai lettori di schermo: il controllo non ha testo proprio. */
	label: string;
}

/**
 * Switch Zen Glass.
 *
 * Acceso riusa i token della CTA (`--cta-bg` / `--cta-text`), che si invertono
 * da soli fra i due temi: scuro su carta in chiaro, chiaro su inchiostro in
 * scuro — esattamente ciò che mostra il mockup, senza doverlo scrivere due volte.
 */
export default function Switch({ checked, onChange, label }: SwitchProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className="relative w-9.5 h-5.5 rounded-full shrink-0 cursor-pointer border transition-colors"
			style={{
				background: checked ? "var(--cta-bg)" : "var(--switch-track-off)",
				borderColor: checked ? "transparent" : "var(--border)",
			}}
		>
			<span
				className="absolute w-4.5 h-4.5 rounded-full transition-transform"
				style={{
					top: "50%",
					left: "1px",
					transform: `translate(${checked ? 17 : 0}px, -50%)`,
					background: checked ? "var(--cta-text)" : "var(--switch-knob-off)",
					boxShadow: checked ? "none" : "0 1px 3px rgba(0, 0, 0, 0.15)",
				}}
			/>
		</button>
	);
}
