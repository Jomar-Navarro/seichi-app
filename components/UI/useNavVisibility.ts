"use client";

import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";

/**
 * Le rotte che sono un DOCUMENTO, non una schermata dell'app — vedi
 * `BottomNav.tsx` per il perché (issue #86/Fase 23b): un elemento `fixed`
 * galleggia sopra il contenuto mentre si scorre, e su un'anteprima di stampa
 * coprirebbe proprio le parti che si sta andando a controllare.
 */
const DOCUMENT_ROUTES = ["/analisi/report"];

/**
 * True quando né la pillola né la sidebar (Fase 28) devono comparire.
 * Condiviso apposta: le due barre di navigazione — e il gutter che
 * `MainContentShell` riserva alla sidebar su schermi larghi — devono
 * nascondersi esattamente alle stesse condizioni, o una futura rotta
 * documento o un futuro flusso a schermo intero aggiornerebbe una sola delle
 * tre superfici, lasciando le altre due a mentire su quale nav è attiva.
 */
export function useNavHidden() {
	const fullScreenActive = useUIStore((s) => s.fullScreenActive);
	const pathname = usePathname();
	return DOCUMENT_ROUTES.includes(pathname) || fullScreenActive;
}
