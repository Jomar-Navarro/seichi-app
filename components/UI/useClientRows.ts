"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category } from "@/types";

/**
 * Le letture di conti e categorie che fanno i moduli (#150): il form del
 * movimento e quello della regola ricorrente.
 *
 * ⚠️ **Tre stati, non due.** Prima ogni modulo partiva da `[]` e scriveva le
 * righe quando arrivavano: «sto caricando», «non ce ne sono» e «la lettura è
 * fallita» erano lo STESSO valore. Il form scriveva «Serve un conto per
 * registrare un movimento» a chi i conti li aveva, ogni volta che arrivavano
 * dopo il primo disegno — su un telefono con la rete lenta, e tre volte nei
 * collaudi (20b, #117, #148), dove è stato preso per un difetto della prova. E
 * `if (!data) return` lasciava una lettura fallita senza traccia: la classe
 * della #124, una lettura fallita travestita da fatto.
 *
 * ⚠️ Restano letture del BROWSER, non server action: Next spedisce le server
 * action una alla volta, e queste finirebbero in coda dietro a quelle della
 * pagina sotto (#122, #148). La RLS limita le righe all'utente.
 */
export type RowsLoad<T> =
	| { status: "loading" }
	| { status: "failed" }
	| { status: "ready"; rows: T[] };

/*
 * Funzioni di modulo, non create nel componente: stanno fra le dipendenze
 * dell'effetto, e una funzione nuova a ogni render lo rifarebbe partire.
 */
async function fetchAccounts(): Promise<Account[]> {
	const { data, error } = await createClient()
		.from("accounts")
		.select("*")
		.order("created_at", { ascending: true });
	if (error) throw error;
	return data ?? [];
}

async function fetchCategories(type: string): Promise<Category[]> {
	const { data, error } = await createClient().from("categories").select("*").eq("type", type);
	if (error) throw error;
	return data ?? [];
}

/** La chiave dei conti, che non dipendono da niente. */
const ALL = "all";

function useRows<T>(
	key: string | null,
	fetchRows: (key: string) => Promise<T[]>,
	scope: string,
	onArrive?: (rows: T[]) => void,
): { load: RowsLoad<T>; retry: () => void } {
	const [attempt, setAttempt] = useState(0);
	/*
	 * Il risultato porta con sé la chiave e il tentativo per cui è stato
	 * chiesto. Così «sto caricando» si DERIVA — chiave cambiata, o «Riprova»
	 * appena toccato — invece di essere scritto con un `setState` dentro
	 * l'effetto, che il lint di React vieta (render a cascata). E dopo un cambio
	 * di tipo le categorie dell'altro tipo non restano a schermo nemmeno per un
	 * istante, la stessa garanzia che il form aveva già con l'etichetta di tipo.
	 */
	const [stored, setStored] = useState<{ key: string; attempt: number; load: RowsLoad<T> } | null>(
		null,
	);

	/*
	 * L'ultima `onArrive` del chiamante, letta quando le righe arrivano. In un
	 * ref, aggiornato in un effetto, perché è una funzione nuova a ogni render:
	 * fra le dipendenze rifarebbe partire la lettura a ogni tasto premuto.
	 */
	const onArriveRef = useRef(onArrive);
	useEffect(() => {
		onArriveRef.current = onArrive;
	});

	useEffect(() => {
		if (key === null) return;
		let cancelled = false;
		fetchRows(key).then(
			(rows) => {
				if (cancelled) return;
				setStored({ key, attempt, load: { status: "ready", rows } });
				onArriveRef.current?.(rows);
			},
			(error: { code?: string; message?: string } | null) => {
				if (cancelled) return;
				// Il motivo vero resta nella console, come `genericError()` (#124):
				// a schermo va solo la frase del dizionario.
				console.error(`[${scope}]`, [error?.code, error?.message].filter(Boolean).join(" ") || error);
				setStored({ key, attempt, load: { status: "failed" } });
			},
		);
		return () => {
			cancelled = true;
		};
	}, [key, attempt, fetchRows, scope]);

	const load: RowsLoad<T> =
		stored !== null && stored.key === key && stored.attempt === attempt
			? stored.load
			: { status: "loading" };
	const retry = useCallback(() => setAttempt((n) => n + 1), []);
	return { load, retry };
}

/**
 * Tutti i conti dell'utente, archiviati compresi: cosa proporre lo decide il
 * modulo (un movimento su un conto poi archiviato deve ritrovare il suo).
 *
 * `onArrive` gira quando le righe arrivano, anche dopo un «Riprova»: è lì che
 * il form sceglie il conto da proporre.
 */
export function useAccountRows(onArrive?: (rows: Account[]) => void) {
	return useRows<Account>(ALL, fetchAccounts, "conti", onArrive);
}

/** Le categorie di un tipo. `null` = nessuna lettura (un trasferimento non ha categoria). */
export function useCategoryRows(type: string | null) {
	return useRows<Category>(type, fetchCategories, "categorie");
}

/** Le righe se sono arrivate, altrimenti nessuna. */
export function rowsOf<T>(load: RowsLoad<T>): T[] {
	return load.status === "ready" ? load.rows : [];
}
