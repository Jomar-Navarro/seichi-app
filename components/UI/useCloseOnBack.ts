"use client";

import { useEffect, useRef } from "react";

/**
 * issue #86 — la seconda difesa contro lo swipe orizzontale che naviga la
 * cronologia invece di restare dentro il modale.
 *
 * `overscroll-behavior-x: none` (globals.css) è la prima, a costo zero, ma è
 * un gesto NATIVO di WKWebView (edge-swipe-to-go-back): il web non ha una
 * leva certa per impedirlo, e infatti l'issue lo segnalava scattare anche
 * con un modale sopra. Questo hook non prova a impedire il gesto — ne
 * NEUTRALIZZA l'effetto, garantendo l'esito a prescindere da cosa decida il
 * WebView.
 *
 * Al montaggio spinge una voce di history SINTETICA (stessa URL — il router
 * di Next non ha nulla da navigare). Finché quella voce resta in cima allo
 * stack, "andare indietro" — dal gesto o dal pulsante — la consuma PRIMA di
 * poter lasciare la pagina: il popstate risultante chiude il modale invece
 * di navigare via.
 *
 * ⚠️ Il montaggio DEVE coincidere con l'apertura, come ogni pannello di
 * questo progetto (vedi CLAUDE.md — "i pannelli si montano, non si
 * nascondono"): un `onClose` letto da un ref evita che l'effetto rigiri a
 * ogni render solo perché il chiamante passa una funzione inline nuova, che
 * spingerebbe una voce di history a ogni render invece che una sola volta.
 *
 * ⚠️ Due strade di chiusura, due comportamenti diversi allo smontaggio:
 * - CHIUSURA PROGRAMMATICA (bottone, backdrop, salvataggio riuscito) →
 *   `onClose()` smonta il componente PRIMA che la history si muova: la
 *   nostra voce sintetica resta appesa in cima allo stack, e va tolta a
 *   mano (`history.back()`) nel cleanup, o un tocco indietro successivo la
 *   consumerebbe senza alcun effetto visibile invece di lasciare davvero la
 *   pagina.
 * - CHIUSURA DA GESTO/POPSTATE → la voce è già stata consumata dal browser
 *   quando il nostro handler scatta: il cleanup NON deve toglierne un'altra,
 *   o si navigherebbe indietro di un passo in più del dovuto. `poppedRef`
 *   distingue i due casi.
 */
export function useCloseOnBack(onClose: () => void) {
	const onCloseRef = useRef(onClose);
	const poppedRef = useRef(false);
	/*
	 * ⚠️⚠️ Sopravvive al DOPPIO invocare degli effetti che React fa in
	 * sviluppo (mount → cleanup → mount, sulla STESSA istanza — non un vero
	 * smontaggio, è la prova apposta per scovare effetti non sicuri da
	 * rieseguire). Senza questo ref il modale si chiudeva da solo un istante
	 * dopo l'apertura, in sviluppo soltanto: la cleanup "fantasma" del primo
	 * giro chiamava `history.back()`, e quella pop — asincrona — arrivava al
	 * listener del SECONDO giro (già montato) come se fosse un gesto reale.
	 *
	 * La cleanup non fa più la pop subito: la rimanda a un microtask, e la
	 * marca con un token. Se un secondo giro dello stesso montaggio riprende
	 * la voce PRIMA che quel microtask scatti — è esattamente cosa succede,
	 * il doppio invocare di React è sincrono — il token viene marcato
	 * `cancelled` e la pop non parte mai. Un vero smontaggio non ha un
	 * secondo giro dietro a cancellarla: lì la pop scatta per davvero, solo
	 * un istante più tardi di prima (impercettibile).
	 */
	const pendingPopRef = useRef<{ cancelled: boolean } | null>(null);

	// Tiene `onCloseRef` allineata senza scrivere un ref durante il render
	// (vietato dalla regola `react-hooks/refs`): gira a ogni render, come un
	// normale effetto, ma non è QUESTO a dover montare/smontare una volta
	// sola — è l'effetto sotto, che infatti ha un array di dipendenze vuoto.
	useEffect(() => {
		onCloseRef.current = onClose;
	});

	useEffect(() => {
		// Un montaggio che riprende la voce cancella la pop lasciata in
		// sospeso dal giro precedente — vedi il commento sul ref sopra.
		if (pendingPopRef.current) {
			pendingPopRef.current.cancelled = true;
			pendingPopRef.current = null;
		}

		// Se la voce c'è già (il caso appena descritto) non se ne spinge una
		// seconda: raddoppiare le voci per lo stesso modale sposterebbe la
		// pop di un passo più in là del dovuto.
		if (!window.history.state?.seichiModal) {
			window.history.pushState({ seichiModal: true }, "");
		}

		function handlePopState() {
			poppedRef.current = true;
			onCloseRef.current();
		}

		window.addEventListener("popstate", handlePopState);
		return () => {
			window.removeEventListener("popstate", handlePopState);
			// La voce è già stata consumata dal browser (gesto/pulsante
			// indietro): niente da togliere, e chiamare `back()` andrebbe un
			// passo oltre.
			if (poppedRef.current) return;

			const token = { cancelled: false };
			pendingPopRef.current = token;
			queueMicrotask(() => {
				if (token.cancelled) return;
				if (window.history.state?.seichiModal) {
					window.history.back();
				}
			});
		};
		// Montaggio == apertura, smontaggio == chiusura (vedi CLAUDE.md — "i
		// pannelli si montano, non si nascondono"): deve girare una volta sola
		// per istanza di modale, non a ogni render.
	}, []);
}
