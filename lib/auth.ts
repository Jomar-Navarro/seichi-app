import { cache } from "react";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/server";

/**
 * L'identità dell'utente per questa richiesta, letta dalle CLAIMS del JWT.
 *
 * ⚠️ **Un `User` di Supabase è VIVO, questo è una FOTOGRAFIA.** È la differenza
 * che conta, e il tipo è volutamente minuscolo per renderla difficile da
 * dimenticare: un token emesso mezz'ora fa descrive l'account di mezz'ora fa.
 *
 * ⚠️ **`providers` NON sta qui, ed è una rimozione deliberata.** C'era, letto da
 * `app_metadata.providers`, e alimentava `hasPasswordIdentity` — mentre
 * `deleteAccount()` calcolava lo stesso predicato da `user.identities` di una
 * `getUser()` fresca. Due derivazioni della stessa domanda nello stesso flusso,
 * che concordavano per fortuna e non per costruzione. Chi ha bisogno dei
 * provider ha bisogno di quelli di ADESSO: si passa da `auth.getUser()`.
 */
export type SessionUser = {
	/**
	 * L'unico campo su cui appoggiarsi senza riserve: `sub` non cambia mai per un
	 * account, quindi non può diventare stantio. Ed è anche ciò che la RLS usa.
	 */
	id: string;
	/**
	 * ⚠️ **L'indirizzo AL MOMENTO DELL'EMISSIONE DEL TOKEN, non quello attuale.**
	 * Va bene solo per DISEGNARE (iniziali dell'avatar, nome di ripiego). Mai per
	 * un confronto di identità, una riautenticazione o una conferma.
	 *
	 * Dopo un cambio email confermato resta il valore VECCHIO fino alla scadenza
	 * dell'access token: `/email-confermata` non è un flusso PKCE, non scambia
	 * alcun `code` e quindi non rinnova la sessione — e `getSession()` rinnova
	 * solo un token già scaduto, non uno che sta per esserlo.
	 *
	 * È già costato un difetto: la conferma di eliminazione account confrontava
	 * questo valore con quello di `auth.getUser()`, e con i due disallineati
	 * l'account diventava **impossibile da eliminare** — l'indirizzo nuovo non
	 * sbloccava il pulsante, quello vecchio veniva rifiutato dal server.
	 */
	email: string;
};

