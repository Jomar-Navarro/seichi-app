"use client";
import { useState, useEffect, useCallback } from "react";
import { getTransactions } from "@/app/(main)/action";
import FilterBar from "@/components/features/Filterbar";
import TransactionList from "@/components/features/TransactionList";
import { useUIStore } from "@/store/useUIStore";
import type { Transaction } from "@/types";

export default function MovimentiPage() {
	const [search, setSearch] = useState("");
	const [tipo, setTipo] = useState("");
	const [periodo, setPeriodo] = useState("30d");
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [loading, setLoading] = useState(true);
	const transactionSavedAt = useUIStore((s) => s.transactionSavedAt);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const result = await getTransactions(tipo || undefined, periodo);
			if ("data" in result) {
				setTransactions((result.data as Transaction[]) ?? []);
			} else {
				setTransactions([]);
			}
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
		<div className="flex flex-col flex-1 px-5 pt-8 pb-24 overflow-y-auto">
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
				<TransactionList transactions={filtered} loading={loading} />
			</div>
		</div>
	);
}
