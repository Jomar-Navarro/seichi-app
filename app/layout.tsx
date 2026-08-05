import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import ThemeProvider from "@/components/features/ThemeProvider";
import {
	DEFAULT_CHOICE,
	DEFAULT_RESOLVED,
	isResolvedTheme,
	isThemeChoice,
	THEME_COOKIE,
	THEME_RESOLVED_COOKIE,
} from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Seichi",
	description:
		"Ordine finanziario, Come si prepara il terreno prima di costruire, Seichi ti aiuta a mettere ordine nelle tue finanze — con calma, chiarezza e controllo.",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	// Il tema si legge qui, prima di emettere <html>: è l'unico punto in cui si
	// può decidere la classe senza che il browser abbia già dipinto qualcosa.
	const store = await cookies();
	const rawChoice = store.get(THEME_COOKIE)?.value;
	const rawResolved = store.get(THEME_RESOLVED_COOKIE)?.value;

	const choice = isThemeChoice(rawChoice) ? rawChoice : DEFAULT_CHOICE;
	// Su "sistema" ci si fida del valore che il client ha scritto l'ultima volta:
	// `prefers-color-scheme` non arriva negli header e il server non lo conosce.
	const resolved =
		choice === "system"
			? isResolvedTheme(rawResolved)
				? rawResolved
				: DEFAULT_RESOLVED
			: choice;

	return (
		<html
			lang="it"
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${
				resolved === "dark" ? " dark" : ""
			}`}
		>
			<body className="min-h-lvh flex flex-col">
				<ThemeProvider initialChoice={choice} initialResolved={resolved}>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
