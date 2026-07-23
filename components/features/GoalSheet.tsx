"use client";

import { useState, useLayoutEffect } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { GOAL_ICONS } from "@/lib/goal-icons";
import { createGoal, updateGoal, deleteGoal } from "@/app/(main)/risparmi/actions";
import type { GoalWithProgress } from "@/types";

interface GoalSheetProps {
	isOpen: boolean;
	goal: GoalWithProgress | null;
	onClose: () => void;
}

interface FormState {
	name: string;
	targetAmount: string;
	targetDate: string;
	icon: string;
}

const EMPTY_FORM: FormState = {
	name: "",
	targetAmount: "",
	targetDate: "",
	icon: "plane",
};

export default function GoalSheet({ isOpen, goal, onClose }: GoalSheetProps) {
	const router = useRouter();
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [submitted, setSubmitted] = useState(false);
	const [loading, setLoading] = useState(false);

	useLayoutEffect(() => {
		if (isOpen) {
			setSubmitted(false);
			setLoading(false);
			setForm(
				goal
					? {
							name: goal.name,
							targetAmount: goal.target_amount != null ? String(goal.target_amount) : "",
							targetDate: goal.target_date ?? "",
							icon: GOAL_ICONS.some((i) => i.id === goal.icon) ? goal.icon : "plane",
					  }
					: EMPTY_FORM,
			);
		}
	}, [isOpen, goal]);

	const nameError = submitted && !form.name.trim();
	const amountError =
		submitted && form.targetAmount !== "" && parseFloat(form.targetAmount) <= 0;

	async function handleSubmit() {
		setSubmitted(true);
		if (!form.name.trim()) return;
		if (form.targetAmount !== "" && parseFloat(form.targetAmount) <= 0) return;

		setLoading(true);
		const payload = {
			name: form.name.trim(),
			target_amount: form.targetAmount !== "" ? parseFloat(form.targetAmount) : null,
			target_date: form.targetDate || null,
			icon: form.icon,
		};

		const result = goal
			? await updateGoal(goal.id, payload)
			: await createGoal(payload);

		setLoading(false);
		if (!result.error) {
			router.refresh();
			onClose();
		}
	}

	async function handleDelete() {
		if (!goal) return;
		setLoading(true);
		await deleteGoal(goal.id);
		router.refresh();
		onClose();
	}

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-end">
			<div
				className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
				onClick={onClose}
			/>

			<div
				className="relative w-full flex flex-col rounded-t-4xl pt-3.5 px-6 pb-8 modal-shadow border-t border-l border-r border-subtle bg-modal backdrop-blur-2xl"
				style={{ maxHeight: "90dvh", overflowY: "auto" }}
			>
				<div className="w-10 h-1 rounded-full mx-auto mb-1 bg-modal-handle shrink-0" />

				<div className="flex items-center justify-between mt-4 mb-6 shrink-0">
					<h2 className="text-xl font-semibold">
						{goal ? "Modifica obiettivo" : "Nuovo obiettivo"}
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
						<label className="text-xs text-muted mb-2 block tracking-wide">Nome obiettivo</label>
						<input
							type="text"
							placeholder="Es. Viaggio in Giappone"
							value={form.name}
							onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
							className="w-full rounded-[18px] px-4 py-3.5 text-[14.5px] bg-input border border-subtle outline-none placeholder:text-muted/60"
							style={{ borderColor: nameError ? "var(--color-aka)" : undefined }}
						/>
						{nameError && (
							<p className="text-xs mt-1.5 ml-1" style={{ color: "var(--color-aka)" }}>
								Inserisci un nome
							</p>
						)}
					</div>

					{/* Importo obiettivo */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">
							Importo obiettivo{" "}
							<span className="text-muted opacity-60">(opzionale)</span>
						</label>
						<div
							className="flex items-center gap-2 rounded-[18px] px-4 py-3.5 bg-input border border-subtle"
							style={{ borderColor: amountError ? "var(--color-aka)" : undefined }}
						>
							<span className="text-[14.5px] text-muted">€</span>
							<input
								type="number"
								inputMode="decimal"
								placeholder="0"
								value={form.targetAmount}
								onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
								className="flex-1 bg-transparent outline-none text-[14.5px] placeholder:text-muted/60"
							/>
						</div>
						{amountError && (
							<p className="text-xs mt-1.5 ml-1" style={{ color: "var(--color-aka)" }}>
								Inserisci un importo valido
							</p>
						)}
					</div>

					{/* Data obiettivo */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">
							Data obiettivo{" "}
							<span className="text-muted opacity-60">(opzionale)</span>
						</label>
						<div className="flex items-center rounded-[18px] px-4 py-3.5 bg-input border border-subtle">
							<input
								type="date"
								value={form.targetDate}
								onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
								className="flex-1 bg-transparent outline-none text-[14.5px] text-muted appearance-none"
								style={{ colorScheme: "inherit" }}
							/>
						</div>
					</div>

					{/* Icona */}
					<div>
						<label className="text-xs text-muted mb-3 block tracking-wide">Icona</label>
						<div className="grid grid-cols-4 gap-2.5">
							{GOAL_ICONS.map(({ id, icon: Icon }) => {
								const selected = form.icon === id;
								return (
									<button
										key={id}
										type="button"
										onClick={() => setForm((f) => ({ ...f, icon: id }))}
										className="aspect-square rounded-[15px] flex items-center justify-center transition-all"
										style={{
											background: selected
												? "color-mix(in srgb, var(--color-kin) 16%, transparent)"
												: "rgba(70,62,48,0.06)",
											border: selected
												? "1.5px solid var(--color-kin)"
												: "1.5px solid transparent",
										}}
									>
										<Icon
											size={19}
											strokeWidth={1.4}
											style={{ color: selected ? "var(--color-kin)" : "var(--color-muted)" }}
										/>
									</button>
								);
							})}
						</div>
					</div>
				</div>

				<button
					onClick={handleSubmit}
					disabled={loading}
					className="mt-8 w-full py-4 rounded-2xl text-[14.5px] font-semibold btn-primary disabled:opacity-50"
				>
					{loading ? "Salvataggio…" : goal ? "Salva modifiche" : "Crea obiettivo"}
				</button>

				{goal && (
					<button
						onClick={handleDelete}
						disabled={loading}
						className="mt-4 text-sm text-center w-full disabled:opacity-50"
						style={{ color: "var(--color-aka)", opacity: 0.8 }}
					>
						Elimina obiettivo
					</button>
				)}
			</div>
		</div>
	);
}
