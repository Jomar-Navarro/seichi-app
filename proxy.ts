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
		 * Fase 25 (PWA) — aggiunte manifest.webmanifest, icon, apple-icon e il
		 * service worker: infrastruttura che il BROWSER richiede da sé (icone, il
		 * manifest, l'installazione/aggiornamento del service worker), non
		 * pagine su cui un utente naviga. Un controllo di sessione su queste
		 * richieste sarebbe overhead puro — lo stesso principio già scritto
		 * per _next/static/_next/image qui sopra — e per il service worker è
		 * peggio che overhead: se `getClaims()` fosse lento o la sessione
		 * scaduta, l'INSTALLAZIONE del service worker verrebbe rimandata su
		 * /welcome, e Serwist precacherebbe quella pagina al posto del
		 * service worker vero. `/~offline` invece PASSA da qui — è una pagina
		 * reale, resa a chiunque tramite PUBLIC_PATHS in lib/supabase/proxy.ts.
		 *
		 * #233 — il worker è `/sw.js` (con `/sw.js.map`), un file di `public/`
		 * generato in build: prima era la route `/serwist/[path]`. Escluso per
		 * nome intero e ancorato alla fine, perché un file di `public/` con
		 * un'estensione qualunque PASSA dal proxy: senza questa voce `/sw.js`
		 * andrebbe a /welcome, e il browser rifiuterebbe un worker rediretto.
		 *
		 * ⚠️ `icon`/`apple-icon` sono ANCORATI al confine di segmento
		 * (`(?=$|/)`), non prefissi nudi: senza l'ancora, un'ipotetica rotta
		 * futura che comincia per quelle lettere (es. `/icone-personalizzate`)
		 * salterebbe silenziosamente il controllo di sessione — lo stesso
		 * difetto, di un ordine di grandezza più subdolo, dei prefissi non
		 * ancorati che questo file evita altrove.
		 *
		 * #160 — `api/cron`: le chiama il cron di Vercel, che non ha sessione.
		 * Dal proxy riceverebbero un redirect a /welcome, cioè un 307 che per
		 * il cron è un «riuscito» senza aver controllato niente. Ognuna si
		 * autentica da sé con `CRON_SECRET` (regola 10: il proxy non è il
		 * perimetro). Ancorata come le altre.
		 */
		"/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon(?=$|/)|apple-icon(?=$|/)|sw\\.js(?:\\.map)?$|api/cron(?=$|/)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
