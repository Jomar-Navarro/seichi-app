import { getSessionUser } from "@/lib/auth";
import { queueReport } from "@/lib/error-sink";

/**
 * Gli errori del browser verso Sentry (#160), passando dal server.
 *
 * Perché non direttamente dal browser a Sentry: Sentry vedrebbe l'IP di chi usa
 * l'app (un dato personale) e il DSN finirebbe nel bundle. Da qui parte con
 * l'IP di Vercel, e la ripulitura la fa `buildEvent()` sul server, nello
 * stesso modo per tutti.
 *
 * Perché una route e non una server action: Next spedisce le action una alla
 * volta (#150), e un rapporto d'errore in coda davanti al «salva» dell'utente
 * lo rallenterebbe. E `keepalive` fa arrivare anche il rapporto di una pagina
 * che si sta chiudendo.
 *
 * ⚠️ Solo per chi ha una sessione (regola 10: si autentica da sé, il proxy non è
 * il perimetro): una route aperta sarebbe un modo per chiunque di consumare la
 * quota di Sentry. Il limite dichiarato: gli errori delle pagine senza login
 * (welcome, sign, recupero password) non arrivano. Quelli del loro server sì,
 * da `onRequestError` e `logServerError()`.
 *
 * Il tetto di `error-sink.ts` (30 al minuto per istanza) vale anche qui, e il
 * browser ne ha uno suo (`lib/client-errors.ts`).
 */

const MAX_BODY = 16_000;

export async function POST(request: Request) {
	// Solo JSON: un <form> di un altro sito non può mandarlo senza preflight CORS.
	if (!request.headers.get("content-type")?.startsWith("application/json")) {
		return new Response(null, { status: 415 });
	}

	let user;
	try {
		user = await getSessionUser();
	} catch {
		// Auth non raggiungibile: lo registra già getSessionUser.
		return new Response(null, { status: 503 });
	}
	if (!user) return new Response(null, { status: 401 });

	const text = await request.text();
	if (text.length > MAX_BODY) return new Response(null, { status: 413 });

	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return new Response(null, { status: 400 });
	}
	const b = body as Record<string, unknown>;
	const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
	const scope = str(b.scope, 80);
	const message = str(b.message, 2_000);
	if (!scope || !message) return new Response(null, { status: 400 });

	queueReport({
		scope,
		message,
		code: str(b.code, 64),
		stack: str(b.stack, 8_000),
		route: str(b.path, 500),
		source: "client",
	});
	return new Response(null, { status: 204 });
}
