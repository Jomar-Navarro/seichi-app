/**
 * Blocco app con PIN (Fase 26a, issue #67).
 *
 * ⚠️ Questo è un blocco dell'INTERFACCIA, non dei dati: la sessione Supabase
 * resta valida nel cookie, e non sostituisce né indebolisce la
 * riautenticazione delle operazioni sensibili (Fase 16). Non è cifratura:
 * nulla di ciò che sta su disco diventa illeggibile. Se promettesse di più,
 * prometterebbe il falso — vedi issue #67.
 *
 * Il PIN vive SOLO in `localStorage`, per dispositivo: mai sul server, mai
 * sincronizzato fra dispositivi, mai in un cookie. ⚠️ Ed è in CHIARO, non
 * hashato: un hash di un PIN a 4 cifre si forza offline in microsecondi, e
 * hasharlo comunque darebbe solo l'ILLUSIONE di una protezione che non c'è —
 * la stessa sicurezza-per-oscurità già scartata altrove in questo progetto
 * (il path degli avatar, Fase 16). Meglio dichiararlo che fingerlo.
 *
 * Due cookie NON segreti (stesso pattern di `lib/theme.ts` — scritti da
 * `document.cookie`, mai httpOnly, un anno di durata) esistono per un motivo
 * solo: senza di loro il server non saprebbe nulla e lascerebbe passare un
 * fotogramma di DASHBOARD VERA (Server Component: i numeri sono già
 * nell'HTML) prima che il JS client decida di coprirla. Non portano il PIN,
 * solo due fatti non sensibili — "questo dispositivo ha un PIN" e "fino a
 * quando vale la finestra di grazia" — che bastano al server per rendere già
 * corretto il primo byte, esattamente come `.dark` per il tema.
 *
 * Questo modulo non importa `next/headers`: `isLockedFromCookies` va letta
 * anche dal server (`app/(main)/layout.tsx`, valori grezzi da `cookies()`) e
 * dal client (`AppLockProvider`, valori grezzi da `document.cookie`) — la
 * STESSA funzione, non due copie che potrebbero divergere.
 */

export const APP_LOCK_ENABLED_COOKIE = "seichi-lock-enabled";
export const APP_LOCK_ACTIVE_UNTIL_COOKIE = "seichi-lock-active-until";

const PIN_STORAGE_KEY = "seichi-app-pin";

export const APP_LOCK_PIN_LENGTH = 4;

/** Quanto resta valido uno sblocco senza che l'app torni in primo piano. */
export const APP_LOCK_GRACE_MS = 5 * 60 * 1000;

/** Un anno, come i cookie del tema: la scelta non deve scadere da sola. */
const MAX_AGE = 60 * 60 * 24 * 365;

/* ---------------------------------------------------------- server e client --- */

/**
 * Decide se il velo va mostrato, dai soli DUE COOKIE.
 *
 * Fail CLOSED: se un PIN è configurato e non risulta un'attività recente
 * valida (cookie assente, scaduto o manomesso), il default è bloccato — mai
 * il contrario. Il costo di sbagliare per eccesso è un velo di troppo,
 * annullato in un istante da chi conosce il PIN; il costo di sbagliare per
 * difetto sarebbe la dashboard vera esposta a chi non lo conosce.
 */
export function isLockedFromCookies(
	enabledRaw: string | undefined,
	activeUntilRaw: string | undefined,
): boolean {
	if (enabledRaw !== "1") return false; // nessun PIN configurato: niente da bloccare
	const activeUntil = activeUntilRaw ? Number(activeUntilRaw) : NaN;
	if (!Number.isFinite(activeUntil)) return true; // mai sbloccato, o cookie assente/manomesso
	return Date.now() > activeUntil;
}

export function isValidPin(value: string): boolean {
	return new RegExp(`^\\d{${APP_LOCK_PIN_LENGTH}}$`).test(value);
}

/* ---------------------------------------------------------------- solo client --- */

/** `localStorage` può lanciare in navigazione privata: trattato come "nessun PIN". */
export function hasStoredPin(): boolean {
	try {
		return localStorage.getItem(PIN_STORAGE_KEY) !== null;
	} catch {
		return false;
	}
}

export function readStoredPin(): string | null {
	try {
		return localStorage.getItem(PIN_STORAGE_KEY);
	} catch {
		return null;
	}
}

function cookieAttrs(): string {
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	return `; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
}

/** Rinfresca la finestra di grazia da QUESTO istante — a ogni sblocco riuscito e a ogni uscita dal primo piano. */
export function markActiveNow() {
	const until = Date.now() + APP_LOCK_GRACE_MS;
	document.cookie = `${APP_LOCK_ACTIVE_UNTIL_COOKIE}=${until}${cookieAttrs()}`;
}

/** Salva il PIN e accende il flag lato server — a fine impostazione o cambio. */
export function savePin(pin: string) {
	try {
		localStorage.setItem(PIN_STORAGE_KEY, pin);
	} catch {
		// localStorage indisponibile: il PIN non persiste, ma non c'è modo di
		// dirlo qui — il chiamante lo scoprirebbe solo al giro successivo, e
		// nel frattempo il cookie "enabled" resterebbe una promessa vuota.
	}
	document.cookie = `${APP_LOCK_ENABLED_COOKIE}=1${cookieAttrs()}`;
	markActiveNow();
}

/** Rimuove il PIN e i due cookie: da qui in poi l'app non si blocca più su questo dispositivo. */
export function clearPin() {
	try {
		localStorage.removeItem(PIN_STORAGE_KEY);
	} catch {
		// ignorabile — al peggio resta un valore locale che nessun cookie referenzia più
	}
	document.cookie = `${APP_LOCK_ENABLED_COOKIE}=; Path=/; Max-Age=0`;
	document.cookie = `${APP_LOCK_ACTIVE_UNTIL_COOKIE}=; Path=/; Max-Age=0`;
}

/** Legge un cookie per nome — solo client, `document.cookie` non esiste sul server. */
export function readCookie(name: string): string | undefined {
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : undefined;
}
