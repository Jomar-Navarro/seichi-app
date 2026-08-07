"use client";
import { useEffect, useState } from "react";
import { TransactionType, Category, Transaction, Frequency } from "@/types";
import { createClient } from "@/lib/supabase/client";
import {
	Calendar,
	ChevronLeft,
	ChevronRight,
	Pencil,
	Delete,
	Check,
	Trash2,
	Repeat,
} from "lucide-react";
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
import { useI18n } from "@/components/features/I18nProvider";
import {
	DISPLAY_CURRENCY,
	currencySymbol,
	formatDate,
	weekdayInitials,
} from "@/lib/i18n/format";

function getDaysInMonth(year: number, month: number) {
	return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
	const day = new Date(year, month, 1).getDay();
	return day === 0 ? 6 : day - 1;
}

interface TransactionFormProps {
	selectedType: TransactionType;
	transaction?: Transaction;
}

export default function TransactionForm({
	selectedType,
	transaction,
}: TransactionFormProps) {
	const { locale, t } = useI18n();
	// Le iniziali dei giorni le dà Intl: erano un array italiano cablato.
	const DAYS = weekdayInitials(locale);
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
	const [isDateOpen, setIsDateOpen] = useState(false);
	const [viewDate, setViewDate] = useState(() =>
		transaction ? new Date(transaction.date) : new Date(),
	);
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

	function selectDay(day: number) {
		setDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 12));
		setIsDateOpen(false);
	}

	function navigateMonth(delta: number) {
		setViewDate((prev) => {
			const d = new Date(prev);
			d.setMonth(d.getMonth() + delta);
			return d;
		});
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

	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();
	const totalDays = getDaysInMonth(year, month);
	const firstWeekday = getFirstWeekday(year, month);
	const today = new Date();

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
				<div className="relative">
					<p className="text-xs text-muted mb-1.5">{t.transactions.form.date}</p>
					<button
						type="button"
						onClick={() => {
							setViewDate(new Date(date));
							setIsDateOpen((p) => !p);
						}}
						className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-subtle"
					>
						<Calendar size={14} className="text-muted shrink-0" />
						<span className="text-sm flex-1 text-left">
							{formatDate(date, locale, {
								day: "numeric",
								month: "long",
								year: "numeric",
							})}
						</span>
						<ChevronRight size={14} className="text-muted" />
					</button>

					{isDateOpen && (
						<div className="absolute top-full mt-1 left-0 right-0 z-20 rounded-2xl bg-deep border border-subtle p-3">
							<div className="flex items-center justify-between mb-2">
								<button
									type="button"
									onClick={() => navigateMonth(-1)}
									className="w-7 h-7 flex items-center justify-center rounded-xl bg-card border border-subtle"
								>
									<ChevronLeft size={14} />
								</button>
								<span className="text-sm font-medium capitalize">
									{formatDate(viewDate, locale, {
										month: "long",
										year: "numeric",
									})}
								</span>
								<button
									type="button"
									onClick={() => navigateMonth(1)}
									className="w-7 h-7 flex items-center justify-center rounded-xl bg-card border border-subtle"
								>
									<ChevronRight size={14} />
								</button>
							</div>

							<div className="grid grid-cols-7 mb-1">
								{DAYS.map((d) => (
									<span
										key={d}
										className="text-center text-[10px] text-muted py-1"
									>
										{d}
									</span>
								))}
							</div>

							<div className="grid grid-cols-7 gap-0.5">
								{Array.from({ length: firstWeekday }).map((_, i) => (
									<div key={`e${i}`} />
								))}
								{Array.from({ length: totalDays }).map((_, i) => {
									const day = i + 1;
									const isSelected =
										date.getDate() === day &&
										date.getMonth() === month &&
										date.getFullYear() === year;
									const isToday =
										today.getDate() === day &&
										today.getMonth() === month &&
										today.getFullYear() === year;
									return (
										<button
											key={day}
											type="button"
											onClick={() => selectDay(day)}
											className={`h-8 w-full rounded-xl text-xs flex items-center justify-center transition-colors ${
												isSelected
													? "btn-primary font-semibold"
													: isToday
														? "border border-subtle font-medium"
														: "hover:bg-card"
											}`}
										>
											{day}
										</button>
									);
								})}
							</div>
						</div>
					)}
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
								Annulla
							</button>
							<button
								onClick={handleDelete}
								className="flex-1 py-3.5 rounded-2xl text-sm font-semibold"
								// `--on-accent`, non "#fff": vedi CLAUDE.md, Fase 18.
								style={{ background: "var(--color-aka)", color: "var(--on-accent)" }}
							>
								Conferma eliminazione
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
							Elimina movimento
						</button>
					)}
				</div>
			)}
		</div>
	);
}
