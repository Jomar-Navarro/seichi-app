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
 * ⚠️ SEMPRE ATTIVA in questo giro, senza gating su query string/localStorage:
 * un primo tentativo armava un flag in `localStorage` alla visita da Safari,
 * ma l'app installata standalone NON condivide quella storage con Safari per
 * lo stesso dominio su iOS (verificato dal telefono il 2026-09-14) — quindi
 * l'icona vera non vedeva mai il flag. Sempre presente è l'unica via
 * affidabile per vederla sull'icona reale senza reinstallarne una seconda.
 * Innocuo: le registrazioni non sono ancora aperte (issue #40), quindi
 * l'unico visitatore reale di produzione in questo momento è chi sta
 * misurando. Da rimuovere non appena raccolte le tre misure dal telefono:
 * non è pensata per restare nel repo.
 */

function subscribeNever() {
	// Nessun evento a cui iscriversi: serve solo a distinguere il render del
	// server (nessun `window`) da quello del client, come già in PwaStatus.tsx.
	return () => {};
}

export default function PerfDebugOverlay() {
	const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
	const [fcp, setFcp] = useState<number | null>(null);

	useEffect(() => {
		if (!hydrated) return;

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
	}, [hydrated]);

	if (!hydrated) return null;

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
