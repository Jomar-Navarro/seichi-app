"use client";

import { useState, useLayoutEffect, useEffect } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Select from "@/components/UI/Select";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { TIPO_COLOR } from "@/lib/transaction-utils";
import { updateRecurringRule } from "@/app/(main)/action";
import type { RecurringRule, Category, Frequency } from "@/types";

const FREQUENCIES: { id: Frequency; label: string }[] = [
	{ id: "settimanale", label: "Settimanale" },
	{ id: "mensile", label: "Mensile" },
	{ id: "annuale", label: "Annuale" },
];

interface RecurringSheetProps {
	isOpen: boolean;
	rule: RecurringRule | null;
	onClose: () => void;
}

export default function RecurringSheet({ isOpen, rule, onClose }: RecurringSheetProps) {
	const router = useRouter();
	const [amount, setAmount] = useState("");
	const [categoryId, setCategoryId] = useState<string | null>(null);
	const [notes, setNotes] = useState("");
	const [frequency, setFrequency] = useState<Frequency>("mensile");
	const [nextRun, setNextRun] = useState("");
	const [categoryList, setCategoryList] = useState<Category[]>([]);
	const [loading, setLoading] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);

	useLayoutEffect(() => {
		if (isOpen && rule) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setAmount(rule.amount.toFixed(2).replace(".", ","));
			setCategoryId(rule.category_id);
			setNotes(rule.notes ?? "");
			setFrequency(rule.frequency);
			setNextRun(rule.next_run);
			setLoading(false);
			setServerError(null);
		}
	}, [isOpen, rule]);

	useEffect(() => {
		if (!isOpen || !rule) return;
		async function loadCategories() {
			const supabase = createClient();
			const { data } = await supabase.from("categories").select("*").eq("type", rule!.type);
			if (data) setCategoryList(data);
		}
		loadCategories();
	}, [isOpen, rule]);

	if (!isOpen || !rule) return null;

	const color = TIPO_COLOR[rule.type] ?? "var(--color-kiri)";
	const importoValido = amount !== "" && parseFloat(amount.replace(",", ".")) > 0;

	const categoryOptions = categoryList.map((c) => {
		const Icon = ICON_MAP[c.icon] ?? GOAL_ICON_MAP[c.icon];
		return {
			value: c.id,
			label: c.name,
			icon: Icon ? (
				<Icon size={14} style={{ color: `var(--color-${c.color})` }} />
			) : (
				<span
					className="w-2.5 h-2.5 rounded-full inline-block"
					style={{ background: `var(--color-${c.color})` }}
				/>
			),
		};
	});

	async function handleSubmit() {
		if (!importoValido || loading || !rule) return;
		setLoading(true);
		setServerError(null);
		try {
			const result = await updateRecurringRule(
				rule.id,
				parseFloat(amount.replace(",", ".")),
				categoryId,
				notes.trim() || null,
				frequency,
				nextRun,
			);
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

	return (
		<div className="fixed inset-0 z-50 flex items-end">
			<div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

			<div
				className="relative w-full flex flex-col rounded-t-4xl pt-3.5 px-6 pb-8 modal-shadow border-t border-l border-r border-subtle bg-modal backdrop-blur-2xl"
				style={{ maxHeight: "90dvh", overflowY: "auto" }}
			>
				<div className="w-10 h-1 rounded-full mx-auto mb-1 bg-modal-handle shrink-0" />

				<div className="flex items-center justify-between mt-4 mb-6 shrink-0">
					<h2 className="text-xl font-semibold">Modifica ricorrenza</h2>
					<button
						onClick={onClose}
						className="w-8 h-8 flex items-center justify-center rounded-xl bg-control border border-subtle"
					>
						<X size={15} />
					</button>
				</div>

				<div className="flex flex-col gap-4">
					{/* Importo */}
					<div>
						<label className="text-xs text-muted mb-1.5 block">Importo</label>
						<div className="flex items-center gap-2 rounded-2xl px-4 py-3 bg-card border border-subtle">
							<span className="text-sm text-muted">€</span>
							<input
								type="text"
								inputMode="decimal"
								value={amount}
								onChange={(e) => setAmount(e.target.value.replace(/[^0-9,]/g, ""))}
								className="flex-1 bg-transparent outline-none text-base"
							/>
						</div>
					</div>

					{/* Categoria */}
					<Select
						title="Categoria"
						variant="compact"
						options={categoryOptions}
						selected={categoryId ?? ""}
						onChange={(val) => setCategoryId(val)}
					/>

					{/* Frequenza */}
					<div>
						<label className="text-xs text-muted mb-1.5 block">Frequenza</label>
						<div className="grid grid-cols-3 gap-2">
							{FREQUENCIES.map((f) => {
								const selected = frequency === f.id;
								return (
									<button
										key={f.id}
										type="button"
										onClick={() => setFrequency(f.id)}
										className="py-2.5 rounded-xl text-[12.5px] font-medium border transition-all"
										style={{
											background: selected
												? `color-mix(in srgb, ${color} 16%, transparent)`
												: "var(--color-card)",
											borderColor: selected ? color : "var(--color-subtle)",
											color: selected ? color : "var(--text-secondary)",
										}}
									>
										{f.label}
									</button>
								);
							})}
						</div>
					</div>

					{/* Prossima data */}
					<div>
						<label className="text-xs text-muted mb-1.5 block">Prossima data</label>
						<div className="flex items-center rounded-2xl px-4 py-3 bg-card border border-subtle">
							<input
								type="date"
								value={nextRun}
								onChange={(e) => setNextRun(e.target.value)}
								className="flex-1 bg-transparent outline-none text-sm text-muted appearance-none"
								style={{ colorScheme: "inherit" }}
							/>
						</div>
					</div>

					{/* Descrizione */}
					<div>
						<label className="text-xs text-muted mb-1.5 block">Descrizione</label>
						<input
							type="text"
							placeholder="Opzionale"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							className="w-full rounded-2xl px-4 py-3 text-sm bg-card border border-subtle outline-none placeholder:text-muted/60"
						/>
					</div>
				</div>

				{serverError && (
					<p className="mt-4 text-xs text-center" style={{ color: "var(--color-aka)" }}>
						{serverError}
					</p>
				)}

				<button
					onClick={handleSubmit}
					disabled={!importoValido || loading}
					className="mt-6 w-full py-4 rounded-2xl text-[14.5px] font-semibold btn-primary disabled:opacity-50"
				>
					{loading ? "Salvataggio…" : "Salva modifiche"}
				</button>
			</div>
		</div>
	);
}
