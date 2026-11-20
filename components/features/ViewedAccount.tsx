"use client";
import { useEffect } from "react";
import { useUIStore } from "@/store/useUIStore";

/**
 * Dichiara allo store il conto che questa pagina sta guardando, finché la
 * pagina resta montata (#112). Il form di un movimento NUOVO parte da lì.
 *
 * Con `null` non dichiara niente: "Tutti i conti" non è un conto da proporre,
 * e il form ripiega sul primo attivo come ha sempre fatto.
 */
export function useViewedAccount(id: string | null) {
	const viewAccount = useUIStore((s) => s.viewAccount);

	useEffect(() => {
		if (!id) return;
		return viewAccount(id);
	}, [id, viewAccount]);
}

/**
 * La stessa dichiarazione per i server component (home, `/analisi`,
 * `/investimenti`), che un hook non lo possono chiamare.
 *
 * ⚠️ Va resa FUORI da ogni Suspense che aspetta dati (#217). Dentro, si monta
 * solo quando i dati arrivano: per tutto lo scheletro il + — che sta nel
 * layout ed è già attivo — apre un form che non trova la dichiarazione, e
 * propone il primo conto attivo. In `/analisi` e `/investimenti` non c'è né un
 * Suspense né un `loading.tsx` sopra di lei, la pagina arriva intera, e lì sta
 * dopo il `redirect` che scarta un conto non tuo. La home invece la rende
 * prima, perché il suo controllo arriva dietro lo scheletro.
 *
 * La garanzia vera sta nel form, non qui: propone il conto guardato solo se è
 * fra i conti dell'utente e non è archiviato.
 */
export default function ViewedAccount({ id }: { id: string | null }) {
	useViewedAccount(id);
	return null;
}
