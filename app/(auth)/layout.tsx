import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Seichi",
	description:
		"Ordine finanziario, Come si prepara il terreno prima di costruire, Seichi ti aiuta a mettere ordine nelle tue finanze — con calma, chiarezza e controllo.",
};

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
