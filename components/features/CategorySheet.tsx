"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import BottomSheetShell from "@/components/UI/BottomSheetShell";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { CATEGORY_LIBRARY } from "@/lib/category-icons";
import { TIPO_COLOR, TIPO_INK } from "@/lib/transaction-utils";
import { TRANSACTION_TYPES } from "@/types";
import {
	createCategory,
	updateCategory,
} from "@/app/(main)/impostazioni/actions";
import { getBudgetForCategory, setBudget } from "@/app/(main)/budget-actions";
import { BUDGET_PERIODS } from "@/lib/budget";
import { clientClock } from "@/lib/dates";
import { amountErrorMessage, formatAmountInput, parseAmountInput } from "@/lib/amount";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, currencySymbol, fill } from "@/lib/i18n/format";
import type { BudgetPeriod, Category } from "@/types";

/** Solo l'ordine: le etichette abbreviate stanno in `t.typesShort`. */
const TYPE_ORDER = [
	"entrata",
	"spesa",
	"investimento",
	"risparmio",
	"abbonamento",
] as const;

function typeIcon(type: string) {
	return TRANSACTION_TYPES.find((t) => t.id === type)?.icon;
}

function resolveIcon(id: string) {
	return ICON_MAP[id] ?? GOAL_ICON_MAP[id] ?? null;
}

/** Set icone per il tipo, includendo l'icona corrente se non è già in libreria (edit legacy) */
function iconListFor(type: string, current: string): string[] {
	const lib = CATEGORY_LIBRARY[type] ?? [];
	if (current && !lib.includes(current)) return [current, ...lib];
	return lib;
}

/**
 * ⚠️ Niente prop `isOpen`: il pannello lo monta e lo smonta il chiamante.
 *
 * Prima restava montato e si nascondeva da sé, quindi lo stato del form
 * sopravviveva alla chiusura e andava riazzerato a mano — nove `setState` dentro
 * un `useLayoutEffect`, cioè un render a cascata a ogni apertura. Montare È
 * l'azzeramento: gli inizializzatori di `useState` girano da capo e leggono
 * `category`/`presetType`, quindi l'effetto non serve più.
 */
interface CategorySheetProps {
	category: Category | null;
	presetType?: string | null;
	onClose: () => void;
}

