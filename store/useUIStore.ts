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
	openTransactionModal: (recurring?: boolean) => void;
	closeTransactionModal: () => void;
	setTransactionType: (type: string | null) => void;
	openEditModal: (transaction: Transaction) => void;
	notifyTransactionSaved: () => void;
	setFullScreenActive: (active: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
	isTransactionModalOpen: false,
	selectedTransactionType: null,
	editingTransaction: null,
	recurringDefault: false,
	transactionSavedAt: 0,
	fullScreenActive: false,
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
}));
