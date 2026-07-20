import { create } from "zustand";
import type { Transaction } from "@/types";

interface UIStore {
	isTransactionModalOpen: boolean;
	selectedTransactionType: string | null;
	editingTransaction: Transaction | null;
	transactionSavedAt: number;
	openTransactionModal: () => void;
	closeTransactionModal: () => void;
	setTransactionType: (type: string | null) => void;
	openEditModal: (transaction: Transaction) => void;
	notifyTransactionSaved: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
	isTransactionModalOpen: false,
	selectedTransactionType: null,
	editingTransaction: null,
	transactionSavedAt: 0,
	openTransactionModal: () => set({ isTransactionModalOpen: true, editingTransaction: null }),
	closeTransactionModal: () =>
		set({ isTransactionModalOpen: false, selectedTransactionType: null, editingTransaction: null }),
	setTransactionType: (type) => set({ selectedTransactionType: type }),
	openEditModal: (transaction) =>
		set({ isTransactionModalOpen: true, editingTransaction: transaction }),
	notifyTransactionSaved: () => set({ transactionSavedAt: Date.now() }),
}));
