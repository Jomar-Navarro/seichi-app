import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Percorsi raggiungibili senza sessione. Il recupero password ci deve stare:
 * chi ha dimenticato la password è per definizione sloggato, e senza questa
 * voce il link ricevuto via email finirebbe su /welcome.
 */
const PUBLIC_PATHS = [
	"/auth",
	"/sign",
	"/callback",
	"/welcome",
	"/error",
	"/recupera-password",
	"/reimposta-password",
	// Il link di conferma cambio email può essere aperto da un browser dove non
	// c'è sessione (client di posta, altro dispositivo)
	"/email-confermata",
];

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	/*
	 * Gli header che `@supabase/ssr` impone accanto ai cookie di sessione:
	 * `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`,
	 * `Expires: 0`, `Pragma: no-cache`.
	 *
	 * ⚠️ Vanno TENUTI DA PARTE, non solo applicati a `supabaseResponse`. La
	 * documentazione della libreria è esplicita sul perché: *"Responses that set
	 * auth cookies must not be cached by CDNs or reverse proxies, otherwise one
	 * user's session token can be served to a different user."* Il ramo di
	 * redirect qui sotto costruisce una risposta NUOVA, e prima copiava solo i
	 * cookie: usciva un 307 con dei token di sessione in `Set-Cookie` e nessuna
	 * direttiva di cache — esattamente la forma che la libreria dice di non
	 * produrre mai.
	 */
	let authHeaders: Record<string, string> = {};

	// With Fluid compute, don't put this client in a global environment
	// variable. Always create a new one on each request.
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet, headers) {
					cookiesToSet.forEach(({ name, value }) =>
						request.cookies.set(name, value),
					);
					supabaseResponse = NextResponse.next({
						request,
					});
					cookiesToSet.forEach(({ name, value, options }) =>
						supabaseResponse.cookies.set(name, value, options),
					);
					authHeaders = { ...authHeaders, ...headers };
					Object.entries(headers).forEach(([key, value]) =>
						supabaseResponse.headers.set(key, value),
					);
				},
			},
		},
	);

	// Do not run code between createServerClient and
	// supabase.auth.getClaims(). A simple mistake could make it very hard to debug
	// issues with users being randomly logged out.

	// IMPORTANT: If you remove getClaims() and you use server-side rendering
	// with the Supabase client, your users may be randomly logged out.
	const { data, error } = await supabase.auth.getClaims();

	/*
	 * ⚠️ **Un guasto di rete non è un logout, e qui la differenza si vedeva.**
	 *
	 * L'`error` veniva scartato, quindi un JWKS irraggiungibile o un GoTrue lento
	 * finivano nello stesso cesto di "token non valido": l'utente, con una
	 * sessione perfettamente buona, veniva spedito su /welcome. Un redirect è una
	 * **affermazione** — dice "non sei autenticato" — e lì era falsa.
	 *
	 * Su un guasto passeggero si lascia passare la richiesta. Non è un buco:
	 * il proxy è una comodità di navigazione, NON il perimetro di sicurezza.
	 * Quello sono la RLS sul database e il controllo che ogni pagina e ogni
	 * action rifanno per conto proprio — necessario comunque, perché una server
	 * action è raggiungibile con una POST diretta. A valle `getSessionUser()`
	 * incontrerà lo stesso guasto e solleverà, quindi si vede una pagina di
	 * errore: sgradevole ma **vera e ricaricabile**, invece di un logout che
	 * mente e costringe a ridigitare le credenziali.
	 */
	if (error && isAuthRetryableFetchError(error)) {
		console.error("[proxy] getClaims non raggiungibile:", error.message);
		return supabaseResponse;
	}

	const user = data?.claims;

	const isPublic = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

	if (!user && !isPublic) {
		const url = request.nextUrl.clone();
		url.pathname = "/welcome";
		const redirect = NextResponse.redirect(url);

		/*
		 * ⚠️ I cookie di `supabaseResponse` vanno RICOPIATI, non abbandonati —
		 * ma il motivo NON è quello che diceva la versione precedente di questo
		 * commento, e vale la pena scriverlo giusto perché la differenza cambia
		 * il giudizio su cosa fa questo blocco.
		 *
		 * Il commento vecchio parlava di "salvare la rotazione". **Quella non
		 * passa quasi mai di qui**: se il refresh riesce, `getClaims()` torna le
		 * claims, `user` è valorizzato e la funzione esce dall'altro ramo. E
		 * sosteneva che un redirect nudo "cancellasse il cookie buono": un
		 * `NextResponse.redirect()` senza `Set-Cookie` non cancella nulla — non
		 * ha alcun header con cui farlo.
		 *
		 * Ciò che davvero arriva qui è l'opposto: il refresh è FALLITO, auth-js
		 * ha dismesso la sessione e `setAll` ha scritto delle CANCELLAZIONI.
		 * Inoltrarle è la cosa giusta — il token è morto, e ripulire impedisce al
		 * browser di ripresentarlo a ogni richiesta successiva. Abbandonarle
		 * lasciava cookie zombie che facevano ritentare un refresh destinato a
		 * fallire per sempre.
		 *
		 * ⚠️ Il rischio residuo, dichiarato: sotto concorrenza una richiesta che
		 * perde la corsa potrebbe cancellare i cookie buoni appena scritti da una
		 * sorella. È mitigato **da GoTrue, non da questo codice** — il
		 * *refresh token reuse interval* (10 secondi di default) fa sì che le
		 * richieste parallele con lo stesso refresh token ricevano tutte la
		 * STESSA sessione nuova invece di un errore: esiste esattamente per il
		 * burst di prefetch dell'hard refresh. Oltre quella finestra un
		 * fallimento significa che il token è morto davvero, e allora cancellare
		 * è corretto. Se un giorno quell'intervallo venisse portato a 0 nelle
		 * impostazioni Auth del progetto, questo blocco va rivisto.
		 */
		supabaseResponse.cookies.getAll().forEach((cookie) => {
			redirect.cookies.set(cookie);
		});

		// I cookie senza le loro direttive di cache sono la metà pericolosa del
		// travaso: una risposta con `Set-Cookie` di sessione e nessun `no-store`
		// è memorizzabile da un CDN, e il token finirebbe a un altro utente.
		Object.entries(authHeaders).forEach(([key, value]) => {
			redirect.headers.set(key, value);
		});

		return redirect;
	}

	// IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
	// creating a new response object with NextResponse.next() make sure to:
	// 1. Pass the request in it, like so:
	//    const myNewResponse = NextResponse.next({ request })
	// 2. Copy over the cookies, like so:
	//    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
	// 3. Change the myNewResponse object to fit your needs, but avoid changing
	//    the cookies!
	// 4. Finally:
	//    return myNewResponse
	// If this is not done, you may be causing the browser and server to go out
	// of sync and terminate the user's session prematurely!

	return supabaseResponse;
}
