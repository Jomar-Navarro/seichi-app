"use client";
import { useRouter, useSearchParams } from "next/navigation";

const TABS = ["Settimana", "Mese", "Anno"] as const;
type Tab = (typeof TABS)[number];

const TAB_PARAM: Record<Tab, string> = {
	Settimana: "settimana",
	Mese: "mese",
	Anno: "anno",
};

export default function AnalyticsTabs() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const periodo = searchParams.get("periodo") ?? "mese";
	const active = TABS.find((t) => TAB_PARAM[t] === periodo) ?? "Mese";

	const handleClick = (tab: Tab) => {
		if (TAB_PARAM[tab] === periodo) return;
		const params = new URLSearchParams(searchParams.toString());
		params.set("periodo", TAB_PARAM[tab]);
		router.replace(`/analisi?${params.toString()}`);
	};

	return (
		// Le utility segment-tab/active-tab esistono apposta e seguono i token:
		// i valori cablati erano quelli del solo tema scuro.
		<div className="flex p-1 rounded-2xl segment-tab">
			{TABS.map((tab) => (
				<button
					key={tab}
					onClick={() => handleClick(tab)}
					className={`flex-1 text-center py-2.25 rounded-xl text-[13px] transition-all border-none cursor-pointer ${
						active === tab
							? "font-semibold active-tab"
							: "font-medium text-muted bg-transparent"
					}`}
				>
					{tab}
				</button>
			))}
		</div>
	);
}
