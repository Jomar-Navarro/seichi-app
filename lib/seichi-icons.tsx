import React from "react";

export interface SeichiIconProps {
	size?: number;
	strokeWidth?: number;
	style?: React.CSSProperties;
	className?: string;
}

export type SeichiIcon = React.FC<SeichiIconProps>;

function base(props: SeichiIconProps, sw = 1.5) {
	return {
		width: props.size ?? 24,
		height: props.size ?? 24,
		viewBox: "0 0 24 24" as const,
		fill: "none" as const,
		stroke: "currentColor",
		strokeWidth: props.strokeWidth ?? sw,
		strokeLinecap: "round" as const,
		strokeLinejoin: "round" as const,
		style: props.style,
		className: props.className,
	};
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export function HomeIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.6)}>
			<path d="M3 10.5 12 3l9 7.5" />
			<path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
		</svg>
	);
}

export function ReceiptIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M6 3.5h12v15.5l-1.8-1.2-1.8 1.2-1.8-1.2-1.8 1.2-1.8-1.2-1.8 1.2V3.5z" />
			<path d="M8.5 7.5h7M8.5 11h7M8.5 14.5h4" />
		</svg>
	);
}

export function ChartNoAxesCombinedIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.6)}>
			<path d="M5 20v-5M10 20v-9M15 20v-3M20 20v-11" />
			<path d="M4 13.5l4-3 4 2 4-5 4 3" />
		</svg>
	);
}

export function PiggyBankIcon(p: SeichiIconProps) {
	const sw = p.strokeWidth ?? 1.5;
	return (
		<svg {...base(p, 1.5)}>
			<ellipse cx="11" cy="13" rx="7.3" ry="5.3" />
			<circle cx="18.7" cy="13.3" r="2.1" />
			<path d="M18.1 13.3h.01M19.3 13.3h.01" />
			<path d="M6.7 8.2 5.6 6.1l2.3 1" />
			<path d="M9.3 11.3h.01" strokeWidth={sw + 0.5} />
			<path d="M6.7 18v1.8M9.7 18.4v1.8M13.8 18.4v1.8M16.8 18v1.8" />
			<path d="M10.3 7.9v-1.3" />
		</svg>
	);
}

export function SettingsIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<circle cx="12" cy="12" r="3" />
			<path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18 6l-1.8 1.8M7.8 16.2 6 18M18 18l-1.8-1.8M7.8 7.8 6 6" />
		</svg>
	);
}

// ─── Transaction type icons ────────────────────────────────────────────────────

export function WalletIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V9h1.5A1.5 1.5 0 0 1 22 10.5v7a1.5 1.5 0 0 1-1.5 1.5H5.5A2.5 2.5 0 0 1 3 16.5v-9z" />
			<circle cx="17.5" cy="14" r="1.3" />
		</svg>
	);
}

export function ShoppingBagIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M6 8h12l-1 12a2 2 0 0 1-2 1.8H9A2 2 0 0 1 7 20L6 8z" />
			<path d="M9 8V6a3 3 0 0 1 6 0v2" />
		</svg>
	);
}

export function TrendingUpIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.6)}>
			<path d="M4 15l4.5-4.5 3 3L20 6" />
			<path d="M15 6h5v5" />
		</svg>
	);
}

export function RepeatIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M17 2l4 4-4 4M3 12v-2a4 4 0 0 1 4-4h14" />
			<path d="M7 22l-4-4 4-4M21 12v2a4 4 0 0 1-4 4H3" />
		</svg>
	);
}

// ─── Category icons (keys match DB values from onboarding) ────────────────────

export function BanknoteIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<rect x="2" y="6" width="20" height="12" rx="2" />
			<circle cx="12" cy="12" r="3" />
			<path d="M6.5 12h.01M17.5 12h.01" />
		</svg>
	);
}

export function BriefcaseIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<rect x="3" y="8" width="18" height="11" rx="1" />
			<path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
			<path d="M3 13h18" />
		</svg>
	);
}

export function AwardIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<circle cx="12" cy="8" r="5.5" />
			<path d="M8.5 13 7 21l5-2.5L17 21l-1.5-8" />
		</svg>
	);
}

export function GiftIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<rect x="4" y="9" width="16" height="11" rx="1.5" />
			<path d="M4 13h16M12 9v11" />
			<circle cx="9" cy="6" r="2.3" />
			<circle cx="15" cy="6" r="2.3" />
			<path d="M9 8.3V9M15 8.3V9" />
		</svg>
	);
}

export function ArrowDownLeftIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M9 14l-5-5 5-5" />
			<path d="M4 9h10a6 6 0 0 1 0 12h-2" />
		</svg>
	);
}

