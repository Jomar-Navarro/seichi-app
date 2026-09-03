"use client";
import { Eye, EyeOff } from "lucide-react";
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
	/**
	 * ⚠️ Lo stato dell'occhio arriva dall'ALTO (`HomeHero`), non è locale.
	 * Tenendolo qui si poteva nascondere il flusso lasciando il saldo della card
	 * accanto in chiaro: due cifre nello stesso carosello, una coperta e una no,
	 * cioè non nascondere niente.
	 */
	hidden: boolean;
	onToggleHidden: () => void;
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
export default function FlowCard({
	flussoMese,
	monthLabel,
	hidden,
	onToggleHidden,
}: FlowCardProps) {
	const { locale, t } = useI18n();
	const isPositive = flussoMese >= 0;
	// La divisione intero/decimali passa da `formatToParts`: cercare la virgola
	// era corretto solo in italiano — vedi `splitAmount` in lib/i18n/format.ts.
	const { sign, integer, decimal } = splitAmount(flussoMese, locale);

	/*
	 * ⚠️ `h-full flex flex-col`: le due pagine del carosello hanno contenuti di
	 * altezza diversa (il flusso non ha il piè di pagina che il saldo ha), e
	 * senza questo la card più corta lasciava un vuoto visibile fra il proprio
	 * bordo e i puntini — che si legge come un difetto, non come una scelta.
	 * Riempiendo l'altezza il carosello resta stabile durante lo scorrimento e
	 * l'ultima riga si appoggia in basso con `mt-auto`.
	 */
	return (
		/*
			⚠️ TRE livelli — issue #81. `overflow-hidden` da solo non basta
			(verificato da Firefox). Guscio → vetro → contenuto, stesso schema
			di `AccountsBalanceCard`, che è la card gemella nello stesso carosello.
		*/
		<div className="relative h-full rounded-3xl overflow-hidden card-shadow-ring">
			<div className="absolute inset-0 bg-surface backdrop-blur-md" />
			<div className="relative h-full flex flex-col p-5">
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
					onClick={onToggleHidden}
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

			{/*
				⚠️ Il link "I saldi reali sono nella pagina conti" NON c'è più, e la
				riga qui sotto ne ha preso il posto facendo due lavori.

				Con il carosello quel link mandava per la strada lunga a una cosa
				distante uno swipe: il saldo è nella card accanto. Era anche diventato
				incompleto al punto di sviare — i saldi non sono "nella pagina conti",
				uno è proprio lì. Il collegamento a `/conti` non è sparito dall'app:
				vive sulla card del saldo, che è il posto dove l'utente sta già
				pensando ai conti.

				La riga ora dice cosa questo numero NON è **e** rivela che ce n'è un
				altro accanto — che è il difetto tipico dei caroselli, metà del
				contenuto invisibile a chi non sa che si scorre.
			*/}
			<p className="mt-auto text-[11.5px] leading-relaxed text-disabled">
				{t.home.flowExplain}
			</p>
			</div>
		</div>
	);
}
