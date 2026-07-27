"use client";

import { useState, useLayoutEffect } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { CATEGORY_LIBRARY } from "@/lib/category-icons";
import { TIPO_COLOR } from "@/lib/transaction-utils";
import { TRANSACTION_TYPES } from "@/types";
import { createCategory, updateCategory } from "@/app/(main)/impostazioni/actions";
import type { Category } from "@/types";

const TYPE_ORDER = [
	{ id: "entrata", label: "entrata" },
	{ id: "spesa", label: "spesa" },
	{ id: "investimento", label: "investim." },
	{ id: "risparmio", label: "risparmio" },
	{ id: "abbonamento", label: "abbon." },
];

function typeIcon(type: string) {
	return TRANSACTION_TYPES.find((t) => t.id === type)?.icon;
}

function resolveIcon(id: string) {
	return ICON_MAP[id] ?? GOAL_ICON_MAP[id] ?? null;
}

/** Set icone per il tipo, includendo l'icona corrente se non è già in libreria (edit legacy) */
function iconListFor(type: string, current: string) {
	const lib = CATEGORY_LIBRARY[type] ?? [];
	if (current && !lib.some((e) => e.id === current)) {
		return [{ id: current, label: "attuale" }, ...lib];
	}
	return lib;
}

interface CategorySheetProps {
	isOpen: boolean;
	category: Category | null;
	presetType?: string | null;
	onClose: () => void;
}

export default function CategorySheet({ isOpen, category, presetType, onClose }: CategorySheetProps) {
	const router = useRouter();
	const [name, setName] = useState("");
	const [icon, setIcon] = useState("");
	const [type, setType] = useState("spesa");
	const [submitted, setSubmitted] = useState(false);
	const [loading, setLoading] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);

	useLayoutEffect(() => {
		if (isOpen) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setSubmitted(false);
			setLoading(false);
			setServerError(null);
			setName(category?.name ?? "");
			const t = category?.type ?? presetType ?? "spesa";
			setType(t);
			const lib = CATEGORY_LIBRARY[t] ?? [];
			setIcon(category?.icon ?? lib[0]?.id ?? "");
		}
	}, [isOpen, category, presetType]);

	const nameError = submitted && !name.trim();
	const color = TIPO_COLOR[type] ?? "var(--color-kiri)";
	const iconList = iconListFor(type, icon);

	function selectType(t: string) {
		setType(t);
		const lib = CATEGORY_LIBRARY[t] ?? [];
		if (!lib.some((e) => e.id === icon)) setIcon(lib[0]?.id ?? "");
	}

	async function handleSubmit() {
		setSubmitted(true);
		if (!name.trim()) return;

		setLoading(true);
		setServerError(null);
		const payload = { name: name.trim(), icon, type };
		try {
			const result = category
				? await updateCategory(category.id, payload)
				: await createCategory(payload);
			if (result.error) {
				setServerError(result.error);
				return;
			}
			router.refresh();
			onClose();
		} finally {
			setLoading(false);
		}
	}

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-end">
			<div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

			<div
				className="relative w-full flex flex-col rounded-t-4xl pt-3.5 px-6 pb-8 modal-shadow border-t border-l border-r border-subtle bg-modal backdrop-blur-2xl"
				style={{ maxHeight: "90dvh", overflowY: "auto" }}
			>
				<div className="w-10 h-1 rounded-full mx-auto mb-1 bg-modal-handle shrink-0" />

				<div className="flex items-center justify-between mt-4 mb-6 shrink-0">
					<h2 className="text-xl font-semibold">
						{category ? "Modifica categoria" : "Nuova categoria"}
					</h2>
					<button
						onClick={onClose}
						className="w-8 h-8 flex items-center justify-center rounded-xl bg-control border border-subtle"
					>
						<X size={15} />
					</button>
				</div>

				<div className="flex flex-col gap-5">
					{/* Nome */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">Nome</label>
						<input
							type="text"
							placeholder="es. Palestra"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full rounded-[18px] px-4 py-3.5 text-base bg-input border border-subtle outline-none placeholder:text-muted/60"
							style={{ borderColor: nameError ? "var(--color-aka)" : undefined }}
						/>
						{nameError && (
							<p className="text-xs mt-1.5 ml-1" style={{ color: "var(--color-aka)" }}>
								Inserisci un nome
							</p>
						)}
					</div>

					{/* Tipo */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">Tipo</label>
						<div className="grid grid-cols-5 gap-2">
							{TYPE_ORDER.map((t) => {
								const selected = type === t.id;
								const tColor = TIPO_COLOR[t.id];
								const TIcon = typeIcon(t.id);
								return (
									<button
										key={t.id}
										type="button"
										onClick={() => selectType(t.id)}
										className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl transition-all border"
										style={{
											background: selected
												? `color-mix(in srgb, ${tColor} 16%, transparent)`
												: "var(--color-input)",
											borderColor: selected ? tColor : "transparent",
										}}
									>
										{TIcon && (
											<TIcon
												size={18}
												strokeWidth={1.5}
												style={{ color: selected ? tColor : "var(--text-muted)" }}
											/>
										)}
										<span
											className="text-[10px] font-medium leading-none"
											style={{ color: selected ? tColor : "var(--text-muted)" }}
										>
											{t.label}
										</span>
									</button>
								);
							})}
						</div>
					</div>

					{/* Icona */}
					<div>
						<div className="flex items-center justify-between mb-3">
							<label className="text-xs text-muted tracking-wide">Icona</label>
							<span className="text-[11px] text-muted capitalize">set — {type}</span>
						</div>
						<div className="grid grid-cols-5 gap-x-2 gap-y-3.5">
							{iconList.map((entry) => {
								const Icon = resolveIcon(entry.id);
								if (!Icon) return null;
								const selected = icon === entry.id;
								return (
									<button
										key={entry.id}
										type="button"
										onClick={() => setIcon(entry.id)}
										className="flex flex-col items-center gap-1.5"
									>
										<span
											className="w-full aspect-square rounded-[14px] flex items-center justify-center transition-all border"
											style={{
												background: selected
													? `color-mix(in srgb, ${color} 16%, transparent)`
													: "var(--color-input)",
												borderColor: selected ? color : "transparent",
											}}
										>
											<Icon
												size={18}
												strokeWidth={1.5}
												style={{ color: selected ? color : "var(--text-muted)" }}
											/>
										</span>
										<span
											className="text-[9.5px] leading-tight text-center w-full truncate"
											style={{ color: selected ? color : "var(--text-muted)" }}
										>
											{entry.label}
										</span>
									</button>
								);
							})}
						</div>
					</div>
				</div>

				{serverError && (
					<p className="mt-5 text-xs text-center" style={{ color: "var(--color-aka)" }}>
						{serverError}
					</p>
				)}

				<button
					onClick={handleSubmit}
					disabled={loading}
					className="mt-6 w-full py-4 rounded-2xl text-[14.5px] font-semibold btn-primary disabled:opacity-50"
				>
					{loading ? "Salvataggio…" : category ? "Salva modifiche" : "Crea categoria"}
				</button>
			</div>
		</div>
	);
}
