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
	/**
	 * Nome accanto all'avatar. Se manca, il trigger resta il solo avatar e il
	 * menu si ancora a destra: la forma usata fuori dalla Home.
	 */
	name?: string;
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

	// Nel mockup è l'intero gruppo avatar+nome ad aprire il menu, non il solo
	// avatar: il chevron accanto al nome è ciò che lo annuncia.
	const expanded = Boolean(name);

	return (
		<div className="relative" ref={ref}>
			<button
				onClick={() => setOpen((o) => !o)}
				className={`flex items-center cursor-pointer active:opacity-80 rounded-2xl ${
					expanded ? "gap-3 p-1 -m-1" : ""
				}`}
				aria-label="Profilo"
				aria-expanded={open}
			>
				<Avatar src={avatarUrl} initials={initials} size={42} className="card-shadow" />
				{expanded && (
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
				)}
			</button>

			{open && (
				// Ancorato al lato da cui parte il trigger, altrimenti sulla Home il
				// pannello uscirebbe dallo schermo a sinistra.
				<div
					className={`absolute top-13 z-50 w-56 rounded-2xl bg-modal border border-subtle modal-shadow backdrop-blur-2xl overflow-hidden ${
						expanded ? "left-0" : "right-0"
					}`}
				>
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
							<span className="text-sm font-medium" style={{ color: "var(--color-aka)" }}>
								Esci
							</span>
						</button>
					</form>
				</div>
			)}
		</div>
	);
}
