import { describe, expect, it } from "vitest";

import { OFFLINE_URL, offlineRevision } from "./offline-revision.mjs";

/*
 * La revisione di `/~offline` nel precache (#127). La calcolano due lati — la
 * route di Serwist sugli URL PRIMA della riscrittura, l'audit su quelli DOPO —
 * e devono arrivare allo stesso numero.
 */
const PRIMA = [
	{ url: ".next/static/chunks/a.js", revision: null },
	{ url: ".next/static/abc123/_buildManifest.js", revision: null },
	{ url: "public/icon-512.png", revision: "r1" },
];
const DOPO = [
	{ url: "/_next/static/chunks/a.js", revision: null },
	{ url: "/_next/static/abc123/_buildManifest.js" },
	{ url: "/icon-512.png", revision: "r1" },
];

describe("offlineRevision", () => {
	it("route e audit arrivano alla stessa revisione", () => {
		expect(offlineRevision(PRIMA)).toBe(offlineRevision(DOPO));
	});

	it("non dipende dall'ordine del glob", () => {
		expect(offlineRevision([...DOPO].reverse())).toBe(offlineRevision(DOPO));
	});

	it("ignora la voce di /~offline, qualunque sia la sua revisione", () => {
		const conOffline = [...DOPO, { url: OFFLINE_URL, revision: "qualsiasi" }];
		expect(offlineRevision(conOffline)).toBe(offlineRevision(DOPO));
	});

	it("cambia quando cambia un chunk, o la cartella dell'id di build", () => {
		const base = offlineRevision(DOPO);
		expect(offlineRevision([...DOPO.slice(0, 2), { url: "/icon-512.png", revision: "r2" }])).not.toBe(base);
		expect(offlineRevision([...DOPO, { url: "/_next/static/chunks/b.js" }])).not.toBe(base);
		expect(offlineRevision(DOPO.map((e) => ({ ...e, url: e.url.replace("abc123", "def456") })))).not.toBe(base);
	});

	it("è un hash esadecimale di 16 caratteri", () => {
		expect(offlineRevision(DOPO)).toMatch(/^[0-9a-f]{16}$/);
	});
});
