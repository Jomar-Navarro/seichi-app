import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Group                                                               */
/* ------------------------------------------------------------------ */

interface SettingsGroupProps {
	children: ReactNode;
	/** Etichetta maiuscoletta sopra il gruppo */
	label?: string;
	/** Bordo di enfasi — usato dalla zona pericolo */
	tone?: string;
	className?: string;
}

/** Card che raggruppa più righe, con separatori automatici fra i figli. */
export function SettingsGroup({ children, label, tone, className = "mb-6" }: SettingsGroupProps) {
	return (
		<div className={className}>
			{label && (
				<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-2.5 ml-0.5">
					{label}
				</p>
			)}
			<div
				className="rounded-[22px] bg-card border border-subtle card-shadow overflow-hidden [&>*+*]:border-t [&>*+*]:border-subtle"
				style={tone ? { borderColor: tone } : undefined}
			>
				{children}
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

interface SettingsRowProps {
	icon: ReactNode;
	label: string;
	/** Riga secondaria sotto l'etichetta (es. l'email corrente) */
	subtitle?: string;
	/** Contenuto a destra: un valore, un toggle, un badge… */
	value?: ReactNode;
	/** Mostra il chevron di navigazione */
	chevron?: boolean;
	/**
	 * Colore della sola LABEL — per le azioni distruttive. Va passato un
	 * inchiostro (`--ink-*`): è testo.
	 */
	tone?: string;
	/**
	 * Tinta della pastiglia icona. Separato da `tone` di proposito: la pastiglia
	 * è un riempimento e vuole l'accento pieno, la label vuole l'inchiostro.
	 * Con un'unica prop l'accento scelto per la pastiglia finiva anche sul testo
	 * (o viceversa), e due righe adiacenti passate a due valori diversi si
	 * ritrovavano pastiglie di tinta diversa con la stessa icona sopra.
	 */
	accent?: string;
	href?: string;
	onClick?: () => void;
	disabled?: boolean;
}

export default function SettingsRow({
	icon,
	label,
	subtitle,
	value,
	chevron,
	tone,
	accent,
	href,
	onClick,
	disabled,
}: SettingsRowProps) {
	const interactive = Boolean(href || onClick) && !disabled;

	const content = (
		<>
			<span
				className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control"
				style={accent ? { background: `color-mix(in srgb, ${accent} 13%, transparent)` } : undefined}
			>
				{icon}
			</span>

			<span className="flex-1 min-w-0 text-left">
				<span
					className="block text-sm font-medium truncate"
					style={tone ? { color: tone } : undefined}
				>
					{label}
				</span>
				{subtitle && <span className="block text-xs text-muted truncate mt-0.5">{subtitle}</span>}
			</span>

			{/* `value != null` e non `value &&`: con un conteggio a 0 quest'ultimo
			    renderizzerebbe uno `0` nudo fuori dallo span, senza stile. */}
			{value != null && <span className="text-[13px] text-muted shrink-0">{value}</span>}
			{chevron && <ChevronRight size={15} className="text-muted shrink-0" />}
		</>
	);

	const className = [
		"flex items-center gap-3 h-15.5 px-4 w-full",
		interactive ? "active:opacity-80" : "",
		disabled ? "opacity-45" : "",
	]
		.filter(Boolean)
		.join(" ");

	if (href && !disabled) {
		return (
			<Link href={href} className={className}>
				{content}
			</Link>
		);
	}

	if (onClick) {
		return (
			<button type="button" onClick={onClick} disabled={disabled} className={className}>
				{content}
			</button>
		);
	}

	// <span> e non <div>: la riga statica viene annidata dentro un <button>
	// (es. "Esci"), e un button può contenere solo phrasing content.
	return <span className={`${className} flex`}>{content}</span>;
}
