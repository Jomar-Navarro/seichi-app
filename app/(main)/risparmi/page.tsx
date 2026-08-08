import { getGoals } from "./actions";
import GoalsPageClient from "@/components/features/GoalsPageClient";
import { getDictionary } from "@/lib/i18n/server";

export default async function RisparmiPage() {
	const result = await getGoals();
	const t = await getDictionary();

	if ("error" in result) return <p className="p-6 text-muted text-sm">{t.goals.loadError}</p>;

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-36">
			<GoalsPageClient goals={result.data} />
		</div>
	);
}
