import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";

interface PageHeaderProps {
	title: string;
	/** Dove porta la freccia indietro */
	backHref: string;
	/** Colore del titolo — usato dalla zona pericolo (`var(--color-aka)`) */
	tone?: string;
	className?: string;
}

/**
 * Intestazione condivisa da impostazioni e sottopagine: freccia + titolo.
 *
 * È async perché legge il dizionario per la sola `aria-label` della freccia — il
 * titolo lo passa il chiamante. Resta un server component: nessuna delle pagine
 * che lo usa è interattiva.
 */
export default async function PageHeader({ title, backHref, tone, className = "mb-6" }: PageHeaderProps) {
	const t = await getDictionary();

	return (
		<div className={`flex items-center gap-3.5 ${className}`}>
			<Link
				href={backHref}
				// issue #69 — w-11 h-11 (44px): area toccabile minima, isolata a
				// sinistra del titolo, l'icona resta 17px.
				className="w-11 h-11 rounded-xl flex items-center justify-center bg-control ring-border shrink-0 active:opacity-80"
				aria-label={t.common.back}
			>
				<ChevronLeft size={17} className="text-secondary" />
			</Link>
			<h1 className="text-[22px] font-semibold" style={tone ? { color: tone } : undefined}>
				{title}
			</h1>
		</div>
	);
}
