/**
 * Gli errori dei download dell'export, portati dall'URL (#162).
 *
 * I due comandi di `/impostazioni/esporta` (CSV e archivio) sono `<a>` nudi:
 * il browser NAVIGA verso la rotta. Finché la rotta rispondeva a un errore con
 * del testo, il browser mostrava quel testo su una pagina bianca, e nella PWA
 * installata su iOS — senza barra e senza tasto indietro — l'utente restava
 * chiuso fuori dall'app.
 *
 * Ora la rotta risponde a ogni errore con un 303 verso la pagina dell'export,
 * con un CODICE nell'URL, e la pagina compone la frase dal dizionario accanto
 * al comando giusto. ⚠️ L'URL porta un codice di un elenco chiuso, MAI una
 * frase: un testo letto dall'URL sarebbe un testo che chiunque può far
 * comparire dentro l'app con un link (CLAUDE.md, «nessun testo del server
 * arriva a schermo»). Un codice sconosciuto si ignora.
 *
 * La sessione scaduta resta un rinvio a `/sign`: là la soluzione è rientrare.
 */

/** Il comando da cui è partito il download: decide DOVE compare l'avviso. */
export const EXPORT_TARGETS = ["csv", "archivio"] as const;
export type ExportTarget = (typeof EXPORT_TARGETS)[number];

/**
 * Le cause, una per messaggio (CLAUDE.md, lezione 8: due cause, due messaggi).
 * - `filtro`: un filtro malformato o non dell'utente (solo CSV);
 * - `limite`: il tetto di frequenza, con l'attesa;
 * - `lettura`: una lettura o il contatore del tetto non hanno risposto;
 * - `troppo-grande`: oltre i limiti di uno ZIP senza ZIP64 (solo archivio);
 * - `rete`: il servizio di autenticazione non risponde (solo archivio, che
 *   legge l'utente vivo).
 */
export const EXPORT_ERROR_CODES = ["filtro", "limite", "lettura", "troppo-grande", "rete"] as const;
export type ExportErrorCode = (typeof EXPORT_ERROR_CODES)[number];

export type ExportError =
	| { target: ExportTarget; code: Exclude<ExportErrorCode, "limite"> }
	| { target: ExportTarget; code: "limite"; wait: number };

/**
 * Quali cause può produrre ciascun comando. Un URL scritto a mano con un
 * codice dell'altro comando («troppo grande» sotto il CSV) si ignora: la frase
 * accanto a un comando deve essere una che quel comando può dire.
 */
const CODES_BY_TARGET: Record<ExportTarget, readonly ExportErrorCode[]> = {
	csv: ["filtro", "limite", "lettura"],
	archivio: ["limite", "lettura", "troppo-grande", "rete"],
};

/** La pagina dell'export, dove l'errore si legge. */
export const EXPORT_PAGE = "/impostazioni/esporta";

/**
 * L'attesa più lunga che si accetta dall'URL: 24 ore, la finestra più lunga
 * dei tetti. Un numero più grande è un URL scritto a mano, non un tetto vero.
 */
const MAX_WAIT_SECONDS = 24 * 60 * 60;

/**
 * Il percorso (relativo) a cui la rotta rinvia per un errore.
 *
 * ⚠️ L'ancora (`#csv`, `#archivio`) porta lo schermo sul comando che ha
 * fallito. Senza, il rinvio ricarica la pagina DALL'INIZIO: chi era sceso in
 * fondo a toccare «Scarica l'archivio» si ritrovava in cima, con l'avviso fuori
 * schermo sotto la BottomNav, e sembrava che non fosse successo niente
 * (trovato nel collaudo dell'app vera: `toBeVisible()` non guarda lo schermo).
 * L'ancora da sola non è bastata (il browser a volte non scorre, sotto
 * carico): lo scorrimento sicuro lo fa `ForgetExportError` dopo
 * l'idratazione; l'ancora resta per il caricamento senza JavaScript.
 */
export function exportErrorPath(error: ExportError): string {
	const params = new URLSearchParams({ errore: error.code, per: error.target });
	if (error.code === "limite") params.set("attesa", String(error.wait));
	return `${EXPORT_PAGE}?${params.toString()}#${error.target}`;
}

/** Il primo valore di un parametro di `searchParams`. */
function first(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

/**
 * L'errore dichiarato dall'URL, o `null` se non c'è o non si riconosce.
 *
 * ⚠️ Un `limite` senza un'attesa valida (un intero fra 1 e 24 ore) si scarta
 * per intero: dire «riprova fra NaN minuti» o un tempo inventato sarebbe peggio
 * di non dire niente — ed è un URL che l'app non produce mai.
 */
export function parseExportError(params: Record<string, string | string[] | undefined>): ExportError | null {
	const code = first(params.errore);
	const target = first(params.per);
	if (!target || !(EXPORT_TARGETS as readonly string[]).includes(target)) return null;
	if (!code || !(EXPORT_ERROR_CODES as readonly string[]).includes(code)) return null;
	const t = target as ExportTarget;
	if (!CODES_BY_TARGET[t].includes(code as ExportErrorCode)) return null;
	if (code !== "limite") return { target: t, code: code as Exclude<ExportErrorCode, "limite"> };

	const raw = first(params.attesa) ?? "";
	if (!/^[1-9]\d{0,5}$/.test(raw)) return null;
	const wait = Number(raw);
	if (wait > MAX_WAIT_SECONDS) return null;
	return { target: t, code: "limite", wait };
}
