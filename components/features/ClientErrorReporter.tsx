"use client";

import { useEffect } from "react";
import { sendClientReport } from "@/lib/client-errors";

/**
 * Gli errori del browser che nessuno ha preso (#160): eccezioni non gestite e
 * promise rifiutate senza `catch`. Prima finivano nella console del telefono di
 * chi usava l'app, cioè da nessuna parte.
 *
 * Montato nel layout di `(main)`, quindi solo nell'app autenticata: è lì che
 * `/api/errori` accetta i rapporti. Non disegna niente.
 *
 * Gli errori di render presi dal confine di `(main)/error.tsx` non arrivano qui
 * (React li consegna al confine, non a `window`): li riferisce lui.
 *
 * Si scartano gli errori che non sono nostri: uno script di un'estensione del
 * browser (file di un'altra origine) e «Script error.», l'errore muto che il
 * browser dà per uno script esterno senza CORS.
 */
export default function ClientErrorReporter() {
	useEffect(() => {
		const onError = (e: ErrorEvent) => {
			if (e.filename && !e.filename.startsWith(window.location.origin)) return;
			if (!e.error && /^Script error\.?$/.test(e.message)) return;
			sendClientReport({
				scope: "browser",
				message: e.error instanceof Error ? `${e.error.name}: ${e.error.message}` : e.message,
				stack: e.error instanceof Error ? e.error.stack : undefined,
			});
		};
		const onRejection = (e: PromiseRejectionEvent) => {
			const r = e.reason;
			sendClientReport({
				scope: "browser: promise",
				message: r instanceof Error ? `${r.name}: ${r.message}` : String(r),
				stack: r instanceof Error ? r.stack : undefined,
			});
		};
		window.addEventListener("error", onError);
		window.addEventListener("unhandledrejection", onRejection);
		return () => {
			window.removeEventListener("error", onError);
			window.removeEventListener("unhandledrejection", onRejection);
		};
	}, []);

	return null;
}
