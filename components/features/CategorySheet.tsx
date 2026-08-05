"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { CATEGORY_LIBRARY } from "@/lib/category-icons";
import { TIPO_COLOR } from "@/lib/transaction-utils";
import { TRANSACTION_TYPES } from "@/types";
import {
	createCategory,
	updateCategory,
} from "@/app/(main)/impostazioni/actions";
import { getBudgetForCategory, setBudget } from "@/app/(main)/budget-actions";
import { BUDGET_PERIODS, periodSuffix } from "@/lib/budget";
import { clientClock } from "@/lib/dates";
import type { BudgetPeriod, Category } from "@/types";

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

export default function CategorySheet({
	isOpen,
	category,
	presetType,
	onClose,
}: CategorySheetProps) {
	const router = useRouter();
	const [name, setName] = useState("");
	const [icon, setIcon] = useState("");
	const [type, setType] = useState("spesa");
	const [submitted, setSubmitted] = useState(false);
	const [loading, setLoading] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>("mensile");
	const [budgetAmount, setBudgetAmount] = useState("");
	/** budget già presente all'apertura: serve a capire se l'utente l'ha cambiato */
	const [initialBudget, setInitialBudget] = useState<{
		period: BudgetPeriod;
		amount: number;
	} | null>(null);

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
			setBudgetPeriod("mensile");
			setBudgetAmount("");
			setInitialBudget(null);
		}
	}, [isOpen, category, presetType]);

	// Il budget vive in una tabella a parte (storico versionato), non è una
	// colonna di `categories`: va caricato separatamente quando si apre il form
	// su una categoria esistente.
	useEffect(() => {
		if (!isOpen || !category) return;
		let cancelled = false;
		getBudgetForCategory(category.id, clientClock()).then((res) => {
			if (cancelled || !("data" in res) || !res.data) return;
			setInitialBudget(res.data);
			setBudgetPeriod(res.data.period);
			setBudgetAmount(String(res.data.amount));
		});
		return () => {
			cancelled = true;
		};
	}, [isOpen, category]);

	const nameError = submitted && !name.trim();
	const color = TIPO_COLOR[type] ?? "var(--color-kiri)";
	const iconList = iconListFor(type, icon);
	/**
	 * Solo le categorie di spesa hanno un budget. Gli abbonamenti no: sono
	 * transazioni ricorrenti di cui l'importo è già noto in anticipo da
	 * `recurring_rules`, e un limite su una cifra che conosci non aggiunge nulla.
	 */
	const showBudget = type === "spesa";

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

			// La categoria è salvata: il budget è un secondo passo su una tabella
			// diversa. Se fallisce, la categoria resta (giustamente) e l'utente
			// legge perché il budget non è stato applicato.
			// Su creazione l'id arriva dalla server action; su modifica ce l'abbiamo
			// già. Il controllo sul tipo restringe l'unione di ritorno, che include
			// anche il ramo d'errore.
			const createdId =
				"id" in result && typeof result.id === "string" ? result.id : null;
			const categoryId = category?.id ?? createdId;
			if (categoryId) {
				const budgetError = await saveBudget(categoryId);
				if (budgetError) {
					setServerError(budgetError);
					return;
				}
			}

			router.refresh();
			onClose();
		} finally {
			setLoading(false);
		}
	}

	/**
	 * Scrive il budget solo se è cambiato davvero. Senza questo confronto, ogni
	 * salvataggio della categoria — anche solo per rinominarla — creerebbe una
	 * riga nello storico dei budget con lo stesso importo di prima.
	 */
	async function saveBudget(categoryId: string): Promise<string | null> {
		// ⚠️ La categoria non è più di tipo spesa, ma un budget ce l'aveva: va
		// rimosso, non semplicemente ignorato. Lasciandolo lì, la riga resta valida
		// nel DB e la card continua a comparire a "€0 / €X" per sempre — e siccome
		// il campo budget ora è nascosto, l'utente non ha più alcun modo di
		// toglierla. Un vicolo cieco creato da un cambio di tipo.
		if (!showBudget) {
			if (!initialBudget) return null;
			const res = await setBudget({
				categoryId,
				period: initialBudget.period,
				amount: null,
				clock: clientClock(),
			});
			return "error" in res ? res.error : null;
		}

		const parsed =
			budgetAmount.trim() === ""
				? null
				: Number(budgetAmount.replace(",", "."));
		if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
			return "Il limite di budget deve essere un importo maggiore di zero";
		}

		const unchanged =
			(parsed === null && initialBudget === null) ||
			(parsed !== null &&
				initialBudget !== null &&
				parsed === initialBudget.amount &&
				budgetPeriod === initialBudget.period);
		if (unchanged) return null;

		const res = await setBudget({
			categoryId,
			period: budgetPeriod,
			amount: parsed,
			clock: clientClock(),
		});
		return "error" in res ? res.error : null;
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
						<label className="text-xs text-muted mb-2 block tracking-wide">
							Nome
						</label>
						<input
							type="text"
							placeholder="es. Palestra"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full rounded-[18px] px-4 py-3.5 text-base bg-input border border-subtle outline-none placeholder:text-muted/60"
							style={{
								borderColor: nameError ? "var(--color-aka)" : undefined,
							}}
						/>
						{nameError && (
							<p
								className="text-xs mt-1.5 ml-1"
								style={{ color: "var(--ink-aka)" }}
							>
								Inserisci un nome
							</p>
						)}
					</div>

					{/* Tipo */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">
							Tipo
						</label>
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
												style={{
													color: selected ? tColor : "var(--text-muted)",
												}}
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

					{/* Limite di budget — solo per le categorie di spesa */}
					{showBudget && (
						<div>
							<label className="text-xs text-muted mb-2 block tracking-wide">
								Limite di budget{" "}
								<span className="text-muted/70 font-normal">(opzionale)</span>
							</label>

							<div className="grid grid-cols-3 gap-2 mb-2.5">
								{BUDGET_PERIODS.map((p) => {
									const selected = budgetPeriod === p.id;
									return (
										<button
											key={p.id}
											type="button"
											onClick={() => setBudgetPeriod(p.id)}
											className="text-center py-2 rounded-xl text-xs font-medium transition-all border"
											style={{
												background: selected
													? `color-mix(in srgb, ${color} 14%, transparent)`
													: "var(--color-input)",
												borderColor: selected ? color : "transparent",
												color: selected ? color : "var(--text-muted)",
												fontWeight: selected ? 600 : 500,
											}}
										>
											{p.label}
										</button>
									);
								})}
							</div>

							<div className="flex items-center rounded-2xl px-4 py-3.5 bg-input border border-subtle">
								<span className="text-[14.5px] text-muted mr-1.5">€</span>
								<input
									type="text"
									inputMode="decimal"
									placeholder="es. 250"
									value={budgetAmount}
									onChange={(e) => setBudgetAmount(e.target.value)}
									className="flex-1 min-w-0 bg-transparent text-base outline-none placeholder:text-muted/60"
								/>
								<span className="text-[11px] text-muted ml-2 shrink-0">
									{periodSuffix(budgetPeriod)}
								</span>
							</div>

							<p className="text-[11px] text-muted/80 mt-2 ml-1 leading-relaxed">
								{initialBudget
									? "Svuota il campo per togliere il limite: i periodi passati restano com'erano."
									: "Lascia vuoto per non impostare nessun limite."}
							</p>
						</div>
					)}

					{/* Icona */}
					<div>
						<div className="flex items-center justify-between mb-3">
							<label className="text-xs text-muted tracking-wide">Icona</label>
							<span className="text-[11px] text-muted capitalize">
								set — {type}
							</span>
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
												style={{
													color: selected ? color : "var(--text-muted)",
												}}
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
					<p
						className="mt-5 text-xs text-center"
						style={{ color: "var(--ink-aka)" }}
					>
						{serverError}
					</p>
				)}

				<button
					onClick={handleSubmit}
					disabled={loading}
					className="mt-6 w-full py-4 rounded-2xl text-[14.5px] font-semibold btn-primary disabled:opacity-50"
				>
					{loading
						? "Salvataggio…"
						: category
							? "Salva modifiche"
							: "Crea categoria"}
				</button>
			</div>
		</div>
	);
}
