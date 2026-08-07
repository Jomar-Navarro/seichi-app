"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Plus, Pencil } from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { TIPO_COLOR, TIPO_INK, formatDate } from "@/lib/transaction-utils";
import { RepeatIcon } from "@/lib/seichi-icons";
import EmptyState from "@/components/UI/EmptyState";
import RecurringSheet from "./RecurringSheet";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, formatMoney, plural } from "@/lib/i18n/format";
import { deleteRecurringRule, setRecurringActive } from "@/app/(main)/action";
import { useUIStore } from "@/store/useUIStore";
import type { Locale } from "@/lib/i18n/config";
import type { RecurringRule } from "@/types";

function formatRuleAmount(r: RecurringRule, locale: Locale) {
	const sign = r.type === "entrata" ? "+ " : "";
	return `${sign}${formatMoney(r.amount, { locale, currency: DISPLAY_CURRENCY, decimals: 2 })}`;
}

export default function RecurringManager({ rules }: { rules: RecurringRule[] }) {
	const router = useRouter();
	const { locale, t } = useI18n();
	const { openTransactionModal, transactionSavedAt } = useUIStore();
	const [pending, setPending] = useState<RecurringRule | null>(null);
	const [editing, setEditing] = useState<RecurringRule | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);

	// Aggiorna la lista quando una ricorrenza viene creata dal modale transazione
	useEffect(() => {
		if (transactionSavedAt) router.refresh();
	}, [transactionSavedAt, router]);

	async function togglePause(r: RecurringRule) {
		setBusyId(r.id);
		try {
			const result = await setRecurringActive(r.id, !r.active);
			if (!result.error) router.refresh();
		} finally {
			setBusyId(null);
		}
	}

	async function confirmDelete() {
		if (!pending) return;
		setDeleting(true);
		try {
			const result = await deleteRecurringRule(pending.id);
			if (!result.error) {
				router.refresh();
				setPending(null);
			}
		} finally {
			setDeleting(false);
		}
	}

	if (rules.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center py-16">
				<EmptyState
					title={t.recurring.emptyTitle}
					description={t.recurring.emptyDescription}
					actionLabel={t.recurring.addAction}
					onAction={() => openTransactionModal(true)}
				/>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col">
			<p className="text-[12.5px] text-muted mb-4">
				{plural(t.recurring.count, rules.length, locale)}
			</p>

			<div className="flex flex-col gap-2.5">
				{rules.map((r) => {
					// `color` per pastiglia e icona, `ink` per l'importo: è l'unico
					// numero della riga e in chiaro l'accento lo lascerebbe a ~3,4:1.
					const color = TIPO_COLOR[r.type];
					const ink = TIPO_INK[r.type];
					const Icon = r.categories
						? (ICON_MAP[r.categories.icon] ?? GOAL_ICON_MAP[r.categories.icon] ?? RepeatIcon)
						: RepeatIcon;
					return (
						<div
							key={r.id}
							className="rounded-[22px] px-4 py-3.5 bg-card border border-subtle card-shadow"
							style={{ opacity: r.active ? 1 : 0.6 }}
						>
							<div className="flex items-start gap-3">
								<span
									className="w-9.5 h-9.5 rounded-[13px] flex items-center justify-center shrink-0"
									style={{ background: `color-mix(in srgb, ${color} 13%, transparent)` }}
								>
									<Icon size={17} strokeWidth={1.5} style={{ color }} />
								</span>
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between gap-2">
										<span className="text-[13.5px] font-semibold truncate">
											{r.categories?.name ?? t.types[r.type as keyof typeof t.types]}
										</span>
										<span className="text-[13.5px] font-semibold whitespace-nowrap" style={{ color: ink }}>
											{formatRuleAmount(r, locale)}
										</span>
									</div>
									<div className="flex items-center gap-1.5 mt-1">
										<span className="text-[11px] font-semibold" style={{ color: "var(--ink-murasaki)" }}>
											{t.frequencies[r.frequency].recur}
										</span>
										<span className="w-0.75 h-0.75 rounded-full bg-muted/50" />
										<span className="text-[11px] text-muted">
											{r.active ? formatDate(r.next_run, locale) : t.recurring.paused}
										</span>
									</div>
								</div>
							</div>

							<div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-subtle">
								<button
									onClick={() => togglePause(r)}
									disabled={busyId === r.id}
									className="flex items-center gap-1.5 text-[11.5px] text-secondary active:opacity-70 disabled:opacity-50"
								>
									{r.active ? <Pause size={12} /> : <Play size={12} />}
									{r.active ? t.recurring.pause : t.recurring.resume}
								</button>
								<button
									onClick={() => setEditing(r)}
									className="flex items-center gap-1.5 text-[11.5px] text-secondary active:opacity-70"
								>
									<Pencil size={12} />
									{t.recurring.edit}
								</button>
								<span className="flex-1" />
								<button
									onClick={() => setPending(r)}
									className="text-[11.5px] active:opacity-70"
									style={{ color: "var(--ink-aka)" }}
								>
									{t.recurring.delete}
								</button>
							</div>
						</div>
					);
				})}
			</div>

			<div className="flex-1" />

			<button
				onClick={() => openTransactionModal(true)}
				className="w-full py-4 mt-4 rounded-2xl btn-primary font-semibold flex items-center justify-center gap-2"
			>
				<Plus size={16} strokeWidth={2} />
				{t.recurring.addAction}
			</button>

			<RecurringSheet isOpen={!!editing} rule={editing} onClose={() => setEditing(null)} />

			{pending && (
				<div className="fixed inset-0 z-50 flex items-center justify-center px-8">
					<div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setPending(null)} />
					<div className="relative w-full max-w-xs rounded-3xl p-6 bg-modal border border-subtle modal-shadow backdrop-blur-2xl">
						<h3 className="text-[17px] font-semibold mb-2">{t.recurring.deleteTitle}</h3>
						<p className="text-[13px] text-muted leading-relaxed mb-5">
							{t.recurring.deleteBody}
						</p>
						<div className="flex gap-2.5">
							<button
								onClick={() => setPending(null)}
								className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-control border border-subtle active:opacity-80"
							>
								{t.common.cancel}
							</button>
							<button
								onClick={confirmDelete}
								disabled={deleting}
								className="flex-1 py-3 rounded-2xl text-sm font-semibold disabled:opacity-50 active:opacity-80"
								// `--on-accent`, non "#fff": vedi CLAUDE.md, Fase 18.
								style={{ background: "var(--color-aka)", color: "var(--on-accent)" }}
							>
								{deleting ? t.common.deleting : t.common.delete}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
