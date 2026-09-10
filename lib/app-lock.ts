/**
 * Blocco app con PIN (Fase 26a) e biometrico (Fase 26b) — issue #67.
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

/**
 * Rimuove il PIN e i due cookie: da qui in poi l'app non si blocca più su
 * questo dispositivo.
 *
 * ⚠️ Toglie anche il biometrico (Fase 26b), non solo il PIN. Il biometrico
 * vive SOTTO il PIN — è un secondo modo di soddisfare lo stesso cancello,
 * non un cancello a sé — quindi lasciarlo acceso senza un PIN che lo regga
 * sarebbe uno stato che non serve a nulla (senza `seichi-lock-enabled` il
 * velo non compare mai, la credenziale resterebbe solo a occupare spazio) e
 * che riapparirebbe "già attivo" se l'utente rimettesse un PIN in futuro,
 * senza aver mai rifatto la cerimonia con QUESTO nuovo PIN.
 */
export function clearPin() {
	try {
		localStorage.removeItem(PIN_STORAGE_KEY);
	} catch {
		// ignorabile — al peggio resta un valore locale che nessun cookie referenzia più
	}
	document.cookie = `${APP_LOCK_ENABLED_COOKIE}=; Path=/; Max-Age=0`;
	document.cookie = `${APP_LOCK_ACTIVE_UNTIL_COOKIE}=; Path=/; Max-Age=0`;
	clearBiometric();
}

/** Legge un cookie per nome — solo client, `document.cookie` non esiste sul server. */
export function readCookie(name: string): string | undefined {
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : undefined;
}

/* ------------------------------------------------------------- biometrico (Fase 26b) --- */

/**
 * Blocco biometrico — un SECONDO modo di soddisfare lo stesso cancello del
 * PIN (`isLockedFromCookies`), mai un cancello a sé. Per questo non esiste
 * un terzo cookie: il server continua a sapere solo "un PIN è configurato" e
 * "fino a quando vale lo sblocco" — è indifferente a COME l'utente ha
 * sbloccato l'ultima volta, PIN o biometria che sia. `markActiveNow()` è
 * infatti l'unica funzione chiamata da entrambi i percorsi di sblocco.
 *
 * ⚠️ **Nessuna verifica crittografica della firma**, per scelta esplicita
 * (issue #67, la stessa discussione già fatta per il PIN in chiaro): qui la
 * PROVA è che `navigator.credentials.get()` con `userVerification:
 * "required"` si sia risolta. Verificare la firma lato client contro una
 * chiave pubblica che quest'app stessa ha emesso e verifica nello stesso
 * contesto non difenderebbe da nessun attaccante compreso nel modello di
 * minaccia dichiarato — chi può eseguire codice arbitrario in questo
 * contesto può già chiamare `onUnlock()` direttamente, esattamente come può
 * già leggere `readStoredPin()` in chiaro. Aggiungerebbe solo il parsing
 * della chiave pubblica COSE e WebCrypto: complessità reale per una difesa
 * immaginaria, la stessa illusione già scartata per l'hash del PIN.
 *
 * Il vero cancello lo mette il sistema operativo: senza Face ID, Touch ID o
 * Windows Hello corretti la promise non si risolve affatto, e nessuna riga
 * di questo file può cambiarlo.
 *
 * ⚠️⚠️ **Contesto sicuro obbligatorio, e l'IP di LAN non lo è.** WebAuthn
 * funziona solo in un secure context: HTTPS, oppure `localhost`/`127.0.0.1`
 * per lo sviluppo. `http://192.168.x.x:3000` — l'indirizzo che questo
 * progetto usa per ogni collaudo da telefono dalla Fase 22 in poi — **non è
 * un secure context**, e `window.isSecureContext` lì vale `false`. È la
 * stessa classe di difetto già registrata per `crypto.randomUUID()` (Fase
 * 22): un'API disponibile solo in un contesto che il collaudo-da-telefono-
 * su-LAN di questo progetto non soddisfa. La prova vera del prompt
 * biometrico richiede un URL HTTPS reale (un preview Vercel, o prod) — non
 * la LAN. `isBiometricAvailable()` sotto lo esclude esplicitamente, così la
 * riga in `/impostazioni/blocco` dice il vero invece di mostrare un
 * interruttore che fallirebbe silenziosamente al primo tocco.
 */

const BIOMETRIC_CREDENTIAL_STORAGE_KEY = "seichi-app-biometric-credential-id";

