"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { TIPO_COLOR, TIPO_LABEL, formatAmount, formatDate } from "@/lib/transaction-utils";
import EmptyState from "@/components/UI/EmptyState";
import { deleteRecurringRule } from "@/app/(main)/action";
import type { RecurringRule } from "@/types";

const FREQ_LABEL: Record<string, string> = {
	settimanale: "Settimanale",
	mensile: "Mensile",
	annuale: "Annuale",
};

export default function RecurringManager({ rules }: { rules: RecurringRule[] }) {
	const router = useRouter();
	const [pending, setPending] = useState<RecurringRule | null>(null);
	const [deleting, setDeleting] = useState(false);

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
					title="Nessuna ricorrenza"
					description="Attiva “Ripeti” quando crei un movimento per generarlo automaticamente a ogni scadenza."
				/>
			</div>
		);
	}

	return (
		<>
			<div className="flex flex-col gap-2.5">
				{rules.map((r) => {
					const color = TIPO_COLOR[r.type];
					const Icon = r.categories
						? (ICON_MAP[r.categories.icon] ?? GOAL_ICON_MAP[r.categories.icon])
						: null;
					return (
						<div
							key={r.id}
							className="flex items-center gap-3 rounded-[20px] px-4 py-3.5 bg-card border border-subtle card-shadow"
						>
							<span
								className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
								style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
							>
								{Icon ? (
									<Icon size={17} strokeWidth={1.5} style={{ color }} />
								) : (
									<span className="w-2 h-2 rounded-full" style={{ background: color }} />
								)}
							</span>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-semibold truncate">
									{r.categories?.name ?? TIPO_LABEL[r.type]}
								</p>
								<p className="text-xs text-muted mt-0.5">
									{FREQ_LABEL[r.frequency]} · prossima {formatDate(r.next_run)}
								</p>
							</div>
							<p className="text-sm font-semibold shrink-0" style={{ color }}>
								{formatAmount(r.amount, r.type)}
							</p>
							<button
								onClick={() => setPending(r)}
								className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0"
								style={{ background: "color-mix(in srgb, var(--color-aka) 8%, transparent)" }}
								aria-label="Elimina ricorrenza"
							>
								<Trash2 size={13} style={{ color: "var(--color-aka)" }} />
							</button>
						</div>
					);
				})}
			</div>

			{pending && (
				<div className="fixed inset-0 z-50 flex items-center justify-center px-8">
					<div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setPending(null)} />
					<div className="relative w-full max-w-xs rounded-3xl p-6 bg-modal border border-subtle modal-shadow backdrop-blur-2xl">
						<h3 className="text-[17px] font-semibold mb-2">Elimina ricorrenza</h3>
						<p className="text-[13px] text-muted leading-relaxed mb-5">
							Interrompe le generazioni future. I movimenti già creati restano. Continuare?
						</p>
						<div className="flex gap-2.5">
							<button
								onClick={() => setPending(null)}
								className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-control border border-subtle active:opacity-80"
							>
								Annulla
							</button>
							<button
								onClick={confirmDelete}
								disabled={deleting}
								className="flex-1 py-3 rounded-2xl text-sm font-semibold disabled:opacity-50 active:opacity-80"
								style={{ background: "var(--color-aka)", color: "#fff" }}
							>
								{deleting ? "Elimino…" : "Elimina"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
