import { describe, expect, it } from "vitest";
import { buildEvent, cameFromServer, fromConsoleArgs, parseDsn, parseStack, scrub, scrubPath, toEnvelope } from "@/lib/error-report";

/*
 * Ciò che parte verso Sentry (#160). La domanda di ogni caso: un dato
 * dell'utente può uscire? E il gemello: l'informazione che serve a capire il
 * guasto resta?
 */

describe("scrub — ciò che si toglie", () => {
	it("email, UUID e token", () => {
		const s = scrub(
			"utente mario.rossi+x@example.co.uk, riga 3f2b8c1e-9a7d-4e21-b0c4-5d6e7f8a9b0c, jwt eyJhbGciOiJFUzI1NiIs.eyJzdWIiOiIxMjMifQ.abc123def",
		);
		expect(s).not.toMatch(/mario|example|3f2b8c1e|eyJ/);
		expect(s).toContain("<email>");
		expect(s).toContain("<uuid>");
		expect(s).toContain("<token>");
	});

	it("le date, intere, con o senza ora", () => {
		// Trovato dagli eventi della suite: «2026-11-23T19:07:31.449Z» diventava
		// «<n>-<n>-23T19:<n>:<n>.449Z».
		expect(scrub("ultimo giro: 2026-11-23T19:07:31.449Z · movimento del 2026-03-05")).toBe(
			"ultimo giro: <data> · movimento del <data>",
		);
	});

	it("gli importi, con la virgola o col punto, e ogni altro numero", () => {
		const s = scrub("speso 1.234,56 su 400 (12.5)");
		expect(s).toBe("speso <n> su <n> (<n>)");
	});

	it("il valore tra virgolette di Postgres: doppie, singole, caporali", () => {
		expect(scrub('invalid input syntax for type uuid: "cena con Mario"')).toBe(
			'invalid input syntax for type uuid: "…"',
		);
		expect(scrub("valore 'Affitto casa' non ammesso")).toBe('valore "…" non ammesso');
		expect(scrub("conto «Revolut» non trovato")).toBe('conto "…" non trovato');
	});

	it("una parola sola minuscola tra virgolette non passa: potrebbe essere una nota", () => {
		expect(scrub('valore "cena" non valido')).toBe('valore "…" non valido');
	});

	it("si tronca a 500 caratteri", () => {
		expect(scrub("a ".repeat(400)).length).toBeLessThanOrEqual(501);
	});
});

describe("scrub — ciò che resta", () => {
	it("il nome del vincolo e della tabella, che dicono QUALE guasto", () => {
		const m = 'new row for relation "transactions" violates check constraint "transactions_amount_check"';
		expect(scrub(m)).toBe(m);
	});

	it("le cifre DENTRO un identificatore restano, tra virgolette e fuori", () => {
		// Il difetto trovato dall'end-to-end: «"e2e_guasto_160"» diventava
		// «"e<n>e_guasto_<n>"», perché i numeri si toglievano dopo le virgolette.
		expect(scrub('violates check constraint "e2e_guasto_160"')).toBe('violates check constraint "e2e_guasto_160"');
		expect(scrub("sequenza job_runs_id_seq2 esaurita")).toBe("sequenza job_runs_id_seq2 esaurita");
		// …ma un numero che sta da solo accanto a un identificatore se ne va.
		expect(scrub('"e2e_guasto_160" per 37,45')).toBe('"e2e_guasto_160" per <n>');
	});

	it("un nome lungo di chiave esterna non è un token", () => {
		const m = 'violates foreign key constraint "transactions_account_id_user_id_fkey"';
		expect(scrub(m)).toBe(m);
	});
});

describe("scrubPath", () => {
	it("toglie query string e frammento: la ricerca dei movimenti è testo dell'utente", () => {
		expect(scrubPath("/transazioni?q=farmacia%20via%20Roma#top")).toBe("/transazioni");
	});

	it("riduce a [id] i segmenti con un id, e tiene la forma della rotta", () => {
		expect(scrubPath("/conti/3f2b8c1e-9a7d-4e21-b0c4-5d6e7f8a9b0c")).toBe("/conti/[id]");
		expect(scrubPath("/conti/[id]")).toBe("/conti/[id]");
		expect(scrubPath("https://seichi-app.vercel.app/impostazioni/importa?x=1")).toBe("/impostazioni/importa");
	});
});

describe("fromConsoleArgs", () => {
	it("legge l'etichetta e il testo dalla forma del progetto", () => {
		expect(fromConsoleArgs(["[transactions] conto non appartenente:", "violates fk"])).toMatchObject({
			scope: "transactions",
			message: "conto non appartenente: violates fk",
		});
	});

	it("prende codice e messaggio da un errore di PostgREST", () => {
		const r = fromConsoleArgs(["[conti] createAccount:", { code: "23505", message: "duplicate key", details: "Key (name)=(Revolut)" }]);
		expect(r.code).toBe("23505");
		expect(r.message).toBe("createAccount: duplicate key");
		// `details` porta i valori della riga: non si legge.
		expect(r.message).not.toContain("Revolut");
	});

	it("prende messaggio e pila da un Error", () => {
		const r = fromConsoleArgs(["[archivio] interrotto:", new TypeError("boom")]);
		expect(r.message).toBe("interrotto: TypeError: boom");
		expect(r.stack).toContain("boom");
	});

	it("senza etichetta non inventa: lo dice", () => {
		expect(fromConsoleArgs([new Error("x")]).scope).toBe("senza-etichetta");
	});
});

