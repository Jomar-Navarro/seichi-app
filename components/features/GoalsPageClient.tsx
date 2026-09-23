"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import GoalCard from "./GoalCard";
import GoalSheet from "./GoalSheet";
import EmptyState from "@/components/UI/EmptyState";
import DashedAddButton from "@/components/UI/DashedAddButton";
import { useI18n } from "./I18nProvider";
import { plural } from "@/lib/i18n/format";
import type { GoalWithProgress } from "@/types";

interface GoalsPageClientProps {
	goals: GoalWithProgress[];
}

export default function GoalsPageClient({ goals }: GoalsPageClientProps) {
	const { locale, t } = useI18n();
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
			<div className="flex items-start lg:items-center justify-between mb-1.5">
				<div>
					<h1 className="text-[26px] lg:text-[30px] lg:tracking-[-0.6px] font-semibold leading-tight">
						{t.goals.title}
					</h1>
					<p className="text-[12.5px] lg:text-[13px] text-muted mt-1 lg:mt-1.5">
						{plural(t.goals.activeCount, active.length, locale)} ·{" "}
						{plural(t.goals.completedCount, completed.length, locale)}
					</p>
				</div>
				<button
					onClick={openCreate}
					// issue #69 — py-3.5 invece di py-2.5: ~44px, isolato a fine header.
					// Da `lg:` è il bottone PRIMARIO del mockup desktop (issue #108) —
					// lo stesso `btn-primary` di "Aggiungi transazione" nella sidebar,
					// alto 44px. ⚠️ Il fondo mobile sta in una classe e non più in uno
					// `style`: uno stile inline avrebbe battuto `lg:btn-primary`.
					className="flex items-center gap-1.5 px-4 py-3.5 rounded-full text-[12.5px] font-semibold bg-surface-elevated card-shadow-ring shrink-0 lg:h-11 lg:py-0 lg:px-5 lg:gap-2 lg:rounded-2xl lg:text-[13.5px] lg:btn-primary lg:shadow-none lg:cursor-pointer"
				>
					<Plus size={13} strokeWidth={2.2} className="lg:size-4" />
					{t.goals.new}
				</button>
			</div>

			{/* Content */}
			{goals.length === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<EmptyState
						title={t.goals.emptyTitle}
						description={t.goals.emptyDescription}
						actionLabel={t.goals.create}
						onAction={openCreate}
					/>
				</div>
			) : (
				// lg: griglia a 2/3 colonne (Fase 28b), invariata su mobile. Dalla
				// issue #108 gap 20 e `items-start` come il mockup desktop. Il suo
				// `repeat(auto-fill, minmax(300px, 1fr))` non serve: col contenuto
				// fermo a `max-w-6xl` dà 2 colonne fra `lg:` e `xl:` e 3 da `xl:` in
				// su — la quarta non entra mai — cioè quello che i due breakpoint
				// dicono già, senza un valore arbitrario.
				<div className="flex flex-col gap-3 mt-5 lg:mt-7 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5 lg:items-start">
					{active.map((g) => (
						<GoalCard key={g.id} goal={g} onEdit={openEdit} />
					))}

					{/*
						La tessera tratteggiata "Nuovo obiettivo" chiude la griglia degli
						attivi da `lg:` (mockup desktop, issue #108); sotto la creazione
						passa dal bottone in alto, com'è sempre stato. Un contenitore e non
						`hidden lg:flex` sul bottone: DashedAddButton ha già `flex` nella
						base, e fra `flex` e `hidden` sullo stesso elemento deciderebbe
						l'ordine del CSS generato.
					*/}
					<div className="hidden lg:block">
						<DashedAddButton variant="tile" label={t.goals.newTitle} onClick={openCreate} />
					</div>

					{completed.length > 0 && (
						<>
							{/*
								Sotto `lg:` l'intestazione serve solo a staccare dagli attivi, e
								senza attivi non c'è niente da staccare. Da `lg:` davanti c'è
								sempre qualcosa — almeno la tessera "Nuovo obiettivo" — e senza
								titolo i completati le starebbero accanto come se fossero la
								stessa cosa.
							*/}
							<p
								className={`${active.length > 0 ? "" : "hidden lg:block "}text-xs text-muted font-medium mt-1 mb-0.5 ml-1 tracking-wide lg:col-span-full`}
							>
								{t.goals.completedSection}
							</p>
							{completed.map((g) => (
								<GoalCard key={g.id} goal={g} onEdit={openEdit} />
							))}
						</>
					)}
				</div>
			)}

			{/*
				Montato solo da aperto: è il montaggio a dare al form uno stato
				pulito, così `GoalSheet` non deve riazzerarsi da sé in un effetto.
				La `key` copre il caso in cui si passi da un obiettivo all'altro
				senza chiudere: cambiando identità React rimonta invece di riusare
				lo stato del precedente.
			*/}
			{sheetOpen && (
				<GoalSheet key={editingGoal?.id ?? "new"} goal={editingGoal} onClose={closeSheet} />
			)}
		</div>
	);
}
