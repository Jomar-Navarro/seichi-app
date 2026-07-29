"use client";

interface SubmitButtonProps {
	label: string;
	/** Etichetta mostrata durante l'attesa */
	pendingLabel?: string;
	pending?: boolean;
	disabled?: boolean;
	onClick?: () => void;
	type?: "button" | "submit";
	/** Variante distruttiva: sfondo aka invece del CTA neutro */
	danger?: boolean;
	className?: string;
}

/** Bottone pieno a tutta larghezza usato dai form account. */
export default function SubmitButton({
	label,
	pendingLabel,
	pending,
	disabled,
	onClick,
	type = "button",
	danger,
	className = "",
}: SubmitButtonProps) {
	const inactive = pending || disabled;

	return (
		<button
			type={type}
			onClick={onClick}
			disabled={inactive}
			className={`w-full py-4.5 rounded-[22px] text-[15px] font-semibold border border-subtle box-shadow transition-opacity disabled:opacity-45 disabled:cursor-not-allowed enabled:cursor-pointer ${className}`}
			style={
				danger
					? {
							background: "color-mix(in srgb, var(--color-aka) 20%, transparent)",
							color: "var(--color-aka)",
							borderColor: "color-mix(in srgb, var(--color-aka) 32%, transparent)",
						}
					: { background: "var(--surface-elevated)", color: "var(--text-primary)" }
			}
		>
			{pending ? (pendingLabel ?? label) : label}
		</button>
	);
}
