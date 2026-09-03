"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus } from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { TIPO_COLOR, TIPO_INK } from "@/lib/transaction-utils";
import CategorySheet from "./CategorySheet";
import { useI18n } from "./I18nProvider";
import { deleteCategory } from "@/app/(main)/impostazioni/actions";
import type { Category } from "@/types";

// `as const` per poter indicizzare i dizionari senza cast: sono le stesse cinque
// chiavi di `categories_type_check`.
const TYPES = ["entrata", "spesa", "investimento", "risparmio", "abbonamento"] as const;

export default function CategoryManager({ categories }: { categories: Category[] }) {
	const router = useRouter();
	const { t } = useI18n();
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
					const ink = TIPO_INK[type];

					return (
						<div key={type}>
							{/* Header gruppo */}
							<div className="flex items-center gap-2 mb-2.5 ml-0.5">
								<span
									className="w-2 h-2 rounded-full shrink-0"
									style={{ background: color }}
								/>
								{/* Era `{type}`, cioè il valore grezzo del database stampato a
								    schermo: in inglese avrebbe continuato a dire "entrata". */}
								<span className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-muted">
									{t.typesSingular[type]}
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
												aria-label={t.common.edit}
											>
												<Pencil size={13} className="text-muted" />
											</button>
											<button
												onClick={() => requestDelete(cat)}
												className="w-7 h-7 rounded-[9px] flex items-center justify-center active:opacity-70"
												style={{ background: "color-mix(in srgb, var(--color-aka) 8%, transparent)" }}
												aria-label={t.common.delete}
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
									{/* L'icona resta sull'accento (per i grafici basta 3:1),
									    l'etichetta no: è testo e vuole l'inchiostro. */}
									{/* ⚠️ Era `nuova {type}` per tutti e cinque i tipi, che in
									    italiano è sbagliato per tre: "nuova investimento",
									    "nuova risparmio", "nuova abbonamento". L'aggettivo si
									    accorda col genere del nome, e il genere non sta nella
									    chiave del database. Ora è una frase intera per tipo. */}
									<span className="text-[13px] font-medium capitalize" style={{ color: ink }}>
										{t.newByType[type]}
									</span>
								</button>
							</div>
						</div>
					);
				})}
			</div>

			{/* Montato solo da aperto: è il montaggio a dare al form uno stato
			    pulito, così `CategorySheet` non deve riazzerarsi in un effetto.
			    La `key` copre il passaggio da una categoria all'altra (o da una
			    esistente alla creazione) senza chiudere in mezzo. */}
			{sheetOpen && (
				<CategorySheet
					key={editing?.id ?? `new:${presetType ?? ""}`}
					category={editing}
					presetType={presetType}
					onClose={() => setSheetOpen(false)}
				/>
			)}

			{/* Dialog conferma eliminazione */}
			{pending && (
				<div className="fixed inset-0 z-50 flex items-center justify-center px-8">
					<div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeDialog} />

					{/* ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto. */}
					<div className="relative w-full max-w-xs rounded-3xl border border-subtle modal-shadow overflow-hidden">
						<div className="absolute inset-0 bg-modal backdrop-blur-2xl" />
						<div className="relative p-6">
						<h3 className="text-[17px] font-semibold mb-2">{t.categories.deleteTitle}</h3>
						<p className="text-[13px] text-muted leading-relaxed mb-5">
							{dialogError ?? (
								<>
									{t.categories.deleteQuestionBefore}
									<span className="font-medium text-foreground">{pending.name}</span>
									{t.categories.deleteQuestionAfter}
								</>
							)}
						</p>

						<div className="flex gap-2.5">
							<button
								onClick={closeDialog}
								className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-control border border-subtle active:opacity-80"
							>
								{t.common.cancel}
							</button>
							{!dialogError && (
								<button
									onClick={confirmDelete}
									disabled={deleting}
									className="flex-1 py-3 rounded-2xl text-sm font-semibold disabled:opacity-50 active:opacity-80"
									// ⚠️ Era `color: "#fff"`. Sopra un riempimento d'accento va
									// `--on-accent`: gli accenti invertono la luminosità fra i
									// temi, quindi un bianco cablato è il tema scuro dato per
									// scontato, e in chiaro sta a 2,8:1 (CLAUDE.md, Fase 18).
									style={{ background: "var(--color-aka)", color: "var(--on-accent)" }}
								>
									{deleting ? t.common.deleting : t.common.delete}
								</button>
							)}
						</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
