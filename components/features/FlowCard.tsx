"use client";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/features/I18nProvider";
import { DISPLAY_CURRENCY, currencySymbol, splitAmount } from "@/lib/i18n/format";

interface FlowCardProps {
	/** entrate − spese − abbonamenti del mese. Vedi `getDashboardTotals`. */
	flussoMese: number;
	/**
	 * Il nome del mese, già formattato.
	 *
	 * ⚠️ Arriva dal SERVER come prop e non si calcola qui, benché questo sia un
	 * client component e `new Date()` darebbe il mese dell'UTENTE invece che
	 * quello del processo. Il motivo non è l'idratazione: è che **l'etichetta
	 * deve descrivere gli stessi dati del numero**. I confini dei bucket li
	 * calcola `getDashboardTotals` col `new Date()` del server (scelta
	 * deliberata, vedi il commento là), quindi calcolare il mese qui potrebbe
	 * far scrivere "luglio" sopra i numeri di giugno nelle prime ore del mese.
	 * Meglio un'etichetta coerente col dato che un'etichetta coerente col fuso.
	 */
	monthLabel: string;
}

/**
 * La cifra grande della home.
 *
 * ⚠️ Non è più un SALDO, e il nome del file lo dice (era `BalanceCard`). Con i
 * conti, "quanto ho" ha una risposta vera nella pagina conti — la somma dei
 * saldi — e il vecchio `saldoTotale` ne dava una diversa, perché sottraeva i
 * risparmi e ignorava `initial_balance`. Due schermate con due risposte sono la
 * configurazione peggiore, quindi la 20a ne toglie una e questa card dichiara
 * ciò che la home è sempre stata: una vista di FLUSSO.
 *
 * Le due righe sotto il numero esistono per dirlo, e la seconda è un link: una
 * card che dichiara "i saldi reali sono altrove" senza portarti altrove sarebbe
 * un vicolo cieco.
 */
export default function FlowCard({ flussoMese, monthLabel }: FlowCardProps) {
	const { locale, t } = useI18n();
	const [hidden, setHidden] = useState(false);
	const isPositive = flussoMese >= 0;
	// La divisione intero/decimali passa da `formatToParts`: cercare la virgola
	// era corretto solo in italiano — vedi `splitAmount` in lib/i18n/format.ts.
	const { sign, integer, decimal } = splitAmount(flussoMese, locale);

	return (
		<div className="rounded-3xl p-5 border border-subtle card-shadow bg-surface backdrop-blur-md">
			<div className="flex items-center justify-between mb-3">
				{/*
					⚠️ Il mockup mette qui anche una pastiglia "Questo mese" con il
					chevron, cioè un SELETTORE DI PERIODO. Non è stata resa: il
					periodo variabile non è nella 20a, e una pastiglia identica ma
					inerte sarebbe un comando che mente sulla propria natura. Il
					mese è già nel titolo, quindi non si perde informazione.
				*/}
				<p className="text-sm text-muted">
					{t.home.flowTitle} · {monthLabel}
				</p>
				<button
					onClick={() => setHidden((h) => !h)}
					className="w-7 h-7 flex items-center justify-center rounded-lg text-muted"
					aria-label={t.common.toggleVisibility}
				>
					{hidden ? <EyeOff size={15} /> : <Eye size={15} />}
				</button>
			</div>

			{/*
				⚠️ L'INCHIOSTRO, non l'accento: `--color-midori` come testo dà ~3,2:1
				su fondo chiaro, sotto il 4,5:1 di WCAG AA. Il mockup usa già
				`#5C7350`, che è `--ink-midori` — accento e inchiostro coincidono
				solo nel tema scuro.
			*/}
			<p
				className={`font-semibold tracking-tight mb-1.5 flex items-baseline gap-0.5 ${
					isPositive ? "text-midori-ink" : "text-aka-ink"
				}`}
			>
				<span className="text-2xl font-semibold mr-1">
					{currencySymbol(DISPLAY_CURRENCY, locale)}
				</span>
				{hidden ? (
					<span className="text-4xl">••••••</span>
				) : (
					<>
						<span className="text-4xl">{sign}{integer}</span>
						<span className="text-2xl font-medium text-muted">{decimal}</span>
					</>
				)}
			</p>

			<p className="text-[11.5px] leading-relaxed text-disabled mb-3">
				{t.home.flowExplain}
			</p>

			<Link
				href="/conti"
				className="flex items-center gap-1.5 pt-2.5 border-t border-subtle text-xs font-semibold text-ao-ink"
			>
				{t.home.flowBalancesHint}
				<ArrowRight size={13} />
			</Link>
		</div>
	);
}
