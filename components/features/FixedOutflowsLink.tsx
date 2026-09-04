"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
 * ⚠️ Stile: una STAT-TILE come `SummaryCard` della home (icona in alto,
 * importo grande, etichetta muta sotto) — non una riga da lista con
 * chevron a destra, che qui leggerebbe come una voce di impostazioni
 * infilata in mezzo ai grafici. La freccia in alto a destra (stile
 * "apri/vai", non "scorri l'elenco") è l'unico indizio che è toccabile.
 * `SummaryCard` stessa non si può riusare: è un Server Component async, e
 * un Server Component non si rende dentro un Client Component — questo lo
 * è per forza, per via di `clientClock()` sotto.
 *
 * Non ripete l'elenco delle regole (resta `RecurringManager`, con pausa/
 * modifica/eliminazione) — solo il totale e un tocco per arrivarci.
 *
 * Riusa `getAvailableThisMonth()` (già la fonte delle uscite fisse per la
 * card budget in impostazioni e per il coach): il totale dipende dal fuso
 * dell'UTENTE, che un server component non conosce — su Vercel direbbe UTC,
 * sbagliando il mese nelle prime ore del giorno.
 *
 * Degrada in silenzio su caricamento/errore/zero — non "€0" mentre ancora
 * non si sa, e non una card vuota per chi non ha ricorrenti: stesso
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
		<Link href="/impostazioni/ricorrenti" className="block mt-4">
			{/* ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto, come SummaryCard. */}
			<div className="relative rounded-2xl overflow-hidden card-shadow-ring active:opacity-80">
				<div className="absolute inset-0 bg-surface backdrop-blur-md" />
				<div className="relative p-4 flex flex-col gap-3">
					<div className="flex items-start justify-between">
						<div
							className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
							style={{ background: "color-mix(in srgb, var(--color-murasaki) 16%, transparent)" }}
						>
							<RepeatIcon size={17} style={{ color: "var(--color-murasaki)" }} />
						</div>
						<ArrowUpRight size={16} className="text-muted mt-0.5" />
					</div>
					<div>
						<p className="text-lg font-bold tracking-tight">
							{formatMoney(amount, { locale, currency: DISPLAY_CURRENCY, decimals: 2 })}
						</p>
						{/* ⚠️ "Uscite fisse" da solo non dice di cosa — chiesto usando
						    l'app. Seconda riga più muta, stessa frase usata dallo stato
						    vuoto di RecurringManager: è la stessa lista, altra porta. */}
						<p className="text-xs mt-0.5">{t.analytics.fixedOutflowsTitle}</p>
						<p className="text-[11px] text-muted mt-0.5">{t.analytics.fixedOutflowsHint}</p>
					</div>
				</div>
			</div>
		</Link>
	);
}
