import { createServerClient } from "@supabase/ssr";
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
	const { data } = await supabase.auth.getClaims();

	const user = data?.claims;

	const isPublic = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

	if (!user && !isPublic) {
		const url = request.nextUrl.clone();
		url.pathname = "/welcome";
		const redirect = NextResponse.redirect(url);

		/*
		 * ⚠️ I cookie di `supabaseResponse` vanno RICOPIATI, non abbandonati.
		 *
		 * `getClaims()` può aver ruotato il refresh token — che è monouso — e
		 * scritto le credenziali nuove su `supabaseResponse` dentro `setAll`.
		 * Questa è una risposta creata da zero: senza il travaso, quel rinnovo
		 * viene buttato e il browser resta con il token vecchio, ormai consumato.
		 *
		 * Il difetto si vede solo sotto CONCORRENZA, ed è per questo che si
		 * manifesta all'hard refresh: la pagina e i prefetch RSC della BottomNav
		 * partono insieme, uno solo vince la rotazione e gli altri arrivano con il
		 * token già bruciato. Rispondendo con un redirect nudo, quelli cancellano
		 * anche il cookie buono appena scritto dal primo, e il giro ricomincia.
		 *
		 * Conseguenza a valle: un prefetch RSC che riceve un redirect inatteso fa
		 * ripiegare il client su una navigazione piena del browser — cioè il
		 * ricaricamento ripetuto della stessa pagina.
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
