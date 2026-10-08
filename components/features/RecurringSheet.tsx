"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import BottomSheetShell from "@/components/UI/BottomSheetShell";
import { createClient } from "@/lib/supabase/client";
import Select, { type Option } from "@/components/UI/Select";
import FrequencySelector from "@/components/UI/FrequencySelector";
import { buildCategoryOptions } from "@/lib/category-options";
import { ACCOUNT_ICON_FALLBACK, ACCOUNT_TYPE_ICON, accountColor } from "@/lib/accounts";
import { TIPO_COLOR, TIPO_INK } from "@/lib/transaction-utils";
import { updateRecurringRule } from "@/app/(main)/action";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, currencySymbol } from "@/lib/i18n/format";
import DatePicker from "@/components/UI/DatePicker";
import { amountErrorMessage, formatAmountInput, parseAmountInput } from "@/lib/amount";
import type { RecurringRule, Account, Category, Frequency } from "@/types";

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
	const [amount, setAmount] = useState(() => formatAmountInput(rule.amount, locale));
	const [categoryId, setCategoryId] = useState<string | null>(rule.category_id);
	const [notes, setNotes] = useState(rule.notes ?? "");
	const [frequency, setFrequency] = useState<Frequency>(rule.frequency);
	const [nextRun, setNextRun] = useState(rule.next_run);
	const [accountId, setAccountId] = useState(rule.account_id);
	const [categoryList, setCategoryList] = useState<Category[]>([]);
	const [accountList, setAccountList] = useState<Account[]>([]);
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

	useEffect(() => {
		async function loadAccounts() {
			const supabase = createClient();
			const { data } = await supabase
				.from("accounts")
				.select("*")
				.order("created_at", { ascending: true });
			if (data) setAccountList(data);
		}
		loadAccounts();
	}, []);

	const color = TIPO_COLOR[rule.type] ?? "var(--color-kiri)";
	const ink = TIPO_INK[rule.type] ?? "var(--ink-kiri)";
	const todayISO = new Date().toLocaleDateString("sv-SE");
	/*
	 * ⚠️ Il testo si legge com'è scritto, non si ripulisce mentre si scrive.
	 * Prima `onChange` toglieva tutto ciò che non era cifra o virgola: "12.50"
	 * diventava "1250" sotto gli occhi di chi scriveva, e "Salva" registrava una
	 * regola da € 1250 che il cron avrebbe replicato ogni mese (issue #119).
	 */
	const parsedAmount = parseAmountInput(amount, locale);
	const importoValido = parsedAmount.status === "ok" && parsedAmount.value > 0;
	// Un testo illeggibile lo si dice subito: il bottone è spento, e un bottone
	// spento senza una ragione scritta è un gesto che non fa niente e non dice
	// niente.
	const amountError = amountErrorMessage(parsedAmount, t, locale);

	const categoryOptions = buildCategoryOptions(categoryList, t.recurring.noCategory);

	/*
	 * ⚠️ Il conto ARCHIVIATO su cui la regola punta resta fra le opzioni, ed è il
	 * caso per cui questo campo esiste. Filtrandolo via, una regola già puntata su
	 * un conto chiuso mostrerebbe il segnaposto — un record CON un conto sembrerebbe
	 * non averne — e per giunta proprio nella schermata da cui la si deve spostare.
	 * Gli altri archiviati restano fuori: proporli significherebbe suggerire di
	 * spedire denaro dove nessun totale lo somma.
	 */
	const accountOptions: Option[] = accountList
		.filter((a) => !a.archived || a.id === accountId)
		.map((a) => {
			const Icon = (a.type && ACCOUNT_TYPE_ICON[a.type]) || ACCOUNT_ICON_FALLBACK;
			return {
				value: a.id,
				label: a.name,
				icon: <Icon size={14} style={{ color: accountColor(a.type, a.color) }} />,
			};
		});

	async function handleSubmit() {
		// `!rule` non serve più: la prop non è nullable, il montaggio lo garantisce.
		if (parsedAmount.status !== "ok" || !importoValido || loading) return;
		setLoading(true);
		setServerError(null);
		try {
			const result = await updateRecurringRule(
				rule.id,
				parsedAmount.value,
				categoryId,
				notes.trim() || null,
				frequency,
				nextRun,
				accountId,
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
		<BottomSheetShell onClose={onClose}>
				<div className="flex items-center justify-between mt-4 mb-6 shrink-0">
					<h2 className="text-xl font-semibold">{t.recurring.editTitle}</h2>
					<button
						onClick={onClose}
							// issue #69 — w-11 h-11 (44px): area toccabile minima, isolata
						// nell'angolo dell'header, l'icona resta 15px.
						className="w-11 h-11 flex items-center justify-center rounded-xl bg-control ring-border"
					>
						<X size={15} />
					</button>
				</div>

				<div className="flex flex-col gap-4">
					{/* Importo */}
					<div>
						<label className="text-xs text-muted mb-1.5 block">{t.recurring.amount}</label>
						<div
							className={`flex items-center gap-2 rounded-2xl px-4 py-3 bg-card ${amountError ? "" : "ring-border"}`}
							style={amountError ? { boxShadow: "var(--color-aka) 0px 0px 0px 1px inset" } : undefined}
						>
							<span className="text-sm text-muted">{currencySymbol(DISPLAY_CURRENCY, locale)}</span>
							<input
								type="text"
								inputMode="decimal"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								aria-invalid={amountError ? true : undefined}
								className="flex-1 bg-transparent outline-none text-base"
							/>
						</div>
						{amountError && (
							<p className="text-xs mt-1.5 ml-1" style={{ color: "var(--ink-aka)" }}>
								{amountError}
							</p>
						)}
					</div>

					{/* Categoria */}
					<Select
						title={t.recurring.category}
						variant="compact"
						options={categoryOptions}
						selected={categoryId ?? ""}
						onChange={(val) => setCategoryId(val || null)}
					/>

					{/*
						Conto. ⚠️ Non c'era, e la sua assenza faceva più danno di un campo
						mancante: `generate_recurring_transactions()` copia `account_id`
						sulla transazione generata, quindi una regola nata sul conto
						sbagliato ci scriveva sopra ogni mese senza che ci fosse modo di
						correggerla. È anche ciò che rende praticabile il rifiuto di
						archiviare un conto con regole attive.
					*/}
					<Select
						title={t.accounts.fieldLabel}
						variant="compact"
						options={accountOptions}
						selected={accountId}
						onChange={setAccountId}
					/>

					{/* Frequenza */}
					<div>
						<label className="text-xs text-muted mb-1.5 block">{t.recurring.frequency}</label>
						<FrequencySelector value={frequency} onChange={setFrequency} color={color} ink={ink} />
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
							// issue #69 — text-base: sotto i 16px iOS zooma da solo al focus.
							className="w-full rounded-2xl px-4 py-3 text-base bg-card ring-border outline-none placeholder:text-muted/60"
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
		</BottomSheetShell>
	);
}
