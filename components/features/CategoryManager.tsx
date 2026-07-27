"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus } from "lucide-react";
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
	const [pending, setPending] = useState<Category | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [dialogError, setDialogError] = useState<string | null>(null);

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

	function requestDelete(cat: Category) {
		setPending(cat);
		setDialogError(null);
	}

	function closeDialog() {
		setPending(null);
		setDialogError(null);
	}

	async function confirmDelete() {
		if (!pending) return;
		setDeleting(true);
		try {
			const result = await deleteCategory(pending.id);
			if (result.error) {
				setDialogError(result.error);
				return;
			}
			router.refresh();
			setPending(null);
		} finally {
			setDeleting(false);
		}
	}

	return (
		<>
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
												onClick={() => requestDelete(cat)}
												className="w-7 h-7 rounded-[9px] flex items-center justify-center active:opacity-70"
												style={{ background: "color-mix(in srgb, var(--color-aka) 8%, transparent)" }}
												aria-label="Elimina"
											>
												<Trash2 size={13} style={{ color: "var(--color-aka)" }} />
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

			{/* Dialog conferma eliminazione */}
			{pending && (
				<div className="fixed inset-0 z-50 flex items-center justify-center px-8">
					<div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeDialog} />

					<div className="relative w-full max-w-xs rounded-3xl p-6 bg-modal border border-subtle modal-shadow backdrop-blur-2xl">
						<h3 className="text-[17px] font-semibold mb-2">Elimina categoria</h3>
						<p className="text-[13px] text-muted leading-relaxed mb-5">
							{dialogError ?? (
								<>
									Vuoi eliminare <span className="font-medium text-foreground">{pending.name}</span>?
									L&apos;azione non si può annullare.
								</>
							)}
						</p>

						<div className="flex gap-2.5">
							<button
								onClick={closeDialog}
								className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-control border border-subtle active:opacity-80"
							>
								Annulla
							</button>
							{!dialogError && (
								<button
									onClick={confirmDelete}
									disabled={deleting}
									className="flex-1 py-3 rounded-2xl text-sm font-semibold disabled:opacity-50 active:opacity-80"
									style={{ background: "var(--color-aka)", color: "#fff" }}
								>
									{deleting ? "Elimino…" : "Elimina"}
								</button>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
}
