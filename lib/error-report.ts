/**
 * Gli errori di produzione verso Sentry (#160), come funzioni pure.
 *
 * ⚠️⚠️ **Il contenuto si sceglie per elenco, non per filtro.** L'SDK ufficiale
 * manda tutto — header, cookie, breadcrumb con gli URL e i log della console —
 * e chiede di togliere ciò che si teme. Qui l'evento lo costruiamo noi, e porta
 * SOLO: l'etichetta del log (`scope`), il codice, il messaggio ripulito, il
 * percorso della pagina senza id né query string, la pila delle chiamate, la
 * versione. Niente utente, niente IP, niente corpo della richiesta.
 *
 * La ripulitura (`scrub`) è la seconda difesa, per ciò che il messaggio stesso
 * può contenere. Postgres e PostgREST mettono i VALORI tra virgolette
 * (`invalid input syntax for type uuid: "…"`) e gli identificatori pure
 * (`violates check constraint "transactions_amount_check"`): si tiene il
 * secondo e si toglie il primo. Si tolgono sempre email, UUID, token e numeri.
 * Il limite, dichiarato: un testo libero dell'utente SENZA virgolette, dentro
 * un messaggio scritto da noi, non si riconosce. Le `raise` dell'app non ne
 * scrivono (interpolano solo un periodo o un'azione), e un `throw` nostro non
 * deve farlo.
 *
 * Il formato è quello «envelope» di Sentry, documentato e stabile:
 * https://develop.sentry.dev/sdk/data-model/envelopes/
 */

/** Dove nasce l'errore: nel server dell'app, in Next fuori dalle nostre `catch`, nel browser. */
export type ErrorSource = "server" | "next" | "client";

export type ErrorReport = {
	/** L'etichetta del log, senza parentesi: `transactions`, `attachments`. */
	scope: string;
	/** SQLSTATE, codice di GoTrue o di PostgREST, `digest` di Next. Facoltativo. */
	code?: string;
	/** Il messaggio grezzo: lo ripulisce `buildEvent()`. */
	message: string;
	source: ErrorSource;
	/** Il percorso della pagina o la rotta (`/conti/[id]`): lo ripulisce `buildEvent()`. */
	route?: string;
	/** La pila dell'errore, se c'è. */
	stack?: string;
};

/** Le relazioni dello schema: tra virgolette sono identificatori, non dati. */
const RELATIONS = new Set([
	"transactions",
	"categories",
	"accounts",
	"profiles",
	"budgets",
	"notifications",
	"imports",
	"attachments",
	"recurring_rules",
	"job_runs",
	"rate_events",
	"objects",
	"buckets",
]);

const MAX_MESSAGE = 500;

/**
 * Toglie da un testo ciò che può essere un dato dell'utente.
 *
 * L'ordine conta: l'email e l'UUID prima dei numeri (o diventerebbero pezzi
 * di `<n>`), le virgolette dopo, così un valore tra virgolette già ridotto a
 * `<uuid>` resta leggibile come «un UUID».
 *
 * ⚠️ Virgolette e numeri in UN passaggio solo. In due, la regola dei numeri
 * passava anche dentro l'identificatore appena tenuto: `"e2e_guasto_160"`
 * diventava `"e<n>e_guasto_<n>"`, cioè il nome del vincolo — l'unica cosa che
 * dice quale guasto — reso illeggibile (trovato dall'end-to-end della #160).
 * E un numero si toglie solo se sta da solo: le cifre attaccate a lettere o a
 * `_` sono parte di un nome (`e2e`, `job_runs_id_seq`), non un importo.
 */