export function ShoppingCartIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" />
			<circle cx="9.5" cy="20" r="1.3" />
			<circle cx="17" cy="20" r="1.3" />
		</svg>
	);
}

export function UtensilsCrossedIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M7 2v7a2 2 0 0 1-2 2v11" />
			<path d="M9 2v6M11 2v6M7 11v-2" />
			<path d="M17 2c-1.8 1-3 3.4-3 6 0 2.4 1.1 4.5 2.7 5.6L16 22" />
		</svg>
	);
}

export function CarIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M4 16.5v-3.2L6 8.8c.3-.7 1-1.1 1.7-1.1h8.6c.7 0 1.4.4 1.7 1.1l2 4.5v3.2" />
			<path d="M4 16.5h16M4 16.5v1.8M20 16.5v1.8" />
			<circle cx="7.5" cy="16.5" r="1.5" />
			<circle cx="16.5" cy="16.5" r="1.5" />
		</svg>
	);
}

export function HeartPulseIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M12 20.5S4 15.7 4 9.8C4 6.9 6.2 5 8.6 5c1.6 0 3 .8 3.4 2 .4-1.2 1.8-2 3.4-2 2.4 0 4.6 1.9 4.6 4.8 0 5.9-8 10.7-8 10.7z" />
			<path d="M6.5 11h2l1.5-3 2 6 1.5-3h4" />
		</svg>
	);
}

export function ShirtIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M4 7 8 4 9.5 5.5h5L16 4l4 3-2.5 3.2L16 9v11H8V9l-1.5 1.2L4 7Z" />
		</svg>
	);
}

export function SmileIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<circle cx="12" cy="12" r="9" />
			<path d="M8.5 14.5s1.5 2 3.5 2 3.5-2 3.5-2" />
			<path d="M9 10h.01M15 10h.01" />
		</svg>
	);
}

export function ShieldIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M12 3l7 3v5.5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6l7-3Z" />
		</svg>
	);
}

export function PlaneIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M2.5 16.5l19-6.7c1-.35 1-1.8-.1-2.1L4.7 4.1c-.8-.2-1.5.5-1.2 1.3l2 5.4-2 5.4c-.3.8.4 1.5 1 1.3z" />
			<path d="M6.5 11.3h6" />
		</svg>
	);
}

export function Building2Icon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M3 21h18" />
			<path d="M4 21V10M8 21V10M12 21V10M16 21V10M20 21V10" />
			<path d="M2 10l10-6 10 6" />
		</svg>
	);
}

export function LaptopIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<rect x="3" y="5" width="18" height="12" rx="1.5" />
			<path d="M1.5 17h21" />
		</svg>
	);
}

export function BarChart2Icon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M4 20V14M9 20V8M14 20V11M19 20V4" />
		</svg>
	);
}

export function BitcoinIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<circle cx="12" cy="12" r="9" />
			<path d="M9 8.5h4c1.1 0 2 .9 2 2s-.9 2-2 2H9M9 12.5h4.5c1.1 0 2 .9 2 2s-.9 2-2 2H9" />
			<path d="M9 8.5V16M11.5 7.5v1.5M11.5 15.5v1.5" />
		</svg>
	);
}

export function PlayIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M8.5 6l10 6-10 6V6z" />
		</svg>
	);
}

export function MusicIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M9 18V5l11-2v13" />
			<circle cx="6" cy="18" r="3" />
			<circle cx="17" cy="16" r="3" />
		</svg>
	);
}

export function DumbbellIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M4 9v6M2 10v4M20 9v6M22 10v4M7 12h10M6 8v8M18 8v8" />
		</svg>
	);
}

export function ZapIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
		</svg>
	);
}

export function KeyRoundIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<circle cx="8" cy="15" r="4" />
			<path d="M10.5 12.5 20 3" />
			<path d="M17 6l2 2M14 9l2 2" />
		</svg>
	);
}

// ─── Goal-only icons ──────────────────────────────────────────────────────────

export function HeartIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M12 20.5S4 15.7 4 9.8C4 6.9 6.2 5 8.6 5c1.6 0 3 .8 3.4 2 .4-1.2 1.8-2 3.4-2 2.4 0 4.6 1.9 4.6 4.8 0 5.9-8 10.7-8 10.7z" />
		</svg>
	);
}

export function GraduationCapIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M2 9l10-4 10 4-10 4-10-4z" />
			<path d="M6 11v4c0 1.5 2.5 3 6 3s6-1.5 6-3v-4" />
			<path d="M22 9v5.5" />
		</svg>
	);
}

export function StarIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M12 3.5l2.4 5.1 5.6.6-4.2 3.8 1.2 5.5L12 15.9 6.9 18.5l1.2-5.5-4.2-3.8 5.6-.6L12 3.5z" />
		</svg>
	);
}
