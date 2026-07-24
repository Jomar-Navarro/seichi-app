"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
	title: string;
	description: string;
	actionLabel?: string;
	onAction?: () => void;
	icon?: ReactNode;
}

/** Icona zen a cerchi concentrici — mirino calmo, stroke tenui che si adattano al tema */
function ZenTarget() {
	return (
		<svg width="88" height="88" viewBox="0 0 88 88" fill="none" className="text-muted">
			<circle cx="44" cy="44" r="30" stroke="currentColor" strokeWidth="1.3" opacity="0.35" />
			<circle cx="44" cy="44" r="21" stroke="currentColor" strokeWidth="1.3" opacity="0.35" />
			<circle cx="44" cy="44" r="12" stroke="currentColor" strokeWidth="1.3" opacity="0.35" />
			<path
				d="M44 14v6M44 68v6M14 44h6M68 44h6"
				stroke="currentColor"
				strokeWidth="1.3"
				strokeLinecap="round"
				opacity="0.55"
			/>
		</svg>
	);
}

export default function EmptyState({
	title,
	description,
	actionLabel,
	onAction,
	icon,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center text-center px-10 gap-[22px]">
			{icon ?? <ZenTarget />}
			<div>
				<p className="text-[15.5px] font-semibold mb-1.5">{title}</p>
				<p className="text-[13px] text-muted leading-relaxed max-w-[280px]">{description}</p>
			</div>
			{actionLabel && onAction && (
				<button
					onClick={onAction}
					className="px-[22px] py-3 rounded-full text-[13px] font-medium border border-subtle card-shadow"
					style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
				>
					{actionLabel}
				</button>
			)}
		</div>
	);
}
