import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import type { Page } from "@playwright/test";
import { BASE_URL } from "./env";

/**
 * Una pagina aperta a metà (#217): ferma sullo scheletro finché il test non la
 * lascia andare.
 *
 * Il server manda la pagina in streaming: prima l'involucro (layout, scheletri,
 * i dati per l'idratazione), poi, man mano che le letture arrivano, il
 * contenuto di ogni Suspense. Questo proxy lascia passare l'involucro e
 * trattiene ciò che chiude un Suspense rimasto aperto, finché non si chiama
 * `release()`. Così un gesto «durante lo scheletro» si prova apposta, invece
 * di sperare che il server sia lento.
 *
 * Perché un proxy: le letture della home le fa il server (server component),
 * quindi `page.route()` non le raggiunge; e una risposta servita da
 * `route.fulfill()` arriva intera, non a pezzi.
 *
 * Com'è fatto lo streaming, misurato il 2026-11-20 leggendo i chunk HTTP
 * della risposta (ogni chunk è un invio di Next):
 *
 * - `#0` l'HTML dell'involucro, con un `<template id="B:n">` per ogni Suspense
 *   ancora aperto; `#1` i dati RSC dell'involucro. Arrivano insieme.
 * - Poi, a qualche millisecondo, altri dati RSC, e i chunk che chiudono i
 *   confini: `<div hidden id="S:n">` col contenuto più `$RC("B:n",…)` che lo
 *   scambia con lo scheletro, oppure `$RX("B:n",…)`, il confine da rendere nel
 *   browser perché sul server è finito in errore. È la strada di un
 *   `redirect()` dentro il Suspense: la home con un conto che non è tuo.
 * - Per quel `redirect` Next manda, PRIMA di `$RX`, un
 *   `<meta id="__next-page-redirect" http-equiv="refresh">`.
 *
 * Quindi si trattiene dal primo chunk che chiude un confine aperto in un chunk
 * PRECEDENTE, o che porta quel `<meta>`, e tutto ciò che viene dopo.
 *
 * - ⚠️ Mai un confine che si apre e si chiude nello stesso chunk: in
 *   `/analisi` i tab fanno così dentro `#0`, e tagliare lì trattiene `#1`, i
 *   dati dell'involucro. La pagina non si idrata, e il + non risponde più.
 * - ⚠️ Il `<meta>`, lasciato passare, dopo un secondo fa ricaricare al browser
 *   la pagina di arrivo, e il test proverebbe quella.
 * - I dati RSC che arrivano dopo l'involucro passano, e non fanno danno:
 *   finché nel DOM il confine resta «in attesa», React non rende niente di ciò
 *   che sta dentro. Nessun effetto, nessuna dichiarazione. Ciò che sta fuori,
 *   il + del layout compreso, si idrata e risponde.
 *
 * ⚠️ I marcatori sono dettagli interni di React e di Next. Se un giorno
 * cambiano, il proxy non trattiene più: lo scenario se ne accorge perché
 * aspetta `holding` e lo scheletro, e cade per tempo scaduto invece di passare
 * per caso.
 *
 * ⚠️ La pagina si apre dall'indirizzo del proxy, sullo stesso host con un'altra
 * porta: i cookie non distinguono le porte, quindi vale la sessione fatta su
 * `BASE_URL`. Le chiamate del browser a Supabase vanno dirette, non passano di
 * qui.
 */
export type HeldPage = {
	/** Si risolve quando il proxy comincia a trattenere. Una pagina che arriva intera non lo risolve mai. */
	holding: Promise<void>;
	/** Lascia passare il resto della pagina. */
	release: () => void;
	/**
	 * Lascia andare la pagina e chiude il proxy. Il browser va portato via
	 * PRIMA (`leave`), o le richieste ancora in volo cadono come errori della
	 * pagina.
	 */
	close: () => Promise<void>;
};

