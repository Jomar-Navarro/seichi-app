import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import BalanceCard from "@/components/features/BalanceCard";
import { getDashboardTotals, getTransactions } from "./action";
import { getGoals } from "./risparmi/actions";
import SummaryCard from "@/components/UI/SummaryCard";
import { TRANSACTION_TYPES } from "@/types";
import RecentTransaction from "@/components/features/RecentTransaction";
import DashboardRefresher from "@/components/features/DashboardRefresher";
import HomeSkeleton from "@/components/features/HomeSkeleton";
import ProfileMenu from "@/components/features/ProfileMenu";
import Sparkline from "@/components/UI/Sparkline";
import { createClient } from "@/lib/supabase/server";
import { ChartNoAxesCombinedIcon } from "@/lib/seichi-icons";

export default function MainPage() {
	return (
		<Suspense fallback={<HomeSkeleton />}>
			<DashboardContent />
		</Suspense>
	);
}

async function DashboardContent() {
	const supabase = await createClient();
	const [result, transaction, goalsResult, { data: { user } }] = await Promise.all([
		getDashboardTotals(),
		getTransactions(undefined, undefined, 5),
		getGoals(),
		supabase.auth.getUser(),
	]);

	const initials = (user?.email ?? "").slice(0, 2).toUpperCase() || "··";

	const entrata = TRANSACTION_TYPES.find((t) => t.id === "entrata")!;
	const uscita = TRANSACTION_TYPES.find((t) => t.id === "spesa")!;
	const investimento = TRANSACTION_TYPES.find((t) => t.id === "investimento")!;
	const risparmio = TRANSACTION_TYPES.find((t) => t.id === "risparmio")!;

	if ("error" in result) return <p>Errore</p>;
	if ("error" in transaction) return <p>Errore</p>;

	const goals = "error" in goalsResult ? [] : goalsResult.data;
	const goalsWithTarget = goals.filter((g) => (g.target_amount ?? 0) > 0);
	const totalTarget = goalsWithTarget.reduce((acc, g) => acc + (g.target_amount ?? 0), 0);
	const totalSaved = goalsWithTarget.reduce((acc, g) => acc + g.saved_amount, 0);
	const risparmiProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

	return (
		<div className="flex flex-col gap-4 px-5 pt-7 pb-32">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-[13px] text-muted">Bentornato</p>
					<p className="text-xl font-semibold leading-tight">Il tuo terreno</p>
				</div>
				<ProfileMenu initials={initials} />
			</div>

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
					trend={result.risparmiTrend}
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
					<Sparkline
						values={result.speseTrend}
						color="var(--color-kiri)"
						width={48}
						height={22}
						opacity={0.5}
						pad={3}
					/>
					<ChevronRight size={16} className="text-muted" />
				</div>
			</Link>

			<RecentTransaction transactions={transaction.data} />
			<DashboardRefresher />
		</div>
	);
}
