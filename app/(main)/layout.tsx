import BottomNav from "@/components/UI/BottomNav";
import TransactionModal from "@/components/UI/TransactionModal";
import PwaStatus from "@/components/features/PwaStatus";

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<div
			className="overflow-x-hidden min-h-lvh flex flex-col"
			// issue #86 — nessuna pagina di `(main)` ha un header FISSO: sono tutte
			// scroll naturale con lo stesso `pt-7`/`pt-8` di apertura, copiato in
			// ~15 file. Un solo punto qui, ADDITIVO al padding di ognuna (0 su un
			// device senza notch, quindi nessun cambiamento lì), evita di toccarli
			// tutti per lo stesso motivo. In basso lo stesso ragionamento vale per
			// il margine oltre `BottomNav` — che ora galleggia più in alto della
			// home indicator, vedi BottomNav.tsx.
			style={{
				background: "var(--background)",
				color: "var(--text-primary)",
				paddingTop: "env(safe-area-inset-top)",
				paddingBottom: "env(safe-area-inset-bottom)",
			}}
		>
			<PwaStatus />
			{children}
			<BottomNav />
			<TransactionModal />
		</div>
	);
}