export function scrub(text: string): string {
	let s = text;
	s = s.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<email>");
	s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>");
	// Una data, con l'ora se c'è: intera, o la regola dei numeri ne lascerebbe
	// i pezzi attaccati alla `T` (`<n>-<n>-23T19:<n>`). Può essere la data di
	// un movimento.
	s = s.replace(/\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/g, "<data>");
	// Un JWT si riconosce dall'intestazione, `{"` in base64: `eyJ`.
	s = s.replace(/\beyJ[\w-]*(?:\.[\w-]*){1,2}/g, "<token>");
	// Una chiave, un hash: lunghi, con lettere E cifre. Un nome di vincolo
	// (`transactions_account_id_user_id_fkey`) non ha cifre e resta.
	s = s.replace(/\b(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{24,}(?:\.[\w-]+)*/g, "<token>");
	s = s.replace(
		/"([^"]*)"|'([^']*)'|«([^»]*)»|(^|[^\w])(\d+(?:[.,]\d+)*)(?!\w)/g,
		(whole, dq?: string, sq?: string, gq?: string, before?: string, num?: string) => {
			if (num !== undefined) return `${before ?? ""}<n>`;
			const inner = dq ?? sq ?? gq ?? "";
			return isIdentifier(inner) ? whole : '"…"';
		},
	);
	return s.length > MAX_MESSAGE ? `${s.slice(0, MAX_MESSAGE)}…` : s;
}

/**
 * Un identificatore dello schema: minuscolo, in snake_case, e con un `_`
 * oppure il nome di una relazione nota. ⚠️ Una parola sola senza `_` («cena»)
 * NON passa: potrebbe essere il valore di un utente, e la si toglie.
 */
function isIdentifier(s: string): boolean {
	if (!/^[a-z_][a-z0-9_]{0,62}$/.test(s)) return false;
	return s.includes("_") || RELATIONS.has(s);
}

/**
 * Il percorso senza query string né frammento, e con ogni segmento che porta
 * un id ridotto a `[id]`. ⚠️ La query string è quella che porta la ricerca
 * dei movimenti (`?q=`), cioè testo dell'utente.
 */
