"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import AppLockScreen from "@/components/features/AppLockScreen";
import { setAppLockCookie } from "@/app/(main)/app-lock-actions";
import { enabledCookieFix, isLockedOnClient, isPinEnabledOnClient, markActiveNow } from "@/lib/app-lock";

/**
 * Lo stato "bloccato" vive FUORI da React, in un piccolo store per istanza
 * (#125), letto con `useSyncExternalStore`.
 *
 * Il motivo è la prima lettura sul client. Il server decide dai soli cookie;
 * se il cookie del PIN è sparito ha reso la pagina sbloccata, e il client —
 * che vede anche `localStorage` — deve poterlo correggere appena montato.
 * Con uno `useState(initialLocked)` servirebbe un `setState` dentro un
 * effetto, cioè il render a cascata che il lint vieta. Qui l'idratazione usa
 * la decisione del server (`getServer`), e subito dopo React legge quella del
 * client (`get`) e, se diverge, rende di nuovo.
 *
 * ⚠️ `get()` decide UNA volta e poi resta fermo finché qualcuno non chiama
 * `set()`: la decisione dipende da `Date.now()`, e un'istantanea che cambiasse
 * da sola fra due letture farebbe sbagliare React. E il client AGGIUNGE un
 * blocco, non lo toglie: se il server ha detto "bloccato", resta bloccato
 * finché qualcuno non digita il PIN — come prima della #125.
 *
 * ⚠️ E `serverLocked` si legge UNA volta, al montaggio, come faceva lo
 * `useState(initialLocked)` di prima: il layout si rende di nuovo a ogni
 * `revalidatePath("/", "layout")`, cioè dopo ogni movimento salvato, e la
 * finestra di grazia si rinnova solo uscendo dal primo piano — chi usa l'app
 * da due minuti ha `active-until` già passato, e applicare la nuova decisione
 * del server lo chiuderebbe fuori a ogni salvataggio. Dopo il montaggio il
 * blocco lo alzano solo `visibilitychange` e lo abbassa solo il PIN.
 */
function createLockStore(serverLocked: boolean) {
	let locked: boolean | undefined;
	const listeners = new Set<() => void>();
	return {
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		get(): boolean {
			if (locked === undefined) locked = serverLocked || isLockedOnClient();
			return locked;
		},
		getServer: () => serverLocked,
		set(next: boolean) {
			if (locked === next) return;
			locked = next;
			listeners.forEach((listener) => listener());
		},
	};
}

/**
 * Monta `AppLockScreen` sopra `children` quando il dispositivo è bloccato
 * (Fase 26a). `initialLocked` arriva dal server (`app/(main)/layout.tsx`,
 * che legge gli stessi due cookie da `cookies()`): è quello che rende il
 * PRIMO byte già corretto, niente lampo di dashboard vera prima che questo
 * componente si idrati — vedi `lib/app-lock.ts` per il perché.
 */
export default function AppLockProvider({
	initialLocked,
	children,
}: {
	initialLocked: boolean;
	children: ReactNode;
}) {
	const [store] = useState(() => createLockStore(initialLocked));
	const locked = useSyncExternalStore(store.subscribe, store.get, store.getServer);

	const unlock = useCallback(() => {
		markActiveNow();
		store.set(false);
	}, [store]);

	useEffect(() => {
		// #125 — il cookie del PIN e `localStorage` non concordano: questa pagina
		// il server l'ha resa credendo al cookie. Il velo, se serve, l'ha già
		// messo `get()`; qui si corregge il cookie dal server, che fa anche
		// rendere di nuovo i Server Component che ne avevano tratto qualcosa —
		// la riga "Blocco con PIN · Attivo" di /impostazioni. Una volta sola:
		// dopo la correzione concordano. Su un errore, ci si riprova al
		// prossimo caricamento: il blocco intanto lo decide `localStorage`, e
		// il guasto resta nei log (#124: un fallimento non è un non-evento).
		const fix = enabledCookieFix(!store.get());
		if (fix !== null) setAppLockCookie(fix).catch((e) => console.error("[app-lock] cookie del PIN:", e));
	}, [store]);

	useEffect(() => {
		function onVisibilityChange() {
			// Nessun PIN configurato: non c'è nulla da sorvegliare, e scrivere
			// il cookie a ogni cambio di visibilità sarebbe rumore puro per chi
			// non ha mai attivato la funzione. Entrambe le fonti, non il solo
			// cookie (#125): era il cookie scaduto a spegnere il blocco.
			if (!isPinEnabledOnClient()) return;

			if (document.visibilityState === "hidden") {
				// ⚠️ SOLO se l'app non è già bloccata: rinfrescare la finestra di
				// grazia mentre il velo è ancora a schermo equivarrebbe a
				// sbloccarla senza che nessuno abbia mai digitato il PIN — un
				// bypass reale, trovato dal code-review. Lo scenario: il velo è
				// su, l'utente cambia app senza sbloccare, torna dopo un attimo —
				// senza questo controllo il cookie `active-until` si rinfrescava
				// comunque, e un ricaricamento (o una scheda nuova) avrebbe
				// mostrato la dashboard vera senza chiedere nulla.
				//
				// L'ultimo istante in cui si sa per certo che l'utente c'era: la
				// finestra di grazia riparte da qui, non dal momento dello
				// sblocco — sennò un uso attivo di 20 minuti si bloccherebbe da
				// solo mentre lo schermo è ancora sotto gli occhi di chi guarda.
				// Vale anche quando a nascondere la pagina è lo schermo che si
				// spegne: è ciò che i testi di /impostazioni/blocco promettono.
				if (!store.get()) markActiveNow();
				return;
			}

			// Torna visibile: la pagina potrebbe essere la STESSA istanza React
			// di prima (background breve) o una ricaricata da zero dal sistema
			// operativo (background lungo, iOS scarica il processo) — in
			// entrambi i casi i cookie e `localStorage` sono la fonte di
			// verità, non lo stato in memoria di questo componente.
			if (isLockedOnClient()) store.set(true);
		}

		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => document.removeEventListener("visibilitychange", onVisibilityChange);
	}, [store]);

	return (
		<>
			{/* `inert`, non un semplice `aria-hidden`: sotto il velo il contenuto
			    non deve essere raggiungibile né da tab né da chi naviga a voce —
			    `aria-hidden` da solo lascerebbe comunque il fuoco tastiera libero
			    di finirci dentro. ⚠️ E `inert` impedisce di INTERAGIRE, non di
			    VEDERE: a coprire è lo z-index del velo, vedi `AppLockScreen`. */}
			<div inert={locked || undefined}>{children}</div>
			{/* Dopo i figli, non prima (#125): a parità di z-index vince chi
			    viene dopo nel documento, e fino alla #125 a vincere era una card
			    dell'import con la tendina aperta. */}
			{locked && <AppLockScreen onUnlock={unlock} />}
		</>
	);
}