function base64UrlEncode(bytes: ArrayBuffer): string {
	let binary = "";
	for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
	const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
	const binary = atob(padded);
	// `new Uint8Array(n)` sopra una `Uint8Array.from(...)` normale: quest'ultima
	// da sola torna `Uint8Array<ArrayBufferLike>`, e `PublicKeyCredentialDescriptor.id`
	// (WebAuthn) vuole `BufferSource` — che pretende un `ArrayBuffer` vero, non
	// un `ArrayBufferLike` generico. Solo un difetto dei tipi, non del dato.
	return new Uint8Array(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/**
 * Il dispositivo HA un lettore biometrico utilizzabile da WebAuthn, in QUESTO
 * contesto? Tre modi di essere "no", tutti trattati allo stesso modo: nessun
 * `window` (SSR), contesto non sicuro (vedi sopra), o l'OS/browser risponde
 * di non avere un platform authenticator — mai un'eccezione che risale fino
 * al chiamante.
 */
export async function isBiometricAvailable(): Promise<boolean> {
	if (typeof window === "undefined") return false;
	if (!window.isSecureContext) return false;
	if (typeof PublicKeyCredential === "undefined") return false;
	if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") return false;
	try {
		return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
	} catch {
		return false;
	}
}

/**
 * Perché `isBiometricAvailable()` ha detto "no" — SOLO per scegliere il
 * messaggio giusto, non per decidere niente.
 *
 * ⚠️ Trovato usando l'app vera da un iPhone 15: la riga diceva "non
 * disponibile su QUESTO DISPOSITIVO", che un iPhone con Face ID smentisce
 * all'istante — mandava a sospettare l'hardware quando la causa vera era
 * l'indirizzo aperto (`http://192.168.x.x:3000`, non un secure context).
 * È la stessa classe già corretta più volte in questo progetto: un
 * messaggio che manda a controllare la cosa sbagliata (`contoError()` nella
 * 20b, `avatarRemoveFailed` riusato per le ricevute nella 22).
 *
 * Sincrona e non parte di `isBiometricAvailable()`: il contesto sicuro si
 * legge subito, senza aspettare la Promise del browser, e i due fatti
 * possono essere veri insieme o no — non è un "else" del primo controllo.
 */
export function isInsecureContextForBiometric(): boolean {
	return typeof window !== "undefined" && !window.isSecureContext;
}

/** `localStorage` può lanciare in navigazione privata: trattato come "non attivo". */
export function hasBiometricCredential(): boolean {
	try {
		return localStorage.getItem(BIOMETRIC_CREDENTIAL_STORAGE_KEY) !== null;
	} catch {
		return false;
	}
}

/**
 * Registra una credenziale platform per QUESTO dispositivo — la cerimonia
 * `create()` di WebAuthn, che l'OS mostra con il proprio prompt biometrico
 * (attivarla è già di per sé la prova di possesso che serve, nessun'altra
 * conferma è necessaria prima di chiamarla).
 *
 * `challenge` e `user.id` sono byte casuali generati QUI, non da un server:
 * non c'è un server, e non ce n'è bisogno — vedi il commento in testa alla
 * sezione sul perché un round-trip di verifica non aggiungerebbe difesa
 * reale. `attestation: "none"` perché nessuno verificherà mai l'attestazione;
 * chiederla comunque sarebbe solo un prompt di privacy in più per l'utente.
 */
export async function registerBiometric(): Promise<boolean> {
	try {
		const credential = (await navigator.credentials.create({
			publicKey: {
				challenge: crypto.getRandomValues(new Uint8Array(32)),
				rp: { name: "Seichi" },
				user: {
					id: crypto.getRandomValues(new Uint8Array(16)),
					name: "blocco-seichi",
					displayName: "Blocco Seichi",
				},
				pubKeyCredParams: [
					{ type: "public-key", alg: -7 }, // ES256
					{ type: "public-key", alg: -257 }, // RS256 — ripiego per authenticator che non fanno ES256
				],
				authenticatorSelection: {
					authenticatorAttachment: "platform",
					userVerification: "required",
					residentKey: "discouraged",
				},
				attestation: "none",
				timeout: 60_000,
			},
		})) as PublicKeyCredential | null;
		if (!credential) return false;
		// ⚠️ Trovato dal code-review: la cerimonia può restare in sospeso fino a
		// 60s (il `timeout` qui sopra). Se nel frattempo il PIN è stato rimosso —
		// `clearPin()` chiama già `clearBiometric()`, vedi sopra — scrivere
		// comunque la credenziale resusciterebbe esattamente lo stato che
		// `clearPin()` esiste per impedire: biometrico attivo senza un PIN sotto.
		// L'invariante va garantita QUI, nel modulo che la dichiara, non solo dal
		// chiamante che oggi capita a mostrare l'interruttore solo a PIN acceso.
		if (!hasStoredPin()) return false;
		localStorage.setItem(BIOMETRIC_CREDENTIAL_STORAGE_KEY, base64UrlEncode(credential.rawId));
		return true;
	} catch {
		// L'utente ha annullato il prompt, l'ha fallito, o il browser/OS ha
		// rifiutato per un motivo suo (hardware assente, permesso negato…): in
		// ogni caso il PIN resta l'unico modo di sbloccare, che è già garantito.
		return false;
	}
}

/**
 * Chiede la cerimonia `get()` di WebAuthn sulla credenziale già registrata.
 * Ritorna `true` solo se l'OS ha davvero verificato l'utente (biometria o,
 * come ripiego dell'OS stesso, il PIN/password del dispositivo).
 */
export async function verifyBiometric(): Promise<boolean> {
	let storedId: string | null;
	try {
		storedId = localStorage.getItem(BIOMETRIC_CREDENTIAL_STORAGE_KEY);
	} catch {
		storedId = null;
	}
	if (!storedId) return false;
	try {
		const assertion = await navigator.credentials.get({
			publicKey: {
				challenge: crypto.getRandomValues(new Uint8Array(32)),
				allowCredentials: [{ id: base64UrlDecode(storedId), type: "public-key", transports: ["internal"] }],
				userVerification: "required",
				timeout: 60_000,
			},
		});
		return assertion != null;
	} catch {
		// Annullato, fallito, o non più disponibile (es. l'utente ha tolto
		// l'impronta dal sistema operativo dopo averla registrata qui): in
		// ogni caso si ricade sul PIN, che resta a schermo — mai un errore.
		return false;
	}
}

/** Toglie SOLO il biometrico, lasciando il PIN intatto — il comando dietro l'interruttore. */
export function clearBiometric(): void {
	try {
		localStorage.removeItem(BIOMETRIC_CREDENTIAL_STORAGE_KEY);
	} catch {
		// ignorabile — al peggio resta un riferimento locale a una credenziale
		// che l'app non chiederà mai più: innocuo, non è un dato nostro da pulire
	}
}
