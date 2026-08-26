"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/components/features/I18nProvider";
import FlowCard from "./FlowCard";
import AccountsBalanceCard from "./AccountsBalanceCard";
import type { AccountWithBalance } from "@/types";

interface HomeHeroProps {
	flussoMese: number;
	monthLabel: string;
	accounts: AccountWithBalance[];
	/** null = tutti i conti. Arriva dal search param. */
	selectedId: string | null;
}

/**
 * Le due cifre della home, affiancate in un carosello: **giacenza** e **flusso**,
 * in quest'ordine (vedi la nota sul carosello più sotto).
 *
 * ⚠️ Averle alla pari è il punto, non un vezzo. La 20a aveva cancellato il
 * "Saldo totale" dalla home perché *contraddiceva* la pagina conti: era
 * `entrate − spese − risparmi − investimenti`, ignorava `initial_balance`, e
 * dava un numero diverso da quello dei conti. La card di qui è invece la **somma
 * dei saldi** — lo stesso identico numero di `/conti`, dalla stessa vista.
 *
 * La regola che la fase ha fissato vieta la **contraddizione**, non la
 * ripetizione: due schermate non possono rispondere *diversamente* a "quanto
 * ho". Rispondere allo stesso modo va bene, e affiancare i due numeri con le
 * rispettive spiegazioni è il modo più diretto di insegnare la differenza fra
 * ciò che si è mosso e ciò che c'è.
 *
 * ⚠️ Lo stato "nascondi importi" sta QUI e non nelle card: l'occhio è una
 * questione di privacy dello schermo, non di una singola cifra. Tenendolo in
 * `FlowCard` si sarebbe potuto nascondere il flusso lasciando il saldo in
 * chiaro — cioè non nascondere niente.
 */
