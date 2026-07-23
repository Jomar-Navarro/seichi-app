import Link from "next/link";
import { ChevronRight } from "lucide-react";
import BalanceCard from "@/components/features/BalanceCard";
import { getDashboardTotals, getTransactions } from "./action";
import { getGoals } from "./risparmi/actions";
import SummaryCard from "@/components/UI/SummaryCard";
import { TRANSACTION_TYPES } from "@/types";
import RecentTransaction from "@/components/features/RecentTransaction";
import DashboardRefresher from "@/components/features/DashboardRefresher";
import { ChartNoAxesCombinedIcon } from "@/lib/seichi-icons";

function AnalisiSparkline({ values }: { values: number[] }) {
	if (values.length < 2) return null;
	const max = Math.max(...values, 1);
	const W = 48, H = 22;
	const pts = values
		.map((v, i) => {
			const x = (i / (values.length - 1)) * W;
			const y = H - 3 - (v / max) * (H - 6);
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(" ");
	return (
		<svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" className="shrink-0">
			<polyline
				points={pts}
				stroke="var(--color-kiri)"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity={0.5}
			/>
		</svg>
	);
}

export default async function MainPage() {
	const [result, transaction, goalsResult] = await Promise.all([
		getDashboardTotals(),
		getTransactions(undefined, undefined, 5),
		getGoals(),
	]);

	const entrata = TRANSACTION_TYPES.find((t) => t.id === "entrata")!;
	const uscita = TRANSACTION_TYPES.find((t) => t.id === "spesa")!;
	const investimento = TRANSACTION_TYPES.find((t) => t.id === "investimento")!;
	const risparmio = TRANSACTION_TYPES.find((t) => t.id === "risparmio")!;

	if ("error" in result) return <p>Errore</p>;
	if ("error" in transaction) return <p>Errore</p>;

	const goals = "error" in goalsResult ? [] : goalsResult.data;
	const totalTarget = goals.reduce((acc, g) => acc + (g.target_amount ?? 0), 0);
	const totalSaved = goals.reduce((acc, g) => acc + g.saved_amount, 0);
	const risparmiProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

	return (
		<div className="flex flex-col gap-4 px-5 pt-7 pb-32">
			<BalanceCard
				saldoTotale={result.saldoTotale}
				saldoMese={result.saldoMese}
			/>

			<div className="grid grid-cols-2 gap-3">
				<SummaryCard
					amount={result.entrateMese}
					icon={entrata.icon}
					color={entrata.color}
					label="Entrate"
					trend={result.entrateTrend}
				/>

				<SummaryCard
					amount={result.speseMese}
					icon={uscita.icon}
					color={uscita.color}
					label="Spese"
					trend={result.speseTrend}
				/>

				<SummaryCard
					amount={result.investimentiMese}
					icon={investimento.icon}
					color={investimento.color}
					label="Investimenti"
					trend={result.investimentiTrend}
				/>

				<SummaryCard
					amount={result.risparmiMese}
					icon={risparmio.icon}
					color={risparmio.color}
					label={totalTarget > 0 ? `Risparmi · ${risparmiProgress}%` : "Risparmi"}
					progress={totalTarget > 0 ? risparmiProgress : undefined}
					trend={totalTarget > 0 ? undefined : result.entrateTrend.map(() => 0)}
				/>
			</div>

			{/* Analisi shortcut */}
			<Link
				href="/analisi"
				className="flex items-center justify-between px-4 py-3.5 rounded-2xl border border-subtle card-shadow"
				style={{ background: "var(--surface)" }}
			>
				<div className="flex items-center gap-3">
					<div
						className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
						style={{ background: "color-mix(in srgb, var(--color-ao) 14%, transparent)" }}
					>
						<ChartNoAxesCombinedIcon size={17} strokeWidth={1.5} style={{ color: "var(--color-ao)" }} />
					</div>
					<div>
						<p className="text-sm font-semibold">Analisi</p>
						<p className="text-xs text-muted">Grafici e statistiche</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<AnalisiSparkline values={result.speseTrend} />
					<ChevronRight size={16} className="text-muted" />
				</div>
			</Link>

			<RecentTransaction transactions={transaction.data} />
			<DashboardRefresher />
		</div>
	);
}
