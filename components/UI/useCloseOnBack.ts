"use client";

import { useEffect, useRef } from "react";

/**
 * issue #86 — la seconda difesa contro lo swipe orizzontale che naviga la
 * cronologia invece di restare dentro il modale.
 *
 * `overscroll-behavior-x: none` (globals.css) è la prima, a costo zero, ma è
 * un gesto NATIVO di WKWebView (edge-swipe-to-go-back): il web non ha una
 * leva certa per impedirlo. Questo hook non prova a impedire il gesto — ne
 * NEUTRALIZZA l'effetto: al montaggio spinge una voce di cronologia SINTETICA
 * (stessa URL), e "andare indietro" — dal gesto o dal pulsante — consuma
 * quella voce invece di lasciare la pagina, e il `popstate` chiude il pannello.
 *
 * ⚠️ UNA VOCE PER PANNELLO, ANCHE ANNIDATO (#214). Prima la voce era un
 * booleano (`seichiModal`), e un pannello aperto dentro un altro — il visore
 * di una ricevuta dentro il wizard — non ne spingeva una seconda: i due
 * condividevano una voce, il `popstate` arrivava a entrambi, e Indietro col
 * visore aperto chiudeva l'intero wizard, form compreso. Ora ogni voce porta
 * la sua PROFONDITÀ (`seichiDepth`), e c'è un solo ascoltatore: al `popstate`
 * legge la profondità della voce su cui si è arrivati e chiude, dall'alto,
 * solo i pannelli che stavano più in su. Un Indietro, un pannello.
 *
 * È lo stesso schema della pila di Esc in `useDialog` (#165), e per lo stesso
 * motivo: due ascoltatori indipendenti chiuderebbero il pannello in cima e
 * quello sotto. Lo chiama `useDialog`, così ogni pannello modale ha la sua
 * voce — anche le conferme e il visore, che prima non ne avevano.
 *
 * ⚠️ Due strade di chiusura:
 * - DAL GESTO (popstate) → la voce è già stata consumata dal browser: lo
 *   smontaggio non deve toglierne un'altra (`popped`).
 * - DAL CODICE (X, sfondo, Esc, salvataggio) → il pannello si smonta e la sua
 *   voce resta appesa in cima: va tolta, o il prossimo Indietro la
 *   consumerebbe senza effetto visibile. Le voci si tolgono in UN colpo solo
 *   (`history.go(-n)`) in un microtask: chiudendo il wizard col visore aperto
 *   si smontano due pannelli, e due `back()` di fila non sono affidabili.
 *
 * ⚠️⚠️ Il doppio montaggio di React in sviluppo (mount → cleanup → mount,
 * sulla STESSA istanza). Il secondo giro trova la voce del primo già in
 * cronologia alla sua profondità e non ne spinge un'altra; la sincronizzazione
 * del cleanup gira in un microtask, DOPO il secondo giro, e trova cronologia e
 * pila d'accordo: non toglie niente. Senza, il modale si chiudeva da solo un
 * istante dopo l'apertura, in sviluppo soltanto.
 *
 * ⚠️ Memoria di modulo (react.md, «La memoria di modulo»): la pila esiste solo
 * nel browser — la toccano solo gli effetti — e rispecchia i pannelli aperti
 * adesso, non dati dell'utente.
 */

type Entry = { depth: number; close: () => void; popped: boolean };

/** I pannelli aperti con la loro voce, dal più basso al più alto. */
const open: Entry[] = [];
let syncQueued = false;

/** La profondità della voce in cima alla cronologia: 0 se non è nostra. */
function historyDepth(): number {
	const state = window.history.state;
	if (typeof state?.seichiDepth === "number") return state.seichiDepth;
	// Una voce scritta prima della #214 (una scheda rimasta aperta durante il
	// deploy): un pannello solo, come allora.
	return state?.seichiModal ? 1 : 0;
}

/** La profondità che la cronologia DEVE avere: quella del pannello più in alto. */
function wantedDepth(): number {
	return open.length ? open[open.length - 1].depth : 0;
}

