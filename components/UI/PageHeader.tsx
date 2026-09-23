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
 *
 * Da `lg:` (issue #108) il titolo segue la scala desktop di tutte le pagine —
 * 30px, tracking negativo — e la freccia prende il raggio del mockup. Vale anche
 * per le sottopagine di /impostazioni e per `/conti/[id]`, che restano strette:
 * cambia la misura del titolo, non la larghezza della pagina.
 */
export default async function PageHeader({ title, backHref, tone, className = "mb-6" }: PageHeaderProps) {
	const t = await getDictionary();

	return (
		<div className={`flex items-center gap-3.5 ${className}`}>
			<Link
				href={backHref}
				// issue #69 — w-11 h-11 (44px): area toccabile minima, isolata a
				// sinistra del titolo, l'icona resta 17px.
				// ⚠️ Resta 44px anche da `lg:`, contro i 40 del mockup desktop:
				// `lg:` non vuol dire mouse — un iPad Pro in verticale è largo 1024px
				// e usa il layout con la sidebar col dito. Del mockup si prende il
				// solo raggio.
				className="w-11 h-11 rounded-xl lg:rounded-[14px] flex items-center justify-center bg-control ring-border shrink-0 active:opacity-80"
				aria-label={t.common.back}
			>
				<ChevronLeft size={17} className="text-secondary" />
			</Link>
			<h1
				className="text-[22px] lg:text-[30px] lg:tracking-[-0.6px] font-semibold"
				style={tone ? { color: tone } : undefined}
			>
				{title}
			</h1>
		</div>
	);
}