export function scrubPath(path: string): string {
	let p = path;
	try {
		// Un URL completo (dal browser): si tiene solo il percorso.
		if (/^https?:\/\//.test(p)) p = new URL(p).pathname;
	} catch {
		// non è un URL: resta com'è, e passa dalla pulizia sotto
	}
	p = p.split(/[?#]/)[0];
	const clean = p
		.split("/")
		.map((seg) => (seg === "" || /^\[[\w.]+\]$/.test(seg) || !/\d|@/.test(seg) ? seg : "[id]"))
		.join("/");
	return clean.slice(0, 200) || "/";
}

type Frame = { function?: string; filename?: string; lineno?: number; colno?: number; in_app: boolean };

/**
 * La pila in frame per Sentry. Due forme: V8 (`at fn (file:1:2)`) per il
 * server e Chromium, Gecko/WebKit (`fn@file:1:2`) per Firefox e Safari.
 * Sentry vuole il frame più vecchio per primo: la pila si legge al contrario.
 */
export function parseStack(stack: string | undefined): Frame[] {
	if (!stack) return [];
	const frames: Frame[] = [];
	for (const raw of stack.split("\n").slice(0, 60)) {
		const line = raw.trim();
		const v8 = /^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line);
		const gecko = /^(.*?)@(.+?):(\d+):(\d+)$/.exec(line);
		const m = v8 ?? gecko;
		if (!m) continue;
		frames.push({
			function: m[1] || undefined,
			filename: shortFile(m[2]),
			lineno: Number(m[3]),
			colno: Number(m[4]),
			// Sul nome intero: accorciato, `node:internal/…` perderebbe il prefisso.
			in_app: !/node_modules|^node:/.test(m[2]),
		});
	}
	return frames.reverse();
}

/**
 * Il file senza la parte della macchina o del dominio: da `.next/` o `_next/`
 * in poi, senza query string. ⚠️ Non passa da `scrubPath()`: i chunk di
 * Turbopack hanno un hash con cifre, e ogni nome diventava `[id]` (visto nella
 * prova di `onRequestError`). Un nome di file è del codice, non dell'utente.
 */
function shortFile(file: string): string {
	const f = file.replace(/^file:\/\//, "").split(/[?#]/)[0];
	const at = f.search(/\.next\/|_next\//);
	return (at >= 0 ? f.slice(at) : (f.split(/[\\/]/).pop() ?? f)).slice(0, 200);
}

/**
 * Dagli argomenti di un `console.error` al rapporto: la forma del progetto è
 * `("[scope] testo:", dettaglio, …)`. Un `Error` porta messaggio e pila, un
 * errore di PostgREST o di GoTrue il suo `code`; il resto diventa testo.
 */
export function fromConsoleArgs(args: unknown[]): Omit<ErrorReport, "source"> {
	let scope = "senza-etichetta";
	let code: string | undefined;
	let stack: string | undefined;
	const parts: string[] = [];

	args.forEach((arg, i) => {
		if (i === 0 && typeof arg === "string") {
			const m = /^\[([^\]]+)\]\s*([\s\S]*)$/.exec(arg);
			if (m) {
				scope = m[1];
				if (m[2]) parts.push(m[2]);
				return;
			}
		}
		if (arg instanceof Error) {
			parts.push(`${arg.name}: ${arg.message}`);
			stack ??= arg.stack;
			const c = (arg as { code?: unknown }).code;
			if (typeof c === "string" || typeof c === "number") code ??= String(c);
			return;
		}
		if (arg && typeof arg === "object") {
			const o = arg as { code?: unknown; message?: unknown };
			if (typeof o.code === "string" || typeof o.code === "number") code ??= String(o.code);
			if (typeof o.message === "string") {
				parts.push(o.message);
				return;
			}
			try {
				parts.push(JSON.stringify(arg));
			} catch {
				parts.push(Object.prototype.toString.call(arg));
			}
			return;
		}
		parts.push(String(arg));
	});

	return { scope, code, message: parts.join(" ").trim() || scope, stack };
}

/** Un id per l'evento: 32 cifre esadecimali, come vuole Sentry. */
export function newEventId(): string {
	return crypto.randomUUID().replace(/-/g, "");
}

/**
 * L'evento di Sentry, costruito per elenco. `now` in millisecondi.
 *
 * `fingerprint` raggruppa per etichetta e codice: lo stesso guasto con due UUID
 * diversi nel messaggio resta un problema solo, non due.
 */
export function buildEvent(
	report: ErrorReport,
	meta: { release?: string; environment?: string; now: number; eventId: string },
) {
	const message = scrub(report.message);
	const frames = parseStack(report.stack);
	const tags: Record<string, string> = { scope: report.scope, source: report.source };
	// Un codice è tecnico (SQLSTATE, GoTrue, `digest`): passa intero se ne ha la
	// forma, altrimenti non passa affatto. Ripulirlo come un testo farebbe di
	// `23505` un `<n>`, cioè buttare proprio l'informazione.
	const code = report.code && /^[\w.-]{1,64}$/.test(report.code) ? report.code : undefined;
	if (code) tags.code = code;
	if (report.route) tags.route = scrubPath(report.route);

	return {
		event_id: meta.eventId,
		timestamp: meta.now / 1000,
		platform: "javascript",
		level: "error",
		logger: report.scope,
		environment: meta.environment ?? "development",
		...(meta.release ? { release: meta.release } : {}),
		tags,
		fingerprint: [report.scope, code ?? "-"],
		exception: {
			values: [
				{
					type: `[${report.scope}]`,
					value: message,
					...(frames.length ? { stacktrace: { frames } } : {}),
				},
			],
		},
	};
}

/** Il DSN di Sentry: chiave pubblica, host e progetto. `null` se non è un DSN. */
export function parseDsn(dsn: string): { endpoint: string; publicKey: string } | null {
	try {
		const u = new URL(dsn);
		const project = u.pathname.replace(/^\/+|\/+$/g, "");
		if (!u.username || !/^\d+$/.test(project)) return null;
		return { endpoint: `${u.protocol}//${u.host}/api/${project}/envelope/`, publicKey: u.username };
	} catch {
		return null;
	}
}

/** L'envelope: un'intestazione, l'intestazione dell'elemento, l'evento. Una riga JSON ciascuno. */
export function toEnvelope(event: { event_id: string }, dsn: string, sentAt: Date): string {
	return [
		JSON.stringify({ event_id: event.event_id, sent_at: sentAt.toISOString(), dsn }),
		JSON.stringify({ type: "event" }),
		JSON.stringify(event),
	].join("\n");
}
