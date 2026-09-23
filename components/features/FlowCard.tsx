"use client";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/components/features/I18nProvider";
import { DISPLAY_CURRENCY, currencySymbol, splitAmount } from "@/lib/i18n/format";
import Sparkline from "@/components/UI/Sparkline";

interface FlowCardProps {
	/** entrate − spese − abbonamenti del mese. Vedi `getDashboardTotals`. */
	flussoMese: number;
	/**
	 * Il flusso dei mesi del trend (`flussoTrend` di `getDashboardTotals`,
	 * l'ultimo punto è `flussoMese`): la sparkline d'area da `lg:`.
	 */
	trend: number[];
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
	trend,
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

			Da `lg:` (mockup desktop, issue #108) stesse misure della gemella, più
			la tinta del flusso: vetro e anello al verde di `--color-midori`. Il
			vetro MESCOLA l'accento con `--surface` invece di sostituirlo: il
			mockup è solo scuro, dove `--surface` è quasi trasparente, ma in chiaro
			è il vetro bianco che fa da card — un 7% di verde da solo lascerebbe
			la card trasparente sopra la carta.

			⚠️ La sparkline d'area del mockup disegna SOLO il flusso dei mesi scorsi
			(entrate − spese − abbonamenti): `flussoTrend`, calcolato in
			`getDashboardTotals` con la stessa `flussoDaTotali()` della cifra, sugli
			stessi bucket e senza query in più. Disegnare `entrate − spese` sarebbe
			stata una quinta definizione di «uscita» sotto la parola che la 20a ha
			fissato. E un mese in rosso resta dentro il disegno: `Sparkline` scala
			dal minimo, zero compreso.
		*/
		<div className="relative h-full rounded-3xl overflow-hidden card-shadow-ring lg:rounded-[28px] lg:shadow-[0px_14px_40px_var(--shadow-drop),inset_0px_1px_0px_var(--shadow-inset),inset_0px_0px_0px_1px_color-mix(in_srgb,var(--color-midori)_16%,transparent)]">
			<div className="absolute inset-0 bg-surface backdrop-blur-md lg:bg-[color-mix(in_srgb,var(--color-midori)_7%,var(--surface))]" />
			<div className="relative h-full flex flex-col p-5 lg:pt-6.5 lg:px-7 lg:pb-6">
			<div className="flex items-center justify-between mb-3 lg:mb-4.5">
				{/*
					⚠️ Il mockup mette qui anche una pastiglia "Questo mese" con il
					chevron, cioè un SELETTORE DI PERIODO. Non è stata resa: il
					periodo variabile non è nella 20a, e una pastiglia identica ma
					inerte sarebbe un comando che mente sulla propria natura. Il
					mese è già nel titolo, quindi non si perde informazione.
				*/}
				<p className="text-sm text-muted lg:text-[12.5px] lg:tracking-[0.4px]">
					{t.home.flowTitle} · {monthLabel}
				</p>
				<button
					onClick={onToggleHidden}
					// issue #69 — w-11 h-11 (44px): unico elemento a fine riga,
					// l'icona resta 15px.
					className="w-11 h-11 -my-2 -mr-2 flex items-center justify-center rounded-lg text-muted"
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
			{/* Da `lg:` stesse misure della cifra del saldo accanto — vedi lì. */}
			<p
				className={`font-semibold tracking-tight mb-1.5 flex items-baseline gap-0.5 lg:tracking-[-1.4px] lg:leading-none lg:mb-3.5 ${
					isPositive ? "text-midori-ink" : "text-aka-ink"
				}`}
			>
				<span className="text-2xl font-semibold mr-1 lg:mr-2 lg:text-[42px] xl:text-[52px]">
					{currencySymbol(DISPLAY_CURRENCY, locale)}
				</span>
				{hidden ? (
					<span className="text-4xl lg:text-[42px] xl:text-[52px]">••••••</span>
				) : (
					<>
						<span className="text-4xl lg:text-[42px] xl:text-[52px]">{sign}{integer}</span>
						<span className="text-2xl font-medium text-muted lg:tracking-[-0.4px] xl:text-[30px]">{decimal}</span>
					</>
				)}
			</p>

			{/*
				Solo da `lg:`: il carosello del telefono resta com'era. Si nasconde
				con l'occhio insieme alla cifra — la forma della curva dice quanto è
				cambiato il flusso, cioè è parte del numero che l'occhio copre.
				Il colore è quello del mese a schermo, come la cifra sopra: la curva
				fa parte della card di QUESTO mese. I mesi negativi restano leggibili
				comunque — l'area si chiude sulla linea dello zero, non sul fondo.
			*/}
			{!hidden && (
				<Sparkline
					values={trend}
					color={isPositive ? "var(--color-midori)" : "var(--color-aka)"}
					width={320}
					height={46}
					opacity={0.85}
					areaOpacity={0.1}
					className="hidden lg:block w-full h-11.5 mb-3.5"
				/>
			)}

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
			<p className="mt-auto text-[11.5px] leading-relaxed text-disabled lg:text-xs lg:leading-[1.55]">
				{t.home.flowExplain}
			</p>
			</div>
		</div>
	);
}
