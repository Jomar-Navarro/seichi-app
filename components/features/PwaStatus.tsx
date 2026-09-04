"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { RefreshCw, Share, X } from "lucide-react";
import { useI18n } from "@/components/features/I18nProvider";

const IOS_HINT_KEY = "seichi-pwa-ios-hint-dismissed";

/** Non c'è nulla a cui iscriversi: la risposta non cambia durante la vita del componente. */
const subscribeNever = () => () => {};

/**
 * Va bene solo iOS + non già installata + non già respinta in passato.
 * Legge `navigator`/`matchMedia`/`localStorage`: nessuno esiste lato server,
 * quindi il default server è "no" (vedi la terza callback più sotto) — un
 * lampo di banner all'idratazione sarebbe peggio di un frame senza.
 */
function shouldShowIosHint() {
	const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
	if (!ios) return false;
	if (window.matchMedia("(display-mode: standalone)").matches) return false;
	try {
		return !localStorage.getItem(IOS_HINT_KEY);
	} catch {
		return false; // localStorage può lanciare in navigazione privata
	}
}

/**
 * Due avvisi minori della Fase 25 (PWA), montati insieme perché condividono
 * la stessa forma (una riga dismissibile in cima al contenuto) e lo stesso
 * ciclo di vita (client-only, nessuno dei due ha nulla da dire in un render
 * server): l'avviso di aggiornamento e il suggerimento di installazione iOS.
 *
 * Montato da `app/(main)/layout.tsx`, non dal root layout: riguardano l'app
 * autenticata che si usa ogni giorno, non le pagine di benvenuto/accesso —
 * mostrarlo sopra un form di login centrato sarebbe fuori posto, ed è lì che
 * il ciclo di vita "app installata" ha senso pieno (vedi CLAUDE.md, perché
 * questa fase precede il blocco PIN).
 */
export default function PwaStatus() {
	const { t } = useI18n();
	const [updateReady, setUpdateReady] = useState(false);
	// Letto una volta da un sistema esterno (userAgent/matchMedia/localStorage),
	// non da un `useEffect` + `setState` — la regola già scritta in CLAUDE.md
	// per lo stesso motivo di `EmailConfirmedStatus`: il valore differisce fra
	// server e client, quindi è `useSyncExternalStore` a doverlo esprimere,
	// non un effetto che lo scoprirebbe un render dopo.
	const iosHintAvailable = useSyncExternalStore(subscribeNever, shouldShowIosHint, () => false);
	const [iosHintDismissed, setIosHintDismissed] = useState(false);
	const showIosHint = iosHintAvailable && !iosHintDismissed;

	// Il service worker attiva la versione nuova da solo (`skipWaiting` +
	// `clientsClaim` in app/sw.ts): "controllerchange" è il momento in cui la
	// scheda APERTA passa sotto il suo controllo. Da qui in poi i chunk
	// serviti in rete sono quelli nuovi, ma l'HTML/JS già in memoria in
	// questa scheda restano i vecchi finché non ricarica — da cui l'avviso.
	// ⚠️ Mai un `location.reload()` automatico qui: chi sta compilando
	// TransactionForm non deve vedersi ricaricare la pagina sotto le dita.
	// Questo è il caso ESPLICITAMENTE permesso dalla stessa regola sopra: uno
	// `useEffect` che si ISCRIVE a un sistema esterno e chiama `setState`
	// dentro il CALLBACK dell'evento, non sincronamente nel corpo dell'effetto.
	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		const onControllerChange = () => setUpdateReady(true);
		navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
		return () =>
			navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
	}, []);

	function dismissIosHint() {
		setIosHintDismissed(true);
		try {
			localStorage.setItem(IOS_HINT_KEY, "1");
		} catch {
			// Ignorabile: al peggio il suggerimento ricompare alla prossima visita.
		}
	}

	if (!updateReady && !showIosHint) return null;

	return (
		<div className="px-5 pt-3 space-y-2">
			{updateReady && (
				<div
					className="flex items-center gap-3 rounded-2xl px-4 py-3"
					// issue #81 — anello (box-shadow) invece di bordo: il colore è
					// traslucido, quindi va scritto per intero come in JobHealthNotice.
					style={{
						background: "color-mix(in srgb, var(--color-ao) 12%, transparent)",
						boxShadow:
							"var(--shadow-drop) 0px 8px 24px, var(--shadow-inset) 0px 1px 0px inset, color-mix(in srgb, var(--color-ao) 32%, transparent) 0px 0px 0px 1px inset",
					}}
					role="status"
				>
					<RefreshCw
						size={16}
						strokeWidth={1.6}
						className="shrink-0"
						style={{ color: "var(--color-ao)" }}
					/>
					<p className="flex-1 text-[13px] text-ao-ink font-medium min-w-0">
						{t.pwa.updateAvailable}
					</p>
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="shrink-0 text-[13px] font-semibold text-ao-ink underline underline-offset-2"
					>
						{t.pwa.updateReload}
					</button>
				</div>
			)}

			{showIosHint && (
				<div
					className="flex items-start gap-3 rounded-2xl px-4 py-3"
					style={{
						background: "color-mix(in srgb, var(--color-midori) 12%, transparent)",
						boxShadow:
							"var(--shadow-drop) 0px 8px 24px, var(--shadow-inset) 0px 1px 0px inset, color-mix(in srgb, var(--color-midori) 32%, transparent) 0px 0px 0px 1px inset",
					}}
					role="status"
				>
					<Share
						size={16}
						strokeWidth={1.6}
						className="shrink-0 mt-0.5"
						style={{ color: "var(--color-midori)" }}
					/>
					<div className="min-w-0 flex-1">
						<p className="text-[13px] font-semibold text-midori-ink">
							{t.pwa.installIosTitle}
						</p>
						<p className="text-[12.5px] text-muted mt-0.5 leading-relaxed">
							{t.pwa.installIosHint}
						</p>
					</div>
					<button
						type="button"
						onClick={dismissIosHint}
						aria-label={t.common.close}
						className="shrink-0 -m-1 p-1 text-muted"
					>
						<X size={15} strokeWidth={1.8} />
					</button>
				</div>
			)}
		</div>
	);
}
