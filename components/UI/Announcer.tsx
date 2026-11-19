"use client";

import { useUIStore } from "@/store/useUIStore";
import { KEEP_ALIVE_ATTR } from "./useDialog";

/**
 * Annuncia un esito agli screen reader (#165): «Categoria salvata.», «Conto
 * eliminato.». Si chiama dal gestore, subito prima di chiudere il pannello.
 *
 * Serve dove il pannello si chiude da solo dopo il salvataggio: il suo testo
 * sparisce con lui, e chi vede capisce dalla riga nuova nella lista, chi non
 * vede non sente niente. Un errore invece resta nel pannello aperto, e lì basta
 * `role="alert"` sul suo paragrafo.
 *
 * ⚠️ La frase è sempre intera, dal dizionario (`t.announce`): niente
 * «{nome} salvato», perché in italiano il participio si accorda col nome.
 */
export function announce(text: string) {
	useUIStore.getState().announce(text);
}

/**
 * L'unica regione degli annunci, montata dal layout di `(main)` e sempre
 * presente: una regione live che nasce insieme al testo non viene letta da
 * tutti i lettori di schermo.
 *
 * `polite`: aspetta che il lettore finisca ciò che sta dicendo (di solito il
 * nome del comando che riprende il fuoco alla chiusura del pannello).
 *
 * La `key` rifà il nodo a ogni annuncio, così la stessa frase due volte di fila
 * viene letta due volte.
 *
 * ⚠️ `KEEP_ALIVE_ATTR`: senza, `useDialog` la renderebbe inerte insieme al
 * resto della pagina, e un elemento inerte è muto anche per lo screen reader —
 * proprio nell'istante in cui l'annuncio parte, col pannello ancora aperto.
 */
export default function Announcer() {
	const announcement = useUIStore((s) => s.announcement);

	return (
		<div role="status" aria-live="polite" aria-atomic="true" className="sr-only" {...{ [KEEP_ALIVE_ATTR]: "" }}>
			{announcement && <span key={announcement.id}>{announcement.text}</span>}
		</div>
	);
}
