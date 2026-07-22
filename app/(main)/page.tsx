import BalanceCard from "@/components/features/BalanceCard";
import { getDashboardTotals, getTransactions } from "./action";
import SummaryCard from "@/components/UI/SummaryCard";
import { TRANSACTION_TYPES } from "@/types";
import RecentTransaction from "@/components/features/RecentTransaction";
import DashboardRefresher from "@/components/features/DashboardRefresher";

export default async function MainPage() {
	const [result, transaction] = await Promise.all([
		getDashboardTotals(),
		getTransactions(undefined, undefined, 5),
	]);
	const entrata = TRANSACTION_TYPES.find((t) => t.id === "entrata")!;
	const uscita = TRANSACTION_TYPES.find((t) => t.id === "spesa")!;
	const investimento = TRANSACTION_TYPES.find((t) => t.id === "investimento")!;
	const risparmio = TRANSACTION_TYPES.find((t) => t.id === "risparmio")!;

	if ("error" in result) return <p>Errore</p>;
	if ("error" in transaction) return <p>Errore</p>;

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
				/>

				<SummaryCard
					amount={result.speseMese}
					icon={uscita.icon}
					color={uscita.color}
					label="Spese"
				/>

				<SummaryCard
					amount={result.investimentiMese}
					icon={investimento.icon}
					color={investimento.color}
					label="Investimenti"
				/>

				<SummaryCard
					amount={result.risparmiMese}
					icon={risparmio.icon}
					color={risparmio.color}
					label="Risparmi"
				/>
			</div>

			<RecentTransaction transactions={transaction.data} />
			<DashboardRefresher />
		</div>
	);
}
