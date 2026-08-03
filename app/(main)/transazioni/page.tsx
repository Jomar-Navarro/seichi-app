"use client";
import { useState, useEffect, useCallback } from "react";
import { getTransactions } from "@/app/(main)/action";
import { getBudgetOverview } from "@/app/(main)/budget-actions";
import FilterBar from "@/components/features/Filterbar";
import TransactionList from "@/components/features/TransactionList";
import BudgetCards from "@/components/features/BudgetCards";
import { useUIStore } from "@/store/useUIStore";
import type { BudgetOverview, Transaction } from "@/types";

export default function MovimentiPage() {
	const [search, setSearch] = useState("");
	const [tipo, setTipo] = useState("");
	const [periodo, setPeriodo] = useState("30d");
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [budgets, setBudgets] = useState<BudgetOverview | null>(null);
	const [loading, setLoading] = useState(true);
	const transactionSavedAt = useUIStore((s) => s.transactionSavedAt);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			// Le due letture sono indipendenti: i filtri cambiano solo la lista,
			// mentre i budget guardano sempre il periodo corrente. Si caricano
			// insieme perché il rientro dopo un salvataggio deve aggiornare
			// entrambi — è quello che fa diventare rossa la barra subito.
			const [result, budgetResult] = await Promise.all([
				getTransactions(tipo || undefined, periodo),
				getBudgetOverview(),
			]);

			if ("data" in result) {
				setTransactions((result.data as Transaction[]) ?? []);
			} else {
				setTransactions([]);
			}
			setBudgets("data" in budgetResult ? budgetResult.data : null);
		} finally {
			setLoading(false);
		}
	}, [tipo, periodo]);

	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => { load(); }, [load, transactionSavedAt]);

	const filtered = search.trim()
		? transactions.filter((t) =>
			t.categories?.name.toLowerCase().includes(search.toLowerCase()) ||
			t.notes?.toLowerCase().includes(search.toLowerCase())
		)
		: transactions;

	return (
		<div className="flex flex-col flex-1 px-5 pt-8 pb-34 overflow-y-auto">
			<h1 className="text-2xl font-semibold mb-5">Movimenti</h1>
			<FilterBar
				search={search}
				tipo={tipo}
				periodo={periodo}
				onSearchChange={setSearch}
				onTipoChange={setTipo}
				onPeriodoChange={setPeriodo}
			/>
			<div className="mt-5">
				{budgets && <BudgetCards overview={budgets} />}
				<TransactionList transactions={filtered} loading={loading} />
			</div>
		</div>
	);
}
