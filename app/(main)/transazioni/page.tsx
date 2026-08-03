"use client";
import { useState, useEffect, useCallback } from "react";
import { getTransactions } from "@/app/(main)/action";
import { getBudgetOverview } from "@/app/(main)/budget-actions";
import FilterBar from "@/components/features/Filterbar";
import TransactionList from "@/components/features/TransactionList";
import BudgetCards from "@/components/features/BudgetCards";
import { useUIStore } from "@/store/useUIStore";
import { clientClock } from "@/lib/dates";
import type { BudgetOverview, Transaction } from "@/types";

export default function MovimentiPage() {
	const [search, setSearch] = useState("");
	const [tipo, setTipo] = useState("");
	const [periodo, setPeriodo] = useState("30d");
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [budgets, setBudgets] = useState<BudgetOverview | null>(null);
	const [loading, setLoading] = useState(true);
	const transactionSavedAt = useUIStore((s) => s.transactionSavedAt);

	const loadTransactions = useCallback(async () => {
		setLoading(true);
		try {
			const result = await getTransactions(tipo || undefined, periodo);
			setTransactions("data" in result ? ((result.data as Transaction[]) ?? []) : []);
		} finally {
			setLoading(false);
		}
	}, [tipo, periodo]);

	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => { loadTransactions(); }, [loadTransactions, transactionSavedAt]);

	// I budget guardano sempre il periodo corrente e NON dipendono dai filtri:
	// tenerli nello stesso effetto li faceva rileggere — con le transazioni del
	// periodo, per giunta — a ogni tocco su "30 giorni" o "Tutte". Si aggiornano
	// solo all'ingresso e dopo il salvataggio di un movimento, che è ciò che fa
	// diventare rossa la barra subito.
	useEffect(() => {
		let cancelled = false;
		getBudgetOverview(clientClock()).then((res) => {
			if (cancelled) return;
			setBudgets("data" in res ? res.data : null);
		});
		return () => { cancelled = true; };
	}, [transactionSavedAt]);

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
