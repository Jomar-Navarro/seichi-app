import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";

// Ripete titolo e descrizione del root layout, nella lingua della richiesta.
export async function generateMetadata(): Promise<Metadata> {
	const t = await getDictionary();
	return { title: t.meta.title, description: t.meta.description };
}

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
