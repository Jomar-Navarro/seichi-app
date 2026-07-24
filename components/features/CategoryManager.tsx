"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check } from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { TIPO_COLOR } from "@/lib/transaction-utils";
import CategorySheet from "./CategorySheet";
import { deleteCategory } from "@/app/(main)/impostazioni/actions";
import type { Category } from "@/types";

const TYPES = ["entrata", "spesa", "investimento", "risparmio", "abbonamento"];

export default function CategoryManager({ categories }: { categories: Category[] }) {
	const router = useRouter();
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editing, setEditing] = useState<Category | null>(null);
	const [presetType, setPresetType] = useState<string | null>(null);
	const [confirmId, setConfirmId] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [banner, setBanner] = useState<string | null>(null);

	function openCreate(type: string) {
		setEditing(null);
		setPresetType(type);
		setSheetOpen(true);
	}

	function openEdit(cat: Category) {
		setEditing(cat);
		setPresetType(null);
		setSheetOpen(true);
	}

	async function handleDelete(id: string) {
		if (confirmId !== id) {
			setConfirmId(id);
			setBanner(null);
			return;
		}
		setBusyId(id);
		try {
			const result = await deleteCategory(id);
			if (result.error) {
				setBanner(result.error);
				return;
			}
			router.refresh();
		} finally {
			setBusyId(null);
			setConfirmId(null);
		}
	}

	return (
		<>
			{banner && (
				<div
					className="mb-4 rounded-2xl px-4 py-3 text-[12.5px] leading-relaxed border"
					style={{
						background: "color-mix(in srgb, var(--color-aka) 10%, transparent)",
						borderColor: "color-mix(in srgb, var(--color-aka) 30%, transparent)",
						color: "var(--color-aka)",
					}}
				>
					{banner}
				</div>
			)}

			<div className="flex flex-col gap-5.5">
				{TYPES.map((type) => {
					const items = categories.filter((c) => c.type === type);
					const color = TIPO_COLOR[type];

					return (
						<div key={type}>
							{/* Header gruppo */}
							<div className="flex items-center gap-2 mb-2.5 ml-0.5">
								<span
									className="w-2 h-2 rounded-full shrink-0"
									style={{ background: color }}
								/>
								<span className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-muted">
									{type}
								</span>
								<span className="ml-auto text-[11.5px] text-muted">{items.length}</span>
							</div>

							{/* Card gruppo */}
							<div className="rounded-[22px] bg-card border border-subtle card-shadow overflow-hidden">
								{items.map((cat) => {
									const Icon = ICON_MAP[cat.icon] ?? GOAL_ICON_MAP[cat.icon];
									const confirming = confirmId === cat.id;
									return (
										<div
											key={cat.id}
											className="flex items-center gap-3 h-15.5 px-4 border-b border-subtle last:border-b-0"
										>
											<span
												className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
												style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
											>
												{Icon ? (
													<Icon size={17} strokeWidth={1.5} style={{ color }} />
												) : (
													<span className="w-2 h-2 rounded-full" style={{ background: color }} />
												)}
											</span>
											<span className="flex-1 text-sm font-medium truncate">{cat.name}</span>

											<button
												onClick={() => openEdit(cat)}
												className="w-7 h-7 rounded-[9px] flex items-center justify-center bg-control active:opacity-70"
												aria-label="Modifica"
											>
												<Pencil size={13} className="text-muted" />
											</button>
											<button
												onClick={() => handleDelete(cat.id)}
												disabled={busyId === cat.id}
												className="w-7 h-7 rounded-[9px] flex items-center justify-center active:opacity-70 disabled:opacity-50"
												style={{
													background: confirming
														? "color-mix(in srgb, var(--color-aka) 22%, transparent)"
														: "color-mix(in srgb, var(--color-aka) 8%, transparent)",
												}}
												aria-label={confirming ? "Conferma eliminazione" : "Elimina"}
											>
												{confirming ? (
													<Check size={13} style={{ color: "var(--color-aka)" }} />
												) : (
													<Trash2 size={13} style={{ color: "var(--color-aka)" }} />
												)}
											</button>
										</div>
									);
								})}

								{/* Nuova <tipo> */}
								<button
									onClick={() => openCreate(type)}
									className="flex items-center gap-2.5 h-13 px-4 w-full text-left active:opacity-70"
								>
									<Plus size={15} strokeWidth={1.8} style={{ color }} />
									<span className="text-[13px] font-medium capitalize" style={{ color }}>
										nuova {type}
									</span>
								</button>
							</div>
						</div>
					);
				})}
			</div>

			<CategorySheet
				isOpen={sheetOpen}
				category={editing}
				presetType={presetType}
				onClose={() => setSheetOpen(false)}
			/>
		</>
	);
}
