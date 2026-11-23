import { fromConsoleArgs } from "@/lib/error-report";

/**
 * Il `console.error` del browser, che in più manda l'errore a Sentry passando
 * da `/api/errori` (#160). Gli stessi argomenti di `console.error`, nella forma
 * del progetto (`"[scope] testo:", dettaglio`): la migrazione è una
 * sostituzione del nome.
 *
 * ⚠️ Riferire non deve mai produrre un altro errore né rallentare niente: la
 * richiesta parte senza attenderla, un suo fallimento si inghiotte (niente
 * `console.error` qui dentro, o un Sentry irraggiungibile parlerebbe di sé
 * all'infinito).
 *
 * Un tetto per pagina: 10 rapporti, e mai due volte lo stesso. Un errore in un
 * ciclo di render ne produrrebbe centinaia uguali.
 */

const MAX_PER_PAGE = 10;
let sent = 0;
const seen = new Set<string>();

/**
 * ⚠️ Gli errori di RETE del browser non partono: dicono che il telefono ha
 * perso la connessione, o che una pagina è stata lasciata mentre caricava
 * (una richiesta interrotta arriva a `error.tsx` come `TypeError: network
 * error`), non che Seichi ha un difetto. Visto nell'end-to-end della #160:
 * con tre scenari in parallelo, la home abbandonata a metà caricamento ne
 * mandava uno o due a ogni giro. Un server davvero giù lo dicono i suoi log e
 * healthchecks, non il browser. Restano nella console.
 * I messaggi sono quelli dei tre motori: Chromium, Firefox, WebKit.
 */
const NETWORK_FAILURE =
	/TypeError: (network error|Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed|The network connection was lost\.?)$/i;

export function sendClientReport(report: { scope: string; message: string; code?: string; stack?: string }): void {
	if (typeof window === "undefined") return;
	if (NETWORK_FAILURE.test(report.message)) return;
	const key = `${report.scope}|${report.message}`;
	if (sent >= MAX_PER_PAGE || seen.has(key)) return;
	sent++;
	seen.add(key);
	try {
		void fetch("/api/errori", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ ...report, path: window.location.pathname }),
			keepalive: true,
		}).catch(() => {});
	} catch {
		// niente: vedi sopra
	}
}

export function logClientError(...args: unknown[]): void {
	console.error(...args);
	try {
		sendClientReport(fromConsoleArgs(args));
	} catch {
		// niente: vedi sopra
	}
}
