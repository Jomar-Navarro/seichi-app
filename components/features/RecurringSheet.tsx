"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Select from "@/components/UI/Select";
import FrequencySelector from "@/components/UI/FrequencySelector";
import { buildCategoryOptions } from "@/lib/category-options";
import { TIPO_COLOR } from "@/lib/transaction-utils";
import { updateRecurringRule } from "@/app/(main)/action";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, currencySymbol } from "@/lib/i18n/format";
import DatePicker from "@/components/UI/DatePicker";
import type { RecurringRule, Category, Frequency } from "@/types";

/**
 * ⚠️ Niente prop `isOpen`, e qui era anche **ridondante**: il chiamante passava
 * `isOpen={!!editing}` accanto a `rule={editing}`, cioè lo stesso dato due volte,
 * e il componente lo ricontrollava con `if (!isOpen || !rule) return null`. Tre
 * espressioni della stessa condizione, che potevano disaccordarsi.
 *
 * Ora è il chiamante a montare il pannello solo quando c'è una regola, quindi
 * `rule` non è più nullable e lo stato iniziale si legge direttamente da essa:
 * montare È l'azzeramento, e l'effetto che riscriveva sette `useState` — un
 * render a cascata a ogni apertura — è scomparso invece di essere zittito.
 */
interface RecurringSheetProps {
	rule: RecurringRule;
	onClose: () => void;
}

export default function RecurringSheet({ rule, onClose }: RecurringSheetProps) {
	const router = useRouter();
	const { locale, t } = useI18n();
	const [amount, setAmount] = useState(() => rule.amount.toFixed(2).replace(".", ","));
	const [categoryId, setCategoryId] = useState<string | null>(rule.category_id);
	const [notes, setNotes] = useState(rule.notes ?? "");
	const [frequency, setFrequency] = useState<Frequency>(rule.frequency);
	const [nextRun, setNextRun] = useState(rule.next_run);
	const [categoryList, setCategoryList] = useState<Category[]>([]);
	const [loading, setLoading] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);

	useEffect(() => {
		async function loadCategories() {
			const supabase = createClient();
			const { data } = await supabase.from("categories").select("*").eq("type", rule.type);
			if (data) setCategoryList(data);
		}
		loadCategories();
	}, [rule.type]);

	const color = TIPO_COLOR[rule.type] ?? "var(--color-kiri)";
	const todayISO = new Date().toLocaleDateString("sv-SE");
	const importoValido = amount !== "" && parseFloat(amount.replace(",", ".")) > 0;

	const categoryOptions = buildCategoryOptions(categoryList, t.recurring.noCategory);

	async function handleSubmit() {
		// `!rule` non serve più: la prop non è nullable, il montaggio lo garantisce.
		if (!importoValido || loading) return;
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
					<h2 className="text-xl font-semibold">{t.recurring.editTitle}</h2>
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
						<label className="text-xs text-muted mb-1.5 block">{t.recurring.amount}</label>
						<div className="flex items-center gap-2 rounded-2xl px-4 py-3 bg-card border border-subtle">
							<span className="text-sm text-muted">{currencySymbol(DISPLAY_CURRENCY, locale)}</span>
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
						title={t.recurring.category}
						variant="compact"
						options={categoryOptions}
						selected={categoryId ?? ""}
						onChange={(val) => setCategoryId(val || null)}
					/>

					{/* Frequenza */}
					<div>
						<label className="text-xs text-muted mb-1.5 block">{t.recurring.frequency}</label>
						<FrequencySelector value={frequency} onChange={setFrequency} color={color} />
					</div>

					{/* Prossima data */}
					<div>
						<label className="text-xs text-muted mb-1.5 block">{t.recurring.nextDate}</label>
						{/* Picker custom: `<input type="date">` seguiva la lingua del
						    browser e mostrava mm/dd/yyyy — vedi DatePicker. */}
						<DatePicker value={nextRun} onChange={setNextRun} min={todayISO} />
					</div>

					{/* Descrizione */}
					<div>
						<label className="text-xs text-muted mb-1.5 block">{t.recurring.description}</label>
						<input
							type="text"
							placeholder={t.recurring.descriptionPlaceholder}
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							className="w-full rounded-2xl px-4 py-3 text-sm bg-card border border-subtle outline-none placeholder:text-muted/60"
						/>
					</div>
				</div>

				{serverError && (
					<p className="mt-4 text-xs text-center" style={{ color: "var(--ink-aka)" }}>
						{serverError}
					</p>
				)}

				<button
					onClick={handleSubmit}
					disabled={!importoValido || loading}
					className="mt-6 w-full py-4 rounded-2xl text-[14.5px] font-semibold btn-primary disabled:opacity-50"
				>
					{loading ? t.common.saving : t.recurring.saveChanges}
				</button>
			</div>
		</div>
	);
}