describe("cameFromServer", () => {
	it("un errore col digest viene dal server, che l'ha già riferito", () => {
		const e = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1234567890" });
		expect(cameFromServer(e)).toBe(true);
	});

	it("un errore nato nel browser no, e nemmeno un valore qualunque", () => {
		expect(cameFromServer(new TypeError("x is undefined"))).toBe(false);
		expect(cameFromServer("[movimento] salvataggio:")).toBe(false);
		expect(cameFromServer(null)).toBe(false);
		expect(cameFromServer({ digest: 42 })).toBe(false);
	});
});

describe("parseStack", () => {
	it("V8, con il frame più vecchio per primo e il percorso della macchina tolto", () => {
		const frames = parseStack(
			"Error: x\n    at saveTransaction (/var/task/.next/server/chunks/ssr/app_1a2b.js:10:5)\n    at async run (node:internal/process/task_queues:95:5)",
		);
		expect(frames).toHaveLength(2);
		expect(frames[1]).toMatchObject({ function: "saveTransaction", lineno: 10, colno: 5, in_app: true });
		expect(frames[1].filename).toMatch(/^\.next\/server\/chunks\/ssr\//);
		expect(frames[1].filename).not.toContain("/var/task");
		expect(frames[0].in_app).toBe(false);
	});

	it("il nome di un chunk con l'hash resta leggibile, senza query string", () => {
		const [f] = parseStack("    at t (/var/task/.next/server/chunks/[root-of-the-server]__a1b2c3._.js:1:65)");
		expect(f.filename).toBe(".next/server/chunks/[root-of-the-server]__a1b2c3._.js");
		const [g] = parseStack("h@https://seichi-app.vercel.app/_next/static/chunks/0f9e8d.js?dpl=dpl_123:1:2");
		expect(g.filename).toBe("_next/static/chunks/0f9e8d.js");
	});

	it("Gecko e WebKit", () => {
		const [f] = parseStack("onClick@https://seichi-app.vercel.app/_next/static/chunks/abc.js:1:200");
		expect(f).toMatchObject({ function: "onClick", lineno: 1, colno: 200 });
		expect(f.filename).toMatch(/^_next\/static\/chunks\//);
	});
});

describe("buildEvent", () => {
	const meta = { now: Date.parse("2026-11-24T10:00:00Z"), eventId: "a".repeat(32), release: "abc123", environment: "production" };

	it("porta solo ciò che è nell'elenco", () => {
		const e = buildEvent(
			{ scope: "transactions", code: "P0001", message: 'nota "Cena con Mario" di mario@x.it per 12,34', source: "server", route: "/conti/3f2b8c1e-9a7d-4e21-b0c4-5d6e7f8a9b0c?q=x" },
			meta,
		);
		expect(Object.keys(e).sort()).toEqual(
			["environment", "event_id", "exception", "fingerprint", "level", "logger", "platform", "release", "tags", "timestamp"].sort(),
		);
		const text = JSON.stringify(e);
		expect(text).not.toMatch(/Cena|Mario|mario@x\.it|12,34|3f2b8c1e|q=x/);
		expect(e.tags).toEqual({ scope: "transactions", source: "server", code: "P0001", route: "/conti/[id]" });
		expect(e.fingerprint).toEqual(["transactions", "P0001"]);
	});

	it("senza utente, senza IP, senza richiesta", () => {
		const e = buildEvent({ scope: "x", message: "y", source: "client" }, meta) as Record<string, unknown>;
		expect(e.user).toBeUndefined();
		expect(e.request).toBeUndefined();
		expect(e.breadcrumbs).toBeUndefined();
	});
});

describe("parseDsn e toEnvelope", () => {
	it("il DSN della regione UE diventa l'indirizzo dell'envelope", () => {
		expect(parseDsn("https://k3y@o123.ingest.de.sentry.io/456")).toEqual({
			endpoint: "https://o123.ingest.de.sentry.io/api/456/envelope/",
			publicKey: "k3y",
		});
		expect(parseDsn("non un dsn")).toBeNull();
		expect(parseDsn("https://o123.ingest.de.sentry.io/456")).toBeNull();
	});

	it("tre righe JSON: intestazione, elemento, evento", () => {
		const lines = toEnvelope({ event_id: "b".repeat(32) }, "https://k@h/1", new Date(0)).split("\n");
		expect(lines).toHaveLength(3);
		expect(JSON.parse(lines[0])).toMatchObject({ event_id: "b".repeat(32), dsn: "https://k@h/1" });
		expect(JSON.parse(lines[1])).toEqual({ type: "event" });
	});
});