function onPopState() {
	const now = historyDepth();
	// Dall'alto: un Indietro chiude il pannello in cima, e solo lui. Un salto
	// di più voci (il menu lungo del pulsante Indietro) li chiude tutti.
	for (let i = open.length - 1; i >= 0 && open[i].depth > now; i--) {
		open[i].popped = true;
		open[i].close();
	}
}

/** Toglie, in un colpo solo, le voci dei pannelli chiusi dal codice. */
function scheduleSync() {
	if (syncQueued) return;
	syncQueued = true;
	queueMicrotask(() => {
		syncQueued = false;
		const extra = historyDepth() - wantedDepth();
		if (extra > 0) window.history.go(-extra);
	});
}

export function useCloseOnBack(onClose: () => void) {
	const onCloseRef = useRef(onClose);

	// Tiene `onCloseRef` allineata senza scrivere un ref durante il render
	// (vietato da `react-hooks/refs`): l'effetto sotto invece gira una volta.
	useEffect(() => {
		onCloseRef.current = onClose;
	});

	useEffect(() => {
		const entry: Entry = {
			depth: wantedDepth() + 1,
			close: () => onCloseRef.current(),
			popped: false,
		};
		open.push(entry);
		if (open.length === 1) window.addEventListener("popstate", onPopState);

		// La voce c'è già quando è il secondo giro del doppio montaggio: non
		// se ne spinge un'altra, o la cronologia andrebbe un passo più in là.
		if (historyDepth() < entry.depth) {
			window.history.pushState({ seichiModal: true, seichiDepth: entry.depth }, "");
		}

		return () => {
			const i = open.lastIndexOf(entry);
			if (i !== -1) open.splice(i, 1);
			if (open.length === 0) window.removeEventListener("popstate", onPopState);
			// Chiuso dal gesto: la voce l'ha già consumata il browser.
			if (!entry.popped) scheduleSync();
		};
		// Montaggio == apertura, smontaggio == chiusura (CLAUDE.md, «I pannelli
		// si montano e si smontano»): una volta sola per pannello.
	}, []);
}

/**
 * Si risolve quando le voci dei pannelli appena chiusi sono state TOLTE dalla
 * cronologia (#122). Va chiamata DOPO `onClose()` e prima di navigare.
 *
 * ⚠️ Esiste perché chiudere e poi navigare non funziona, e non lo dice. Il
 * pannello smontato toglie la propria voce con `history.go()` (vedi
 * `scheduleSync`), e il `popstate` che ne nasce arriva al router di Next come
 * un "indietro" vero: un `ACTION_RESTORE` della pagina sotto, che scarta la
 * navigazione ancora in volo. Eliminando un conto da `/conti/[id]` il
 * `router.push("/conti")` veniva così annullato.
 *
 * Il nostro ascoltatore è registrato DOPO quello di Next (che lo aggancia al
 * montaggio dell'app), quindi quando questa promessa si risolve il ritorno
 * alla pagina sotto è già stato messo in coda: una navigazione chiesta adesso
 * viene dopo, e vince.
 *
 * Se in cima non c'è una voce nostra — già consumata, o mai spinta — si
 * risolve subito. Il tetto di tempo è solo una rete: senza, un `popstate` che
 * non arriva mai terrebbe ferma la navigazione.
 *
 * ⚠️ Guarda la CRONOLOGIA, non la pila dei pannelli: la si chiama subito dopo
 * `onClose()`, quando React non ha ancora smontato il pannello, che quindi è
 * ancora nella pila. Confrontare la cronologia con la pila direbbe «niente da
 * togliere» e lascerebbe partire la navigazione che il ritorno scarterà.
 * Serve ai pannelli di primo livello che chiudono e navigano: nessuno chiude
 * un pannello annidato per navigare.
 */
export function whenModalEntryGone(timeoutMs = 1000): Promise<void> {
	return new Promise((resolve) => {
		if (historyDepth() === 0) {
			resolve();
			return;
		}
		const done = () => {
			window.removeEventListener("popstate", done);
			clearTimeout(timer);
			resolve();
		};
		const timer = setTimeout(done, timeoutMs);
		window.addEventListener("popstate", done);
	});
}
