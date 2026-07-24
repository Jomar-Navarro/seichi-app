"use client";

import { useState, useLayoutEffect } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICONS, GOAL_ICON_MAP } from "@/lib/goal-icons";
import { TIPO_COLOR } from "@/lib/transaction-utils";
import { createCategory, updateCategory } from "@/app/(main)/impostazioni/actions";
import type { Category } from "@/types";

const TYPES = ["entrata", "spesa", "investimento", "risparmio", "abbonamento"];

// Le categorie risparmio usano il set di icone degli obiettivi (coerente con GoalSheet)
function iconsForType(type: string) {
	return type === "risparmio"
		? GOAL_ICONS.map((g) => ({ key: g.id, Icon: g.icon }))
		: Object.keys(ICON_MAP).map((key) => ({ key, Icon: ICON_MAP[key] }));
}

function iconKeysForType(type: string) {
	return type === "risparmio" ? Object.keys(GOAL_ICON_MAP) : Object.keys(ICON_MAP);
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
	const [icon, setIcon] = useState(iconKeysForType("spesa")[0]);
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
			const keys = iconKeysForType(t);
			setIcon(category && keys.includes(category.icon) ? category.icon : keys[0]);
		}
	}, [isOpen, category, presetType]);

	const nameError = submitted && !name.trim();
	const color = TIPO_COLOR[type] ?? "var(--color-kiri)";

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
						<div className="flex flex-wrap gap-2">
							{TYPES.map((t) => {
								const selected = type === t;
								const tColor = TIPO_COLOR[t];
								return (
									<button
										key={t}
										type="button"
										onClick={() => {
											setType(t);
											const keys = iconKeysForType(t);
											if (!keys.includes(icon)) setIcon(keys[0]);
										}}
										className="px-3.5 py-2 rounded-full text-[12.5px] font-medium capitalize transition-all border"
										style={{
											background: selected
												? `color-mix(in srgb, ${tColor} 16%, transparent)`
												: "var(--color-input)",
											borderColor: selected ? tColor : "transparent",
											color: selected ? tColor : "var(--text-secondary)",
										}}
									>
										{t}
									</button>
								);
							})}
						</div>
					</div>

					{/* Icona */}
					<div>
						<label className="text-xs text-muted mb-3 block tracking-wide">Icona</label>
						<div className="grid grid-cols-6 gap-2.5">
							{iconsForType(type).map(({ key, Icon }) => {
								const selected = icon === key;
								return (
									<button
										key={key}
										type="button"
										onClick={() => setIcon(key)}
										className="aspect-square rounded-[14px] flex items-center justify-center transition-all border"
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
