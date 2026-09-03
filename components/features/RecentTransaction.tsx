"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { useUIStore } from "@/store/useUIStore";
import type { Transaction } from "@/types";
import {
	DIRECTION_ARROW,
	TIPO_COLOR,
	TIPO_INK,
	amountSign,
	formatDate,
	formatAmount,
} from "@/lib/transaction-utils";
import { ArrowLeftRightIcon } from "@/lib/seichi-icons";
import { useI18n } from "./I18nProvider";

function EmptyState() {
	const { openTransactionModal } = useUIStore();
	const { t } = useI18n();
	return (
		<div className="flex flex-col items-center justify-center py-10 text-center">
			<button
				onClick={() => openTransactionModal()}
				className="w-14 h-14 rounded-full bg-card card-shadow-ring flex items-center justify-center mb-4"
			>
				<Plus size={20} className="text-muted" />
			</button>
			<p className="font-semibold mb-1">{t.home.emptyTitle}</p>
			<p className="text-sm text-muted max-w-xs leading-relaxed">
				{t.home.emptyDescription}
			</p>
		</div>
	);
}

interface RecentTransactionProps {
	transactions: Transaction[];
	/** Per nominare i conti di un trasferimento: vedi `TransactionList`. */
	accounts?: { id: string; name: string }[];
	/**
	 * Il conto selezionato in home, se uno solo. Decide il segno degli importi.
	 *
	 * ⚠️ Le quattro card sopra restano una vista di FLUSSO e i trasferimenti non
	 * ci entrano: qui invece compaiono, ed è voluto. Questa sezione è un
	 * estratto del registro, non un totale — nasconderla farebbe sembrare che il
	 * trasferimento appena registrato non sia mai avvenuto, che è la cosa
	 * peggiore da comunicare subito dopo un salvataggio andato a buon fine.
	 */
	viewedAccountId?: string | null;
}

export default function RecentTransaction({
	transactions,
	accounts = [],
	viewedAccountId = null,
}: RecentTransactionProps) {
	const { openEditModal } = useUIStore();
	const { locale, t } = useI18n();

	const accountName = new Map(accounts.map((a) => [a.id, a.name]));

	return (
		<div>
			{/* Header — esterno al card */}
			<div className="flex items-center justify-between mb-3">
				<p className="font-semibold">{t.home.recentTitle}</p>
				<Link
					href="/transazioni"
					className="text-sm font-medium"
					style={{ color: "var(--ink-midori)" }}
				>
					{t.home.seeAll}
				</Link>
			</div>

			{/*
				Niente sfumatura in fondo: la lista NON scorre (la Home chiede 5
				movimenti e li mostra tutti), quindi non c'è nulla da lasciar
				intuire — ed è a questo che serve una sfumatura.
			*/}
			<div className="bg-card rounded-3xl overflow-hidden card-shadow-ring">
				{transactions.length === 0 ? (
					<div className="px-4 py-4">
						<EmptyState />
					</div>
				) : (
					<div className="flex flex-col">
						{transactions.map((tx, i) => {
								const isTransfer = tx.type === "trasferimento";
								const cat = tx.categories;
								// Icona e colore propri: un trasferimento non ha la categoria
								// da cui gli altri li ereditano. Vedi `TransactionList`.
								const Icon = isTransfer
									? ArrowLeftRightIcon
									: cat
										? (ICON_MAP[cat.icon] ?? GOAL_ICON_MAP[cat.icon])
										: null;
								const color = isTransfer
									? TIPO_COLOR.trasferimento
									: `var(--color-${cat?.color ?? "kiri"})`;
								const amountColor = TIPO_INK[tx.type] ?? "var(--text-primary)";
								const toName = tx.to_account_id ? accountName.get(tx.to_account_id) : null;
								const title = isTransfer
									? `${accountName.get(tx.account_id) ?? "—"} ${DIRECTION_ARROW} ${toName ?? "—"}`
									: (cat?.name ?? "—");
								const isLast = i === transactions.length - 1;

								return (
									<button
										key={tx.id}
										onClick={() => openEditModal(tx)}
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
												{title}
											</p>
											<p className="text-xs text-muted mt-0.5 truncate">
												{t.types[tx.type as keyof typeof t.types]} · {formatDate(tx.date, locale)}
												{/* La destinazione di un risparmio si dice: vedi TransactionList. */}
												{!isTransfer && toName && ` · ${DIRECTION_ARROW} ${toName}`}
											</p>
										</div>
										<p
											className="text-sm font-semibold shrink-0"
											style={{ color: amountColor }}
										>
											{formatAmount(tx.amount, amountSign(tx, viewedAccountId), locale)}
										</p>
									</button>
								);
							})}
					</div>
				)}
			</div>
		</div>
	);
}
