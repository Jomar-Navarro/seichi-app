"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { GOAL_ICONS } from "@/lib/goal-icons";
import { createGoal, updateGoal, deleteGoal } from "@/app/(main)/risparmi/actions";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, currencySymbol } from "@/lib/i18n/format";
import DatePicker from "@/components/UI/DatePicker";
import type { GoalWithProgress } from "@/types";

/**
 * ⚠️ Non c'è una prop `isOpen`, ed è il punto di questo componente.
 *
 * Prima restava sempre montato e si nascondeva da sé (`if (!isOpen) return null`).
 * Ma nascondere non è smontare: lo stato del form sopravviveva alla chiusura, e
 * andava riazzerato a mano in un `useLayoutEffect` che riscriveva cinque `useState`
 * a ogni apertura — cioè un render a cascata, che il lint di React segnala.
 *
 * Ora è il chiamante a montarlo e smontarlo (`{sheetOpen && <GoalSheet …/>}`).
 * Montare È l'azzeramento: gli inizializzatori di `useState` girano da capo e
 * leggono `goal`, quindi l'effetto non serve più — non è stato zittito, è
 * scomparso. Il costo è zero: da chiuso il componente non disegnava nulla
 * comunque, e non c'è animazione d'uscita da preservare.
 */
interface GoalSheetProps {
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

export default function GoalSheet({ goal, onClose }: GoalSheetProps) {
	const { locale, t } = useI18n();
	const router = useRouter();
	// Inizializzatore pigro: gira una volta al montaggio, che è esattamente
	// quando il pannello si apre. Gli altri stati partono già dal valore giusto.
	const [form, setForm] = useState<FormState>(() =>
		goal
			? {
					name: goal.name,
					targetAmount: goal.target_amount != null ? String(goal.target_amount) : "",
					targetDate: goal.target_date ?? "",
					icon: GOAL_ICONS.some((i) => i.id === goal.icon) ? goal.icon : "plane",
			  }
			: EMPTY_FORM,
	);
	const [submitted, setSubmitted] = useState(false);
	const [loading, setLoading] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const nameError = submitted && !form.name.trim();
	const amountError =
		submitted &&
		form.targetAmount !== "" &&
		(isNaN(parseFloat(form.targetAmount)) || parseFloat(form.targetAmount) <= 0);

	async function handleSubmit() {
		setSubmitted(true);
		if (!form.name.trim()) return;
		if (
			form.targetAmount !== "" &&
			(isNaN(parseFloat(form.targetAmount)) || parseFloat(form.targetAmount) <= 0)
		)
			return;

		setLoading(true);
		setServerError(null);
		const payload = {
			name: form.name.trim(),
			target_amount: form.targetAmount !== "" ? parseFloat(form.targetAmount) : null,
			target_date: form.targetDate || null,
			icon: form.icon,
		};

		try {
			const result = goal
				? await updateGoal(goal.id, payload)
				: await createGoal(payload);
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

	async function handleDelete() {
		if (!goal) return;
		if (!confirmDelete) {
			setConfirmDelete(true);
			return;
		}
		setLoading(true);
		setServerError(null);
		try {
			const result = await deleteGoal(goal.id);
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
						{goal ? t.goals.editTitle : t.goals.newTitle}
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
						<label className="text-xs text-muted mb-2 block tracking-wide">{t.goals.nameLabel}</label>
						<input
							type="text"
							placeholder={t.goals.namePlaceholder}
							value={form.name}
							onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
							className="w-full rounded-[18px] px-4 py-3.5 text-[14.5px] bg-input border border-subtle outline-none placeholder:text-muted/60"
							style={{ borderColor: nameError ? "var(--color-aka)" : undefined }}
						/>
						{nameError && (
							<p className="text-xs mt-1.5 ml-1" style={{ color: "var(--ink-aka)" }}>
								{t.goals.nameRequired}
							</p>
						)}
					</div>

					{/* Importo obiettivo */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">
							{t.goals.targetLabel}{" "}
							<span className="text-muted opacity-60">{t.goals.optional}</span>
						</label>
						<div
							className="flex items-center gap-2 rounded-[18px] px-4 py-3.5 bg-input border border-subtle"
							style={{ borderColor: amountError ? "var(--color-aka)" : undefined }}
						>
							<span className="text-[14.5px] text-muted">{currencySymbol(DISPLAY_CURRENCY, locale)}</span>
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
							<p className="text-xs mt-1.5 ml-1" style={{ color: "var(--ink-aka)" }}>
								{t.goals.amountInvalid}
							</p>
						)}
					</div>

					{/* Data obiettivo */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">
							{t.goals.dateLabel}{" "}
							<span className="text-muted opacity-60">{t.goals.optional}</span>
						</label>
						{/* Picker custom e non `<input type="date">`: quello segue la
						    lingua del BROWSER, non quella dell'app — vedi DatePicker. */}
						<DatePicker
							value={form.targetDate}
							onChange={(iso) => setForm((f) => ({ ...f, targetDate: iso }))}
							placeholder={t.goals.noDeadline}
							className="rounded-[18px] px-4 py-3.5 bg-input border border-subtle"
						/>
					</div>

					{/* Icona */}
					<div>
						<label className="text-xs text-muted mb-3 block tracking-wide">{t.goals.iconLabel}</label>
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
												: "var(--icon-btn-bg)",
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

				{serverError && (
					<p className="mt-5 text-xs text-center" style={{ color: "var(--ink-aka)" }}>
						{serverError}
					</p>
				)}

				<button
					onClick={handleSubmit}
					disabled={loading}
					className="mt-4 w-full py-4 rounded-2xl text-[14.5px] font-semibold btn-primary disabled:opacity-50"
				>
					{loading ? t.common.saving : goal ? t.goals.saveChanges : t.goals.create}
				</button>

				{goal && (
					<button
						onClick={handleDelete}
						disabled={loading}
						className="mt-3 w-full py-3.5 rounded-2xl text-sm font-semibold border disabled:opacity-50 transition-colors hover:bg-[color-mix(in_srgb,var(--color-aka)_8%,transparent)]"
						style={{
							color: "var(--ink-aka)",
							borderColor: confirmDelete
								? "var(--color-aka)"
								: "color-mix(in srgb, var(--color-aka) 35%, transparent)",
							background: confirmDelete
								? "color-mix(in srgb, var(--color-aka) 12%, transparent)"
								: undefined,
						}}
					>
						{confirmDelete ? t.goals.deleteConfirm : t.goals.delete}
					</button>
				)}
			</div>
		</div>
	);
}
