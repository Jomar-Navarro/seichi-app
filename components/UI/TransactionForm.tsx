"use client";
import { useEffect, useState } from "react";
import { TransactionType, Category, Transaction } from "@/types";
import { createClient } from "@/lib/supabase/client";
import {
	Calendar,
	ChevronLeft,
	ChevronRight,
	Pencil,
	Delete,
	Check,
	Trash2,
	Banknote,
	Briefcase,
	Award,
	Gift,
	ArrowDownLeft,
	ShoppingCart,
	UtensilsCrossed,
	Car,
	HeartPulse,
	Shirt,
	Smile,
	Home,
	Shield,
	Plane,
	Building2,
	Laptop,
	BarChart2,
	TrendingUp,
	Bitcoin,
	PiggyBank,
	Play,
	Music,
	Dumbbell,
	Zap,
	KeyRound,
	type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
	Banknote,
	Briefcase,
	Award,
	Gift,
	ArrowDownLeft,
	ShoppingCart,
	UtensilsCrossed,
	Car,
	HeartPulse,
	Shirt,
	Smile,
	Home,
	Shield,
	Plane,
	Building2,
	Laptop,
	BarChart2,
	TrendingUp,
	Bitcoin,
	PiggyBank,
	Play,
	Music,
	Dumbbell,
	Zap,
	KeyRound,
};
import Select from "@/components/UI/Select";
import {
	saveTransaction,
	updateTransaction,
	deleteTransaction,
} from "@/app/(main)/action";
import { useUIStore } from "@/store/useUIStore";

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

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
	const isEditing = !!transaction;

	const [amount, setAmount] = useState(() =>
		transaction ? transaction.amount.toString().replace(".", ",") : "",
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
	const { closeTransactionModal, notifyTransactionSaved } = useUIStore();

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
		if (!isValid) return;
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
	}

	async function handleDelete() {
		if (!transaction) return;
		const result = await deleteTransaction(transaction.id);
		if (!result?.error) {
			notifyTransactionSaved();
			closeTransactionModal();
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

	const categoryOptions = categoryList.map((c) => {
		const Icon = ICON_MAP[c.icon];
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

	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();
	const totalDays = getDaysInMonth(year, month);
	const firstWeekday = getFirstWeekday(year, month);
	const today = new Date();

	return (
		<div className="flex flex-col flex-1 min-h-0">
			{/* Importo */}
			<div className="text-center pt-1 pb-3">
				<p className="text-muted text-md mb-2">Importo</p>
				<div className="text-7xl font-bold tracking-tight">
					<span className="text-3xl mr-1">€</span>
					{amount || "0"}
				</div>
			</div>

			<div className="flex flex-col gap-2 mb-3">
				{/* Categoria */}
				<Select
					title="Categoria"
					variant="compact"
					options={categoryOptions}
					selected={categoryId ?? ""}
					onChange={(val) => setCategoryId(val)}
				/>

				{/* Descrizione */}
				<div>
					<p className="text-xs text-muted mb-1.5">Descrizione</p>
					<div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-subtle">
						<Pencil size={14} className="text-muted shrink-0" />
						<input
							type="text"
							placeholder="Es. Trenord, Esselunga..."
							value={description ?? ""}
							onChange={(e) => setDescription(e.target.value)}
							className="bg-transparent text-sm flex-1 outline-none placeholder:text-muted"
						/>
					</div>
				</div>

				{/* Data */}
				<div className="relative">
					<p className="text-xs text-muted mb-1.5">Data</p>
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
							{date.toLocaleDateString("it-IT", {
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
									{viewDate.toLocaleDateString("it-IT", {
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
													? "bg-foreground text-yoru font-semibold"
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
						className={`flex items-center justify-center rounded-2xl bg-card border border-subtle text-lg font-medium ${isEditing ? "h-14" : "h-16"}`}
					>
						{key === "⌫" ? <Delete size={18} /> : key}
					</button>
				))}
			</div>

			<button
				onClick={handleSave}
				disabled={!isValid}
				className="w-full mt-3 py-4 rounded-2xl btn-primary font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
			>
				<Check size={18} />
				{isEditing ? "Salva modifiche" : "Salva movimento"}
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
								style={{ background: "var(--color-aka)", color: "#fff" }}
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
								color: "var(--color-aka)",
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
