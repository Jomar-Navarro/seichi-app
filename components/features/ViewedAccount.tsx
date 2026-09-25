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
 * ⚠️ Va resa DOPO il controllo che il conto sia fra quelli dell'utente —
 * quello che fa il `redirect` —, così dichiara solo scelte già validate.
 * Il form ricontrolla comunque che il conto esista e non sia archiviato.
 */
export default function ViewedAccount({ id }: { id: string | null }) {
	useViewedAccount(id);
	return null;
}
