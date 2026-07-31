import type { ReactNode } from "react";

interface StatusScreenProps {
	icon: ReactNode;
	title: string;
	description?: string;
	/** Colore dell'alone dietro l'icona (default: midori) */
	tone?: string;
	/** Forma del riquadro icona: cerchio o quadrato arrotondato */
	shape?: "circle" | "squircle";
	children?: ReactNode;
}

/** Schermata di esito centrata — riusata dai flussi email, password e recupero. */
export default function StatusScreen({
	icon,
	title,
	description,
	tone = "var(--color-midori)",
	shape = "squircle",
	children,
}: StatusScreenProps) {
	return (
		<div className="flex-1 flex flex-col items-center justify-center text-center px-2">
			<div
				className="w-16 h-16 flex items-center justify-center mb-5"
				style={{
					background: `color-mix(in srgb, ${tone} 14%, transparent)`,
					borderRadius: shape === "circle" ? "50%" : "22px",
				}}
			>
				{icon}
			</div>
			<h2 className="text-[17px] font-semibold mb-2.5">{title}</h2>
			{description && (
				<p className="text-[13.5px] text-muted leading-relaxed max-w-[280px]">{description}</p>
			)}
			{children && <div className="w-full mt-6">{children}</div>}
		</div>
	);
}
