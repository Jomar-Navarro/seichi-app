import { FileArchive } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries/it";
import type { Locale } from "@/lib/i18n/config";
import { plural } from "@/lib/i18n/format";

/**
 * L'archivio completo in `/impostazioni/esporta` (issue #162), sotto il CSV.
 *
 * Componente server e senza stato: non ha filtri, l'archivio è sempre tutto.
 *
 * ⚠️ Il comando c'è SEMPRE, anche senza movimenti, al contrario del CSV: un
 * account con solo profilo, conti e categorie ha comunque dati da portare via,
 * e la portabilità vale per quelli.
 *
 * ⚠️ `receiptCount` `null` vuol dire «non letto» (#124): la frase sul tempo si
 * omette invece di dire «non ci sono ricevute».
 */
export default function ArchiveDownload({
	t,
	locale,
	receiptCount,
	error,
}: {
	t: Dictionary;
	locale: Locale;
	receiptCount: number | null;
	/** La frase dell'ultimo download fallito (#162), già composta dalla pagina. */
	error: string | null;
}) {
	const a = t.export.archive;
	return (
		/*
			`id="archivio"`: l'ancora del rinvio di un errore (`exportErrorPath()`),
			che riporta lo schermo qui invece che in cima alla pagina. `scroll-mt`:
			nessun header fisso, ma su iOS il titolo finirebbe sotto la barra di
			stato della PWA (la stessa misura dell'ancora `#budget`).
		*/
		<section id="archivio" className="mt-10 scroll-mt-[calc(env(safe-area-inset-top)+1.75rem)]">
			<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-3 ml-0.5">
				{a.title}
			</p>
			<p className="text-[13.5px] text-secondary leading-relaxed">{a.intro}</p>
			{/* Accanto al comando, come per il CSV: è l'aspettativa sbagliata più probabile. */}
			<p className="text-[12.5px] text-muted leading-relaxed mt-2">{a.notBackup}</p>
			{receiptCount !== null && (
				<p className="text-[12.5px] text-muted leading-relaxed mt-2">
					{plural(a.receipts, receiptCount, locale)}
				</p>
			)}
			{error && (
				<p role="alert" className="mt-4 text-[13px] leading-relaxed text-aka-ink">
					{error}
				</p>
			)}
			{/*
				⚠️ Un `<a>` NUDO, come il CSV: `<Link>` chiederebbe la rotta come
				payload RSC e non scaricherebbe niente. Il nome del file lo decide
				`Content-Disposition`.
			*/}
			<a
				href="/impostazioni/esporta/archivio"
				className="w-full h-13 mt-5 rounded-[17px] ring-border bg-control text-foreground text-[15px] font-semibold flex items-center justify-center gap-2.5"
			>
				<FileArchive size={17} />
				{a.download}
			</a>
		</section>
	);
}
