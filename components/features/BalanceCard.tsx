"use client";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/components/features/I18nProvider";
import {
	DISPLAY_CURRENCY,
	currencySymbol,
	formatNumber,
	splitAmount,
} from "@/lib/i18n/format";

interface BalanceCardProps {
	saldoTotale: number;
	saldoMese: number;
}

export default function BalanceCard({ saldoTotale, saldoMese }: BalanceCardProps) {
	const { locale, t } = useI18n();
	const [hidden, setHidden] = useState(false);
	const isPositive = saldoMese >= 0;
	// La divisione intero/decimali passa da `formatToParts`: cercare la virgola
	// era corretto solo in italiano — vedi `splitAmount` in lib/i18n/format.ts.
	const { sign, integer, decimal } = splitAmount(saldoTotale, locale);

	return (
		<div className="rounded-3xl p-5 border border-subtle card-shadow bg-surface backdrop-blur-md">
			<div className="flex items-center justify-between mb-3">
				<p className="text-sm text-muted">{t.home.balanceTotal}</p>
				<button
					onClick={() => setHidden((h) => !h)}
					className="w-7 h-7 flex items-center justify-center rounded-lg text-muted"
				>
					{hidden ? <EyeOff size={15} /> : <Eye size={15} />}
				</button>
			</div>

			<p className="font-bold tracking-tight mb-4 flex items-baseline gap-0.5">
				<span className="text-3xl font-semibold mr-1">
					{currencySymbol(DISPLAY_CURRENCY, locale)}
				</span>
				{hidden ? (
					<span className="text-5xl">••••••</span>
				) : (
					<>
						<span className="text-5xl">{sign}{integer}</span>
						<span className="text-3xl font-semibold text-muted">{decimal}</span>
					</>
				)}
			</p>

			<span
				className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
				style={{
					background: isPositive
						? "color-mix(in srgb, var(--color-midori) 16%, transparent)"
						: "color-mix(in srgb, var(--color-aka) 16%, transparent)",
					color: isPositive ? "var(--color-midori)" : "var(--color-aka)",
				}}
			>
				{isPositive ? "↑" : "↓"} {isPositive ? "+" : "−"}{" "}
				{currencySymbol(DISPLAY_CURRENCY, locale)}{" "}
				{hidden
					? "••••"
					: formatNumber(Math.abs(saldoMese), locale, {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
						})}{" "}
				{t.home.balanceThisMonth}
			</span>
		</div>
	);
}
