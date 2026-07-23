"use client";

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import GoalCard from "./GoalCard";
import GoalSheet from "./GoalSheet";
import type { GoalWithProgress } from "@/types";

function EmptyState({ onNew }: { onNew: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center text-center py-16 px-6">
			<div
				className="w-18 h-18 rounded-3xl flex items-center justify-center mb-5 border border-subtle card-shadow"
				style={{ background: "var(--surface)" }}
			>
				<Target size={30} strokeWidth={1.4} style={{ color: "var(--color-kin)" }} />
			</div>
			<p className="text-[18px] font-semibold mb-2.5">Nessun obiettivo ancora</p>
			<p className="text-sm text-muted leading-relaxed max-w-65 mb-7">
				Crea il tuo primo obiettivo e guarda i tuoi progressi crescere, un passo alla volta.
			</p>
			<button
				onClick={onNew}
				className="flex items-center gap-2 px-5 py-3 rounded-full text-[13.5px] font-semibold card-shadow border border-subtle"
				style={{ background: "var(--surface-elevated)" }}
			>
				<Plus size={14} strokeWidth={2.2} />
				Crea il primo obiettivo
			</button>
		</div>
	);
}

interface GoalsPageClientProps {
	goals: GoalWithProgress[];
}

export default function GoalsPageClient({ goals }: GoalsPageClientProps) {
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editingGoal, setEditingGoal] = useState<GoalWithProgress | null>(null);

	const active = goals.filter(
		(g) => g.target_amount == null || g.saved_amount < g.target_amount,
	);
	const completed = goals.filter(
		(g) => g.target_amount != null && g.saved_amount >= g.target_amount,
	);

	function openCreate() {
		setEditingGoal(null);
		setSheetOpen(true);
	}

	function openEdit(goal: GoalWithProgress) {
		setEditingGoal(goal);
		setSheetOpen(true);
	}

	function closeSheet() {
		setSheetOpen(false);
		setEditingGoal(null);
	}

	return (
		<div className="flex flex-col flex-1">
			{/* Header */}
			<div className="flex items-start justify-between mb-1.5">
				<div>
					<h1 className="text-[26px] font-semibold leading-tight">Obiettivi</h1>
					<p className="text-[12.5px] text-muted mt-1">
						{active.length} {active.length === 1 ? "attivo" : "attivi"} · {completed.length}{" "}
						{completed.length === 1 ? "completato" : "completati"}
					</p>
				</div>
				<button
					onClick={openCreate}
					className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12.5px] font-semibold card-shadow border border-subtle shrink-0"
					style={{ background: "var(--surface-elevated)" }}
				>
					<Plus size={13} strokeWidth={2.2} />
					Nuovo
				</button>
			</div>

			{/* Content */}
			{goals.length === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<EmptyState onNew={openCreate} />
				</div>
			) : (
				<div className="flex flex-col gap-3 mt-5">
					{active.map((g) => (
						<GoalCard key={g.id} goal={g} onEdit={openEdit} />
					))}

					{completed.length > 0 && (
						<>
							{active.length > 0 && (
								<p className="text-xs text-muted font-medium mt-1 mb-0.5 ml-1 tracking-wide">
									Completati
								</p>
							)}
							{completed.map((g) => (
								<GoalCard key={g.id} goal={g} onEdit={openEdit} />
							))}
						</>
					)}
				</div>
			)}

			<GoalSheet isOpen={sheetOpen} goal={editingGoal} onClose={closeSheet} />
		</div>
	);
}
