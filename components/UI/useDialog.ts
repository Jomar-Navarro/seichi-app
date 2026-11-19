"use client";

import { useEffect, useId, useRef } from "react";

/*
 * #165 — i pannelli dell'app come finestre di dialogo vere.
 *
 * Due ganci, un'unica pila:
 *   · `useDialog`  — i pannelli MODALI (fogli, wizard del movimento, visore
 *     delle ricevute, conferme): ruolo, nome, fuoco, sfondo `inert`, Esc;
 *   · `useDismissLayer` — gli strati NON modali ancorati a un comando (tendine,
 *     campanella, selettore del conto, menu profilo): solo Esc. Lo sfondo resta
 *     vivo, perché un tocco fuori li chiude e la pagina sotto non è coperta.
 *
 * Storia: `docs/storia/issue-165-dialog`.
 */

/** Uno strato aperto sopra la pagina, e come si chiude. */
interface Layer {
	close: () => void;
}

/*
 * ⚠️ La pila degli strati aperti, dal più vecchio al più recente. Esc chiude
 * SOLO quello in cima: col visore delle ricevute aperto dentro il wizard, Esc
 * chiude il visore e non il wizard — il difetto per cui la 28d aveva scartato
 * Esc (`fase-28-responsive`, «Tasto Esc — valutato e scartato»).
 *
 * Memoria di modulo (`react.md`, Confini 6): vive solo nel browser, perché la
 * scrivono soltanto gli effetti; non porta dati dell'utente, solo funzioni di
 * chiusura, e si svuota con gli strati che la riempiono.
 *
 * L'ordine è quello dei montaggi. Uno strato si apre sempre dopo quello che lo
 * contiene (la tendina dopo il foglio, il visore dopo il wizard), quindi chi
 * sta sopra a schermo sta anche in cima qui.
 */
const stack: Layer[] = [];

/*
 * Un solo ascoltatore per tutta l'app, acceso solo a pila non vuota (`react.md`,
 * Tocco 2: un ascoltatore globale vive solo finché serve).
 *
 * Sul `document` e in fase di risalita: chi gestisce Esc da sé più in basso (un
 * campo che lo usa) lo marca con `preventDefault()` e qui viene rispettato.
 * `isComposing`: Esc durante una composizione (tastiere giapponesi, cinesi)
 * annulla la composizione, non il pannello.
 */
function onKeyDown(e: KeyboardEvent) {
	if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
	const top = stack[stack.length - 1];
	if (!top) return;
	e.preventDefault();
	top.close();
}

function pushLayer(layer: Layer): () => void {
	stack.push(layer);
	if (stack.length === 1) document.addEventListener("keydown", onKeyDown);
	return () => {
		const i = stack.lastIndexOf(layer);
		if (i !== -1) stack.splice(i, 1);
		if (stack.length === 0) document.removeEventListener("keydown", onKeyDown);
	};
}

/*
 * Quanti pannelli aperti hanno chiesto `inert` su ciascun elemento.
 *
 * ⚠️ Un contatore e non un sì/no: col visore aperto sopra il wizard, lo stesso
 * elemento può essere reso inerte da entrambi, e chiudere il primo dei due non
 * deve risvegliarlo mentre l'altro è ancora aperto — in qualunque ordine si
 * chiudano.
 */
const claims = new WeakMap<Element, number>();

function claim(el: Element): boolean {
	const n = claims.get(el) ?? 0;
	if (n === 0) {
		// ⚠️ Un `inert` che c'era già non è nostro (oggi: il contenuto sotto il
		// velo del PIN, che lo scrive React in `AppLockProvider`). Non si conta e
		// non si tocca: toglierlo alla chiusura sveglierebbe ciò che il velo copre.
		if (el.hasAttribute("inert")) return false;
		el.setAttribute("inert", "");
	}
	claims.set(el, n + 1);
	return true;
}

function release(el: Element) {
	const n = claims.get(el) ?? 0;
	if (n <= 1) {
		claims.delete(el);
		el.removeAttribute("inert");
	} else {
		claims.set(el, n - 1);
	}
}

/**
 * Rende `inert` tutto ciò che sta FUORI da `root`, e restituisce come
 * annullarlo.
 *
 * Risale da `root` fino a `<body>` e, a ogni livello, rende inerti i fratelli
 * del ramo che porta al pannello. Così il pannello resta vivo senza spostarlo
 * nel DOM (niente portali: i fogli vivono dentro le pagine che li aprono).
 *
 * Perché non `<dialog>` con `showModal()`, che farebbe tutto da sé: il dialog
 * nativo vive nel top layer, SOPRA ogni z-index, e il velo del PIN copre con lo
 * z-index (`AppLockScreen`). Bloccandosi con un foglio aperto, il foglio
 * resterebbe visibile sopra il velo, con i conti in chiaro.
 *
 * ⚠️ Ciò che compare DOPO l'apertura fuori dal pannello non diventa inerte (un
 * avviso della PWA, il velo del PIN stesso — che anzi deve restare vivo). È
 * voluto: inseguire ogni nodo nuovo vorrebbe un `MutationObserver`, per
 * elementi che comunque stanno sotto lo sfondo del pannello.
 */
