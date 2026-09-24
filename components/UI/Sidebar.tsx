"use client";

import { Suspense, use, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useI18n } from "@/components/features/I18nProvider";
import ProfileMenu from "@/components/features/ProfileMenu";
import { plural } from "@/lib/i18n/format";
// Solo TIPO: cancellato in compilazione, quindi `lib/account.ts` — che importa
// il client Supabase del server — non entra nel bundle del browser. Stesso
// schema di `JobHealthNotice` con `lib/jobs.ts`.
import type { SidebarProfile } from "@/lib/account";
import { SIDEBAR_MEDIA_QUERY, writeSidebarCookie } from "@/lib/sidebar";
import { useNavHidden } from "./useNavVisibility";
import {
	HomeIcon,
	ReceiptIcon,
	PiggyBankIcon,
	TrendingUpIcon,
	ChartNoAxesCombinedIcon,
	SettingsIcon,
} from "@/lib/seichi-icons";

// Stesse sei sezioni della Fase 20a più Analisi e Impostazioni, che sulla
// pillola mobile restano deliberatamente fuori (vincolo del pollice — la
// bottom nav resta a quattro voci più il FAB). Su una rail non c'è quel
// vincolo, e lasciarle raggiungibili solo da una card scorciatoia/dal menu
// profilo leggerebbe come un porting incompleto.
//
// `dot` è il pallino della voce attiva nel colore della sezione (mockup
// desktop, issue #108): verde per le viste generali, oro per gli obiettivi,
// blu per gli investimenti — gli stessi accenti che quelle pagine usano per
// i propri numeri. ⚠️ Classi SCRITTE PER INTERO, mai composte
// (`bg-${accent}`): Tailwind genera solo le classi che legge nel sorgente, e
// una classe inesistente non dà errore — il pallino semplicemente non si
// colorerebbe (la trappola che `npm run audit:tokens` esiste per trovare).
const NAV_ITEMS = [
	{ href: "/", icon: HomeIcon, key: "home", dot: "bg-midori" },
	{ href: "/transazioni", icon: ReceiptIcon, key: "transactions", dot: "bg-midori" },
	{ href: "/risparmi", icon: PiggyBankIcon, key: "goals", dot: "bg-kin" },
	{ href: "/investimenti", icon: TrendingUpIcon, key: "investments", dot: "bg-ao" },
	{ href: "/analisi", icon: ChartNoAxesCombinedIcon, key: "analytics", dot: "bg-midori" },
	{ href: "/impostazioni", icon: SettingsIcon, key: "settings", dot: "bg-midori" },
] as const;

/**
 * Se la voce `href` descrive la pagina in `pathname`.
 *
 * ⚠️ Per PREFISSO, non per uguaglianza — che era il controllo fino alla 28a,
 * e su una rail sempre visibile lasciava tutte le voci spente appena si
 * entrava in una sottopagina: `/impostazioni/categorie` non evidenziava
 * "Impostazioni". Il prefisso si ferma al confine di segmento (`href + "/"`),
 * o una futura `/transazioni-ricorrenti` accenderebbe "Transazioni".
 *
 * La home è l'eccezione: `/` è prefisso di tutto, quindi vale solo esatta.
 *
 * ⚠️ `/conti` e `/conti/[id]` NON accendono niente, ed è corretto: la pagina
 * conti si raggiunge dal selettore in home (Fase 20a), non da una voce della
 * nav, e accendere "Home" su una pagina che non è la home direbbe il falso.
 */
