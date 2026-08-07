import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * L'identità dell'utente per questa richiesta, letta dalle CLAIMS del JWT.
 *
 * ⚠️ Non è un `User` di Supabase, ed è deliberato: contiene solo ciò che il token
 * porta davvero con sé. Un tipo più largo inviterebbe a leggere campi che nelle
 * claims non ci sono (`created_at`, `identities`, i metadati aggiornati) e che
 * sarebbero `undefined` in silenzio.
 */
export type SessionUser = {
	id: string;
	email: string;
	/**
	 * I provider collegati all'account (`app_metadata.providers`). È l'equivalente
	 * di `user.identities.map(i => i.provider)`, che nel JWT non c'è.
	 */
	providers: string[];
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
	const { data } = await supabase.auth.getClaims();
	const claims = data?.claims;

	if (!claims?.sub) return null;

	return {
		id: claims.sub,
		// `email` è opzionale nelle claims (un utente può esistere col solo
		// telefono). Chi ha bisogno di un indirizzo vero deve controllarlo.
		email: typeof claims.email === "string" ? claims.email : "",
		providers: claims.app_metadata?.providers ?? [],
	};
});
