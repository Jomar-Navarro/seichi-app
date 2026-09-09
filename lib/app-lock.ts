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

/** 6, non 4 — dal design (`PinCard`/`PinSetupCard`, Fase 26a-bis). */
export const APP_LOCK_PIN_LENGTH = 6;

/**
 * Le quattro durate fra cui scegliere per "richiedi il PIN dopo" — su
 * richiesta esplicita, dopo che era stata prima una costante fissa (5
 * minuti, poi 1). Come il PIN, la scelta vive SOLO in `localStorage`, per
 * dispositivo: non è un dato che ha senso sincronizzare, e scriverla in un
 * cookie non serve — a differenza di "un PIN è configurato" e "fino a
 * quando vale lo sblocco", il server non deve mai saperlo per decidere cosa
 * rendere.
 */
export const APP_LOCK_GRACE_OPTIONS_MS = [30_000, 60_000, 180_000, 300_000] as const;

export type AppLockGraceMs = (typeof APP_LOCK_GRACE_OPTIONS_MS)[number];

/** 1 minuto — quanto vale finché l'utente non sceglie diversamente. */
export const APP_LOCK_GRACE_DEFAULT_MS: AppLockGraceMs = 60_000;

const GRACE_STORAGE_KEY = "seichi-lock-grace-ms";

export function isAppLockGraceMs(value: number): value is AppLockGraceMs {
	return (APP_LOCK_GRACE_OPTIONS_MS as readonly number[]).includes(value);
}

/** `localStorage` può lanciare in navigazione privata: si ripiega sul default. */
export function readGraceMs(): AppLockGraceMs {
	try {
		const raw = Number(localStorage.getItem(GRACE_STORAGE_KEY));
		if (isAppLockGraceMs(raw)) return raw;
	} catch {
		// ignorabile
	}
	return APP_LOCK_GRACE_DEFAULT_MS;
}

export function writeGraceMs(ms: AppLockGraceMs) {
	try {
		localStorage.setItem(GRACE_STORAGE_KEY, String(ms));
	} catch {
		// ignorabile — al peggio la scelta non persiste e si ripiega sul default
	}
}

/**
 * Quanto restano PIENI e ROSSI i pallini dopo un PIN sbagliato prima di
 * svuotarsi da soli — non un timer a caso, è il ritmo del design: mostrare
 * l'errore (scossa CSS di 0.4s inclusa) abbastanza a lungo da essere letto,
 * poi lasciare campo libero al tentativo successivo senza indugiare.
 */
export const APP_LOCK_REJECT_DISPLAY_MS = 900;

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
	const until = Date.now() + readGraceMs();
	document.cookie = `${APP_LOCK_ACTIVE_UNTIL_COOKIE}=${until}${cookieAttrs()}`;
}

/**
 * Salva il PIN e accende il flag lato server — a fine impostazione o cambio.
 *
 * ⚠️ Ritorna `false` se `localStorage` ha rifiutato la scrittura, e in quel
 * caso NON accende il cookie. Trovato dal code-review: la versione
 * precedente accendeva comunque `seichi-lock-enabled`, quindi l'app si
 * bloccava lo stesso (fail-closed, corretto) ma `readStoredPin()` sarebbe
 * rimasta `null` per sempre — nessun PIN digitato può mai coincidere con
 * `null`, quindi l'utente restava chiuso fuori dalla propria app, senza
 * aver mai avuto un vero PIN da dimenticare. Meglio non promettere un
 * blocco che non può verificare nulla.
 */
export function savePin(pin: string): boolean {
	try {
		localStorage.setItem(PIN_STORAGE_KEY, pin);
	} catch {
		return false;
	}
	document.cookie = `${APP_LOCK_ENABLED_COOKIE}=1${cookieAttrs()}`;
	markActiveNow();
	return true;
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
