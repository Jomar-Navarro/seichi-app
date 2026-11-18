import { NextResponse, type NextRequest } from "next/server";
import { exportErrorPath, type ExportError } from "./download-error";

/**
 * La risposta a un errore dei download dell'export (#162): un 303 verso la
 * pagina dell'export, con il codice nell'URL. Mai un testo: i comandi sono
 * `<a>` nudi, e un testo diventerebbe una pagina bianca senza via d'uscita
 * nella PWA installata. Il perché per intero: `download-error.ts`.
 *
 * 303 e non 307: il browser deve tornare alla pagina con una GET, qualunque
 * sia il metodo arrivato. `no-store` come le risposte riuscite: l'URL porta
 * lo stato di un account.
 */
export function exportErrorRedirect(req: NextRequest, error: ExportError): NextResponse {
	const res = NextResponse.redirect(new URL(exportErrorPath(error), req.url), 303);
	res.headers.set("Cache-Control", "private, no-store");
	return res;
}
