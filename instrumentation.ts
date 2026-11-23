import type { Instrumentation } from "next";
import { sendReport } from "@/lib/error-sink";

/**
 * Gli errori che Next cattura da sé (#160): un server component che solleva,
 * un'action o una route che lancia, il proxy. Sono quelli che finiscono su
 * `(main)/error.tsx` o sulla pagina d'errore di Next, e che nessuna nostra
 * `catch` ha visto (node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/instrumentation.md).
 *
 * Il `digest` è il filo che li lega al browser: il client vede solo quello, e
 * `error.tsx` per questo non li riferisce una seconda volta.
 *
 * `routePath` è la rotta come FILE (`/conti/[id]`), non l'URL: niente id né
 * query string. Della richiesta non si legge altro: header e cookie restano
 * qui. L'attesa è voluta: la documentazione vuole i lavori asincroni attesi.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, _request, context) => {
	const e = err instanceof Error ? err : new Error(String(err));
	const digest = (err as { digest?: unknown })?.digest;
	await sendReport({
		scope: `next: ${context.routeType}`,
		code: typeof digest === "string" ? digest : undefined,
		message: `${e.name}: ${e.message}`,
		stack: e.stack,
		route: context.routePath,
		source: "next",
	});
};
