"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { getTransactions } from "@/app/(main)/action";
import { getAccountOptions } from "@/app/(main)/conti/actions";
import { getAttachmentCounts } from "@/app/(main)/attachment-actions";
import { TRANSACTIONS_PAGE_SIZE } from "@/lib/transaction-utils";
import AccountSheet from "./AccountSheet";
import TransactionList from "./TransactionList";
import { useI18n } from "./I18nProvider";
import { useUIStore } from "@/store/useUIStore";
import {
	DISPLAY_CURRENCY,
	currencySymbol,
	formatMoney,
	splitAmount,
} from "@/lib/i18n/format";
import {
	ACCOUNT_ICON_FALLBACK,
	ACCOUNT_TYPE_ICON,
	accountColor,
	accountTypeLabel,
} from "@/lib/accounts";
import type { Account, AccountWithBalance, Transaction } from "@/types";

/** Quel poco che serve al nome dei conti nei trasferimenti: vedi `getAccountOptions`. */
type AccountOption = Pick<Account, "id" | "name" | "archived">;

interface AccountDetailClientProps {
	account: AccountWithBalance;
}

/**
 * L'interno della pagina `/conti/[id]`: il saldo, i fatti del conto, e il suo
 * estratto movimenti.
 *
 * ⚠️ Client, come `AccountsPageClient`: il comando "Modifica" apre lo stesso
 * `AccountSheet` (interattivo), e la lista movimenti si pagina — nessuna
 * delle due cose è esprimibile in un server component.
 */
export default function AccountDetailClient({ account }: AccountDetailClientProps) {
	const { locale, t } = useI18n();
	const [sheetOpen, setSheetOpen] = useState(false);
	const [accounts, setAccounts] = useState<AccountOption[]>([]);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
	const [hasMore, setHasMore] = useState(false);
	const [loading, setLoading] = useState(true);
	const transactionSavedAt = useUIStore((s) => s.transactionSavedAt);

	const Icon = (account.type && ACCOUNT_TYPE_ICON[account.type]) || ACCOUNT_ICON_FALLBACK;
	const color = accountColor(account.type, account.color);
	const { sign, integer, decimal } = splitAmount(account.balance, locale);

	/*
	 * I conti servono a NOMINARE i due lati di un trasferimento (vedi
	 * `TransactionList`) e a sapere se questo è l'ultimo conto ATTIVO, per
	 * `AccountSheet`. Una query sola, non due: `canArchive` si deriva dagli
	 * stessi dati che la lista dei nomi già porta.
	 */
	useEffect(() => {
		let cancelled = false;
		getAccountOptions().then((res) => {
			if (cancelled || !("data" in res)) return;
			setAccounts(res.data);
		});
		return () => { cancelled = true; };
	}, [transactionSavedAt]);

	const loadPage = useCallback(
		async (offset: number, append: boolean) => {
			setLoading(true);
			try {
				const result = await getTransactions({
					conto: account.id,
					limit: TRANSACTIONS_PAGE_SIZE,
					offset,
				});
				if ("error" in result) {
					if (!append) setTransactions([]);
					setHasMore(false);
					return;
				}
				const rows = (result.data as Transaction[]) ?? [];
				setTransactions((prev) => (append ? [...prev, ...rows] : rows));
				setHasMore(result.hasMore);

				// I conteggi degli allegati SOLO per le righe appena arrivate — vedi
				// la stessa nota in `/transazioni`.
				if (rows.length > 0) {
					const counts = await getAttachmentCounts(rows.map((r) => r.id));
					setAttachmentCounts((prev) => (append ? { ...prev, ...counts } : counts));
				} else if (!append) {
					setAttachmentCounts({});
				}
			} finally {
				setLoading(false);
			}
		},
		[account.id],
	);

	const loadMore = useCallback(
		() => loadPage(transactions.length, true),
		[loadPage, transactions.length],
	);

	// Riparte dalla prima pagina all'ingresso e dopo ogni salvataggio — un
	// movimento appena scritto va in cima, non nella pagina che si sta
	// guardando.
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => { loadPage(0, false); }, [loadPage, transactionSavedAt]);

	const canArchive = accounts.filter((a) => !a.archived).length > 1;

	return (
		<>
			<div className="rounded-3xl p-5 border border-subtle card-shadow bg-surface backdrop-blur-md">
				<div className="flex items-center gap-3 mb-4">
					<span
						className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
						style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
					>
						<Icon size={19} style={{ color }} />
					</span>
					<div className="min-w-0">
						<p className="text-sm font-medium truncate">{account.name}</p>
						<p className="text-[11.5px] text-muted">
							{account.archived ? t.accounts.archivedNote : accountTypeLabel(account.type, t)}
						</p>
					</div>
				</div>

				<p className="font-semibold tracking-tight flex items-baseline gap-0.5">
					<span className="text-xl font-semibold mr-1">
						{currencySymbol(DISPLAY_CURRENCY, locale)}
					</span>
					<span className="text-3xl">{sign}{integer}</span>
					<span className="text-xl font-medium text-muted">{decimal}</span>
				</p>
				{/* Stesso testo della card saldo in home: è lo STESSO numero, dalla
				    stessa vista `account_balances` — vedi `AccountsBalanceCard`. */}
				<p className="text-xs text-muted mt-1">{t.accounts.balanceExplainOne}</p>

				<div className="flex items-center justify-between mt-4 pt-4 border-t border-subtle">
					<div>
						<p className="text-[11px] text-muted">{t.accounts.initialBalance}</p>
						<p className="text-[13px] font-medium mt-0.5">
							{formatMoney(account.initial_balance, {
								locale,
								currency: DISPLAY_CURRENCY,
								decimals: 2,
							})}
						</p>
					</div>
					<button
						onClick={() => setSheetOpen(true)}
						className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12.5px] font-semibold card-shadow border border-subtle shrink-0"
						style={{ background: "var(--surface-elevated)" }}
					>
						<Pencil size={13} strokeWidth={2.2} />
						{t.common.edit}
					</button>
				</div>
			</div>

			{/*
				⚠️ "Modifica" è QUI, in chiaro — issue #62, punto 3. Da quando il tap
				sulla riga della lista apre questa pagina invece del foglio, lo
				swipe è l'UNICA altra porta: senza questo bottone, chi non conosce
				il gesto non avrebbe più modo di rinominare un conto. È lo stesso
				precedente della Fase 21 sull'annullamento import: progettare la
				reversibilità senza darle una casa stabile è metà del lavoro.
			*/}

			<p className="text-xs font-medium tracking-wide text-muted mt-6 mb-2.5 ml-1">
				{t.transactions.title}
			</p>
			<TransactionList
				transactions={transactions}
				loading={loading && transactions.length === 0}
				attachmentCounts={attachmentCounts}
				accounts={accounts}
				viewedAccountId={account.id}
			/>

			{hasMore && (
				<button
					onClick={loadMore}
					disabled={loading}
					className="w-full mt-4 py-3 rounded-2xl bg-card border border-subtle text-sm font-medium text-secondary disabled:opacity-50"
				>
					{loading ? t.common.loading : t.transactions.loadMore}
				</button>
			)}

			{sheetOpen && (
				<AccountSheet
					account={account}
					canArchive={canArchive}
					onClose={() => setSheetOpen(false)}
				/>
			)}
		</>
	);
}
