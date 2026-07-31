"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

/** Stile condiviso: un unico punto di verità per bottoni e link-bottone. */
const BASE =
	"w-full py-4.5 rounded-[22px] text-[15px] font-semibold border border-subtle transition-opacity";

const DANGER_STYLE: CSSProperties = {
	background: "color-mix(in srgb, var(--color-aka) 20%, transparent)",
	color: "var(--color-aka)",
	borderColor: "color-mix(in srgb, var(--color-aka) 32%, transparent)",
};

const SOLID_STYLE: CSSProperties = {
	background: "var(--surface-elevated)",
	color: "var(--text-primary)",
};

/** Azione secondaria: stessa forma, meno peso — niente ombra, sfondo più tenue. */
const GHOST_STYLE: CSSProperties = {
	background: "var(--seg-bg)",
	color: "var(--text-secondary)",
};

interface SubmitButtonProps {
	label: string;
	/** Etichetta mostrata durante l'attesa */
	pendingLabel?: string;
	pending?: boolean;
	disabled?: boolean;
	onClick?: () => void;
	type?: "button" | "submit";
	/**
	 * Se valorizzato rende un <Link> con lo stesso aspetto. Da preferire a
	 * onClick+router.push quando l'azione è una semplice navigazione: mantiene
	 * apri-in-nuova-scheda, tasto centrale e menu contestuale.
	 */
	href?: string;
	/** Variante distruttiva: sfondo aka invece del CTA neutro */
	danger?: boolean;
	/** "ghost" per le azioni secondarie accanto a un'azione principale */
	variant?: "solid" | "ghost";
	className?: string;
}

/** Bottone pieno a tutta larghezza usato dai form account e dalle schermate di esito. */
export default function SubmitButton({
	label,
	pendingLabel,
	pending,
	disabled,
	onClick,
	type = "button",
	href,
	danger,
	variant = "solid",
	className = "",
}: SubmitButtonProps) {
	const inactive = pending || disabled;
	const ghost = variant === "ghost" && !danger;
	const style = danger ? DANGER_STYLE : ghost ? GHOST_STYLE : SOLID_STYLE;
	// L'ombra distingue l'azione principale: la secondaria resta piatta.
	const elevation = ghost ? "" : "box-shadow";

	if (href && !inactive) {
		return (
			<Link
				href={href}
				className={`${BASE} ${elevation} block text-center ${className}`}
				style={style}
			>
				{label}
			</Link>
		);
	}

	return (
		<button
			type={type}
			onClick={onClick}
			disabled={inactive}
			className={`${BASE} ${elevation} disabled:opacity-45 disabled:cursor-not-allowed enabled:cursor-pointer ${className}`}
			style={style}
		>
			{pending ? (pendingLabel ?? label) : label}
		</button>
	);
}
