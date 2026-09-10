import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { SerwistProvider } from "@serwist/turbopack/react";
import BootSplash from "@/components/UI/BootSplash";
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

/**
 * `apple-touch-startup-image` — lo splash nativo di iOS per la PWA. ⚠️ NON
 * legge `background_color`/`theme_color` dal manifest (quello è solo per
 * Android): senza questi `<link>`, l'apertura da home screen mostra uno
 * schermo vuoto (nero durante la transizione di sistema, poi bianco) prima
 * che qualunque HTML nostro arrivi — verificato dal vivo su iPhone 15, non
 * un'ipotesi. Le immagini sono in `public/splash/`, generate da
 * `scripts/generate-pwa-splash.mjs` (`npm run generate:pwa-splash`).
 *
 * ⚠️ Questa lista è DUPLICATA nello script (che è Node puro, fuori dalla
 * build Next, e non può importare questo file): stesso compromesso già
 * accettato per i percorsi dell'icona Sprout fra `lib/pwa-icon.ts` e
 * `generate-pwa-icons.mjs`. Se la copertura dei modelli cambia, va
 * cambiata in entrambi i posti.
 *
 * `prefers-color-scheme` risponde al tema di SISTEMA del dispositivo, non
 * al cookie di Seichi — a questo stadio non esiste ancora una richiesta da
 * cui leggerlo. Vedi il commento in testa allo script per il perché copre
 * solo iPhone 12→17/Air (ritratto, l'unico orientamento che l'app usa) e
 * non l'intera matrice storica Apple.
 */
const APPLE_SPLASH_SIZES: Array<{ w: number; h: number; scale: number }> = [
	{ w: 393, h: 852, scale: 3 },
	{ w: 430, h: 932, scale: 3 },
	{ w: 390, h: 844, scale: 3 },
	{ w: 428, h: 926, scale: 3 },
	{ w: 375, h: 812, scale: 3 },
	{ w: 440, h: 956, scale: 3 },
	{ w: 402, h: 874, scale: 3 },
	{ w: 420, h: 912, scale: 3 },
];

const APPLE_SPLASH_LINKS = APPLE_SPLASH_SIZES.flatMap(({ w, h, scale }) =>
	(["light", "dark"] as const).map((scheme) => ({
		rel: "apple-touch-startup-image",
		url: `/splash/splash-${w}x${h}-${scheme}.png`,
		media:
			`(prefers-color-scheme: ${scheme}) and (device-width: ${w}px) and (device-height: ${h}px) ` +
			`and (-webkit-device-pixel-ratio: ${scale}) and (orientation: portrait)`,
	})),
);

// Titolo e descrizione seguono la lingua come tutto il resto. È una funzione e non
// più una costante perché il locale si conosce solo a richiesta in corso: una
// costante di modulo verrebbe valutata una volta sola, alla prima esecuzione.
export async function generateMetadata(): Promise<Metadata> {
	const { t } = await getI18n();
	return {
		title: t.meta.title,
		description: t.meta.description,
		icons: { other: APPLE_SPLASH_LINKS },
		/*
		 * issue #86 — `viewport-fit=cover` (sotto) NON bastava da solo per una
		 * PWA aperta da "Aggiungi a Home" su iOS: quello estende il VIEWPORT,
		 * ma la barra di stato è un overlay dell'OS con un meccanismo suo,
		 * senza equivalente nel manifest standard. Senza questo meta iOS la
		 * disegna OPACA — verificato dal vivo, la barra nera del bug era
		 * esattamente questo, non una mancanza di sfondo. `black-translucent`
		 * la rende trasparente e lascia che il contenuto disegni sotto.
		 *
		 * ⚠️ Debito dichiarato: le tre uniche opzioni di iOS sono statiche, e
		 * nessuna sa "trasparente coi soli caratteri chiari sopra scuro, scuri
		 * sopra chiaro". `black-translucent` fissa caratteri BIANCHI —
		 * corretto sul fondo scuro dell'header, dove tutti gli screenshot di
		 * questo giro sono stati presi, ma da riverificare in TEMA CHIARO
		 * (Fase 27/28): se l'header lì è chiaro, la barra di stato
		 * diventerebbe poco leggibile. Non risolto qui perché la scelta —
		 * quale sfondo dare alla zona sotto la notch in chiaro — è una
		 * decisione di design a sé, non un effetto collaterale di questa fase.
		 */
		appleWebApp: {
			title: t.meta.title,
			statusBarStyle: "black-translucent",
		},
		/*
		 * issue #86 — ancora barra nera sull'iPhone 15 (Dynamic Island) dopo il
		 * fix sopra, mentre sui modelli con notch funzionava. Causa verificata
		 * leggendo il sorgente di Next (`lib/metadata/metadata.js`):
		 * `appleWebApp.capable` scrive SOLO `mobile-web-app-capable`
		 * (generico), mai il vecchio `apple-mobile-web-app-capable` — e
		 * `apple-mobile-web-app-status-bar-style` risulterebbe senza effetto
		 * senza quest'ultimo. Nessun campo tipizzato di `Metadata` lo copre:
		 * va scritto a mano con `other`.
		 */
		other: {
			"apple-mobile-web-app-capable": "yes",
		},
	};
}

