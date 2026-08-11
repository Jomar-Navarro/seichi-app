"use client";

import { useState, type ReactNode } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import AccountSheet from "./AccountSheet";
import EmptyState from "@/components/UI/EmptyState";
import { useI18n } from "./I18nProvider";
import {
	DISPLAY_CURRENCY,
	currencySymbol,
	formatMoney,
	plural,
	splitAmount,
} from "@/lib/i18n/format";
import {
	ACCOUNT_ICON_FALLBACK,
	ACCOUNT_TYPE_ICON,
	accountColor,
	accountTypeLabel,
} from "@/lib/accounts";
import { setAccountArchived } from "@/app/(main)/conti/actions";
import type { AccountWithBalance } from "@/types";

interface AccountsPageClientProps {
	accounts: AccountWithBalance[];
}

export default function AccountsPageClient({ accounts }: AccountsPageClientProps) {
	const { locale, t } = useI18n();
	const router = useRouter();
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editing, setEditing] = useState<AccountWithBalance | null>(null);

	const active = accounts.filter((a) => !a.archived);
	const archived = accounts.filter((a) => a.archived);

	/*
	 * ⚠️ Gli archiviati restano FUORI dalla somma, e per questo il numero si
	 * chiama "Saldo" e non "Saldo totale".
	 *
	 * Il mockup scriveva "Saldo totale · 4 conti attivi" su una cifra che
	 * escludeva il conto archiviato: una parola falsa in grande, corretta a voce
	 * bassa nel sottotitolo. È il difetto già elevato a regola nella 17a — "spese
	 * variabili", mai "spese totali". Un numero sbagliato che sembra giusto è
	 * peggio di un numero assente.
	 */
	const total = active.reduce((sum, a) => sum + a.balance, 0);
	const { sign, integer, decimal } = splitAmount(total, locale);

	function openCreate() {
		setEditing(null);
		setSheetOpen(true);
	}

	function openEdit(account: AccountWithBalance) {
		setEditing(account);
		setSheetOpen(true);
	}

	async function reactivate(id: string) {
		await setAccountArchived(id, false);
		router.refresh();
	}

	return (
		<div className="flex flex-col flex-1">
			<div className="flex items-start justify-between mb-1.5">
				<div>
					<h1 className="text-[26px] font-semibold leading-tight">{t.accounts.title}</h1>
					<p className="text-[12.5px] text-muted mt-1">
						{plural(t.accounts.activeCount, active.length, locale)}
					</p>
				</div>
				<button
					onClick={openCreate}
					className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12.5px] font-semibold card-shadow border border-subtle shrink-0"
					style={{ background: "var(--surface-elevated)" }}
				>
					<Plus size={13} strokeWidth={2.2} />
					{t.accounts.newTitle}
				</button>
			</div>

			{accounts.length === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<EmptyState
						title={t.accounts.emptyTitle}
						description={t.accounts.emptyDescription}
						actionLabel={t.accounts.newTitle}
						onAction={openCreate}
					/>
				</div>
			) : (
				<div className="flex flex-col gap-3 mt-5">
					{/* Il saldo complessivo dei soli conti attivi. */}
					<div className="rounded-3xl p-5 border border-subtle card-shadow bg-surface backdrop-blur-md">
						<p className="text-sm text-muted mb-2">{t.accounts.balanceHeading}</p>
						<p className="font-semibold tracking-tight flex items-baseline gap-0.5">
							<span className="text-2xl font-semibold mr-1">
								{currencySymbol(DISPLAY_CURRENCY, locale)}
							</span>
							<span className="text-4xl">{sign}{integer}</span>
							<span className="text-2xl font-medium text-muted">{decimal}</span>
						</p>
					</div>

					{active.map((a) => (
						<AccountRow key={a.id} account={a} locale={locale} onClick={() => openEdit(a)} />
					))}

					{archived.length > 0 && (
						<>
							<p className="text-xs text-muted font-medium mt-1 mb-0.5 ml-1 tracking-wide">
								{plural(t.accounts.archivedSection, archived.length, locale)}
							</p>
							{archived.map((a) => (
								<AccountRow
									key={a.id}
									account={a}
									locale={locale}
									onClick={() => openEdit(a)}
									action={
										/*
											⚠️ `text-ao-ink` e non `--color-ao`: il mockup usava
											l'accento pieno come colore del testo a 11,5px, cioè
											~3,2:1 su fondo chiaro, sotto il 4,5:1 di WCAG AA. È
											l'unico punto del mockup che sbaglia, quindi è una
											svista isolata e non un pattern.
										*/
										<button
											onClick={(e) => {
												e.stopPropagation();
												void reactivate(a.id);
											}}
											className="flex items-center gap-1 text-[11.5px] font-semibold text-ao-ink"
										>
											<RotateCcw size={11} />
											{t.accounts.reactivate}
										</button>
									}
								/>
							))}
						</>
					)}
				</div>
			)}

			{sheetOpen && (
				<AccountSheet
					key={editing?.id ?? "new"}
					account={editing}
					canArchive={active.length > 1}
					onClose={() => {
						setSheetOpen(false);
						setEditing(null);
					}}
				/>
			)}
		</div>
	);
}

/**
 * ⚠️ La riga è un `div`, non un `button`, e il bottone sta DENTRO.
 *
 * La forma ovvia — riga cliccabile con "riattiva" annidato — sarebbe markup
 * interattivo dentro markup interattivo: HTML non valido, e con un
 * comportamento da tastiera indefinito. È lo stesso motivo per cui la riga
 * "Ripeti" del form movimento non può usare `<Switch>` e ne condivide il
 * disegno invece del markup.
 */
function AccountRow({
	account,
	locale,
	onClick,
	action,
}: {
	account: AccountWithBalance;
	locale: Parameters<typeof formatMoney>[1]["locale"];
	onClick: () => void;
	action?: ReactNode;
}) {
	const { t } = useI18n();
	// Lookup su mappa e non `accountIcon(...)`: vedi ACCOUNT_ICON_FALLBACK.
	const Icon = (account.type && ACCOUNT_TYPE_ICON[account.type]) || ACCOUNT_ICON_FALLBACK;
	const color = accountColor(account.type, account.color);

	return (
		<div
			className={`w-full flex items-center gap-3 p-4 rounded-3xl border border-subtle card-shadow bg-surface backdrop-blur-md ${
				account.archived ? "opacity-55" : ""
			}`}
		>
			<button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0 text-left">
				<span
					className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
					style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
				>
					<Icon size={19} style={{ color }} />
				</span>

				<span className="flex-1 min-w-0">
					<span className="block text-[14.5px] font-medium text-foreground truncate">
						{account.name}
					</span>
					<span className="block text-[11.5px] text-muted">
						{account.archived ? t.accounts.archivedNote : accountTypeLabel(account.type, t)}
					</span>
				</span>
			</button>

			<div className="flex flex-col items-end gap-1 shrink-0">
				<span className="text-[14.5px] font-semibold text-foreground">
					{formatMoney(account.balance, { locale, currency: DISPLAY_CURRENCY, decimals: 2 })}
				</span>
				{action}
			</div>
		</div>
	);
}
