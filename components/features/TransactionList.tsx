"use client";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { useUIStore } from "@/store/useUIStore";
import EmptyState from "@/components/UI/EmptyState";
import type { Transaction } from "@/types";
import { TIPO_COLOR, TIPO_LABEL, formatDate, formatAmount } from "@/lib/transaction-utils";

interface TransactionListProps {
	transactions: Transaction[];
	loading: boolean;
}

function Skeleton() {
	return (
		<div className="space-y-2">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-card border border-subtle animate-pulse">
					<div className="w-10 h-10 rounded-xl bg-surface-elevated shrink-0" />
					<div className="flex-1 space-y-2">
						<div className="h-3 rounded-full bg-surface-elevated w-28" />
						<div className="h-2.5 rounded-full bg-surface-elevated w-16" />
					</div>
					<div className="h-3.5 rounded-full bg-surface-elevated w-16" />
				</div>
			))}
		</div>
	);
}

function TransactionsEmpty() {
	const { openTransactionModal } = useUIStore();
	return (
		<div className="py-16">
			<EmptyState
				title="Nessuna transazione ancora"
				description="Le tue entrate e uscite appariranno qui non appena registrerai il primo movimento."
				actionLabel="Aggiungi movimento"
				onAction={openTransactionModal}
			/>
		</div>
	);
}

export default function TransactionList({ transactions, loading }: TransactionListProps) {
	const { openEditModal } = useUIStore();

	if (loading) return <Skeleton />;
	if (transactions.length === 0) return <TransactionsEmpty />;

	const groups = transactions.reduce<Record<string, Transaction[]>>((acc, t) => {
		const key = formatDate(t.date);
		if (!acc[key]) acc[key] = [];
		acc[key].push(t);
		return acc;
	}, {});

	return (
		<div className="space-y-5">
			{Object.entries(groups).map(([date, items]) => (
				<div key={date}>
					<p className="text-xs font-medium tracking-[1.6px] text-muted mb-2.5 ms-1">{date}</p>
					<div className="space-y-2">
						{items.map((t) => {
							const cat = t.categories;
							const Icon = cat ? (ICON_MAP[cat.icon] ?? GOAL_ICON_MAP[cat.icon]) : null;
							const color = `var(--color-${cat?.color ?? "kiri"})`;
							const amountColor = TIPO_COLOR[t.type] ?? "var(--text-primary)";

							return (
								<button
									key={t.id}
									onClick={() => openEditModal(t)}
									className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-card border border-subtle card-shadow text-left active:opacity-75 transition-opacity"
								>
									<div
										className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
										style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
									>
										{Icon
											? <Icon size={17} style={{ color }} />
											: <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
										}
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold truncate">{cat?.name ?? "—"}</p>
										<p className="text-xs text-muted mt-0.5">
											{t.notes ? t.notes : TIPO_LABEL[t.type]}
										</p>
									</div>
									<p className="text-sm font-semibold shrink-0" style={{ color: amountColor }}>
										{formatAmount(t.amount, t.type)}
									</p>
								</button>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}
