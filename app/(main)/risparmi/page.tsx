import { getGoals } from "./actions";
import GoalsPageClient from "@/components/features/GoalsPageClient";
import { getDictionary } from "@/lib/i18n/server";

export default async function RisparmiPage() {
	const result = await getGoals();
	const t = await getDictionary();

	if ("error" in result) return <p className="p-6 text-muted text-sm">{t.goals.loadError}</p>;

	return (
		// Da `lg:` il wrapper delle pagine desktop di #108: la bottom nav non c'è
		// più, quindi il fondo torna a un margine normale.
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-36 lg:px-10 lg:pt-9 lg:pb-12 lg:max-w-6xl lg:mx-auto lg:w-full">
			<GoalsPageClient goals={result.data} />
		</div>
	);
}
