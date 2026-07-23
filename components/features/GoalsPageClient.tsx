"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import GoalCard from "./GoalCard";
import GoalSheet from "./GoalSheet";
import EmptyState from "@/components/UI/EmptyState";
import type { GoalWithProgress } from "@/types";

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
					<EmptyState
						title="Nessun obiettivo ancora"
						description="Crea il tuo primo obiettivo per iniziare a metterlo da parte con calma."
						actionLabel="Crea obiettivo"
						onAction={openCreate}
					/>
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