/*
 * ~~Debito dichiarato — la zona intorno alla Dynamic Island...~~ — CHIUSO
 * il 2026-09-10, e la chiusura smentisce la diagnosi originale invece di
 * confermarla.
 *
 * La disomogeneità era ancora lì dopo tre tecniche diverse (sotto, tenute
 * per la cronaca) perché il PROBLEMA non era mai stato il rendering della
 * status bar: era una PWA installata che girava su un manifest/CSS
 * VECCHIO, da prima delle correzioni. Disinstallata e reinstallata da
 * capo — stesso gesto che ha chiuso la mancata comparsa dello splash
 * d'apertura nello stesso giro — la zona è tornata omogenea senza
 * toccare una riga in più. È la stessa classe di difetto già registrata
 * per l'aggiornamento del service worker: un banner "nuova versione" che
 * non compare NON dimostra che i contenuti siano freschi, dimostra solo
 * che lo SCRIPT del service worker non è cambiato — la cache HTTP del
 * bundle sotto poteva comunque essere quella di ieri.
 *
 * Le tre tecniche provate, e perché sembravano tutte fallire:
 *
 * - un elemento `fixed` con `backdrop-blur` alto quanto `env(safe-area-
 *   inset-top)`;
 * - lo stesso elemento con un riempimento piatto (`--background-secondary`);
 * - lo stesso ancora, mischiato con l'80% di nero.
 *
 * Nessuna delle tre era sbagliata nel merito — il codice reale, una volta
 * servito fresco, integra la zona correttamente. Il "zero su tre" non
 * era il segnale che il problema fosse strutturale: era il segnale di una
 * PWA che non stava eseguendo nessuna delle tre versioni provate.
 *
 * La lezione, e vale oltre questo debito: su una PWA installata, un
 * cambiamento che "non si vede sul telefono" va sempre prima escluso
 * come cache — disinstallare e reinstallare — prima di concludere che il
 * codice non basta. Vale la stessa domanda già scritta per lo splash di
 * apertura: NON è pulita finché non si è vista sparire disinstallando.
 */

/*
 * issue #86 — la notch/Dynamic Island appariva NERA. Causa verificata: senza
 * `viewport-fit=cover` iOS lascia l'area di notch/status-bar FUORI dal
 * viewport dell'app, quindi non è uno sfondo mancante — è zona che l'app non
 * sta disegnando affatto. `viewportFit: "cover"` (→ `viewport-fit=cover` nel
 * meta) estende il viewport fin sotto: da qui in poi lo sfondo del `body`
 * (già token, non un colore fisso) copre anche quella zona.
 *
 * ⚠️ Coprire da solo NON basta: senza `env(safe-area-inset-*)` sugli elementi
 * che prima potevano ignorarla, il contenuto finirebbe SOTTO la notch invece
 * che sopra un buco nero — vedi BottomNav, TransactionModal, BottomSheetShell
 * e il padding del layout `(main)`.
 */
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
};

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
			// issue #86 — `scrollbar-none` (già usata dal carosello orizzontale della
			// home) qui nasconde la scrollbar nativa dello scroll VERTICALE della
			// pagina: in una PWA standalone, senza la chrome del browser intorno,
			// l'indicatore di scroll di iOS risalta molto più che dentro Safari.
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scrollbar-none${
				resolved === "dark" ? " dark" : ""
			}`}
		>
			<body className="min-h-lvh flex flex-col">
				{/*
					Splash di apertura — copre {children} finché non si dissolve da sé
					(zg-boot-out, ~900ms, puro CSS). Va PRIMA di tutto il resto: si
					rende sul PRIMO byte, quindi non deve aspettare che React idrati
					SerwistProvider/I18nProvider/ThemeProvider per apparire — vedi
					BootSplash.tsx per il perché è sicuro farlo senza JS.
				*/}
				<BootSplash />
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
