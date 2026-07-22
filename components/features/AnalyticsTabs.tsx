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
		<div className="flex p-1 rounded-2xl bg-[rgba(230,233,239,0.04)] border border-[rgba(230,233,239,0.09)]">
			{TABS.map((tab) => (
				<button
					key={tab}
					onClick={() => handleClick(tab)}
					className={`flex-1 text-center py-2.25 rounded-xl text-[13px] transition-all border-none cursor-pointer ${
						active === tab
							? "font-semibold text-tsuki bg-[rgba(230,233,239,0.10)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_16px_rgba(0,0,0,0.30)]"
							: "font-medium text-kiri bg-transparent"
					}`}
				>
					{tab}
				</button>
			))}
		</div>
	);
}
