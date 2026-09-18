"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Sprout } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useI18n } from "@/components/features/I18nProvider";
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
const NAV_ITEMS = [
	{ href: "/", icon: HomeIcon, key: "home" },
	{ href: "/transazioni", icon: ReceiptIcon, key: "transactions" },
	{ href: "/risparmi", icon: PiggyBankIcon, key: "goals" },
	{ href: "/investimenti", icon: TrendingUpIcon, key: "investments" },
	{ href: "/analisi", icon: ChartNoAxesCombinedIcon, key: "analytics" },
	{ href: "/impostazioni", icon: SettingsIcon, key: "settings" },
] as const;

/**
 * La rail persistente da `lg:` in su (Fase 28a) — sostituisce la pillola
 * mobile, non la affianca: `BottomNav` porta `lg:hidden`, questa
 * `hidden lg:flex`. Nasconde alle stesse condizioni della pillola
 * (`useNavHidden`), così il gutter che `MainContentShell` le riserva sparisce
 * in accordo, mai con uno spazio vuoto lasciato dietro.
 */
export default function Sidebar() {
	const { openTransactionModal } = useUIStore();
	const pathname = usePathname();
	const { t } = useI18n();
	const hidden = useNavHidden();

	if (hidden) return null;

	return (
		<div
			className="no-print hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col border-r border-subtle bg-surface backdrop-blur-2xl z-30"
			style={{
				paddingTop: "env(safe-area-inset-top)",
				paddingBottom: "env(safe-area-inset-bottom)",
			}}
		>
			<div className="flex flex-col flex-1 min-h-0 px-4 py-7 overflow-y-auto scrollbar-none">
				<Link href="/" className="flex items-center gap-2.5 px-2.5 mb-7 shrink-0">
					<Sprout size={20} className="text-midori" />
					{/* "Seichi" non è tradotto nemmeno in BrandHeader.tsx: è il nome del prodotto, non testo. */}
					<span className="text-[15px] font-semibold">Seichi</span>
				</Link>

				<button
					onClick={() => openTransactionModal()}
					className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl btn-primary font-semibold text-[13.5px] mb-5 cursor-pointer shrink-0"
				>
					<Plus size={16} />
					{t.nav.addTransaction}
				</button>

				<nav className="flex flex-col gap-0.5">
					{NAV_ITEMS.map(({ href, icon: Icon, key }) => {
						const active = pathname === href;
						return (
							<Link
								key={href}
								href={href}
								className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[14px] font-medium ${
									active ? "bg-control text-foreground" : "text-muted"
								}`}
							>
								<Icon size={19} strokeWidth={1.7} />
								{t.nav[key]}
							</Link>
						);
					})}
				</nav>
			</div>
		</div>
	);
}
