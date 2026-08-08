"use client";
import { useEffect, useState } from "react";
import { TransactionType, Category, Transaction, Frequency } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Delete, Check, Trash2, Repeat } from "lucide-react";
import Select from "@/components/UI/Select";
import FrequencySelector from "@/components/UI/FrequencySelector";
import { SwitchVisual } from "@/components/UI/Switch";
import { buildCategoryOptions } from "@/lib/category-options";
import {
	saveTransaction,
	updateTransaction,
	deleteTransaction,
	createRecurringRule,
} from "@/app/(main)/action";
import { useUIStore } from "@/store/useUIStore";
import DatePicker from "@/components/UI/DatePicker";
import { useI18n } from "@/components/features/I18nProvider";
import { DISPLAY_CURRENCY, currencySymbol } from "@/lib/i18n/format";

/**
 * ⚠️ Il calendario NON sta più qui.
 *
 * Questo file conteneva un picker inline completo — griglia dei giorni,
 * navigazione dei mesi, intestazione della settimana — che nella Fase 19 è stato
 * spostato in `components/UI/DatePicker.tsx` per darlo anche a `GoalSheet` e
 * `RecurringSheet`, che usavano ancora `<input type="date">`. Per un po' le due
 * copie sono coesistite: sbagliato, e già stavano divergendo (`min` e il comando
 * "svuota" esistevano solo nella nuova). Ora il picker è uno solo.
 */
interface TransactionFormProps {
	selectedType: TransactionType;
	transaction?: Transaction;
}

