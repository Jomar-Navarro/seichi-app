/*
 * ⚠️ Nessun `generateMetadata` qui.
 *
 * Produrrebbe esattamente ciò che il root layout già fornisce — stesso titolo,
 * stessa descrizione, stessa fonte — quindi sarebbe un override che non
 * sovrascrive nulla, al costo di una seconda risoluzione del dizionario a ogni
 * pagina auth e di un secondo posto da aggiornare. Next.js unisce i metadata
 * annidati su quelli della radice: non dichiararli è ereditarli.
 */

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<div
			className="overflow-x-hidden min-h-lvh flex flex-col"
			style={{ background: "var(--background)", color: "var(--text-primary)" }}
		>
			{children}
		</div>
	);
}