export default function CategorySheet({
	category,
	presetType,
	onClose,
}: CategorySheetProps) {
	const router = useRouter();
	const { locale, t } = useI18n();

	// Valori di partenza derivati dalle prop. Vengono ricalcolati a ogni render ma
	// consumati solo al montaggio — sono due letture e un accesso a un oggetto.
	// `initialType` e non `t`: quel nome ora è del dizionario.
	const initialType = category?.type ?? presetType ?? "spesa";
	const initialIcon = category?.icon ?? (CATEGORY_LIBRARY[initialType] ?? [])[0] ?? "";

	const [name, setName] = useState(category?.name ?? "");
	const [icon, setIcon] = useState(initialIcon);
	const [type, setType] = useState(initialType);
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

	/*
	 * ⚠️ Lo stato della LETTURA del budget, distinto dal suo valore (#122).
	 *
	 * Prima una lettura fallita lasciava il campo vuoto, cioè "nessun limite":
	 * una lettura fallita travestita da fatto. E costava: cambiando il tipo
	 * della categoria la lapide non veniva scritta, perché il budget sembrava
	 * non esserci, e la card restava a "€0 / €X" per sempre. In più una risposta
	 * tardiva sovrascriveva ciò che si stava già digitando.
	 *
	 * Ora i campi del budget restano spenti finché la lettura non è finita, e se
	 * fallisce lo dicono; il salvataggio aspetta, e rifiuta solo ciò che senza
	 * il budget non saprebbe fare (vedi `handleSubmit`).
	 */
	const [budgetLoad, setBudgetLoad] = useState<"loading" | "ready" | "failed">(
		category ? "loading" : "ready",
	);

	// Il budget vive in una tabella a parte (storico versionato), non è una
	// colonna di `categories`: va caricato separatamente quando si apre il form
	// su una categoria esistente.
	useEffect(() => {
		if (!category) return;
		let cancelled = false;
		getBudgetForCategory(category.id, clientClock())
			.then((res) => {
				if (cancelled) return;
				if (!("data" in res)) {
					console.error("[categorie] lettura budget:", res.error);
					setBudgetLoad("failed");
					return;
				}
				if (res.data) {
					setInitialBudget(res.data);
					setBudgetPeriod(res.data.period);
					setBudgetAmount(formatAmountInput(res.data.amount, locale));
				}
				setBudgetLoad("ready");
			})
			// Anche quando l'azione RIFIUTA: senza, i campi resterebbero spenti
			// per sempre, senza un messaggio.
			.catch((e) => {
				if (cancelled) return;
				console.error("[categorie] lettura budget:", e);
				setBudgetLoad("failed");
			});
		return () => {
			cancelled = true;
		};
	}, [category, locale]);
	const budgetReady = budgetLoad === "ready";

	const nameError = submitted && !name.trim();
	const color = TIPO_COLOR[type] ?? "var(--color-kiri)";
	// issue #126 — stesso ruolo di `color`, ma per il TESTO: `color` resta per
	// riempimenti e bordi (dove l'accento pieno serve a risaltare), questo per
	// le etichette, dove sotto soglia WCAG AA in tema chiaro.
	const ink = TIPO_INK[type] ?? "var(--ink-kiri)";
	const iconList = iconListFor(type, icon);
	/**
	 * Solo le categorie di spesa hanno un budget. Gli abbonamenti no: sono
	 * transazioni ricorrenti di cui l'importo è già noto in anticipo da
	 * `recurring_rules`, e un limite su una cifra che conosci non aggiunge nulla.
	 */
	const showBudget = type === "spesa";

	/*
	 * ⚠️ Il budget si legge PRIMA di salvare la categoria, non dopo.
	 *
	 * Il parser di prima leggeva il punto come decimale — "1.200" diventava un
	 * limite di 1,2 € — e il controllo stava dentro `saveBudget`, cioè dopo che
	 * la categoria era già stata scritta: un importo sbagliato salvava comunque
	 * metà del form (issue #119). Ora un testo illeggibile ferma tutto, e il
	 * messaggio sta sotto il campo invece che in fondo al foglio.
	 */
	const parsedBudget = parseAmountInput(budgetAmount, locale);
	const budgetInvalid =
		showBudget &&
		parsedBudget.status !== "empty" &&
		(parsedBudget.status !== "ok" || parsedBudget.value <= 0);
	const budgetError = submitted && budgetInvalid;
	const budgetErrorText =
		amountErrorMessage(parsedBudget, t, locale) ?? t.categories.budgetMustBePositive;

	function selectType(nextType: string) {
		setType(nextType);
		const lib = CATEGORY_LIBRARY[nextType] ?? [];
		if (!lib.includes(icon)) setIcon(lib[0] ?? "");
	}

	async function handleSubmit() {
		setSubmitted(true);
		if (!name.trim() || budgetInvalid) return;
		/*
		 * Uscendo dalle spese, un budget esistente va chiuso con la lapide — e se
		 * la lettura è fallita non si sa se c'è. Si rifiuta PRIMA di scrivere la
		 * categoria, o il tipo cambierebbe e il budget resterebbe orfano. Gli
		 * altri salvataggi passano: con i campi spenti il budget non è stato
		 * toccato, e `saveBudget` non lo riscrive.
		 */
		if (budgetLoad === "failed" && category?.type === "spesa" && type !== "spesa") {
			setServerError(t.categories.budgetReadFailed);
			return;
		}

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

		// `handleSubmit` ha già fermato un testo illeggibile: qui resta solo
		// "un importo" o "nessun budget".
		const parsed = parsedBudget.status === "ok" ? parsedBudget.value : null;

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

	return (
		<BottomSheetShell onClose={onClose}>
				<div className="flex items-center justify-between mt-4 mb-6 shrink-0">
					<h2 className="text-xl font-semibold">
						{category ? t.categories.editTitle : t.categories.newTitle}
					</h2>
					<button
						onClick={onClose}
							// issue #69 — w-11 h-11 (44px): area toccabile minima, isolata
						// nell'angolo dell'header, l'icona resta 15px.
						className="w-11 h-11 flex items-center justify-center rounded-xl bg-control ring-border"
					>
						<X size={15} />
					</button>
				</div>

				<div className="flex flex-col gap-5">
					{/* Nome */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">
							{t.categories.nameLabel}
						</label>
						<input
							type="text"
							placeholder={t.categories.namePlaceholder}
							value={name}
							onChange={(e) => setName(e.target.value)}
							className={`w-full rounded-[18px] px-4 py-3.5 text-base bg-input outline-none placeholder:text-muted/60 ${nameError ? "" : "ring-border"}`}
							style={{
								boxShadow: nameError ? "var(--color-aka) 0px 0px 0px 1px inset" : undefined,
							}}
						/>
						{nameError && (
							<p
								className="text-xs mt-1.5 ml-1"
								style={{ color: "var(--ink-aka)" }}
							>
								{t.categories.nameRequired}
							</p>
						)}
					</div>

					{/* Tipo */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">
							{t.categories.typeLabel}
						</label>
						<div className="grid grid-cols-5 gap-2">
							{TYPE_ORDER.map((typeId) => {
								const selected = type === typeId;
								const tColor = TIPO_COLOR[typeId];
								// issue #126 — l'accento pieno resta su riempimento/icona
								// (3:1 basta), l'etichetta vuole l'inchiostro.
								const tInk = TIPO_INK[typeId] ?? "var(--ink-kiri)";
								const TIcon = typeIcon(typeId);
								return (
									<button
										key={typeId}
										type="button"
										onClick={() => selectType(typeId)}
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
											style={{ color: selected ? tInk : "var(--text-muted)" }}
										>
											{t.typesShort[typeId]}
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
								{t.categories.budgetLabel}{" "}
								<span className="text-muted/70 font-normal">{t.categories.optional}</span>
							</label>

							<div className="grid grid-cols-3 gap-2 mb-2.5">
								{BUDGET_PERIODS.map((period) => {
									const selected = budgetPeriod === period;
									return (
										<button
											key={period}
											type="button"
											disabled={!budgetReady}
											onClick={() => setBudgetPeriod(period)}
											// issue #69 — py-3.5 invece di py-2: griglia 3 colonne
											// fisse, sempre 3 voci, una riga sola.
											className="text-center py-3.5 rounded-xl text-xs font-medium transition-all border disabled:opacity-50"
											style={{
												background: selected
													? `color-mix(in srgb, ${color} 14%, transparent)`
													: "var(--color-input)",
												borderColor: selected ? color : "transparent",
												// issue #126 — `color` resta sul riempimento/bordo, il
												// testo vuole l'inchiostro.
												color: selected ? ink : "var(--text-muted)",
												fontWeight: selected ? 600 : 500,
											}}
										>
											{t.budgetPeriods[period].label}
										</button>
									);
								})}
							</div>

							<div
								className={`flex items-center rounded-2xl px-4 py-3.5 bg-input ${budgetError ? "" : "ring-border"}`}
								style={budgetError ? { boxShadow: "var(--color-aka) 0px 0px 0px 1px inset" } : undefined}
							>
								<span className="text-[14.5px] text-muted mr-1.5">{currencySymbol(DISPLAY_CURRENCY, locale)}</span>
								<input
									type="text"
									inputMode="decimal"
									placeholder={
										budgetLoad === "loading" ? t.common.loading : t.categories.budgetPlaceholder
									}
									value={budgetAmount}
									disabled={!budgetReady}
									onChange={(e) => setBudgetAmount(e.target.value)}
									aria-invalid={budgetError || undefined}
									className="flex-1 min-w-0 bg-transparent text-base outline-none placeholder:text-muted/60 disabled:opacity-50"
								/>
								<span className="text-[11px] text-muted ml-2 shrink-0">
									{t.budgetPeriods[budgetPeriod].suffix}
								</span>
							</div>
							{budgetError && (
								<p className="text-xs mt-1.5 ml-1" style={{ color: "var(--ink-aka)" }}>
									{budgetErrorText}
								</p>
							)}
							{budgetLoad === "failed" && (
								<p className="text-xs mt-1.5 ml-1" style={{ color: "var(--ink-aka)" }}>
									{t.categories.budgetReadFailed}
								</p>
							)}

							{/* Con la lettura fallita il suggerimento mentirebbe: "lascia vuoto
							    per non impostare nessun limite" sopra un limite che forse c'è. */}
							{budgetLoad !== "failed" && (
								<p className="text-[11px] text-muted/80 mt-2 ml-1 leading-relaxed">
									{initialBudget
										? t.categories.budgetHintExisting
										: t.categories.budgetHintNew}
								</p>
							)}
						</div>
					)}

					{/* Icona */}
					<div>
						<div className="flex items-center justify-between mb-3">
							<label className="text-xs text-muted tracking-wide">{t.categories.iconLabel}</label>
							<span className="text-[11px] text-muted">
								{fill(t.categories.iconSet, {
									type: t.typesSingular[type as keyof typeof t.typesSingular] ?? type,
								})}
							</span>
						</div>
						<div className="grid grid-cols-5 gap-x-2 gap-y-3.5">
							{iconList.map((iconId) => {
								const Icon = resolveIcon(iconId);
								if (!Icon) return null;
								const selected = icon === iconId;
								// L'etichetta dipende dal TIPO oltre che dall'icona: la stessa
								// `Landmark` è "Bonifico" fra le entrate e "Azioni" fra gli
								// investimenti. Il ripiego copre l'icona di una categoria
								// vecchia, non più nella libreria del suo tipo.
								const labels = t.iconLabels[type as keyof typeof t.iconLabels];
								const label =
									(labels as Record<string, string> | undefined)?.[iconId] ??
									t.categories.currentIcon;
								return (
									<button
										key={iconId}
										type="button"
										onClick={() => setIcon(iconId)}
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
											// issue #126 — era `color` (l'accento pieno): sotto
											// soglia come testo in tema chiaro.
											style={{ color: selected ? ink : "var(--text-muted)" }}
										>
											{label}
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
					// Finché il budget non è letto non si sa cosa riscrivere: un
					// istante, di norma, e meglio di una scelta fatta alla cieca.
					disabled={loading || budgetLoad === "loading"}
					className="mt-6 w-full py-4 rounded-2xl text-[14.5px] font-semibold btn-primary disabled:opacity-50"
				>
					{loading
						? t.common.saving
						: category
							? t.categories.saveChanges
							: t.categories.create}
				</button>
		</BottomSheetShell>
	);
}
