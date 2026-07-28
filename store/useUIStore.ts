import { create } from "zustand";
import type { Transaction } from "@/types";

interface UIStore {
	isTransactionModalOpen: boolean;
	selectedTransactionType: string | null;
	editingTransaction: Transaction | null;
	recurringDefault: boolean;
	transactionSavedAt: number;
	openTransactionModal: (recurring?: boolean) => void;
	closeTransactionModal: () => void;
	setTransactionType: (type: string | null) => void;
	openEditModal: (transaction: Transaction) => void;
	notifyTransactionSaved: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
	isTransactionModalOpen: false,
	selectedTransactionType: null,
	editingTransaction: null,
	recurringDefault: false,
	transactionSavedAt: 0,
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
}));