export default function HomeHero({
	flussoMese,
	monthLabel,
	accounts,
	selectedId,
}: HomeHeroProps) {
	const { t } = useI18n();
	const [hidden, setHidden] = useState(false);
	const [page, setPage] = useState(0);
	const trackRef = useRef<HTMLDivElement>(null);

	/*
	 * ⚠️ Senza conti la seconda pagina NON si rende.
	 *
	 * `getAccounts()` può fallire, e la home degrada a `accounts = []` invece di
	 * sparire — scelta giusta per il selettore, che semplicemente non compare.
	 * Ma questa card AFFERMA: con l'elenco vuoto avrebbe scritto "Saldo € 0,00 ·
	 * 0 conti attivi" a un utente con 15.000 € su quattro conti. Un numero
	 * sbagliato che sembra giusto è peggio di un numero assente — e qui il
	 * numero assente è disponibile gratis, basta non disegnare la pagina.
	 *
	 * Restando una card sola sparisce anche il carosello: niente puntini, niente
	 * scorrimento verso il vuoto.
	 */
	const showBalance = accounts.length > 0;

	/*
	 * La pagina attiva si deduce dallo scroll invece di essere pilotata da noi:
	 * lo swipe è nativo (`snap-x`), quindi l'unica fonte attendibile di "dove
	 * siamo" è la posizione del contenitore. Guidarla da uno stato avrebbe
	 * significato combattere contro lo scroll del browser.
	 */
	function onScroll() {
		const el = trackRef.current;
		if (!el) return;
		const next = Math.round(el.scrollLeft / el.clientWidth);
		if (next !== page) setPage(next);
	}

	function goTo(i: number) {
		const el = trackRef.current;
		if (!el) return;
		// Si misura il figlio invece di moltiplicare per la larghezza: oggi le due
		// coincidono, ma basterebbe un `gap` o una pagina di larghezza diversa per
		// far divergere il calcolo aritmetico dalla posizione reale.
		const child = el.children[i] as HTMLElement | undefined;
		el.scrollTo({ left: child?.offsetLeft ?? i * el.clientWidth, behavior: "smooth" });
	}

	return (
		<div>
			{/*
				⚠️ Il contenitore va A TUTTA LARGHEZZA e il padding sta sulle PAGINE,
				non viceversa. Sono due difetti diversi risolti dalla stessa mossa.

				1. `overflow-x-auto` ritaglia il `box-shadow`, che per definizione
				   sborda dal riquadro — e per specifica CSS se un asse non è
				   `visible` non lo è nemmeno l'altro, quindi il taglio avviene su
				   tutti e quattro i lati. `card-shadow` è `0 8px 24px`: si estende
				   **32px sotto**, 16 sopra, 24 ai lati. Da qui `pt-4 pb-8` (16 e 32)
				   con i margini negativi che riallineano.
				2. Col padding sul CONTENITORE ogni pagina era più stretta della vista,
				   quindi si vedeva sbucare la card successiva e il bordo sembrava
				   comunque tagliato. Ora la pagina è larga quanto la vista e il
				   respiro laterale lo dà `px-5` su di essa — gli stessi 20px del
				   resto della home, così la card è allineata alle quattro sotto.

				`-mx-5` porta il contenitore ai bordi dello schermo: è il padding
				della pagina, restituito alle pagine del carosello.
			*/}
			<div
				ref={trackRef}
				onScroll={onScroll}
				className="flex overflow-x-auto -mx-5 pt-4 -mt-4 pb-8 -mb-8 snap-x snap-mandatory scrollbar-none"
			>
				{/*
					⚠️ La GIACENZA viene prima, il flusso dopo — chiesto usando l'app.

					Non cambia nulla di ciò che la 20a ha deciso: la regola vieta la
					CONTRADDIZIONE, non l'ordine, e i due numeri restano quelli di prima
					con le stesse spiegazioni. Cambia solo quale domanda la home
					risponde per prima — "quanto ho" invece di "come sto andando".

					⚠️ Ma l'ordine è anche il VERSO delle frasi: il suggerimento
					"per i saldi, scorri →" viveva su `flowExplain`, e con i saldi a
					sinistra avrebbe indicato una pagina che non c'è. Tolto — non
					spostato sull'altra card, ed è la parte che è costata un tentativo:

					· ⚠️ **due frecce sulla stessa card sono due gesti diversi.** La card
					  saldo ha già "Vedi il dettaglio dei conti →", che NAVIGA. Un secondo
					  → che significa *scorri di lato* usa lo stesso simbolo per un'altra
					  azione, e a distinguerli resta solo la parola accanto.
					· ⚠️ per fare spazio al suggerimento avevo cancellato *«gli archiviati
					  restano fuori»*, che è un FATTO sul numero (20a: il saldo li
					  esclude). Barattare un'informazione per un aiuto al gesto è il
					  verso sbagliato dello scambio.

					A insegnare lo scorrimento restano i PUNTINI qui sotto, che sono anche
					comandi — l'unica affordance che non compete con un collegamento.

					⚠️ Conseguenza buona e non cercata: il vecchio suggerimento stava sul
					flusso, che si rende SEMPRE, mentre la seconda pagina esiste solo con
					dei conti — senza, la home diceva "scorri →" verso il nulla.
				*/}
				{showBalance && (
					<div className="snap-center shrink-0 w-full px-5">
						<AccountsBalanceCard
							accounts={accounts}
							selectedId={selectedId}
							hidden={hidden}
							onToggleHidden={() => setHidden((h) => !h)}
						/>
					</div>
				)}
				<div className="snap-center shrink-0 w-full px-5">
					<FlowCard
						flussoMese={flussoMese}
						monthLabel={monthLabel}
						hidden={hidden}
						onToggleHidden={() => setHidden((h) => !h)}
					/>
				</div>
			</div>

			{/*
				I puntini: attivo = pastiglia allungata, come nel mockup. Sono anche
				comandi, non solo indicatori — su desktop non c'è lo swipe, e un
				carosello senza modo di girarlo col mouse nasconde metà del contenuto.
			*/}
			{showBalance && (
			<div className="flex items-center justify-center gap-1.5 mt-3">
				{[0, 1].map((i) => (
					<button
						key={i}
						onClick={() => goTo(i)}
						aria-label={i === 0 ? t.home.flowTitle : t.accounts.balanceHeading}
						aria-current={page === i}
						className="h-1.5 rounded-full transition-all"
						style={{
							width: page === i ? 22 : 6,
							background: page === i ? "var(--ink-midori)" : "var(--border)",
						}}
					/>
				))}
			</div>
			)}
		</div>
	);
}