/**
 * L'utente della richiesta corrente — **senza toccare la rete**.
 *
 * ## Perché non `auth.getUser()`
 *
 * `getUser()` non legge il cookie: fa una `GET /auth/v1/user` verso GoTrue a
 * ogni singola invocazione, e non memoizza nulla. Siccome ogni loader apriva il
 * proprio client e ripeteva il proprio controllo, una vista della home costava
 * **cinque** chiamate HTTP per ottenere cinque volte la stessa risposta, in
 * parallelo, dentro lo stesso render.
 *
 * `getClaims()` invece verifica la firma del token **in locale** con WebCrypto,
 * perché questo progetto usa chiavi JWT asimmetriche (ES256 — si controlla su
 * `/auth/v1/.well-known/jwks.json`). Il JWKS sta in una cache di modulo di
 * `auth-js` (`GLOBAL_JWKS`), quindi si scarica una volta per processo, non per
 * client. Costo di rete a regime: zero.
 *
 * ⚠️ Se il progetto tornasse a un segreto simmetrico HS256, `getClaims()`
 * ripiegherebbe **da solo** su `getUser()` — nessun errore, nessun avviso, e
 * ogni chiamata tornerebbe a essere una richiesta di rete. Il risparmio dipende
 * dal tipo di chiave, non da questo file.
 *
 * ## Perché `cache()`
 *
 * Dedupa per richiesta: i cinque loader della home condividono un solo decode.
 * Fuori da un render (per esempio dentro una server action) React non memoizza,
 * ma là il controllo si fa comunque una volta sola, quindi non cambia nulla.
 *
 * ## Il compromesso, per intero
 *
 * Le claims dicono che il token è **autentico e non scaduto**, non che la
 * sessione sia ancora viva: un logout altrove non si vede fino alla scadenza
 * dell'access token. Non è una perdita reale, perché è la stessa garanzia che
 * offre già il resto dello stack — PostgREST valida quello stesso JWT allo
 * stesso modo, quindi le policy RLS non avrebbero comunque visto la revoca.
 *
 * Dove la garanzia deve essere più forte — cambio email, cambio password,
 * eliminazione account, reimpostazione dopo il recupero — si continua a usare
 * `auth.getUser()`, che interroga il server. Là il costo di rete è irrilevante
 * (una chiamata per azione, non cinque per render) ed è esattamente ciò che si
 * sta comprando.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
	const supabase = await createClient();
	const { data, error } = await supabase.auth.getClaims();

	/*
	 * ⚠️ **"Non lo so" non è "non sei autenticato".** L'`error` va guardato, o un
	 * guasto passeggero si traveste da logout: `getClaims()` fallisce anche
	 * quando non riesce a scaricare il JWKS, quando WebCrypto non c'è, o quando
	 * il ripiego a `/auth/v1/user` non risponde. Ignorandolo, un utente con un
	 * token perfettamente valido veniva spedito su /sign da `getAccountContext()`
	 * a fronte di un singolo pacchetto perso, senza che nulla finisse nei log.
	 *
	 * Perciò i due casi si separano, e il discrimine è il tipo dell'errore:
	 *   - rete/infrastruttura → si SOLLEVA. La pagina mostra un errore, che è
	 *     recuperabile: l'utente ricarica e rientra. Un logout no — richiede di
	 *     ridigitare le credenziali per un guasto che non lo riguarda.
	 *   - token assente, scaduto o non valido → `null`, perché lì "non
	 *     autenticato" è davvero la risposta giusta.
	 *
	 * NB: il caso comune del visitatore sloggato NON passa di qui. Senza cookie
	 * `getSession()` restituisce `session: null` **senza errore**, quindi il ramo
	 * non scatta e il log resta silenzioso — si accende solo per le anomalie.
	 */
	if (error) {
		if (isAuthRetryableFetchError(error)) {
			console.error("[auth] getClaims non raggiungibile:", error.message);
			throw error;
		}
		console.warn("[auth] claims non valide:", error.message);
		return null;
	}

	const claims = data?.claims;

	if (!claims?.sub) return null;

	return {
		id: claims.sub,
		// `email` è opzionale nelle claims (un utente può esistere col solo
		// telefono). Vedi l'avvertenza sul tipo: è una fotografia, serve a
		// disegnare e a nient'altro.
		email: typeof claims.email === "string" ? claims.email : "",
	};
});

/**
 * L'apertura di ogni server action che legge dati: client, utente e dizionario.
 *
 * ⚠️ **Esiste per avere UN posto da cambiare, non per risparmiare righe.** Quelle
 * quattro righe stavano copiate identiche in una ventina di action su sei file, e
 * in un solo giorno hanno dovuto cambiare due volte — prima per passare alle
 * claims, poi per gestire l'errore di `getClaims()`. Ogni volta è stata una
 * modifica a tappeto in cui **applicarla a metà non si vede**: è la stessa
 * "migrazione a campione" che la sezione Fase 18 di questo progetto descrive
 * come il modo tipico in cui i difetti entrano di soppiatto.
 *
 * Il dizionario arriva insieme perché ogni chiamante lo usa subito dopo, per il
 * messaggio di "non autenticato": tenerlo fuori avrebbe lasciato metà del
 * preambolo duplicato, cioè non avrebbe risolto niente.
 *
 * ⚠️ **Non è la stessa cosa di `requireLiveUser()`** in
 * `impostazioni/account/actions.ts`. Quella interroga il server e restituisce
 * l'utente VIVO, e i due nomi sono diversi apposta: le operazioni sensibili
 * sull'account non possono lavorare su una fotografia.
 */
export async function requireUser() {
	const supabase = await createClient();
	// Il dizionario non dipende dall'utente: si carica in parallelo.
	const [user, t] = await Promise.all([getSessionUser(), getDictionary()]);
	return { supabase, user, t };
}
