"use client";
import { Home, List, Plus, ChartPie, ChartNoAxesColumn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";

const NAV_ITEMS = [
	{ href: "/",           icon: Home,             label: "Home" },
	{ href: "/movimenti",  icon: List,             label: "Movimenti" },
	{ href: "/budget",     icon: ChartPie,         label: "Budget" },
	{ href: "/analisi",    icon: ChartNoAxesColumn, label: "Analisi" },
];

export default function BottomNav() {
	const { openTransactionModal } = useUIStore();
	const pathname = usePathname();

	return (
		<div className="absolute left-[50%] translate-[-50%] bottom-0 min-w-88 flex items-center justify-between py-2 px-4 rounded-3xl z-6 border border-subtle bg-surface backdrop-blur-[26px] box-shadow h-16">
			{NAV_ITEMS.slice(0, 2).map(({ href, icon: Icon, label }) => {
				const active = pathname === href;
				return (
					<Link key={href} href={href} className={`flex flex-col items-center gap-0.5 w-13.5 ${active ? "text-foreground" : "text-muted"}`}>
						<Icon size={20} />
						<span className="text-[10px] font-medium">{label}</span>
					</Link>
				);
			})}

			<button
				onClick={openTransactionModal}
				className="w-13.5 h-13.5 mb-1 rounded-2xl shrink-0 fab flex items-center justify-center cursor-pointer -translate-y-4.5"
			>
				<Plus />
			</button>

			{NAV_ITEMS.slice(2).map(({ href, icon: Icon, label }) => {
				const active = pathname === href;
				return (
					<Link key={href} href={href} className={`flex flex-col items-center gap-0.5 w-13.5 ${active ? "text-foreground" : "text-muted"}`}>
						<Icon size={20} />
						<span className="text-[10px] font-medium">{label}</span>
					</Link>
				);
			})}
		</div>
	);
}