export default function TransactionForm({
	selectedType,
	transaction,
}: TransactionFormProps) {
	const { locale, t } = useI18n();
	const isEditing = !!transaction;

	const [amount, setAmount] = useState(() =>
		transaction ? transaction.amount.toFixed(2).replace(".", ",") : "",
	);
	const [categoryId, setCategoryId] = useState<string | null>(
		transaction?.category_id ?? null,
	);
	const [description, setDescription] = useState<string | null>(
		transaction?.notes ?? null,
	);
	const [date, setDate] = useState(() =>
		transaction ? new Date(transaction.date) : new Date(),
	);
	const [categoryList, setCategoryList] = useState<Category[]>([]);
	const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const { closeTransactionModal, notifyTransactionSaved, recurringDefault } =
		useUIStore();
	const [isRecurring, setIsRecurring] = useState(recurringDefault);
	const [frequency, setFrequency] = useState<Frequency>("mensile");

	useEffect(() => {
		async function loadCategories() {
			const supabase = createClient();
			const { data } = await supabase
				.from("categories")
				.select("*")
				.eq("type", selectedType.id);
			if (data) setCategoryList(data);
		}
		loadCategories();
	}, [selectedType.id]);

	const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];

	const handleKey = (key: string) => {
		if (key === "⌫") {
			setAmount((prev) => prev.slice(0, -1));
			return;
		}
		if (key === ",") {
			setAmount((prev) => (prev.includes(",") ? prev : prev + ","));
			return;
		}
		setAmount((prev) => prev + key);
	};

	const isValid = amount !== "" && parseFloat(amount.replace(",", ".")) > 0;

	async function handleSave() {
		if (!isValid || isSaving) return;
		setIsSaving(true);
		try {
			const importo = parseFloat(amount.replace(",", "."));
			const result = isEditing
				? await updateTransaction(
						transaction.id,
						importo,
						selectedType.id,
						categoryId,
						description,
						date.toISOString(),
					)
				: isRecurring
					? await createRecurringRule(
							importo,
							selectedType.id,
							categoryId,
							description,
							date.toLocaleDateString("sv-SE"), // YYYY-MM-DD in locale, no shift UTC
							frequency,
						)
					: await saveTransaction(
							importo,
							selectedType.id,
							categoryId,
							description,
							date.toISOString(),
						);

			if (!result?.error) {
				notifyTransactionSaved();
				closeTransactionModal();
			}
		} finally {
			setIsSaving(false);
		}
	}

	async function handleDelete() {
		if (!transaction || isSaving) return;
		setIsSaving(true);
		try {
			const result = await deleteTransaction(transaction.id);
			if (!result?.error) {
				notifyTransactionSaved();
				closeTransactionModal();
			}
		} finally {
			setIsSaving(false);
		}
	}

	const effectiveCategoryList: Category[] =
		categoryList.length > 0
			? categoryList
			: isEditing && transaction.categories && transaction.category_id
				? [
						{
							id: transaction.category_id,
							user_id: "",
							name: transaction.categories.name,
							icon: transaction.categories.icon,
							color: transaction.categories.color,
							type: selectedType.id,
						},
					]
				: [];

	const categoryOptions = buildCategoryOptions(effectiveCategoryList);

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
			{/* Importo */}
			<div className="text-center pt-1 pb-3">
				<p className="text-muted text-md mb-2">{t.transactions.form.amount}</p>
				<div className="text-7xl font-bold tracking-tight">
					<span className="text-3xl mr-1">{currencySymbol(DISPLAY_CURRENCY, locale)}</span>
					{amount || "0"}
				</div>
			</div>

			<div className="flex flex-col gap-2 mb-3">
				{/* Categoria */}
				<Select
					title={t.transactions.form.category}
					variant="compact"
					options={categoryOptions}
					selected={categoryId ?? ""}
					onChange={(val) => setCategoryId(val)}
				/>

				{/* Descrizione */}
				<div>
					<p className="text-xs text-muted mb-1.5">{t.transactions.form.description}</p>
					<div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-subtle">
						<Pencil size={14} className="text-muted shrink-0" />
						<input
							type="text"
							placeholder={t.transactions.form.descriptionPlaceholder}
							value={description ?? ""}
							onChange={(e) => setDescription(e.target.value)}
							className="bg-transparent text-sm flex-1 outline-none placeholder:text-muted"
						/>
					</div>
				</div>

				{/* Data */}
				<div>
					<p className="text-xs text-muted mb-1.5">{t.transactions.form.date}</p>
					{/* Lo stesso picker di GoalSheet e RecurringSheet: qui viveva la copia
					    originale, ora estratta in components/UI/DatePicker.tsx. */}
					<DatePicker
						value={date.toLocaleDateString("sv-SE")}
						// Mezzogiorno, non mezzanotte: attorno al cambio ora legale una
						// data costruita a mezzanotte può ricadere nel giorno prima.
						onChange={(iso) => setDate(new Date(`${iso}T12:00:00`))}
					/>
				</div>
			</div>

			{/* Ripeti (solo nuovi movimenti) */}
			{!isEditing && (
				<div className="mb-3">
					<p className="text-xs text-muted mb-1.5">{t.transactions.form.recurringSection}</p>
					<button
						type="button"
						onClick={() => setIsRecurring((v) => !v)}
						className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-subtle"
					>
						<Repeat size={14} className="text-muted shrink-0" />
						<span className="text-sm flex-1 text-left">{t.transactions.form.repeat}</span>
						{/*
							Il DISEGNO di <Switch> senza il suo comando: questa riga è già
							un <button>, e annidarci dentro il bottone role="switch" del
							componente sarebbe markup interattivo dentro markup interattivo.
							Il comando resta la riga.
							Acceso il binario è l'accento del tipo, non la CTA — quindi il
							pomello va su --on-accent: gli accenti invertono la luminosità
							fra i temi e un pomello fisso ci sparirebbe sopra da un lato.
						*/}
						<SwitchVisual
							checked={isRecurring}
							on={{ track: selectedType.color, knob: "var(--on-accent)" }}
						/>
					</button>
					{isRecurring && (
						<div className="mt-2">
							<FrequencySelector
								value={frequency}
								onChange={setFrequency}
								color={selectedType.color}
							/>
						</div>
					)}
				</div>
			)}

			{/* Tastierino */}
			<div className="grid grid-cols-3 gap-2">
				{KEYS.map((key, i) => (
					<button
						key={i}
						type="button"
						onPointerDown={(e) => {
							e.preventDefault();
							handleKey(key);
						}}
						className={`flex items-center justify-center rounded-2xl bg-card border border-subtle text-lg font-medium ${isRecurring ? "h-12" : "h-14"}`}
					>
						{key === "⌫" ? <Delete size={18} /> : key}
					</button>
				))}
			</div>

			<button
				onClick={handleSave}
				disabled={!isValid || isSaving}
				className="w-full mt-3 py-4 rounded-2xl btn-primary font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
			>
				<Check size={18} />
				{isEditing
					? t.transactions.form.saveChanges
					: isRecurring
						? t.transactions.form.createRecurring
						: t.transactions.form.save}
			</button>

			{isEditing && (
				<div className="mt-2">
					{isDeleteConfirm ? (
						<div className="flex gap-2">
							<button
								onClick={() => setIsDeleteConfirm(false)}
								className="flex-1 py-3.5 rounded-2xl bg-card border border-subtle text-sm font-semibold"
							>
								{t.common.cancel}
							</button>
							<button
								onClick={handleDelete}
								className="flex-1 py-3.5 rounded-2xl text-sm font-semibold"
								// `--on-accent`, non "#fff": vedi CLAUDE.md, Fase 18.
								style={{ background: "var(--color-aka)", color: "var(--on-accent)" }}
							>
								{t.transactions.form.deleteConfirm}
							</button>
						</div>
					) : (
						<button
							onClick={() => setIsDeleteConfirm(true)}
							className="w-full py-3.5 rounded-2xl border text-sm font-semibold flex items-center justify-center gap-2"
							style={{
								borderColor:
									"color-mix(in srgb, var(--color-aka) 40%, transparent)",
								color: "var(--ink-aka)",
							}}
						>
							<Trash2 size={15} />
							{t.transactions.form.delete}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
