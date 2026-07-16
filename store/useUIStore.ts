import { create } from "zustand";

interface UIStore {
	isTransactionModalOpen: boolean;
	openTransactionModal: () => void;
	closeTransactionModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
	isTransactionModalOpen: false,
	openTransactionModal: () => set({ isTransactionModalOpen: true }),
	closeTransactionModal: () => set({ isTransactionModalOpen: false }),
}));
