"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { RepeatIcon } from "@/lib/seichi-icons";
import { getAvailableThisMonth } from "@/app/(main)/budget-actions";
import { useI18n } from "@/components/features/I18nProvider";
import { DISPLAY_CURRENCY, formatMoney } from "@/lib/i18n/format";
import { clientClock } from "@/lib/dates";

/**
 * Scorciatoia da `/analisi` a `/impostazioni/ricorrenti` (issue #86, chiesto
 * usando l'app). Il donut "Spese per categoria" sopra questa card esclude
 * DELIBERATAMENTE gli abbonamenti — sono uscite fisse, non spese variabili —
 * quindi senza un collegamento qui l'unico modo di scoprire "quali
 * abbonamenti ho e quanto mi costano ogni mese" è sapere che la loro
 * gestione vive nelle impostazioni. Un utente al primo utilizzo non lo sa.
 *
 * Non ripete l'elenco — quello resta `RecurringManager`, con pausa/modifica/
 * eliminazione — solo il totale e un tocco per arrivarci.
 *
 * ⚠️ Carica il dato da sé, come `GlobalBudgetSection`: il totale dipende dal
 * fuso dell'UTENTE (`clientClock()`), che un server component non conosce —
 * su Vercel direbbe UTC, sbagliando il mese nelle prime ore del giorno.
 * `getAvailableThisMonth()` e non una chiamata dedicata: è già la funzione
 * che restituisce le uscite fisse senza ricalcolarle una seconda volta (la
 * stessa usata dalla card budget in impostazioni e dal coach).
 *
 * ⚠️ Degrada in silenzio su caricamento/errore/zero — non "€0" mentre
 * ancora non si sa, e non una card vuota per chi non ha ricorrenti: stesso
 * trattamento già riservato a `getAccounts()` su questa pagina.
 */
export default function FixedOutflowsLink() {
	const { locale, t } = useI18n();
	const [amount, setAmount] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;
		getAvailableThisMonth(clientClock()).then((res) => {
			if (cancelled) return;
			if (!("error" in res)) setAmount(res.data.fixedOutflows);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	if (!amount) return null;

	return (
		<Link
			href="/impostazioni/ricorrenti"
			className="flex items-center gap-3 rounded-[22px] px-4 py-3.5 mt-4 bg-card card-shadow-ring active:opacity-80"
		>
			<span
				className="w-9.5 h-9.5 rounded-[13px] flex items-center justify-center shrink-0"
				style={{ background: "color-mix(in srgb, var(--color-murasaki) 13%, transparent)" }}
			>
				<RepeatIcon size={17} strokeWidth={1.5} style={{ color: "var(--color-murasaki)" }} />
			</span>
			<div className="flex-1 min-w-0">
				<p className="text-[13.5px] font-semibold">{t.analytics.fixedOutflowsTitle}</p>
				<p className="text-[12px] text-muted mt-0.5">
					{formatMoney(amount, { locale, currency: DISPLAY_CURRENCY, decimals: 2 })}
					{" · "}
					{t.analytics.fixedOutflowsCta}
				</p>
			</div>
			<ChevronRight size={16} className="shrink-0 text-muted" />
		</Link>
	);
}