const CLOSES = /\$R[CX]\("(B:\d+)"/g;
const OPENS = /<template id="(B:\d+)"/g;
const REDIRECT_META = '<meta id="__next-page-redirect"';

export async function openHeld(page: Page, path: string): Promise<HeldPage> {
	const target = new URL(BASE_URL);
	let startHolding!: () => void;
	const holding = new Promise<void>((resolve) => (startHolding = resolve));
	let released = false;
	const onRelease: Array<() => void> = [];

	/** Il documento della pagina, chiesto a mano per vederne i chunk HTTP. */
	function streamDocument(req: http.IncomingMessage, res: http.ServerResponse) {
		const lines = [`GET ${req.url} HTTP/1.1`];
		for (const [name, value] of Object.entries(req.headers)) {
			// In chiaro, perché i marcatori si possano leggere; e una richiesta
			// sola per connessione, così la risposta finisce con il socket.
			if (value === undefined || ["accept-encoding", "connection", "keep-alive"].includes(name)) continue;
			for (const one of Array.isArray(value) ? value : [value]) lines.push(`${name}: ${one}`);
		}
		lines.push("connection: close", "", "");

		const socket = net.connect(Number(target.port), target.hostname, () => socket.write(lines.join("\r\n")));
		let buffer = Buffer.alloc(0);
		let inBody = false;
		let chunked = false;
		let held = false;
		let ended = false;
		const queue: Buffer[] = [];
		const opened = new Set<string>();

		const finish = () => {
			ended = true;
			if (!held || released) res.end();
		};
		const forward = (body: Buffer) => {
			if (held && !released) queue.push(body);
			else res.write(body);
		};
		onRelease.push(() => {
			for (const body of queue) res.write(body);
			queue.length = 0;
			if (ended) res.end();
		});

		socket.on("data", (data: Buffer) => {
			buffer = Buffer.concat([buffer, data]);
			if (!inBody) {
				const end = buffer.indexOf("\r\n\r\n");
				if (end === -1) return;
				const [status, ...headerLines] = buffer.subarray(0, end).toString("latin1").split("\r\n");
				const headers: Record<string, string | string[]> = {};
				for (const line of headerLines) {
					const colon = line.indexOf(":");
					const name = line.slice(0, colon).trim().toLowerCase();
					const value = line.slice(colon + 1).trim();
					if (name === "transfer-encoding") chunked = /chunked/i.test(value);
					// Il corpo lo rimanda questo server, con la sua codifica.
					if (["transfer-encoding", "connection", "keep-alive", "content-length"].includes(name)) continue;
					const prev = headers[name];
					headers[name] = prev === undefined ? value : [...(Array.isArray(prev) ? prev : [prev]), value];
				}
				res.writeHead(Number(status.split(" ")[1]), headers);
				buffer = buffer.subarray(end + 4);
				inBody = true;
			}
			if (!chunked) {
				forward(buffer);
				buffer = Buffer.alloc(0);
				return;
			}
			// Un chunk alla volta: `<dimensione esadecimale>\r\n<dati>\r\n`, e `0` alla fine.
			for (;;) {
				const newline = buffer.indexOf("\r\n");
				if (newline === -1) return;
				const size = parseInt(buffer.subarray(0, newline).toString("latin1"), 16);
				if (size === 0) {
					socket.destroy();
					finish();
					return;
				}
				if (buffer.length < newline + 2 + size + 2) return;
				const body = buffer.subarray(newline + 2, newline + 2 + size);
				buffer = buffer.subarray(newline + 2 + size + 2);

				const text = body.toString("latin1");
				if (!held && !released) {
					const closesOpen = [...text.matchAll(CLOSES)].some((m) => opened.has(m[1]));
					if (closesOpen || text.includes(REDIRECT_META)) {
						held = true;
						startHolding();
					}
				}
				// Dopo il controllo: un confine aperto in QUESTO chunk e chiuso nello
				// stesso non deve far trattenere niente.
				for (const m of text.matchAll(OPENS)) opened.add(m[1]);
				forward(body);
			}
		});
		socket.on("end", () => {
			if (!chunked) finish();
		});
		socket.on("error", () => res.destroy());
	}

	const server = http.createServer((req, res) => {
		// Solo il documento della pagina: script, navigazioni lato client e
		// server action passano come sono.
		if (!released && req.method === "GET" && req.url === path && req.headers.rsc === undefined) {
			streamDocument(req, res);
			return;
		}
		const upstream = http.request(
			{ hostname: target.hostname, port: target.port, method: req.method, path: req.url, headers: req.headers },
			(up) => {
				res.writeHead(up.statusCode ?? 502, up.headers);
				up.pipe(res);
			},
		);
		upstream.on("error", () => res.destroy());
		req.pipe(upstream);
	});

	await new Promise<void>((resolve) => server.listen(0, target.hostname, resolve));
	const { port } = server.address() as AddressInfo;

	const release = () => {
		if (released) return;
		released = true;
		for (const flush of onRelease) flush();
	};

	// ⚠️ `commit` e non `load`: trattenuta, la pagina non finisce mai di caricarsi.
	await page.goto(`${target.protocol}//${target.hostname}:${port}${path}`, { waitUntil: "commit" });
	// Lo splash copre la pagina per ~900ms, poi resta nel DOM trasparente (vedi `open`).
	await page.waitForFunction(() => {
		const s = document.querySelector(".zg-boot-out");
		return s !== null && getComputedStyle(s).opacity === "0";
	});

	return {
		holding,
		release,
		close: async () => {
			release();
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		},
	};
}
