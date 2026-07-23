import { getGoals } from "./actions";
import GoalsPageClient from "@/components/features/GoalsPageClient";

export default async function RisparmiPage() {
	const result = await getGoals();

	if ("error" in result) return <p className="p-6 text-muted text-sm">Errore nel caricamento degli obiettivi.</p>;

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-36">
			<GoalsPageClient goals={result.data} />
		</div>
	);
}
