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

export default function BottomNav() {
	const { openTransactionModal } = useUIStore();
	const pathname = usePathname();
	const { t } = useI18n();

	return (
		<>
			{/* Blur overlay — sfuma il contenuto dietro la nav, edge-to-edge */}
			<div
				className="fixed bottom-0 left-0 right-0 h-28 pointer-events-none z-39 backdrop-blur-2xl"
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
			<div className="fixed left-[50%] translate-[-50%] bottom-0 min-w-88 flex items-center justify-between py-2 px-4 rounded-3xl z-40 border border-subtle bg-surface backdrop-blur-[26px] box-shadow h-16">
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
