import { ElementType } from "react";
import Sparkline from "@/components/UI/Sparkline";
import { getI18n } from "@/lib/i18n/server";
import { DISPLAY_CURRENCY, formatMoney } from "@/lib/i18n/format";

/**
 * ⚠️ RESTA UN SERVER COMPONENT, e non è un dettaglio.
 *
 * Per formattare l'importo serviva il locale, e la via istintiva era aggiungere
 * `"use client"` e chiamare `useI18n()`. Ma la home è un server component e passa
 * `icon` — un COMPONENTE React, cioè una funzione. Attraversare il confine
 * server→client con una funzione non è possibile: React solleva "Functions cannot
 * be passed directly to Client Components", a runtime, dove né `tsc` né la build
 * lo vedono.
 *
 * La lingua si prende quindi da `getI18n()`, che è ciò che i server component
 * fanno già ovunque. È il rovescio esatto della regola scritta nei dizionari:
 * lì i DATI non possono portare funzioni verso il client, qui è un componente a
 * non poterle ricevere.
 */
interface SummaryCardProps {
	label: string;
	amount: number;
	icon: ElementType;
	color: string;
	trend?: number[];
	progress?: number;
}

function CircularProgress({ progress, color }: { progress: number; color: string }) {
	const r = 13;
	const circ = 2 * Math.PI * r;
	const offset = circ * (1 - Math.min(Math.max(progress, 0), 100) / 100);
	return (
		<svg width={32} height={32} viewBox="0 0 32 32" fill="none">
			{/* Traccia = l'accento al 18%, come nel mockup: il bianco all'8%
			    spariva del tutto sul fondo chiaro. */}
			<circle
				cx={16}
				cy={16}
				r={r}
				stroke={`color-mix(in srgb, ${color} 18%, transparent)`}
				strokeWidth="2.5"
			/>
			<circle
				cx={16}
				cy={16}
				r={r}
				stroke={color}
				strokeWidth="2.5"
				strokeDasharray={circ}
				strokeDashoffset={offset}
				strokeLinecap="round"
				transform="rotate(-90 16 16)"
			/>
		</svg>
	);
}

export default async function SummaryCard({ label, amount, icon, color, trend, progress }: SummaryCardProps) {
	const { locale } = await getI18n();
	const Icon = icon;
	return (
		<div className="rounded-2xl p-4 border border-subtle card-shadow bg-surface backdrop-blur-md flex flex-col gap-3">
			<div className="flex items-start justify-between">
				<div
					className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
					style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
				>
					<Icon size={17} style={{ color }} />
				</div>
				{progress !== undefined ? (
					<CircularProgress progress={progress} color={color} />
				) : trend ? (
					<Sparkline values={trend} color={color} />
				) : null}
			</div>
			<div>
				<p className="text-lg font-bold tracking-tight">
					{formatMoney(amount, { locale, currency: DISPLAY_CURRENCY, decimals: 2 })}
				</p>
				<p className="text-xs text-muted mt-0.5">{label}</p>
			</div>
		</div>
	);
}
