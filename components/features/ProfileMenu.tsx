"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, LogOut } from "lucide-react";
import Avatar from "@/components/UI/Avatar";
import { signOut } from "@/app/(main)/impostazioni/actions";

interface ProfileMenuProps {
	initials: string;
	/** Foto profilo, se caricata — altrimenti si mostrano le iniziali */
	avatarUrl?: string | null;
}

export default function ProfileMenu({ initials, avatarUrl }: ProfileMenuProps) {
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
			<button
				onClick={() => setOpen((o) => !o)}
				className="rounded-full flex card-shadow active:opacity-80 cursor-pointer"
				aria-label="Profilo"
			>
				<Avatar src={avatarUrl} initials={initials} size={40} />
			</button>

			{open && (
				<div className="absolute right-0 top-12 z-50 w-52 rounded-2xl bg-modal border border-subtle modal-shadow backdrop-blur-2xl overflow-hidden">
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
