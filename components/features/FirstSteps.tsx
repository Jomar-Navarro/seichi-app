import { FIRST_STEP_KEYS, type FirstStepsState } from "@/lib/first-steps";
import FirstStepsCard from "./FirstStepsCard";

/**
 * Il pezzo server della card «Primi passi» (#163): aspetta la RPC sotto il SUO
 * `<Suspense>`, così il resto della home non la aspetta.
 *
 * La promise la avvia la home PRIMA delle sue letture (`loadFirstSteps()`):
 * partendo da qui, la RPC aspetterebbe la fine di tutte le altre. Al client
 * arriva solo la fotografia delle voci, un oggetto semplice.
 */
export default async function FirstSteps({ promise }: { promise: Promise<FirstStepsState | null> }) {
	const state = await promise;
	if (!state) return null;
	/*
	 * ⚠️ La `key` è la firma delle voci fatte. Dopo un salvataggio la home si
	 * rilegge (`DashboardRefresher`) e la card riceve lo stato nuovo, ma la voce
	 * aperta è uno `useState` inizializzato dalla prop: senza rimontare, chi
	 * aggiunge la prima transazione dal pulsante della card resterebbe su
	 * «transazione», ora «Fatto», invece di passare al budget. Montare è
	 * l'azzeramento (CLAUDE.md, Interfaccia).
	 */
	const signature = FIRST_STEP_KEYS.map((k) => (state.done[k] ? "1" : "0")).join("") + (state.hasImport ? "i" : "");
	return <FirstStepsCard key={signature} state={state} />;
}

/**
 * Il posto della card mentre la RPC risponde: alto più o meno quanto la card,
 * così l'arrivo non spinge giù il Flusso. Compare solo a card aperta: a card
 * chiusa la home non apre nemmeno il Suspense. Il respiro è `zg-pulse`, che col
 * movimento ridotto si ferma (dichiarato in `globals.css`).
 */
export function FirstStepsSkeleton() {
	return <div aria-hidden="true" className="h-76 rounded-3xl zg-pulse bg-surface-elevated lg:h-66 lg:rounded-[28px]" />;
}
