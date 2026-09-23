import { ElementType } from "react";
import Sparkline from "@/components/UI/Sparkline";
import { getI18n } from "@/lib/i18n/server";
import { DISPLAY_CURRENCY, currencySymbol, splitAmount } from "@/lib/i18n/format";

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
		// 34px da `lg:` (issue #108): scala uniforme sul `viewBox`, quindi è lo
		// stesso anello un po' più grande, non un secondo disegno.
		<svg width={32} height={32} viewBox="0 0 32 32" fill="none" className="lg:w-8.5 lg:h-8.5">
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
	/*
	 * ⚠️ L'importo passa da `splitAmount` e non più da `formatMoney` in un pezzo
	 * solo: da `lg:` i decimali sono più piccoli e smorzati (mockup desktop, issue
	 * #108), come già nelle due card grandi sopra. Sotto `lg:` lo span dei decimali
	 * eredita tutto dal paragrafo, quindi il telefono vede la stessa cifra di
	 * prima, carattere per carattere — per un importo non negativo, che è ciò che
	 * questa card somma: `splitAmount` scrive l'eventuale meno tipografico (U+2212),
	 * `formatMoney` il trattino.
	 */
	const { sign, integer, decimal } = splitAmount(amount, locale);
	return (
		/*
			⚠️ TRE livelli — issue #81 (i quadrati di Firefox). `overflow-hidden`
			da solo non basta (verificato dall'app vera su Firefox). Guscio
			(arrotonda, ritaglia, niente sfocatura propria) → vetro (riempie
			esatto, sfoca, niente angoli propri) → contenuto. Stesso schema di
			`BottomSheetShell`.

			Da `lg:` le misure del mockup desktop (issue #108): raggio 22, padding
			18/20, tessera icona 34, sparkline 62×24, cifra 21px. Solo varianti:
			la stessa card, non una copia per il desktop.
		*/
		<div className="relative rounded-2xl overflow-hidden card-shadow-ring lg:rounded-[22px]">
			<div className="absolute inset-0 bg-surface backdrop-blur-md" />
			<div className="relative p-4 flex flex-col gap-3 lg:px-5 lg:py-4.5 lg:gap-4.5">
				<div className="flex items-start justify-between lg:items-center">
					<div
						className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 lg:w-8.5 lg:h-8.5"
						style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
					>
						<Icon size={17} style={{ color }} />
					</div>
					{progress !== undefined ? (
						<CircularProgress progress={progress} color={color} />
					) : trend ? (
						<Sparkline values={trend} color={color} className="lg:w-15.5 lg:h-6" />
					) : null}
				</div>
				<div>
					<p className="text-lg font-bold tracking-tight lg:text-[21px] lg:font-semibold lg:tracking-[-0.3px] lg:leading-[1.2]">
						{currencySymbol(DISPLAY_CURRENCY, locale)} {sign}{integer}
						<span className="lg:text-sm lg:font-medium lg:text-muted">{decimal}</span>
					</p>
					<p className="text-xs text-muted mt-0.5 lg:mt-1.25">{label}</p>
				</div>
			</div>
		</div>
	);
}
