"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { ANALYTICS_PERIODS } from "@/lib/analytics";

/**
 * Gli id sono già i valori del parametro `?periodo=`.
 *
 * Prima erano le etichette visibili ("Settimana", "Mese", "Anno") e serviva una
 * mappa `TAB_PARAM` per tradurle in `settimana|mese|anno`. Con le etichette nel
 * dizionario (`t.analytics.tabs`) quella mappa sparisce: il testo non è più
 * anche una chiave.
 */
/*
 * ⚠️ La lista viene da `lib/analytics.ts`, che è la stessa usata dal titolo
 * del periodo e dalla validazione del report (23b). Tenerne una copia qui
 * significava che aggiungere una finestra temporale richiedeva di ricordarsi
 * di tre punti — e il terzo, il report, è nato proprio dalla necessità di
 * validare quel parametro.
 */
const TABS = ANALYTICS_PERIODS;
type Tab = (typeof TABS)[number];

export default function AnalyticsTabs() {
	const { t } = useI18n();
	const router = useRouter();
	const searchParams = useSearchParams();
	const periodo = searchParams.get("periodo") ?? "mese";
	const active: Tab = TABS.find((tab) => tab === periodo) ?? "mese";

	const handleClick = (tab: Tab) => {
		if (tab === periodo) return;
		const params = new URLSearchParams(searchParams.toString());
		params.set("periodo", tab);
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
					{t.analytics.tabs[tab]}
				</button>
			))}
		</div>
	);
}
