"use client";

import { useCallback, useState, type CSSProperties } from "react";

/**
 * issue #86 punto 5 — la posizione del tooltip di un donut CON etichetta al
 * centro (`SpendingPieChart`, `InvestimentiTab`).
 *
 * ⚠️ Il primo tentativo fissava il tooltip SEMPRE nello stesso punto (sotto
 * l'anello), per impedirgli di sovrapporre l'etichetta centrale — funzionava,
 * ma ignorava QUALE fetta era stata toccata: chiesto usando l'app, "non puoi
 * metterli a fianco alla loro fetta?". Recharts calcola già, per ogni fetta,
 * l'angolo medio e il raggio (`entry.midAngle`, `entry.outerRadius`,
 * `entry.cx`/`entry.cy`) e li passa a `onMouseEnter`/`onClick` del `<Pie>` —
 * non serve rifare quella trigonometria: si prende il punto sul bordo
 * ESTERNO dell'anello, a quell'angolo, con un margine. È sempre fuori dal
 * buco centrale per costruzione (il margine parte da `outerRadius`, mai da
 * `innerRadius`), quindi non serve più un punto fisso per evitare
 * l'etichetta.
 *
 * ⚠️ NON si usa il prop `position` di `<Tooltip>`: quello fissa l'angolo
 * IN ALTO A SINISTRA del riquadro sul punto dato, e basta — nessun modo di
 * farlo crescere in una direzione diversa. Si calcola invece uno stile che
 * ancora un lato del riquadro al punto, così cresce in una direzione scelta.
 *
 * ⚠️⚠️ Verticale e orizzontale NON usano la stessa regola, e non per
 * simmetria mancata: i due assi hanno spazio DIVERSO attorno al donut.
 *
 * - **Verticale**: sopra e sotto l'anello (nella colonna del donut) NON
 *   c'è quasi spazio — sono margini di pochi pixel. Un riquadro che
 *   crescesse SEMPRE verso il basso rientrerebbe nel buco centrale per una
 *   fetta in alto (il punto sta appena fuori dall'anello, il riquadro è più
 *   alto di quel margine): è il difetto che questo hook esiste per
 *   risolvere. Qui si ancora quindi il lato più vicino al centro — cresce
 *   verso l'alto per le fette in alto, verso il basso per quelle in basso —
 *   in modo che il riquadro si allontani sempre dal centro, mai verso di lui.
 * - **Orizzontale**: a sinistra del donut c'è SOLO il margine della pagina
 *   (`px-5`, 20px) — pochissimo. A destra c'è la legenda e il resto del
 *   contenuto — tanto. La stessa regola "ancora il lato più vicino al
 *   centro" applicata qui farebbe crescere il riquadro verso sinistra per
 *   ogni fetta nella metà sinistra del donut, e con appena 20px di margine
 *   basta un riquadro largo il suo contenuto per uscire dallo schermo — è
 *   successo, visto sullo schermo vero. Qui si ancora quindi SEMPRE a
 *   sinistra (cresce verso destra): nel caso peggiore si sovrappone un
 *   momento all'anello o alla legenda, mai al bordo dello schermo.
 *
 * `style` è `null` quando nessuna fetta è attiva: `wrapperStyle={style ??
 * undefined}` lascia che il tooltip resti semplicemente invisibile (Recharts
 * lo nasconde comunque quando non c'è nulla di attivo).
 */
const RADIAN = Math.PI / 180;

/**
 * Il minimo che Recharts passa ai gestori di `<Pie>` — resto dei campi
 * ignorato. `midAngle` è opzionale nel tipo di Recharts (`PieSectorData`),
 * quindi lo è anche qui: a runtime c'è sempre per una fetta vera, ma il tipo
 * non lo garantisce.
 */
interface PieSectorEntry {
	cx: number;
	cy: number;
	outerRadius: number;
	midAngle?: number;
}

/** issue #81 — segue la card sotto: senza uno z-index esplicito, un elemento
 *  posizionato più avanti nel DOM vince l'ordine di disegno anche se questo
 *  tooltip è sopra di lui nello schermo. */
const Z_INDEX = 20;

export function useDonutTooltipPosition(gap = 10) {
	const [style, setStyle] = useState<CSSProperties | null>(null);

	const activate = useCallback(
		(entry: PieSectorEntry) => {
			if (entry.midAngle === undefined) return;
			const angle = -RADIAN * entry.midAngle;
			const radius = entry.outerRadius + gap;
			const x = entry.cx + Math.cos(angle) * radius;
			const y = entry.cy + Math.sin(angle) * radius;

			// Verticale: si allontana sempre dal centro (vedi il commento sopra
			// per il perché). Orizzontale: cresce sempre a destra, mai a
			// sinistra — a sinistra del donut non c'è margine per crescere.
			const top = y >= entry.cy;

			setStyle({
				position: "absolute",
				zIndex: Z_INDEX,
				left: x,
				top: top ? y : undefined,
				bottom: top ? undefined : `calc(100% - ${y}px)`,
				/*
				 * ⚠️ Recharts imposta GIÀ un `transform: translate(...)` proprio,
				 * calcolato dalla SUA coordinata (il centro-raggio della fetta,
				 * non il nostro punto fuori dall'anello) — e lo tiene, perché
				 * `wrapperStyle` sovrascrive `outerStyle` chiave per chiave: se
				 * questa chiave manca, il `transform` di Recharts resta applicato
				 * SOPRA il nostro `left`/`top`, spostando il riquadro di un
				 * secondo offset non voluto. `none` lo annulla: la posizione la
				 * decide solo `left`/`top`/`bottom`.
				 */
				transform: "none",
			});
		},
		[gap],
	);

	const clear = useCallback(() => setStyle(null), []);

	return {
		/** Da passare a `wrapperStyle` di `<Tooltip>` (`?? undefined` se null). */
		style,
		/** Da spalmare sui props `onMouseEnter`/`onClick`/`onMouseLeave` di `<Pie>`. */
		pieHandlers: {
			onMouseEnter: activate,
			onClick: activate,
			onMouseLeave: clear,
		},
	};
}
