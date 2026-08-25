"use client";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";
import { useI18n } from "@/components/features/I18nProvider";
import {
	HomeIcon,
	ReceiptIcon,
	PiggyBankIcon,
	TrendingUpIcon,
} from "@/lib/seichi-icons";

// I `href` restano in italiano: sono identificatori di route, non testo letto
// dall'utente. La `key` del dizionario è ciò che cambia lingua.
const NAV_ITEMS = [
	{ href: "/", icon: HomeIcon, key: "home" },
	{ href: "/transazioni", icon: ReceiptIcon, key: "transactions" },
	{ href: "/risparmi", icon: PiggyBankIcon, key: "goals" },
	{ href: "/investimenti", icon: TrendingUpIcon, key: "investments" },
] as const;

/**
 * Le rotte che sono un DOCUMENTO, non una schermata dell'app.
 *
 * ⚠️ Qui la barra non si limita a occupare spazio: è `fixed`, quindi
 * galleggia sopra il contenuto mentre si scorre, e su un'anteprima di stampa
 * copre proprio le parti che si sta andando a controllare — il donut delle
 * spese, nel caso che l'ha fatta notare. `no-print` la toglie dalla carta ma
 * non dallo schermo, e l'anteprima serve a vedere prima ciò che uscirà.
 *
 * ⚠️ Nascondere qui è meglio che spostare il report fuori dal gruppo
 * `(main)`: quello vorrebbe un layout proprio e un secondo controllo di
 * autenticazione, per ottenere la stessa cosa in più righe.
 */
const DOCUMENT_ROUTES = ["/analisi/report"];

export default function BottomNav() {
	const { openTransactionModal } = useUIStore();
	const pathname = usePathname();
	const { t } = useI18n();

	if (DOCUMENT_ROUTES.includes(pathname)) return null;

	return (
		<>
			{/*
				Blur overlay — sfuma il contenuto dietro la nav, edge-to-edge.

				⚠️ `no-print` su entrambi gli elementi fissi (Fase 23b): la barra è
				`fixed`, e un elemento fisso in stampa non compare una volta — si
				ripete su OGNI foglio, perché ogni pagina è un nuovo viewport.
			*/}
			<div
				className="no-print fixed bottom-0 left-0 right-0 h-28 pointer-events-none z-39 backdrop-blur-2xl"
				style={{
					WebkitMaskImage:
						"linear-gradient(to top, black 35%, transparent 100%)",
					maskImage: "linear-gradient(to top, black 35%, transparent 100%)",
					// Sfuma verso il fondo pagina, che cambia col tema: cablato al
					// blu notte era una macchia scura sulla carta chiara.
					background:
						"linear-gradient(to top, color-mix(in srgb, var(--background-secondary) 96%, transparent) 0%, color-mix(in srgb, var(--background-secondary) 40%, transparent) 50%, transparent 100%)",
				}}
			/>
			<div className="no-print fixed left-[50%] translate-[-50%] bottom-0 min-w-88 flex items-center justify-between py-2 px-4 rounded-3xl z-40 border border-subtle bg-surface backdrop-blur-[26px] box-shadow h-16">
				{NAV_ITEMS.slice(0, 2).map(({ href, icon: Icon, key }) => {
					const active = pathname === href;
					return (
						<Link
							key={href}
							href={href}
							className={`flex flex-col items-center gap-0.5 w-13.5 ${active ? "text-foreground" : "text-muted"}`}
						>
							<Icon size={20} />
							<span className="text-[10px] font-medium">{t.nav[key]}</span>
						</Link>
					);
				})}

				<button
					onClick={() => openTransactionModal()}
					aria-label={t.nav.addTransaction}
					className="w-13.5 h-13.5 mb-1 rounded-2xl shrink-0 fab flex items-center justify-center cursor-pointer -translate-y-4.5"
				>
					<Plus />
				</button>

				{NAV_ITEMS.slice(2).map(({ href, icon: Icon, key }) => {
					const active = pathname === href;
					return (
						<Link
							key={href}
							href={href}
							className={`flex flex-col items-center gap-0.5 w-13.5 ${active ? "text-foreground" : "text-muted"}`}
						>
							<Icon size={20} />
							<span className="text-[10px] font-medium">{t.nav[key]}</span>
						</Link>
					);
				})}
			</div>
		</>
	);
}
