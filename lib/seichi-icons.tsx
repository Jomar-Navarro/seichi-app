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

/**
 * Il gemello esatto di `TrendingUpIcon`, specchiato sull'asse orizzontale
 * (ogni `y` diventa `24 − y`): stessa spezzata, stesso angolo, freccia in basso
 * a destra invece che in alto.
 *
 * ⚠️ Specchiata e non ridisegnata, perché le due icone stanno **una accanto
 * all'altra** nella griglia del `TransactionModal` — investimento e
 * disinvestimento sono lo stesso atto nei due versi. Un disegno "simile" fatto a
 * mano avrebbe pendenze diverse, e la parentela fra i due tipi si leggerebbe
 * come somiglianza casuale invece che come opposizione.
 */
export function TrendingDownIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.6)}>
			<path d="M4 9l4.5 4.5 3-3L20 18" />
			<path d="M15 18h5v-5" />
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

/**
 * Trasferimento fra conti (Fase 20b).
 *
 * Due frecce opposte e nessuna direzione dominante: un trasferimento non è né
 * un'entrata né un'uscita, e l'icona non deve suggerire il contrario. Per la
 * stessa ragione non riusa `ArrowDownLeftIcon`, che nell'app significa
 * "in arrivo".
 */
export function ArrowLeftRightIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.6)}>
			<path d="M16 3l4 4-4 4" />
			<path d="M20 7H4" />
			<path d="M8 21l-4-4 4-4" />
			<path d="M4 17h16" />
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


// ─── Extended category library icons (Fase 13) ───────────────────

export function LandmarkIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M3 21h18" />
			<path d="M4 21V10M8 21V10M12 21V10M16 21V10M20 21V10" />
			<path d="M2 10l10-6 10 6" />
		</svg>
	);
}

export function CoinsIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<circle cx="8.5" cy="8.5" r="5.5" />
			<circle cx="15" cy="15" r="5.5" />
		</svg>
	);
}

export function ArrowDownToLineIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.6)}>
			<path d="M12 4v12" />
			<path d="M7 11l5 5 5-5" />
			<path d="M4 20h16" />
		</svg>
	);
}

export function HandCoinsIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<circle cx="12" cy="8" r="4" />
			<path d="M4 19c0-2.8 2.5-4.5 5.5-4.5H14a2 2 0 0 1 0 4h-3" />
			<path d="M2 15.5h3" />
		</svg>
	);
}

export function PercentIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.6)}>
			<path d="M5 19 19 5" />
			<circle cx="7" cy="7" r="2.5" />
			<circle cx="17" cy="17" r="2.5" />
		</svg>
	);
}

export function HandshakeIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M2 12h4l3-3 3 3 2-2h4" />
			<path d="M6 12l3.5 3.5a1.5 1.5 0 0 0 2.1 0L15 12" />
		</svg>
	);
}

export function CircleDollarSignIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 6v12M9.5 9a2.5 2.5 0 0 1 2.5-1.5c1.5 0 2.5.8 2.5 2s-1 1.7-2.5 2-2.5.8-2.5 2 1 2 2.5 2a2.5 2.5 0 0 0 2.5-1.5" />
		</svg>
	);
}

export function ShoppingBasketIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M4 10h16l-1.5 9a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 10z" />
			<path d="M4 10l3-6M20 10l-3-6" />
			<path d="M9 10a3 3 0 0 1 6 0" />
		</svg>
	);
}

export function UtensilsIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M7 2v7a2 2 0 0 1-2 2v11M9 2v6M11 2v6M7 11v-2" />
			<path d="M17 2c-1.8 1-3 3.4-3 6 0 2.4 1.1 4.5 2.7 5.6L16 22" />
		</svg>
	);
}

export function WifiIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M2 8.5a15.5 15.5 0 0 1 20 0" />
			<path d="M5.5 12.5a10.5 10.5 0 0 1 13 0" />
			<path d="M9 16.3a5.5 5.5 0 0 1 6 0" />
			<circle cx="12" cy="19.5" r="1.1" fill="currentColor" />
		</svg>
	);
}

export function FuelIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
			<path d="M3 21h11" />
			<path d="M14 9h2l3 3v6a1.5 1.5 0 0 1-3 0v-2a1 1 0 0 0-1-1h-1" />
			<path d="M6 6h4v4H6z" />
		</svg>
	);
}

export function BabyIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<circle cx="12" cy="7" r="3.2" />
			<path d="M7 20c0-3.5 2-6 5-6s5 2.5 5 6" />
			<path d="M9.5 7c0 1 1 1.6 2.5 1.6s2.5-.6 2.5-1.6" />
		</svg>
	);
}

export function PawPrintIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<circle cx="8" cy="8" r="1.6" />
			<circle cx="13" cy="6.5" r="1.6" />
			<circle cx="17" cy="9" r="1.6" />
			<path d="M9 15.5c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5-1.8 3-4 3-4-.8-4-3Z" />
		</svg>
	);
}

