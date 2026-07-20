import { create } from "zustand";

interface UIStore {
	isTransactionModalOpen: boolean;
	selectedTransactionType: string | null;
	openTransactionModal: () => void;
	closeTransactionModal: () => void;
	setTransactionType: (type: string | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
	isTransactionModalOpen: false,
	selectedTransactionType: null,
	openTransactionModal: () => set({ isTransactionModalOpen: true }),
	closeTransactionModal: () =>
		set({ isTransactionModalOpen: false, selectedTransactionType: null }),
	setTransactionType: (type) => set({ selectedTransactionType: type }),
}));
