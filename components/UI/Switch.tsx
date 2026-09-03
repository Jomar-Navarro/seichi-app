"use client";

interface SwitchVisualProps {
	checked: boolean;
	/**
	 * Colori dello stato acceso. Il default è la CTA (`--cta-bg`/`--cta-text`),
	 * che si inverte da sola fra i due temi: scuro su carta in chiaro, chiaro su
	 * inchiostro in scuro — ciò che mostra il mockup, senza scriverlo due volte.
	 * Chi passa un accento come `track` DEVE passare `--on-accent` come `knob`:
	 * gli accenti invertono la luminosità fra i temi e un pomello fisso finisce
	 * per sparirci sopra.
	 */
	on?: { track: string; knob: string };
}

const CTA_ON = { track: "var(--cta-bg)", knob: "var(--cta-text)" };

/**
 * Il DISEGNO dell'interruttore, senza il comando.
 *
 * Esiste separato perché la riga "Ripeti" di TransactionForm è già un
 * `<button>`: annidarci dentro il `<button role="switch">` qui sotto sarebbe
 * markup interattivo dentro markup interattivo. Prima quella riga si ridisegnava
 * l'interruttore a mano e le due forme erano già divergenti (38×22 con pomello
 * 18 contro 40×24 con pomello 20). Con il disegno condiviso la geometria non è
 * più una cosa da tenere allineata a memoria.
 */
export function SwitchVisual({ checked, on = CTA_ON }: SwitchVisualProps) {
	return (
		<span
			// issue #81 — anello (box-shadow) invece di bordo quando spento:
			// `--border` è traslucido. Acceso non ha bisogno di alcun bordo, il
			// riempimento basta.
			className="relative block w-9.5 h-5.5 rounded-full shrink-0 transition-colors"
			style={{
				background: checked ? on.track : "var(--switch-track-off)",
				boxShadow: checked ? undefined : "var(--border) 0px 0px 0px 1px inset",
			}}
		>
			<span
				className="absolute w-4.5 h-4.5 rounded-full transition-transform"
				style={{
					top: "50%",
					left: "1px",
					transform: `translate(${checked ? 17 : 0}px, -50%)`,
					background: checked ? on.knob : "var(--switch-knob-off)",
					boxShadow: checked ? "none" : "0 1px 3px rgba(0, 0, 0, 0.15)",
				}}
			/>
		</span>
	);
}

interface SwitchProps {
	checked: boolean;
	onChange: (next: boolean) => void;
	/** Serve ai lettori di schermo: il controllo non ha testo proprio. */
	label: string;
}

/** Switch Zen Glass — il disegno di `SwitchVisual` più il comando. */
export default function Switch({ checked, onChange, label }: SwitchProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className="shrink-0 cursor-pointer"
		>
			<SwitchVisual checked={checked} />
		</button>
	);
}
