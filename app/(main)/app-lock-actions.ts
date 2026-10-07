"use server";

import { cookies, headers } from "next/headers";
import { APP_LOCK_ENABLED_COOKIE, APP_LOCK_ENABLED_COOKIE_OPTIONS } from "@/lib/app-lock";

/**
 * Accende o spegne `seichi-lock-enabled` — l'unico punto che lo SCRIVE (#125).
 *
 * Dal server e non da `document.cookie`, perché Safari (ITP) tronca a 7 giorni
 * i cookie creati dal JavaScript, qualunque `Max-Age` si chieda: il blocco si
 * spegneva da solo una settimana dopo aver impostato il PIN. Un `Set-Cookie`
 * non ha quel tetto. Vedi `lib/app-lock.ts`.
 *
 * Qui accanto alle altre azioni di `(main)` e non dentro /impostazioni/blocco:
 * la usa anche `AppLockProvider`, cioè il layout di ogni pagina.
 *
 * Nessun `requireUser()`: non legge né scrive dati, solo un cookie non segreto
 * sul browser di chi chiama. Accenderlo senza un PIN mostra al più il velo "il
 * PIN non c'è più" — ciò che chiunque può già ottenere scrivendo il cookie a
 * mano nel proprio browser.
 *
 * ⚠️ Impostare un cookie in una server action fa rendere di nuovo pagina e
 * layout (guida "mutating data" di Next 16). Qui è voluto: è ciò che fa tornare
 * "Attivo" la riga di /impostazioni quando il cookie mancava.
 */
export async function setAppLockCookie(enabled: boolean) {
	const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();
	const options = { ...APP_LOCK_ENABLED_COOKIE_OPTIONS, secure: proto === "https" };
	const store = await cookies();
	if (enabled === true) store.set(APP_LOCK_ENABLED_COOKIE, "1", options);
	else store.set(APP_LOCK_ENABLED_COOKIE, "", { ...options, maxAge: 0 });
}
