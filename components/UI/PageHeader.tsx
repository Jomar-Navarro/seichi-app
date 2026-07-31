import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
	title: string;
	/** Dove porta la freccia indietro */
	backHref: string;
	/** Colore del titolo — usato dalla zona pericolo (`var(--color-aka)`) */
	tone?: string;
	className?: string;
}

/** Intestazione condivisa da impostazioni e sottopagine: freccia + titolo. */
export default function PageHeader({ title, backHref, tone, className = "mb-6" }: PageHeaderProps) {
	return (
		<div className={`flex items-center gap-3.5 ${className}`}>
			<Link
				href={backHref}
				className="w-10 h-10 rounded-xl flex items-center justify-center bg-control border border-subtle shrink-0 active:opacity-80"
				aria-label="Indietro"
			>
				<ChevronLeft size={17} className="text-secondary" />
			</Link>
			<h1 className="text-[22px] font-semibold" style={tone ? { color: tone } : undefined}>
				{title}
			</h1>
		</div>
	);
}
