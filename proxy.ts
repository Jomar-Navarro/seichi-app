import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
	// update user's auth session
	return await updateSession(request);
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * Feel free to modify this pattern to include more paths.
		 *
		 * Fase 25 (PWA) — aggiunte manifest.webmanifest, icon, apple-icon,
		 * serwist: infrastruttura che il BROWSER richiede da sé (icone, il
		 * manifest, l'installazione/aggiornamento del service worker), non
		 * pagine su cui un utente naviga. Un controllo di sessione su queste
		 * richieste sarebbe overhead puro — lo stesso principio già scritto
		 * per _next/static/_next/image qui sopra — e per il service worker è
		 * peggio che overhead: se `getClaims()` fosse lento o la sessione
		 * scaduta, l'INSTALLAZIONE del service worker verrebbe rimandata su
		 * /welcome, e Serwist precacherebbe quella pagina al posto del
		 * service worker vero. `/~offline` invece PASSA da qui — è una pagina
		 * reale, resa a chiunque tramite PUBLIC_PATHS in lib/supabase/proxy.ts.
		 */
		"/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|serwist|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
