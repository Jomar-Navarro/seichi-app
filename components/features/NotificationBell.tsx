"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
	getNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "@/app/(main)/notification-actions";
import { BADGE_MAX, NOTIFICATION_META, relativeTime } from "@/lib/notifications";
import type { AppNotification } from "@/types";

interface NotificationBellProps {
	/** conteggio risolto lato server: evita che il badge lampeggi all'apertura */
	initialUnread: number;
}

export default function NotificationBell({ initialUnread }: NotificationBellProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<AppNotification[] | null>(null);
	const [unread, setUnread] = useState(initialUnread);
	const [error, setError] = useState<string | null>(null);

	async function toggle() {
		if (open) {
			setOpen(false);
			return;
		}
		setOpen(true);
		// La lista si carica alla PRIMA apertura, non al montaggio della pagina:
		// il badge basta a decidere se aprire, e chi non apre non paga la query.
		if (items === null) await load();
	}

	async function load() {
		const res = await getNotifications();
		if ("error" in res) {
			setError(res.error);
			setItems([]);
			return;
		}
		setError(null);
		setItems(res.data);
		// Riallinea il badge a ciò che è appena arrivato: se il job ha generato
		// qualcosa dopo il render della pagina, il conteggio del server è vecchio.
		setUnread(res.data.filter((n) => !n.read).length);
	}

	/**
	 * Il tap segna come letta E naviga. È ciò che rende utile la colonna
	 * `destinazione`: una notifica che non porta da nessuna parte è un vicolo
	 * cieco. Lo stato si aggiorna subito, senza aspettare il server — se la
	 * scrittura fallisce la notifica ricompare non letta al prossimo caricamento,
	 * che è il modo giusto di sbagliare.
	 */
	async function openItem(n: AppNotification) {
		setOpen(false);
		if (!n.read) {
			setItems((prev) => prev?.map((i) => (i.id === n.id ? { ...i, read: true } : i)) ?? prev);
			setUnread((u) => Math.max(0, u - 1));
			await markNotificationRead(n.id);
		}
		router.push(n.destinazione);
	}

	async function markAll() {
		setItems((prev) => prev?.map((i) => ({ ...i, read: true })) ?? prev);
		setUnread(0);
		await markAllNotificationsRead();
	}

	return (
		<div className="relative">
			<button
				onClick={toggle}
				className="relative w-10 h-10 rounded-full flex items-center justify-center bg-control border border-subtle card-shadow active:opacity-80 cursor-pointer"
				aria-label={unread > 0 ? `Notifiche, ${unread} non lette` : "Notifiche"}
			>
				<Bell size={18} strokeWidth={1.6} className="text-secondary" />
				{/*
					Il mockup mostra la campanella nuda, ma senza segnale non c'è motivo
					di aprirla e il pannello muore. Oltre il nono il numero esatto
					smette di dire qualcosa di utile.
				*/}
				{unread > 0 && (
					<span
						className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center text-[10px] font-semibold leading-none"
						style={{ background: "var(--color-aka)", color: "#fff" }}
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
						Posizionato `fixed` sui margini della pagina invece che ancorato al
						bottone: il pannello è largo quanto il contenuto, e un dropdown
						agganciato alla campanella uscirebbe dallo schermo a destra.
					*/}
					{/*
						`--color-deep` (la "superficie solida") e non `bg-modal`: quello
						sta a 0.85 in tema scuro, pensato per i bottom sheet che coprono
						uno sfondo già oscurato. Qui il pannello galleggia sulla
						dashboard piena di numeri, e a 0.85 il testo delle card sotto si
						legge attraverso. Il 94% lascia il velo di vetro del design
						(che è a 0.92) senza sacrificare la leggibilità.
					*/}
					<div
						className="fixed left-5 right-5 top-23 z-50 flex flex-col max-h-[70dvh] rounded-[28px] border border-subtle modal-shadow backdrop-blur-2xl overflow-hidden"
						style={{ background: "color-mix(in srgb, var(--color-deep) 94%, transparent)" }}
					>
						<div className="flex items-center justify-between px-5 py-4 border-b border-subtle shrink-0">
							<h2 className="text-[15px] font-semibold">Notifiche</h2>
							{unread > 0 && (
								<button
									onClick={markAll}
									className="text-[12px] text-muted active:opacity-60 cursor-pointer"
								>
									segna tutte come lette
								</button>
							)}
						</div>

						<div className="overflow-y-auto">
							{items === null && (
								<p className="px-5 py-8 text-center text-[13px] text-muted">Caricamento…</p>
							)}

							{error && (
								<p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--color-aka)" }}>
									{error}
								</p>
							)}

							{items !== null && !error && items.length === 0 && (
								<div className="px-8 py-10 text-center">
									<p className="text-[14px] font-medium mb-1.5">Nessuna notifica</p>
									<p className="text-[12.5px] text-muted leading-relaxed">
										Qui arrivano gli avvisi su budget, obiettivi e rinnovi in arrivo.
									</p>
								</div>
							)}

							{items?.map((n) => {
								const meta = NOTIFICATION_META[n.type];
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
												{relativeTime(n.created_at)}
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
					</div>
				</>
			)}
		</div>
	);
}
