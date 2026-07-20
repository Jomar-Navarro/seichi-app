import BottomNav from "@/components/UI/BottomNav";
import TransactionModal from "@/components/UI/TransactionModal";

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
			<BottomNav />
			<TransactionModal />
		</div>
	);
}
