"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import AppLockScreen from "@/components/features/AppLockScreen";
import {
	APP_LOCK_ACTIVE_UNTIL_COOKIE,
	APP_LOCK_ENABLED_COOKIE,
	isLockedFromCookies,
	markActiveNow,
	readCookie,
} from "@/lib/app-lock";

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
	const [locked, setLocked] = useState(initialLocked);

	const unlock = useCallback(() => {
		markActiveNow();
		setLocked(false);
	}, []);

	useEffect(() => {
		function onVisibilityChange() {
			// Nessun PIN configurato: non c'è nulla da sorvegliare, e scrivere
			// il cookie a ogni cambio di visibilità sarebbe rumore puro per chi
			// non ha mai attivato la funzione.
			if (readCookie(APP_LOCK_ENABLED_COOKIE) !== "1") return;

			if (document.visibilityState === "hidden") {
				// L'ultimo istante in cui si sa per certo che l'utente c'era: la
				// finestra di grazia riparte da qui, non dal momento dello
				// sblocco — sennò un uso attivo di 20 minuti si bloccherebbe da
				// solo mentre lo schermo è ancora sotto gli occhi di chi guarda.
				markActiveNow();
				return;
			}

			// Torna visibile: la pagina potrebbe essere la STESSA istanza React
			// di prima (background breve) o una ricaricata da zero dal sistema
			// operativo (background lungo, iOS scarica il processo) — in
			// entrambi i casi il cookie è la fonte di verità, non lo stato in
			// memoria di questo componente.
			const stillOk = !isLockedFromCookies(
				readCookie(APP_LOCK_ENABLED_COOKIE),
				readCookie(APP_LOCK_ACTIVE_UNTIL_COOKIE),
			);
			if (!stillOk) setLocked(true);
		}

		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => document.removeEventListener("visibilitychange", onVisibilityChange);
	}, []);

	return (
		<>
			{locked && <AppLockScreen onUnlock={unlock} />}
			{/* `inert`, non un semplice `aria-hidden`: sotto il velo il contenuto
			    non deve essere raggiungibile né da tab né da chi naviga a voce —
			    `aria-hidden` da solo lascerebbe comunque il fuoco tastiera libero
			    di finirci dentro. */}
			<div inert={locked || undefined}>{children}</div>
		</>
	);
}
