"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Diagnostica TEMPORANEA, non permanente. Serve a rimisurare il lampo bianco
 * dell'avvio (vedi CLAUDE.md, "Sospeso il 2026-09-10...") contro un deploy
 * vero — TLS, CDN, latenza reale — invece che contro `localhost`/LAN, dove il
 * numero non era verificabile. Stesso principio dello script ad-hoc già usato
 * per quella misura: quando manca lo strumento giusto (qui: un Mac per Safari
 * Web Inspector), se ne costruisce uno minimo invece di continuare a dedurre.
 *
 * Attiva SOLO con `?perfdebug=1` nell'URL — altrimenti non renderizza nulla,
 * quindi nessun utente reale la vede mai. Da rimuovere non appena raccolte le
 * tre misure dal telefono: non è pensata per restare nel repo.
 */

function subscribeNever() {
	// La query string non cambia durante la vita di questa pagina di prova:
	// nessun evento a cui iscriversi, come già in PwaStatus.tsx.
	return () => {};
}

function readPerfDebugFlag() {
	return new URLSearchParams(window.location.search).get("perfdebug") === "1";
}

export default function PerfDebugOverlay() {
	// `useSyncExternalStore`, non `useEffect`+`setState`: la differenza fra il
	// render del server (nessun `window`) e quello del client è esattamente
	// ciò che questo hook esiste per esprimere, come già in `PwaStatus.tsx`.
	const active = useSyncExternalStore(subscribeNever, readPerfDebugFlag, () => false);
	const [fcp, setFcp] = useState<number | null>(null);

	useEffect(() => {
		if (!active) return;

		let cancelled = false;
		let frame = 0;

		// Le entry di Paint Timing arrivano in modo asincrono, quindi si
		// interroga a ogni fotogramma finché non compaiono — mai una lettura
		// sola seguita da "non c'è ancora". Il primo controllo passa comunque
		// da `requestAnimationFrame`, mai sincrono nel corpo dell'effetto: è
		// lo stesso schema già usato per `controllerchange` in PwaStatus — ci
		// si iscrive, e si chiama `setState` dentro il CALLBACK, non nel
		// corpo dell'effetto.
		let attempts = 0;
		function tick() {
			if (cancelled) return;
			const entry = performance
				.getEntriesByType("paint")
				.find((e) => e.name === "first-contentful-paint");
			if (entry) {
				setFcp(Math.round(entry.startTime));
				return;
			}
			if (attempts++ < 300) frame = requestAnimationFrame(tick);
		}
		frame = requestAnimationFrame(tick);

		return () => {
			cancelled = true;
			cancelAnimationFrame(frame);
		};
	}, [active]);

	if (!active) return null;

	return (
		<div
			style={{
				position: "fixed",
				top: 8,
				left: 8,
				zIndex: 99999,
				background: "#000",
				color: "#0f0",
				fontFamily: "monospace",
				fontSize: 20,
				padding: "6px 10px",
				borderRadius: 8,
				lineHeight: 1.3,
				pointerEvents: "none",
			}}
		>
			FCP: {fcp === null ? "…" : `${fcp}ms`}
		</div>
	);
}
