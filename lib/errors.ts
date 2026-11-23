import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { fromConsoleArgs } from "@/lib/error-report";
import { queueReport } from "@/lib/error-sink";
import type { Dictionary } from "@/lib/i18n/dictionaries/it";

/**
 * Gli errori del server, tradotti per chi usa l'app (issue #124).
 *
 * ⚠️ **Il testo di Postgres, dello Storage o di GoTrue NON raggiunge mai
 * l'interfaccia.** Era restituito così com'era da 57 punti delle server action:
 * l'app in italiano mostrava `new row violates row-level security policy for
 * table "categories"`, cioè una frase in inglese che per giunta racconta la
 * forma dello schema. Ma non si butta nemmeno — finisce nei log del server,
 * perché è l'unica cosa che dice QUALE vincolo o quale query ha parlato. È la
 * regola di `contoError()` (20b), estesa a tutte le action.
 *
 * Fuori da un file `"use server"`: da là ogni funzione esportata diventerebbe
 * un'azione raggiungibile con una POST.
 */

/**
 * Il `console.error` del server, che in più manda l'errore a Sentry (#160).
 *
 * Prende gli STESSI argomenti, nella forma del progetto
 * (`"[scope] testo:", dettaglio`), e scrive nel log la stessa riga di prima:
 * la migrazione da `console.error` è una sostituzione del nome, niente altro.
 * Cosa parte verso Sentry lo decide `fromConsoleArgs()` + `buildEvent()`
 * (`lib/error-report.ts`): l'etichetta, il codice, il messaggio ripulito.
 *
 * ⚠️ **Ogni `console.error` del server passa da qui** (lezione 3: la
 * migrazione a campione). Restano `console.warn` le cose che non sono guasti
 * (claims scadute, `lib/auth.ts`), e `console.error` solo dentro
 * `lib/error-sink.ts`, dove un guasto di Sentry non deve riparlare a Sentry.
 */
export function logServerError(...args: unknown[]): void {
	console.error(...args);
	try {
		queueReport({ ...fromConsoleArgs(args), source: "server" });
	} catch {
		// riferire un errore non deve mai produrne un altro
	}
}

/** Un errore di PostgREST o dello Storage, o la stringa che `readAll` ne ha già estratto. */
type ServerError = { message: string; code?: string } | string;

/**
 * Registra l'errore e restituisce la frase generica del dizionario.
 *
 * È il caso comune: la causa vera di un guasto del database non è qualcosa che
 * l'utente possa correggere — un vincolo che scatta è un difetto nostro (i form
 * lo impediscono prima), una rete che cade si risolve riprovando. Dove una
 * causa SI può nominare in modo utile la frase la sceglie il chiamante, prima
 * di arrivare qui: `contoError()` per un conto altrui, i conteggi che bloccano
 * un'eliminazione, i codici di GoTrue qui sotto.
 *
 * `scope` è l'etichetta del log, nella forma che il progetto usa già
 * (`"categorie: creazione"` → `[categorie: creazione]`): con decine di punti che
 * rispondono la stessa frase, è ciò che distingue un guasto dall'altro.
 */
export function genericError(scope: string, error: ServerError, t: Dictionary): string {
	const detail = typeof error === "string" ? error : [error.code, error.message].filter(Boolean).join(" ");
	console.error(`[${scope}]`, detail);
	// A Sentry codice e messaggio separati: il codice è il raggruppamento.
	queueReport(
		typeof error === "string"
			? { scope, message: error, source: "server" }
			: { scope, code: error.code, message: error.message, source: "server" },
	);
	return t.common.genericError;
}

/** I codici di GoTrue che dicono "hai fatto troppe richieste". */
const RATE_LIMITED = new Set([
	"over_request_rate_limit",
	"over_email_send_rate_limit",
	"over_sms_send_rate_limit",
]);

/**
 * La frase per un errore di Supabase Auth.
 *
 * ⚠️ **Un guasto di rete non è una password sbagliata.** Il login traduceva ogni
 * errore di `signInWithPassword` in "credenziali errate": un servizio che non
 * risponde, un limite di frequenza e un'email non confermata — che diventerà il
 * caso normale riattivando *Confirm email* (#40) — mandavano tutti a ridigitare
 * una password giusta. Due cause diverse non possono avere lo stesso messaggio
 * solo perché arrivano dallo stesso `if (error)`.
 *
 * Il discrimine per la rete è `isAuthRetryableFetchError`, lo stesso di
 * `getSessionUser()` e del proxy: copre una richiesta che non parte e le
 * risposte 5xx del gateway, cioè tutto ciò che "riprova fra poco" risolve.
 *
 * Le frasi per le credenziali e per un indirizzo già usato le sceglie il
 * chiamante, perché cambiano col contesto: al login la password è "le
 * credenziali", in un cambio password è "la password attuale", e un indirizzo
 * già registrato è un invito ad accedere in una registrazione ma un rifiuto in
 * un cambio email.
 */
export function authErrorMessage(
	scope: string,
	error: AuthError,
	t: Dictionary,
	phrases: { wrongCredentials?: string; emailTaken?: string } = {},
): string {
	if (isAuthRetryableFetchError(error)) {
		logServerError(`[${scope}] servizio non raggiungibile:`, error.message);
		return t.errors.authUnavailable;
	}

	const code = error.code ?? "";
	if (error.status === 429 || RATE_LIMITED.has(code)) return t.errors.tooManyAttempts;

	/*
	 * Un server senza codici (versione dell'API precedente al 2024) risponde
	 * alle credenziali sbagliate con un 400 nudo: era l'unico caso in cui la
	 * frase di prima — "credenziali errate" per ogni errore — diceva il vero, e
	 * resta l'unico in cui la si deduce senza un codice.
	 */
	if (phrases.wrongCredentials && (code === "invalid_credentials" || (!code && error.status === 400))) {
		return phrases.wrongCredentials;
	}

	switch (code) {
		case "email_not_confirmed":
			return t.auth.errors.emailNotConfirmed;
		case "same_password":
			return t.errors.samePassword;
		case "weak_password":
			return t.errors.weakPassword;
		case "email_exists":
		case "user_already_exists":
			return phrases.emailTaken ?? t.errors.emailTaken;
		case "email_address_invalid":
			return t.errors.invalidEmail;
		case "signup_disabled":
			return t.auth.errors.signupDisabled;
	}

	return genericError(scope, { code, message: error.message }, t);
}
