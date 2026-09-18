"use client";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";
import { useI18n } from "@/components/features/I18nProvider";
import { useNavHidden } from "./useNavVisibility";
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

export default function BottomNav() {
	const { openTransactionModal } = useUIStore();
	const pathname = usePathname();
	const { t } = useI18n();
	// Le rotte-documento e il flusso a schermo intero (wizard PIN) sono in
	// `useNavVisibility.ts`, condiviso con `Sidebar.tsx` (Fase 28a): le due
	// barre devono sparire esattamente insieme, o una futura rotta o un
	// futuro flusso ne aggiornerebbe una sola.
	const hidden = useNavHidden();

	if (hidden) return null;

	return (
		<>
			{/*
				Blur overlay — sfuma il contenuto dietro la nav, edge-to-edge.

				⚠️ `no-print` su entrambi gli elementi fissi (Fase 23b): la barra è
				`fixed`, e un elemento fisso in stampa non compare una volta — si
				ripete su OGNI foglio, perché ogni pagina è un nuovo viewport.
			*/}
			<div
				className="no-print lg:hidden fixed bottom-0 left-0 right-0 h-28 pointer-events-none z-39 backdrop-blur-2xl"
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
			{/*
				issue #81 — l'anello sostituisce il bordo (box-shadow-ring), ma qui
				NON si può aggiungere `overflow-hidden`: il FAB al centro esce sopra
				questa barra con `-translate-y-4.5`, e ritagliare lo taglierebbe a
				metà. Il ritaglio di `backdrop-filter` sull'angolo resta quindi un
				residuo aperto, deliberatamente — è la stessa ragione per cui questa
				barra era già esclusa dal giro precedente.
			*/}
			<div
				className="no-print lg:hidden fixed left-[50%] translate-[-50%] min-w-88 flex items-center justify-between py-2 px-4 rounded-3xl z-40 bg-surface backdrop-blur-[26px] box-shadow-ring h-16"
				// issue #86 — `bottom-0` metteva la pillola a filo del bordo reale
				// dello schermo: su un device con home indicator finiva dietro la
				// sua zona di gesto. `env()` la solleva di quel tanto; su un device
				// senza notch/indicator vale 0 e il comportamento resta identico a
				// prima (flush al bordo, com'era voluto).
				style={{ bottom: "env(safe-area-inset-bottom)" }}
			>
				{NAV_ITEMS.slice(0, 2).map(({ href, icon: Icon, key }) => {
					const active = pathname === href;
					return (
						<Link
							key={href}
							href={href}
							// issue #69 — -my-1 py-1: la barra è alta 64px e il contenuto
							// (icona+etichetta) solo ~36, quindi c'è margine sopra/sotto
							// per portare l'area toccabile a 44px senza spostare nulla.
							className={`-my-1 py-1 flex flex-col items-center gap-0.5 w-13.5 ${active ? "text-foreground" : "text-muted"}`}
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
							// issue #69 — -my-1 py-1: la barra è alta 64px e il contenuto
							// (icona+etichetta) solo ~36, quindi c'è margine sopra/sotto
							// per portare l'area toccabile a 44px senza spostare nulla.
							className={`-my-1 py-1 flex flex-col items-center gap-0.5 w-13.5 ${active ? "text-foreground" : "text-muted"}`}
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
