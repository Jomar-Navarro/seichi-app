"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, LogOut, ChevronDown } from "lucide-react";
import Avatar from "@/components/UI/Avatar";
import ThemeToggle from "./ThemeToggle";
import { signOut } from "@/app/(main)/impostazioni/actions";

interface ProfileMenuProps {
	initials: string;
	/** Foto profilo, se caricata — altrimenti si mostrano le iniziali */
	avatarUrl?: string | null;
	/** Nome accanto all'avatar. */
	name: string;
	/** Riga sopra il nome. */
	greeting?: string;
}

export default function ProfileMenu({ initials, avatarUrl, name, greeting }: ProfileMenuProps) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function onClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener("mousedown", onClick);
		return () => document.removeEventListener("mousedown", onClick);
	}, [open]);

	return (
		<div className="relative" ref={ref}>
			{/* Nel mockup è l'intero gruppo avatar+nome ad aprire il menu, non il
			    solo avatar: il chevron accanto al nome è ciò che lo annuncia. */}
			<button
				onClick={() => setOpen((o) => !o)}
				className="flex items-center gap-3 p-1 -m-1 cursor-pointer active:opacity-80 rounded-2xl"
				// NIENTE aria-label: il bottone contiene già nome e saluto, e un
				// label lo sovrascriverebbe — uno screen reader leggerebbe "Profilo"
				// al posto di "Bentornato, <nome>".
				aria-haspopup="menu"
				aria-expanded={open}
			>
				<Avatar src={avatarUrl} initials={initials} size={42} className="card-shadow" />
				<span className="text-left min-w-0">
					{greeting && (
						<span className="block text-xs text-muted leading-none">{greeting}</span>
					)}
					<span className="flex items-center gap-1.5 mt-1">
						<span className="text-base font-semibold leading-none truncate max-w-36">
							{name}
						</span>
						<ChevronDown size={11} className="text-muted shrink-0" />
					</span>
				</span>
			</button>

			{open && (
				// Ancorato a sinistra, il lato da cui parte il trigger: altrimenti
				// sulla Home il pannello uscirebbe dallo schermo.
				<div className="absolute left-0 top-13 z-50 w-56 rounded-2xl bg-modal border border-subtle modal-shadow backdrop-blur-2xl overflow-hidden">
					<ThemeToggle />
					<Link
						href="/impostazioni"
						onClick={() => setOpen(false)}
						className="flex items-center gap-3 px-4 h-12 border-b border-subtle active:opacity-80"
					>
						<Settings size={16} className="text-secondary" />
						<span className="text-sm font-medium">Impostazioni</span>
					</Link>
					<form action={signOut}>
						<button
							type="submit"
							className="flex items-center gap-3 px-4 h-12 w-full text-left active:opacity-80"
						>
							<LogOut size={16} style={{ color: "var(--color-aka)" }} />
							<span className="text-sm font-medium" style={{ color: "var(--ink-aka)" }}>
								Esci
							</span>
						</button>
					</form>
				</div>
			)}
		</div>
	);
}
