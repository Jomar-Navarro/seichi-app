"use client";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { useUIStore } from "@/store/useUIStore";
import EmptyState from "@/components/UI/EmptyState";
import type { Transaction } from "@/types";
import { TIPO_INK, formatDate, formatAmount } from "@/lib/transaction-utils";
import { useI18n } from "./I18nProvider";

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
	const { t } = useI18n();
	return (
		<div className="py-16">
			<EmptyState
				title={t.transactions.emptyTitle}
				description={t.transactions.emptyDescription}
				actionLabel={t.transactions.addAction}
				onAction={openTransactionModal}
			/>
		</div>
	);
}

export default function TransactionList({ transactions, loading }: TransactionListProps) {
	const { openEditModal } = useUIStore();
	const { locale, t } = useI18n();

	if (loading) return <Skeleton />;
	if (transactions.length === 0) return <TransactionsEmpty />;

	const groups = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
		const key = formatDate(tx.date, locale);
		if (!acc[key]) acc[key] = [];
		acc[key].push(tx);
		return acc;
	}, {});

	return (
		<div className="space-y-5">
			{Object.entries(groups).map(([date, items]) => (
				<div key={date}>
					<p className="text-xs font-medium tracking-[1.6px] text-muted mb-2.5 ms-1">{date}</p>
					<div className="space-y-2">
						{items.map((tx) => {
							const cat = tx.categories;
							const Icon = cat ? (ICON_MAP[cat.icon] ?? GOAL_ICON_MAP[cat.icon]) : null;
							const color = `var(--color-${cat?.color ?? "kiri"})`;
							const amountColor = TIPO_INK[tx.type] ?? "var(--text-primary)";

							return (
								<button
									key={tx.id}
									onClick={() => openEditModal(tx)}
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
											{tx.notes ? tx.notes : t.types[tx.type as keyof typeof t.types]}
										</p>
									</div>
									<p className="text-sm font-semibold shrink-0" style={{ color: amountColor }}>
										{formatAmount(tx.amount, tx.type, locale)}
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