function inertOutside(root: Element): () => void {
	const claimed: Element[] = [];
	let node: Element = root;
	while (node !== document.body && node.parentElement) {
		const parent: Element = node.parentElement;
		for (const sibling of Array.from(parent.children)) {
			if (sibling !== node && claim(sibling)) claimed.push(sibling);
		}
		node = parent;
	}
	return () => claimed.forEach(release);
}

/** Tiene un ref allineato all'ultima funzione ricevuta, senza scriverlo nel render. */
function useLatest<T>(value: T) {
	const ref = useRef(value);
	useEffect(() => {
		ref.current = value;
	});
	return ref;
}

/**
 * Un pannello modale (#165). Il componente si monta all'apertura e si smonta
 * alla chiusura (`react.md`, Confini 2): montaggio e apertura coincidono, e
 * l'effetto qui sotto gira una volta per pannello.
 *
 * Restituisce:
 *   · `rootRef` — l'elemento più esterno del pannello, sfondo compreso. È da lì
 *     che si rende inerte il resto: partendo dal solo pannello, lo sfondo
 *     (suo fratello) diventerebbe inerte, e il tocco fuori smetterebbe di
 *     chiudere. Facoltativo: dove sfondo e pannello coincidono (il visore) basta
 *     `dialogProps`;
 *   · `dialogProps` — da stendere sul pannello: `role="dialog"`, `aria-modal`,
 *     il nome, `tabIndex={-1}` per poterci portare il fuoco;
 *   · `titleId` — l'`id` da dare al titolo visibile, quando non si passano
 *     né `label` né `labelledBy`.
 *
 * Il nome viene dal titolo visibile (`aria-labelledby`), così non può divergere
 * da ciò che si legge. `labelledBy` quando il titolo lo disegna un altro
 * componente (i fogli dentro `BottomSheetShell`); `label` solo per chi un
 * titolo non ce l'ha.
 *
 * All'apertura il fuoco va sul PANNELLO, non sul primo campo: sul telefono un
 * campo a fuoco apre la tastiera, che coprirebbe metà foglio a ogni apertura.
 * Lo screen reader legge il nome del dialog, e il Tab parte da lì.
 *
 * Alla chiusura il fuoco torna a chi l'aveva prima (di solito il comando che ha
 * aperto il pannello), se esiste ancora e non è a sua volta sotto un pannello.
 *
 * Esc chiama `onClose`: la stessa strada del tocco sullo sfondo e della X, così
 * `useCloseOnBack` tiene in ordine la cronologia come con loro (#86).
 */
export function useDialog(
	onClose: () => void,
	options: { label?: string; labelledBy?: string } = {},
) {
	const rootRef = useRef<HTMLDivElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const ownTitleId = useId();
	const titleId = options.labelledBy ?? ownTitleId;
	const closeRef = useLatest(onClose);

	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) return;

		const active = document.activeElement;
		const opener = active instanceof HTMLElement && active !== document.body ? active : null;

		const releaseInert = inertOutside(rootRef.current ?? panel);
		const popLayer = pushLayer({ close: () => closeRef.current() });
		if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true });

		return () => {
			popLayer();
			releaseInert();
			if (opener?.isConnected && !opener.closest("[inert]")) {
				opener.focus({ preventScroll: true });
			}
		};
		// Montaggio == apertura: gira una volta per pannello. `onClose` arriva
		// da `closeRef`, che segue l'ultima versione senza far rigirare l'effetto
		// (rigirandolo, il fuoco tornerebbe al comando e poi di nuovo al pannello
		// a ogni render del chiamante).
	}, [closeRef]);

	const dialogProps = {
		ref: panelRef,
		role: "dialog",
		"aria-modal": true,
		...(options.label ? { "aria-label": options.label } : { "aria-labelledby": titleId }),
		tabIndex: -1,
	} as const;

	return { rootRef, dialogProps, titleId };
}

/**
 * Uno strato NON modale (#165): una tendina, un menu, un pannello ancorato al
 * comando che lo apre. Finché `open` è vero, Esc chiama `onDismiss` — ma solo
 * se lo strato è in cima: con una tendina aperta dentro un foglio, Esc chiude
 * la tendina e il foglio resta.
 *
 * Il fuoco lo restituisce `onDismiss` (di solito al comando che apre lo
 * strato): questi strati vivono accanto al loro comando, e solo il chiamante sa
 * qual è.
 */
export function useDismissLayer(open: boolean, onDismiss: () => void) {
	const dismissRef = useLatest(onDismiss);
	useEffect(() => {
		if (!open) return;
		return pushLayer({ close: () => dismissRef.current() });
	}, [open, dismissRef]);
}
