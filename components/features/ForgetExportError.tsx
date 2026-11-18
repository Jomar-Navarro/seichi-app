"use client";
import { useEffect } from "react";
import { scrollBehavior } from "@/lib/motion";

/**
 * Toglie dall'URL il codice dell'errore di un download (#162), dopo che la
 * pagina l'ha mostrato.
 *
 * ⚠️ Scelta dichiarata: l'avviso resta a schermo finché si resta sulla pagina,
 * ma NON ricompare al ricarico. Con il codice nell'URL un ricarico mostrerebbe
 * un guasto forse già passato, o un'attesa del tetto ormai vecchia («riprova
 * fra 59 minuti» un'ora dopo): una frase falsa.
 *
 * `history.replaceState` e non `router.replace`: il secondo rifarebbe la pagina
 * senza il parametro, e l'avviso sparirebbe nell'istante in cui compare. Il
 * primo cambia solo l'URL, e Next lo integra nel suo router (guida «Linking
 * and Navigating», *Native History API*). Nessun `setState`: l'effetto tocca
 * solo il browser.
 *
 * ⚠️ Porta anche lo schermo sul comando che ha fallito (`target`, l'`id` della
 * sua sezione). L'ancora del rinvio (`#csv`, `#archivio`) da sola non basta:
 * lo scorrimento del browser al caricamento è riuscito a volte sì e a volte no
 * (verde con tre scenari, rosso con sedici in parallelo), e la pagina restava
 * in cima con l'avviso sotto la BottomNav. Qui lo scorrimento avviene dopo
 * l'idratazione, quando la sezione c'è di sicuro; l'ancora resta per chi non
 * ha ancora JavaScript.
 */
export default function ForgetExportError({ target }: { target: "csv" | "archivio" }) {
	useEffect(() => {
		document.getElementById(target)?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
		window.history.replaceState(null, "", window.location.pathname);
	}, [target]);
	return null;
}
