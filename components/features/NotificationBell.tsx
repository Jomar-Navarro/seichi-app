"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown } from "lucide-react";
import {
	getNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "@/app/(main)/notification-actions";
import { BADGE_MAX, notificationMeta, relativeTime } from "@/lib/notifications";
import type { RenderedNotification } from "@/types";
import { useI18n } from "./I18nProvider";

interface NotificationBellProps {
	/** conteggio risolto lato server: evita che il badge lampeggi all'apertura */
	initialUnread: number;
}

export default function NotificationBell({ initialUnread }: NotificationBellProps) {
	const { locale, t } = useI18n();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<RenderedNotification[] | null>(null);
	const [unread, setUnread] = useState(initialUnread);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	/*
	 * issue: il pannello copriva la campanella che l'ha aperto. Era `fixed`
	 * con un `top` FISSO (un numero indovinato per il layout comune), che non
	 * si sposta se l'header cresce — la barra di stato "in chiamata" di iOS
	 * allunga la safe-area in alto e sposta la campanella più in basso, ma il
	 * pannello restava dov'era e finiva sopra di lei.
	 *
	 * Stesso schema del menu "richiedi il PIN dopo" in `AppLockSettings.tsx`:
	 * la posizione si calcola al TOCCO da `getBoundingClientRect()` del
	 * bottone vero, non da un numero scritto a mano. Su telefono serve solo
	 * `top` — `left-5 right-5` restano fissi ai margini della pagina (il
	 * pannello è largo quanto il contenuto, non quanto la campanella:
	 * ancorarlo anche in orizzontale al bottone, che sta a destra, lo
	 * farebbe uscire dallo schermo).
	 *
	 * ⚠️ Da `lg:` in su quel ragionamento si rovescia. La pagina non è più
	 * larga quanto il viewport (Fase 28b: un contenitore centrato dopo la
	 * sidebar), quindi "i margini della pagina" non coincidono più coi
	 * margini dello SCHERMO — `right-5` ancorerebbe il pannello al bordo
	 * della finestra, staccato dalla campanella che sta molto più a
	 * sinistra. Da `lg:` si ancora quindi al bottone stesso: `panelRight` è
	 * la distanza fra il bordo destro del bottone e il bordo destro del
	 * viewport, letta una volta sola al tocco (come `panelTop`), e il
	 * pannello guadagna una larghezza fissa (`lg:w-96`) invece che "quanto
	 * il contenuto" — sotto `lg:` resta `null` e il comportamento di sempre
	 * non cambia.
	 */
	const bellRef = useRef<HTMLButtonElement>(null);
	const [panelTop, setPanelTop] = useState<number | null>(null);
	const [panelRight, setPanelRight] = useState<number | null>(null);

	async function toggle() {
		if (open) {
			setOpen(false);
			return;
		}
		const rect = bellRef.current?.getBoundingClientRect();
		setPanelTop(rect ? rect.bottom + 10 : null);
		const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
		setPanelRight(isDesktop && rect ? window.innerWidth - rect.right : null);
		setOpen(true);
		// Si ricarica a ogni apertura, non solo la prima. La versione precedente
		// caricava una volta sola: dopo un errore restava bloccata sul messaggio
		// per tutta la vita della pagina, e non vedeva mai le notifiche generate
		// o lette altrove nel frattempo.
		await load();
	}

	/*
	 * Il pannello prendeva TUTTO lo schermo (`70dvh`, quasi la sua interezza
	 * su un telefono) per una lista che nella maggior parte dei casi è più
	 * corta. Ora parte a "metà" (`50dvh`) e un comando "mostra tutto" la
	 * espande fino all'altezza precedente — la stessa scelta già fatta per
	 * `ATTACHMENT_MAX_EDGE` e per ogni altro numero di questo tipo: 70dvh
	 * resta il tetto pensato in origine, non un valore nuovo.
	 *
	 * ⚠️ Il comando compare SOLO quando la lista è davvero più alta dello
	 * spazio compresso — altrimenti sarebbe un bottone che non cambia niente,
	 * e un comando sempre presente e inerte insegna a ignorarlo (stessa
	 * regola di "Azzera filtri", issue #9). Si misura leggendo `scrollHeight`
	 * contro `clientHeight` DOPO che le righe sono arrivate: è il DOM, non un
	 * calcolo in `dvh`, a dire se il contenuto trabocca.
	 */
	const listRef = useRef<HTMLDivElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [overflowing, setOverflowing] = useState(false);

	useEffect(() => {
		if (!items || expanded) return;
		const el = listRef.current;
		if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1);
	}, [items, expanded]);

	async function load() {
		setLoading(true);
		const res = await getNotifications();
		setLoading(false);

		if ("error" in res) {
			// ⚠️ `items` NON viene azzerato: se c'era già una lista buona resta
			// visibile sotto il messaggio d'errore, invece di sparire e lasciare
			// il pannello vuoto per un problema di rete passeggero.
			setError(res.error);
			return;
		}
		setError(null);
		setItems(res.data);
		// Il conteggio arriva dal server insieme alla pagina: dedurlo dalle righe
		// caricate lo sottostimerebbe oltre il limite del pannello.
		setUnread(res.unread);
	}

	/**
	 * Il tap segna come letta E naviga.
	 *
	 * La scrittura parte senza essere attesa: `markNotificationRead` invalida la
	 * cache della home, e aspettarla bloccherebbe la navigazione su un
	 * round-trip il cui risultato viene buttato via un istante dopo. Lo stato
	 * ottimistico è già applicato; se la scrittura fallisce la riga torna non
	 * letta alla prossima apertura del pannello, che ora ricarica sempre.
	 */
	function openItem(n: RenderedNotification) {
		setOpen(false);
		if (!n.read) {
			setItems((prev) => prev?.map((i) => (i.id === n.id ? { ...i, read: true } : i)) ?? prev);
			setUnread((u) => Math.max(0, u - 1));
			void markNotificationRead(n.id);
		}
		router.push(n.destination);
	}

	async function markAll() {
		const snapshot = items;
		const previousUnread = unread;

		setItems((prev) => prev?.map((i) => ({ ...i, read: true })) ?? prev);
		setUnread(0);

		const res = await markAllNotificationsRead();
		if ("error" in res) {
			// Qui l'utente resta sulla pagina a guardare il risultato, quindi
			// l'ottimismo va annullato: lasciare il badge a zero mentre nel
			// database è tutto non letto è una bugia che dura fino al reload.
			setItems(snapshot);
			setUnread(previousUnread);
			setError(res.error);
		}
	}

	return (
		<div className="relative">
			<button
				ref={bellRef}
				onClick={toggle}
				// `z-50` quando aperto: senza, l'overlay (z-40) coprirebbe il bottone
				// e il secondo tocco finirebbe sull'overlay. Funzionava per caso —
				// chiudeva lo stesso — ma la campanella non era davvero un interruttore.
				// Pastiglia 42px a raggio 14 come nel mockup: è un comando, quindi
				// una tessera. Il tondo resta all'avatar, che è una persona.
				className={`relative w-10.5 h-10.5 rounded-[14px] flex items-center justify-center bg-surface card-shadow-ring active:opacity-80 cursor-pointer ${open ? "z-50" : ""}`}
				aria-label={unread > 0 ? `Notifiche, ${unread} non lette` : "Notifiche"}
				aria-expanded={open}
			>
				<Bell size={18} strokeWidth={1.6} className="text-secondary" />
				{/*
					Il mockup mostra la campanella nuda, ma senza segnale non c'è motivo
					di aprirla e il pannello muore. Oltre il nono il numero esatto
					smette di dire qualcosa di utile.

					È l'unico posto dove l'inchiostro fa da FONDO, ed è voluto: il badge
					porta del testo sopra un riempimento pieno, e in chiaro l'accento è
					troppo chiaro perché il bianco ci stia sopra (3,4:1 a 10px). Il
					`#fff` cablato di prima dava per scontato il tema scuro — dove però
					l'accento è un pastello e il bianco stava a 2,8:1: il difetto c'era
					da entrambe le parti.
				*/}
				{unread > 0 && (
					<span
						className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center text-[10px] font-semibold leading-none"
						style={{ background: "var(--ink-aka)", color: "var(--on-accent)" }}
					>
						{unread > BADGE_MAX ? `${BADGE_MAX}+` : unread}
					</span>
				)}
			</button>

			{open && (
				<>
					<div
						className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1.5px]"
						onClick={() => setOpen(false)}
					/>

					{/*
						`left-5 right-5` fissi ai margini della pagina su telefono: il
						pannello è largo quanto il contenuto. Da `lg:` in su (Fase 28b)
						`panelRight` non è più `null`: `lg:left-auto` toglie `left-5`,
						`lg:w-96` fissa una larghezza (non più "quanto il contenuto") e lo
						`style` inline sovrascrive `right-5` con la distanza vera dal
						bottone — vedi il commento su `panelRight` più sopra. Solo `top`
						resta sempre dinamico.

						`--color-deep` (superficie solida) al 94% e non `bg-modal`: quello
						sta a 0.85, tarato per i bottom sheet che coprono uno sfondo già
						oscurato. Qui il pannello galleggia sulla dashboard piena di numeri.
					*/}
					{/* ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto. */}
					<div
						className="fixed left-5 right-5 lg:left-auto lg:w-96 z-50 rounded-[28px] overflow-hidden modal-shadow-ring"
						style={{ top: panelTop ?? 92, right: panelRight ?? undefined }}
					>
						<div
							className="absolute inset-0 backdrop-blur-2xl"
							style={{ background: "color-mix(in srgb, var(--color-deep) 94%, transparent)" }}
						/>
						<div className={`relative flex flex-col ${expanded ? "max-h-[70dvh]" : "max-h-[50dvh]"}`}>
						<div className="flex items-center justify-between px-5 py-4 border-b border-subtle shrink-0">
							<h2 className="text-[15px] font-semibold">{t.notifications.title}</h2>
							{unread > 0 && (
								<button
									onClick={markAll}
									className="text-[12px] text-muted active:opacity-60 cursor-pointer"
								>
									{t.notifications.markAllRead}
								</button>
							)}
						</div>

						<div ref={listRef} className="overflow-y-auto overscroll-contain scrollbar-none">
							{error && (
								<div className="px-5 py-4 border-b border-subtle">
									<p className="text-[12.5px]" style={{ color: "var(--ink-aka)" }}>
										{error}
									</p>
									<button
										onClick={load}
										className="text-[12px] text-muted underline mt-1.5 cursor-pointer"
									>
										riprova
									</button>
								</div>
							)}

							{loading && items === null && (
								<p className="px-5 py-8 text-center text-[13px] text-muted">{t.notifications.loading}</p>
							)}

							{items !== null && items.length === 0 && !error && (
								<div className="px-8 py-10 text-center">
									<p className="text-[14px] font-medium mb-1.5">{t.notifications.empty}</p>
									<p className="text-[12.5px] text-muted leading-relaxed">
										{t.notifications.emptyDescription}
									</p>
								</div>
							)}

							{items?.map((n) => {
								const meta = notificationMeta(n.type);
								const Icon = meta.icon;
								return (
									<button
										key={n.id}
										onClick={() => openItem(n)}
										className="flex items-start gap-3 w-full text-left px-5 py-3.5 border-b border-subtle last:border-b-0 active:opacity-70"
										// Letta = 0.55, come da design. È l'unica cosa che distingue
										// ciò che hai già guardato da ciò che non hai mai visto.
										style={{ opacity: n.read ? 0.55 : 1 }}
									>
										<span
											className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
											style={{ background: `color-mix(in srgb, ${meta.color} 13%, transparent)` }}
										>
											<Icon size={16} strokeWidth={1.6} style={{ color: meta.color }} />
										</span>

										<span className="flex-1 min-w-0">
											<span className="block text-[13px] leading-snug">{n.title}</span>
											{n.body && (
												<span className="block text-[11.5px] text-muted mt-1">{n.body}</span>
											)}
											<span className="block text-[11px] text-disabled mt-1">
												{relativeTime(n.created_at, locale, t.notifications.justNow)}
											</span>
										</span>

										<span
											className="w-1.75 h-1.75 rounded-full shrink-0 mt-1.5"
											style={{
												background: n.read
													? "color-mix(in srgb, var(--color-kiri) 40%, transparent)"
													: "var(--color-kin)",
											}}
										/>
									</button>
								);
							})}
						</div>

						{/*
							Fuori dall'area che scorre, o bisognerebbe scorrere fino in
							fondo per trovarlo — proprio ciò che serve a evitare. Compare
							solo se `overflowing` (compresso) o se è già espanso (per poter
							tornare indietro): mai un comando presente e inerte.
						*/}
						{(overflowing || expanded) && (
							<button
								type="button"
								onClick={() => setExpanded((v) => !v)}
								className="shrink-0 flex items-center justify-center gap-1.5 py-3 text-[12px] text-muted border-t border-subtle active:opacity-60"
							>
								{expanded ? t.notifications.showLess : t.notifications.showAll}
								<ChevronDown
									size={13}
									className={`transition-transform ${expanded ? "rotate-180" : ""}`}
								/>
							</button>
						)}
						</div>
					</div>
				</>
			)}
		</div>
	);
}
