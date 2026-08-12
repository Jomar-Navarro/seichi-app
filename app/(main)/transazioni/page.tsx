"use client";
import { useState, useEffect, useCallback } from "react";
import { getTransactions } from "@/app/(main)/action";
import { getAccountOptions } from "@/app/(main)/conti/actions";
import { getBudgetOverview } from "@/app/(main)/budget-actions";
import FilterBar from "@/components/features/Filterbar";
import TransactionList from "@/components/features/TransactionList";
import BudgetCards from "@/components/features/BudgetCards";
import { useUIStore } from "@/store/useUIStore";
import { clientClock } from "@/lib/dates";
import { useI18n } from "@/components/features/I18nProvider";
import type { Account, BudgetOverview, Transaction } from "@/types";

/** Quel poco che serve al filtro: vedi `getAccountOptions`. */
type AccountOption = Pick<Account, "id" | "name" | "archived">;

export default function MovimentiPage() {
	const { t } = useI18n();
	const [search, setSearch] = useState("");
	const [tipo, setTipo] = useState("");
	const [periodo, setPeriodo] = useState("30d");
	const [conto, setConto] = useState("");
	const [accounts, setAccounts] = useState<AccountOption[]>([]);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [budgets, setBudgets] = useState<BudgetOverview | null>(null);
	const [loading, setLoading] = useState(true);
	const transactionSavedAt = useUIStore((s) => s.transactionSavedAt);

	const loadTransactions = useCallback(async () => {
		setLoading(true);
		try {
			const result = await getTransactions(tipo || undefined, periodo, undefined, conto || undefined);
			setTransactions("data" in result ? ((result.data as Transaction[]) ?? []) : []);
		} finally {
			setLoading(false);
		}
	}, [tipo, periodo, conto]);

	/*
	 * I conti servono solo a popolare il filtro, quindi si caricano una volta e
	 * non dipendono da nulla. Gli ARCHIVIATI restano fuori dal selettore, ma i
	 * loro movimenti continuano a comparire in "tutti i conti": archiviare un
	 * conto non nasconde la sua storia, la toglie dai comandi.
	 */
	useEffect(() => {
		let cancelled = false;
		getAccountOptions().then((res) => {
			if (cancelled || !("data" in res)) return;
			// ⚠️ Si tengono TUTTI, archiviati compresi: il filtro deve poter
			// nominare il conto su cui è puntato anche se nel frattempo è stato
			// archiviato. La selezione dei *proponibili* avviene in FilterBar.
			setAccounts(res.data);
		});
		return () => { cancelled = true; };
		// ⚠️ Dipende da `transactionSavedAt`: senza, un conto creato altrove non
		// compariva nel filtro fino a un ricaricamento completo della pagina.
	}, [transactionSavedAt]);

	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => { loadTransactions(); }, [loadTransactions, transactionSavedAt]);

	// I budget guardano sempre il periodo corrente e NON dipendono dai filtri:
	// tenerli nello stesso effetto li faceva rileggere — con le transazioni del
	// periodo, per giunta — a ogni tocco su "30 giorni" o "Tutte". Si aggiornano
	// solo all'ingresso e dopo il salvataggio di un movimento, che è ciò che fa
	// diventare rossa la barra subito.
	useEffect(() => {
		let cancelled = false;
		getBudgetOverview(clientClock()).then((res) => {
			if (cancelled) return;
			setBudgets("data" in res ? res.data : null);
		});
		return () => { cancelled = true; };
	}, [transactionSavedAt]);

	const filtered = search.trim()
		? transactions.filter((t) =>
			t.categories?.name.toLowerCase().includes(search.toLowerCase()) ||
			t.notes?.toLowerCase().includes(search.toLowerCase())
		)
		: transactions;

	return (
		<div className="flex flex-col flex-1 px-5 pt-8 pb-34 overflow-y-auto">
			<h1 className="text-2xl font-semibold mb-5">{t.transactions.title}</h1>
			<FilterBar
				search={search}
				tipo={tipo}
				periodo={periodo}
				conto={conto}
				accounts={accounts}
				onSearchChange={setSearch}
				onTipoChange={setTipo}
				onPeriodoChange={setPeriodo}
				onContoChange={setConto}
			/>
			<div className="mt-5">
				{budgets && <BudgetCards overview={budgets} />}
				{/*
					⚠️ I budget NON si filtrano per conto, e con un filtro attivo lo
					dicono. Sono limiti su una CATEGORIA: "€ 400 per la spesa" non si
					divide fra contanti e carta, quindi filtrarli inventerebbe budget
					per-conto che nessuno ha impostato. Nasconderli toglierebbe di
					vista i budget proprio a chi sta guardando le sue uscite. Resta la
					terza via, già usata due volte in questa fase: quando due numeri
					hanno ambiti diversi, si DICE.
				*/}
				{budgets && conto && (
					<p className="-mt-1 mb-4 ml-1 text-[11px] text-disabled leading-relaxed">
						{t.budget.acrossAllAccounts}
					</p>
				)}
				{/*
					`periodo` di default è "30d", quindi NON conta come filtro: se
					contasse, la lista vuota di un utente nuovo direbbe "nessun
					movimento con questi filtri" invece di invitarlo ad aggiungerne
					il primo — cioè il difetto opposto.
				*/}
				<TransactionList
					transactions={filtered}
					loading={loading}
					filtered={Boolean(tipo || conto || search.trim() || periodo !== "30d")}
				/>
			</div>
		</div>
	);
}
