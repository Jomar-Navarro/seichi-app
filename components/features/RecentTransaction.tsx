"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { useUIStore } from "@/store/useUIStore";
import type { Transaction } from "@/types";
import {
	TIPO_COLOR,
	TIPO_LABEL,
	formatDate,
	formatAmount,
} from "@/lib/transaction-utils";

function EmptyState() {
	const { openTransactionModal } = useUIStore();
	return (
		<div className="flex flex-col items-center justify-center py-10 text-center">
			<button
				onClick={openTransactionModal}
				className="w-14 h-14 rounded-full bg-card border border-subtle flex items-center justify-center mb-4 card-shadow"
			>
				<Plus size={20} className="text-muted" />
			</button>
			<p className="font-semibold mb-1">Ancora nessun movimento</p>
			<p className="text-sm text-muted max-w-xs leading-relaxed">
				Aggiungi il primo movimento per iniziare.
			</p>
		</div>
	);
}

interface RecentTransactionProps {
	transactions: Transaction[];
}

export default function RecentTransaction({
	transactions,
}: RecentTransactionProps) {
	const { openEditModal } = useUIStore();

	return (
		<div>
			{/* Header — esterno al card */}
			<div className="flex items-center justify-between mb-3">
				<p className="font-semibold">Transazioni recenti</p>
				<Link
					href="/transazioni"
					className="text-sm font-medium"
					style={{ color: "var(--color-midori)" }}
				>
					Vedi tutti
				</Link>
			</div>

			<div className="bg-card border border-subtle rounded-3xl overflow-hidden card-shadow">
				{transactions.length === 0 ? (
					<div className="px-4 py-4">
						<EmptyState />
					</div>
				) : (
					<div className="relative">
						<div className="flex flex-col gap-0">
							{transactions.map((t, i) => {
								const cat = t.categories;
								const Icon = cat ? ICON_MAP[cat.icon] : null;
								const color = `var(--color-${cat?.color ?? "kiri"})`;
								const amountColor = TIPO_COLOR[t.type] ?? "var(--text-primary)";
								const isLast = i === transactions.length - 1;

								return (
									<button
										key={t.id}
										onClick={() => openEditModal(t)}
										className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:opacity-75 transition-opacity ${!isLast ? "border-b border-subtle" : ""}`}
									>
										<div
											className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
											style={{
												background: `color-mix(in srgb, ${color} 16%, transparent)`,
											}}
										>
											{Icon ? (
												<Icon size={17} style={{ color }} />
											) : (
												<span
													className="w-2.5 h-2.5 rounded-full"
													style={{ background: color }}
												/>
											)}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-semibold truncate">
												{cat?.name ?? "—"}
											</p>
											<p className="text-xs text-muted mt-0.5">
												{t.notes ? t.notes : TIPO_LABEL[t.type]} ·{" "}
												{formatDate(t.date)}
											</p>
										</div>
										<p
											className="text-sm font-semibold shrink-0"
											style={{ color: amountColor }}
										>
											{formatAmount(t.amount, t.type)}
										</p>
									</button>
								);
							})}
						</div>

						{/* Fade bottom — solo gradiente, nessun blur sul contenuto */}
						<div
							className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
							style={{
								background:
									"linear-gradient(to top, var(--deep) 0%, transparent 100%)",
							}}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
