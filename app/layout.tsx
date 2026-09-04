import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { SerwistProvider } from "@serwist/turbopack/react";
import I18nProvider from "@/components/features/I18nProvider";
import ThemeProvider from "@/components/features/ThemeProvider";
import { getI18n } from "@/lib/i18n/server";
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

// Titolo e descrizione seguono la lingua come tutto il resto. È una funzione e non
// più una costante perché il locale si conosce solo a richiesta in corso: una
// costante di modulo verrebbe valutata una volta sola, alla prima esecuzione.
export async function generateMetadata(): Promise<Metadata> {
	const { t } = await getI18n();
	return {
		title: t.meta.title,
		description: t.meta.description,
	};
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	// Tema e lingua si leggono qui per lo stesso motivo: `<html>` porta la classe
	// `.dark` e l'attributo `lang`, e questo è l'unico punto in cui si decidono
	// prima che il browser abbia dipinto o che uno screen reader abbia scelto la
	// voce con cui leggere la pagina.
	const { locale, t } = await getI18n();
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
			lang={locale}
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${
				resolved === "dark" ? " dark" : ""
			}`}
		>
			<body className="min-h-lvh flex flex-col">
				{/*
					Fase 25 — PWA. ⚠️⚠️ `withSerwist` in next.config.ts NON registra nulla:
					è solo un wrapper di config (verificato nel sorgente del pacchetto —
					spreadta la config e basta). Senza QUESTO provider il service worker
					non si installa in NESSUN browser: precache, fallback offline e
					l'avviso "nuova versione" di PwaStatus restano tutti inerti, anche se
					`/serwist/sw.js` risponde 200 al curl.

					⚠️⚠️ `cacheOnNavigation` e `reloadOnOnline` sono `true` di DEFAULT nel
					pacchetto, e vanno spenti entrambi:
					- `reloadOnOnline` farebbe `location.reload()` a OGNI ritorno online —
					  su mobile capita di continuo (ascensore, wifi che passa a dati) — e
					  ricaricherebbe la pagina sotto le dita di chi sta compilando
					  TransactionForm. È esattamente il reload automatico che PwaStatus
					  vieta esplicitamente per l'avviso di aggiornamento.
					- `cacheOnNavigation` manderebbe al service worker un messaggio
					  `CACHE_URLS` per ogni navigazione client-side. Con `runtimeCaching: []`
					  in app/sw.ts e nessun `setDefaultHandler` il messaggio non trova
					  alcuna route e non cachea nulla (verificato in
					  node_modules/serwist/src/Serwist.ts: `handleRequest` senza handler
					  ritorna `undefined`) — ma è un canale che aggirerebbe
					  `runtimeCaching` invece di rispettarlo, e spegnerlo esplicitamente
					  non lascia la garanzia "nessuna pagina applicativa in cache" appesa
					  a una coincidenza (route vuote oggi, magari non domani).
				*/}
				<SerwistProvider
					swUrl="/serwist/sw.js"
					cacheOnNavigation={false}
					reloadOnOnline={false}
				>
					<I18nProvider locale={locale} dictionary={t}>
						<ThemeProvider initialChoice={choice} initialResolved={resolved}>
							{children}
						</ThemeProvider>
					</I18nProvider>
				</SerwistProvider>
			</body>
		</html>
	);
}