export function CoffeeIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
			<path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" />
			<path d="M7 4c0 1-1 1-1 2M11 4c0 1-1 1-1 2" />
		</svg>
	);
}

export function WrenchIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2Z" />
		</svg>
	);
}

export function StethoscopeIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M6 3v6a4 4 0 0 0 8 0V3" />
			<path d="M6 3H4.5M14 3h1.5" />
			<path d="M10 13v3a4 4 0 0 0 8 0v-1.5" />
			<circle cx="19" cy="14" r="1.6" />
		</svg>
	);
}

export function LineChartIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.6)}>
			<path d="M3 3v18h18" />
			<path d="M7 14l3-3 3 2 5-6" />
		</svg>
	);
}

export function PieChartIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M12 3v9l7.8 4.5" />
			<path d="M20.9 13.5A9 9 0 1 1 12 3" />
		</svg>
	);
}

export function LayersIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M12 3 3 8l9 5 9-5-9-5Z" />
			<path d="M3 12l9 5 9-5" />
			<path d="M3 16l9 5 9-5" />
		</svg>
	);
}

export function BarChart3Icon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
		</svg>
	);
}

export function VaultIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<rect x="3" y="4" width="18" height="16" rx="2" />
			<circle cx="12" cy="12" r="4" />
			<circle cx="12" cy="12" r="1" fill="currentColor" />
			<path d="M6 4v2M18 4v2M6 18v2M18 18v2" />
		</svg>
	);
}

export function GlobeIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<circle cx="12" cy="12" r="9" />
			<path d="M3 12h18" />
			<path d="M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" />
		</svg>
	);
}

export function GemIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M6 3h12l4 6-10 12L2 9Z" />
			<path d="M2 9h20M8.5 3 6 9l6 12 6-12-2.5-6" />
		</svg>
	);
}

export function TargetIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<circle cx="12" cy="12" r="9" />
			<circle cx="12" cy="12" r="5.3" />
			<circle cx="12" cy="12" r="1.6" fill="currentColor" />
		</svg>
	);
}

export function UmbrellaIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M12 2c5 0 9 4 9 8H3c0-4 4-8 9-8Z" />
			<path d="M12 10v9a2 2 0 0 1-4 0" />
			<path d="M12 2v2" />
		</svg>
	);
}

export function SunriseIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M12 3v5" />
			<path d="M4.5 12a7.5 7.5 0 0 1 15 0" />
			<path d="M2 12h1.5M20.5 12H22M5 5.5l1.5 1.5M19 5.5l-1.5 1.5" />
			<path d="M2 17h20" />
		</svg>
	);
}

export function SparklesIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.3)}>
			<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
			<path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z" />
		</svg>
	);
}

export function TvIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<rect x="3" y="6" width="18" height="12" rx="2" />
			<path d="M8 21h8M12 18v3" />
		</svg>
	);
}

export function SmartphoneIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<rect x="7" y="2" width="10" height="20" rx="2" />
			<path d="M11 18h2" />
		</svg>
	);
}

export function CloudIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.8A3.5 3.5 0 0 0 7 18Z" />
		</svg>
	);
}

export function NewspaperIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M4 4h13v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
			<path d="M17 8h3v10a2 2 0 0 1-2 2h-1" />
			<path d="M7 8h6M7 11.5h6M7 15h4" />
		</svg>
	);
}

export function Gamepad2Icon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<rect x="2.5" y="7.5" width="19" height="10" rx="4" />
			<path d="M7 10.5v4M5 12.5h4" />
			<circle cx="16" cy="10.5" r="1" fill="currentColor" />
			<circle cx="18.5" cy="13" r="1" fill="currentColor" />
		</svg>
	);
}

export function BookOpenIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<path d="M12 6c-2-1.3-4.5-2-7-2v14c2.5 0 5 .7 7 2 2-1.3 4.5-2 7-2V4c-2.5 0-5 .7-7 2Z" />
			<path d="M12 6v14" />
		</svg>
	);
}

export function MailIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<rect x="3" y="5.5" width="18" height="13" rx="2.5" />
			<path d="M3.5 7 12 13l8.5-6" />
		</svg>
	);
}

export function CreditCardIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<rect x="2.5" y="5" width="19" height="14" rx="2.5" />
			<path d="M2.5 9.5h19" />
			<path d="M6 15h4" />
		</svg>
	);
}

export function RadioIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.4)}>
			<circle cx="12" cy="14" r="6" />
			<circle cx="12" cy="14" r="1" fill="currentColor" />
			<path d="M8 14a4 4 0 0 1 8 0" />
			<path d="M4 9 20 5M4 9l3 1M20 5l-3 1" />
		</svg>
	);
}

export function HeadphonesIcon(p: SeichiIconProps) {
	return (
		<svg {...base(p, 1.5)}>
			<path d="M4 15v-3a8 8 0 0 1 16 0v3" />
			<rect x="2.5" y="14" width="4" height="6" rx="1.5" />
			<rect x="17.5" y="14" width="4" height="6" rx="1.5" />
		</svg>
	);
}
