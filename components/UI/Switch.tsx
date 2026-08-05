"use client";

interface SwitchProps {
	checked: boolean;
	onChange: (next: boolean) => void;
	/** Serve ai lettori di schermo: il controllo non ha testo proprio. */
	label: string;
	disabled?: boolean;
}

/**
 * Switch Zen Glass.
 *
 * Acceso riusa i token della CTA (`--cta-bg` / `--cta-text`), che si invertono
 * da soli fra i due temi: scuro su carta in chiaro, chiaro su inchiostro in
 * scuro — esattamente ciò che mostra il mockup, senza doverlo scrivere due volte.
 */
export default function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className="relative w-[38px] h-[22px] rounded-full shrink-0 cursor-pointer border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			style={{
				background: checked ? "var(--cta-bg)" : "var(--switch-track-off)",
				borderColor: checked ? "transparent" : "var(--border)",
			}}
		>
			<span
				className="absolute w-[18px] h-[18px] rounded-full transition-transform"
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