function isActive(pathname: string, href: string) {
	if (href === "/") return pathname === "/";
	return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * La rail persistente da `lg:` in su (Fase 28a) — sostituisce la pillola
 * mobile, non la affianca: `BottomNav` porta `lg:hidden`, questa
 * `hidden lg:flex`. Nasconde alle stesse condizioni della pillola
 * (`useNavHidden`), così il gutter che `MainContentShell` le riserva sparisce
 * in accordo, mai con uno spazio vuoto lasciato dietro.
 *
 * Dall'issue #108 segue il mockup desktop: marchio, "Aggiungi transazione",
 * nav con la voce attiva in rilievo, e in fondo il footer del profilo — che
 * apre lo STESSO menu della home (`ProfileMenu`, variante `sidebar`).
 *
 * `profile` è una PROMISE, non un valore: la avvia il layout di `(main)` senza
 * attenderla, e qui la legge `use()` dentro un `<Suspense>` attorno al solo
 * footer. Il perché — e quanto costa — è scritto nel layout.
 *
 * `null` invece di una promise = il layout ha SALTATO le query, perché il
 * cookie di `lib/sidebar.ts` diceva che su questo dispositivo la rail non si
 * vede (review post-merge del #108).
 */
export default function Sidebar({ profile }: { profile: Promise<SidebarProfile | null> | null }) {
	const { openTransactionModal } = useUIStore();
	const pathname = usePathname();
	const router = useRouter();
	const { t } = useI18n();
	const hidden = useNavHidden();
	const skipped = profile === null;
	const refreshed = useRef(false);

	/*
	 * Tiene aggiornato `SIDEBAR_COOKIE` con ciò che il browser sa e il server no:
	 * se la rail si vede. Prima del `return null` qui sotto, perché gli hook
	 * devono girare a ogni render — e scrivere il cookie è giusto anche mentre
	 * la rail è nascosta per scelta (report, wizard del PIN).
	 *
	 * ⚠️ Il caso che conta è il PASSAGGIO del breakpoint verso l'alto — un iPad
	 * ruotato, una finestra allargata — dopo un render che le query le aveva
	 * saltate: la rail compare senza dati per il footer. Allora un
	 * `router.refresh()` rifà il layout, che ora legge "1" e le avvia.
	 * ⚠️ UNO per montaggio (`refreshed`): se il cookie non si potesse scrivere,
	 * il server continuerebbe a leggere "0" e un refresh ne chiamerebbe un altro
	 * per sempre. Verso il basso non serve niente: la rail sparisce da sé, e al
	 * render successivo le query non partono più.
	 *
	 * Nessun `setState`: il valore non serve al render, solo al server e al
	 * refresh — quindi niente render a cascata (`react-hooks/set-state-in-effect`).
	 */
	useEffect(() => {
		const mq = window.matchMedia(SIDEBAR_MEDIA_QUERY);
		function sync() {
			writeSidebarCookie(mq.matches);
			if (mq.matches && skipped && !hidden && !refreshed.current) {
				refreshed.current = true;
				router.refresh();
			}
		}
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, [skipped, hidden, router]);

	if (hidden) return null;

	return (
		<div
			className="no-print hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col border-r border-subtle bg-surface backdrop-blur-2xl z-30"
			style={{
				paddingTop: "env(safe-area-inset-top)",
				paddingBottom: "env(safe-area-inset-bottom)",
			}}
		>
			{/*
				Il mockup è largo 252px; qui resta `w-64` (256px) perché il gutter di
				`MainContentShell` è `lg:pl-64`, e i due numeri devono restare lo
				stesso numero — quattro pixel di rail valgono meno di un disallineamento.

				⚠️ Il footer del profilo sta FUORI dal contenitore che scorre, non in
				fondo a esso con `mt-auto` come nel mockup. Due ragioni: su una
				finestra bassa scorrerebbe via insieme alla nav, portandosi dietro il
				menu del profilo; e `overflow-y-auto` ritaglia per specifica ANCHE
				l'asse orizzontale, quindi il pannello che si apre sopra la card
				avrebbe l'ombra tagliata al bordo della rail — la stessa trappola già
				pagata dal carosello della home (Fase 20a) e dalla barra filtri (21c).
				Il `pt-6.5` del footer è il `gap` di 26px che nel mockup separa la nav
				dal footer, garantito anche quando lo spazio manca.
			*/}
			<div className="flex flex-col gap-6.5 flex-1 min-h-0 px-4.5 pt-6.5 overflow-y-auto scrollbar-none">
				<Link href="/" className="flex items-center gap-2.75 px-2 shrink-0 rounded-xl">
					{/* ⚠️ issue #81 — anello nel box-shadow, non `border`: la pastiglia
					    è arrotondata e `--border` è traslucido. Stessa classe della
					    card del grafico in `MonthlyLineChart`. */}
					<span className="w-8.5 h-8.5 rounded-xl bg-control shadow-[inset_0_1px_0_var(--shadow-inset),inset_0_0_0_1px_var(--border)] flex items-center justify-center shrink-0">
						{/*
							⚠️⚠️ Ensō, non lo Sprout — ed è un cambio di MARCHIO, qui soltanto.
							Il mockup desktop (issue #108) lo mette in testa alla rail; lo
							Sprout resta ovunque altrove (icona PWA, `BrandHeader`,
							`BootSplash`). È lo stesso segno della schermata di sblocco
							(`AppLockScreen`, Fase 26b) — stessa geometria, qui nel verde
							d'accento invece che d'inchiostro e a 19px: là è un simbolo al
							centro dello schermo, qui è il marchio accanto al nome.
							`aria-hidden`: il nome del link lo dà "Seichi" accanto.
						*/}
						<svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="text-midori" aria-hidden="true">
							<circle
								cx="12"
								cy="12"
								r="8.5"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeDasharray="44 10"
								transform="rotate(-20 12 12)"
							/>
						</svg>
					</span>
					{/* "Seichi" e 整地 non si traducono: sono il nome (vedi `brand` in
					    it.ts), come in BrandHeader.tsx. */}
					<span className="min-w-0">
						<span className="block text-base font-semibold leading-tight tracking-[0.2px]">Seichi</span>
						<span className="block text-[9.5px] leading-tight tracking-[2.2px] text-disabled mt-0.5">整地</span>
					</span>
				</Link>

				<button
					type="button"
					onClick={() => openTransactionModal()}
					className="flex items-center justify-center gap-2.25 w-full h-11.5 rounded-2xl btn-primary font-semibold text-[13.5px] cursor-pointer shrink-0"
				>
					<Plus size={17} strokeWidth={2} />
					{t.nav.addTransaction}
				</button>

				<nav className="flex flex-col gap-0.75">
					{NAV_ITEMS.map(({ href, icon: Icon, key, dot }) => {
						const active = isActive(pathname, href);
						return (
							<Link
								key={href}
								href={href}
								aria-current={active ? "page" : undefined}
								/*
									La voce attiva è `bg-tab`, non `bg-control` come fino alla 28a: è
									il token nato apposta per "il selezionato" (Fase 18), bianco IN
									RILIEVO in chiaro e appena più luminoso in scuro. `bg-control` in
									chiaro è una tinta più SCURA del fondo, e uno stato scavato si
									legge come disabilitato — la trappola che quel token esiste per
									evitare. Per la stessa ragione il passaggio del mouse schiarisce
									(`bg-surface`) invece di scurire: in entrambi i temi va nella
									stessa direzione dello stato attivo, solo meno.
									⚠️ issue #81 — l'anello sta nel box-shadow, non in un `border`.
								*/
								className={`flex items-center gap-3 px-3.25 py-2.75 rounded-[14px] text-[13.5px] transition-colors ${
									active
										? "bg-tab font-semibold text-foreground shadow-[inset_0_1px_0_var(--shadow-inset),inset_0_0_0_1px_var(--border)]"
										: "font-medium text-secondary hover:bg-surface"
								}`}
							>
								<Icon size={18} strokeWidth={1.6} className={`shrink-0 ${active ? "text-foreground" : "text-muted"}`} />
								{t.nav[key]}
								{active && (
									<span aria-hidden="true" className={`ml-auto w-1.25 h-1.25 rounded-full shrink-0 ${dot}`} />
								)}
							</Link>
						);
					})}
				</nav>
			</div>

			<div className="shrink-0 px-4.5 pt-6.5 pb-5.5">
				{/*
					Senza promise il segnaposto, non il vuoto: se questa rail si vede
					mentre il layout ha saltato le query, il refresh dell'effetto qui
					sopra è già partito e i dati stanno arrivando. Se invece non si vede,
					il segnaposto è dentro un contenitore `hidden` e non costa niente.
				*/}
				{profile ? (
					<Suspense fallback={<ProfileFooterSkeleton />}>
						<ProfileFooter profile={profile} />
					</Suspense>
				) : (
					<ProfileFooterSkeleton />
				)}
			</div>
		</div>
	);
}

/**
 * Il footer del profilo, dalla promise del layout.
 *
 * `null` (nessun utente, o un guasto che `getSidebarProfile()` ha assorbito)
 * non disegna niente: il menu è una comodità, e la voce "Impostazioni" nella
 * nav porta comunque a tema, profilo e uscita.
 *
 * Il sottotitolo usa le STESSE parole della card saldo in home
 * (`t.accounts.activeCount`), così i due conteggi non possono dire due cose.
 * Senza conteggio non c'è sottotitolo: mai "0 conti attivi" per un errore.
 */
function ProfileFooter({ profile }: { profile: Promise<SidebarProfile | null> }) {
	const { t, locale } = useI18n();
	const data = use(profile);

	if (!data) return null;

	return (
		<ProfileMenu
			variant="sidebar"
			initials={data.initials}
			avatarUrl={data.avatarUrl}
			name={data.displayName}
			subtitle={
				data.activeAccounts === null
					? undefined
					: plural(t.accounts.activeCount, data.activeAccounts, locale)
			}
		/>
	);
}

/**
 * Segnaposto della stessa misura della card vera — 54px, cioè `py-2.75` più
 * l'avatar da 32 — o la rail salterebbe di qualche pixel quando la promise
 * risolve. Stesso respiro (`zg-pulse`) degli scheletri della home.
 */
function ProfileFooterSkeleton() {
	return (
		<div aria-hidden="true" className="flex items-center gap-2.75 h-13.5 px-3 rounded-2xl bg-surface ring-border">
			<span className="w-8 h-8 rounded-[11px] bg-surface-elevated zg-pulse shrink-0" />
			<span className="flex flex-col gap-1.5">
				<span
					className="h-2.5 w-24 rounded-full bg-surface-elevated zg-pulse"
					style={{ animationDelay: "0.1s" }}
				/>
				<span
					className="h-2 w-16 rounded-full bg-surface-elevated zg-pulse"
					style={{ animationDelay: "0.15s" }}
				/>
			</span>
		</div>
	);
}
