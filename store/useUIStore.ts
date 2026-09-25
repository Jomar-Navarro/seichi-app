import { create } from "zustand";
import type { Transaction } from "@/types";

interface UIStore {
	isTransactionModalOpen: boolean;
	selectedTransactionType: string | null;
	editingTransaction: Transaction | null;
	recurringDefault: boolean;
	transactionSavedAt: number;
	/**
	 * Un SOTTO-flusso a schermo intero è attivo dentro una pagina di `(main)`
	 * — oggi solo il wizard PIN (Fase 26a), che il design vuole senza barra
	 * di navigazione, a differenza della pagina impostazioni che lo ospita.
	 * `BottomNav` non può saperlo da sé: sta in un componente FRATELLO della
	 * pagina, non genitore/figlio, quindi serve uno stato condiviso — non
	 * `DOCUMENT_ROUTES` (quello è per l'intera ROTTA, qui la stessa route
	 * ha stati diversi).
	 */
	fullScreenActive: boolean;
	/**
	 * Il conto che la pagina aperta sta guardando, se ne guarda uno (#112).
	 *
	 * Il modale dei movimenti sta nel layout di `(main)` e lo aprono il FAB e la
	 * sidebar, che non sanno quale pagina c'è sotto: per questo il form
	 * proponeva sempre il primo conto attivo, anche con Revolut selezionato.
	 * Stesso problema di `fullScreenActive` — componenti fratelli, non
	 * genitore e figlio — e stessa soluzione.
	 *
	 * ⚠️ Lo scrivono le PAGINE, e non lo ricalcola nessuno nel client: è la
	 * scelta che il server ha già risolto e validato (URL = istruzione, cookie
	 * = memoria, Fase 20b), oppure il filtro o il dettaglio che la pagina sta
	 * mostrando. Si dichiara con `<ViewedAccount>` o `useViewedAccount()`, mai
	 * con un `set` a mano: la dichiarazione va ritirata allo smontaggio, o
	 * sopravvivrebbe alla pagina che l'ha fatta.
	 */
	viewedAccountId: string | null;
	openTransactionModal: (recurring?: boolean) => void;
	closeTransactionModal: () => void;
	setTransactionType: (type: string | null) => void;
	openEditModal: (transaction: Transaction) => void;
	notifyTransactionSaved: () => void;
	setFullScreenActive: (active: boolean) => void;
	/**
	 * Dichiara il conto guardato e restituisce la funzione che ritira la
	 * dichiarazione — pensata per essere il cleanup di un effetto.
	 *
	 * ⚠️ Il ritiro azzera SOLO se nessuno ha dichiarato dopo. Passando da una
	 * pagina all'altra, l'ordine fra lo smontaggio della vecchia e il montaggio
	 * della nuova non è una cosa su cui appoggiarsi; e con lo stesso conto su
	 * entrambe (home → /analisi, Revolut in tutte e due) confrontare l'id non
	 * basterebbe, perché il ritiro della vecchia cancellerebbe la dichiarazione
	 * della nuova. Si confronta il turno, non il valore.
	 */
	viewAccount: (id: string) => () => void;
}

export const useUIStore = create<UIStore>((set) => {
	// Il turno dell'ultima dichiarazione del conto guardato (vedi `viewAccount`).
	let viewTurn = 0;

	return {
		isTransactionModalOpen: false,
		selectedTransactionType: null,
		editingTransaction: null,
		recurringDefault: false,
		transactionSavedAt: 0,
		fullScreenActive: false,
		viewedAccountId: null,
		openTransactionModal: (recurring = false) =>
			set({ isTransactionModalOpen: true, editingTransaction: null, recurringDefault: recurring }),
		closeTransactionModal: () =>
			set({
				isTransactionModalOpen: false,
				selectedTransactionType: null,
				editingTransaction: null,
				recurringDefault: false,
			}),
		setTransactionType: (type) => set({ selectedTransactionType: type }),
		openEditModal: (transaction) =>
			set({ isTransactionModalOpen: true, editingTransaction: transaction, recurringDefault: false }),
		notifyTransactionSaved: () => set({ transactionSavedAt: Date.now() }),
		setFullScreenActive: (active) => set({ fullScreenActive: active }),
		viewAccount: (id) => {
			const turn = ++viewTurn;
			set({ viewedAccountId: id });
			return () => {
				if (viewTurn === turn) set({ viewedAccountId: null });
			};
		},
	};
});
