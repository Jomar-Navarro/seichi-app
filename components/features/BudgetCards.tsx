"use client";

import type { CSSProperties } from "react";
import { AlertTriangle } from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { budgetColor, budgetInk } from "@/lib/budget";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, fill, formatMoney, formatNumber, lookup } from "@/lib/i18n/format";
import type { BudgetOverview, BudgetWithSpending } from "@/types";

/*
 * ⚠️ UN componente per due forme (issue #108). Sotto `lg:` è la tessera di
 * sempre, in un nastro che scorre in orizzontale; da `lg:` in su la stessa
 * tessera diventa una RIGA dentro un'unica card — nome, barra, importo — come
 * nel mockup desktop di Movimenti. Tutto ciò che cambia passa da varianti
 * `lg:`: sotto il breakpoint nessuna classe e nessuno stile è diverso da prima.
 *
 * ⚠️ Due stili che prima erano INLINE ora non lo sono, e non per gusto: uno
 * stile inline batte qualunque classe, quindi da `lg:` in su non ci sarebbe
 * stato modo di toglierlo. Il rendering sotto `lg:` è identico.
 *  - l'anello rosso dello sforato → la classe qui sotto, che `lg:shadow-none`
 *    può spegnere (la riga desktop non ha anello: sta dentro una card che ce
 *    l'ha già);
 *  - il binario tinto della barra → una variabile CSS (`--budget-track`) letta
 *    da `bg-(--budget-track)`, che `lg:bg-control` sostituisce col binario
 *    neutro del mockup. La tinta resta derivata da `budgetColor()`: un secondo
 *    elenco stato → colore scritto qui divergerebbe dal primo alla prima
 *    modifica.
 */
const SFORATO_RING =
	"shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-aka)_35%,transparent)]";

function BudgetCard({
	budget,
	windowInHeader,
}: {
	budget: BudgetWithSpending;
	/**
	 * Da `lg:` in su la finestra ("questo mese") è già scritta nell'intestazione
	 * della card — vedi `BudgetCards` — e la riga non la ripete. Sotto `lg:` la
	 * tessera la porta SEMPRE: le tessere scorrono, e l'intestazione esce dal
	 * campo visivo.
	 */
	windowInHeader: boolean;
}) {
	const { locale, t } = useI18n();
	/** Importi arrotondati all'euro: nelle card i centesimi sono rumore. */
	const money = (v: number) =>
		formatMoney(v, { locale, currency: DISPLAY_CURRENCY });
	/*
	 * Lo stesso numero senza simbolo, per il denominatore della riga desktop
	 * ("€ 365 / 400"). Le stesse opzioni che `formatMoney` passa a
	 * `formatNumber`: le cifre sono identiche, manca solo il simbolo — che la
	 * riga ha già davanti allo speso, e che nella colonna a larghezza fissa
	 * dell'importo spingerebbe la cifra fuori allineamento.
	 */
	const bare = (v: number) =>
		formatNumber(v, locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
	const isGlobal = budget.categoryId === null;
	const baseColor = isGlobal
		? "var(--color-aka)"
		: `var(--color-${budget.category?.color ?? "kiri"})`;
	const color = budgetColor(budget.status);
	const sforato = budget.status === "sforato";

	const Icon = isGlobal ? null : ICON_MAP[budget.category?.icon ?? ""];

	// Il bordo usa `--border` come ogni altra superficie, ma issue #81 lo rende
	// un ANELLO (box-shadow), non un bordo vero: `borderColor` non ha più nulla
	// da colorare. Solo lo stato sforato lo sovrascrive, per intero.
	return (
		/* ⚠️ TRE livelli — issue #81. Guscio (anello, ritaglio) → vetro → contenuto.
		   Da `lg:` in su il guscio smette di esserlo: niente raggio, niente
		   anello, niente vetro — la riga vive dentro la card di `BudgetCards`,
		   che è lei il vetro. */
		<div
			className={`relative min-w-39 rounded-3xl overflow-hidden lg:min-w-0 lg:rounded-none lg:overflow-visible lg:shadow-none ${
				sforato ? SFORATO_RING : "ring-border"
			}`}
		>
			<div className="absolute inset-0 bg-card backdrop-blur-lg lg:hidden" />
			<div className="relative p-4 lg:p-0 lg:flex lg:items-center lg:gap-3">
			{/*
				⚠️ Il triangolo resta solo sulla tessera. Nella riga desktop lo
				sforato lo dicono già tre cose che non dipendono dal solo colore: la
				barra piena, lo speso che supera il limite scritto accanto, e
				l'inchiostro rosso — e nella riga ogni pixel tolto al nome è una
				lettera in meno prima dei puntini.
			*/}
			{sforato && (
				<span
					className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center lg:hidden"
					style={{ background: "color-mix(in srgb, var(--color-aka) 18%, transparent)" }}
				>
					<AlertTriangle size={11} strokeWidth={2} style={{ color: "var(--color-aka)" }} />
				</span>
			)}

			{/* La pastiglia non c'è nella riga desktop (mockup): l'identità della
			    categoria la porta il nome, che lì è il primo elemento. */}
			<span
				className="w-8 h-8 rounded-[11px] flex items-center justify-center mb-3 lg:hidden"
				style={{ background: `color-mix(in srgb, ${baseColor} 13%, transparent)` }}
			>
				{Icon ? (
					<Icon size={17} strokeWidth={1.5} style={{ color: baseColor }} />
				) : (
					<span className="text-[13px] font-semibold" style={{ color: baseColor }}>
						€
					</span>
				)}
			</span>

			<div className="lg:flex-1 lg:min-w-0">
				<div className="text-sm font-semibold truncate pr-4 lg:text-[13px] lg:font-medium lg:pr-0">
					{isGlobal ? t.budget.variableExpenses : budget.category?.name}
				</div>

				<div
					className={`text-[11px] text-muted/80 mb-1.5 mt-0.5 lg:mb-0 ${
						windowInHeader ? "lg:hidden" : ""
					}`}
				>
					{lookup(t.budgetPeriods, budget.period, (p) => p.window, "")}
				</div>
			</div>

			{/*
				Nella riga desktop l'importo va DOPO la barra (`lg:order-last`), in
				una colonna larga almeno 108px e allineata a destra, così le cifre di
				righe diverse si incolonnano. `min-w` e non `w`: un limite a cinque
				cifre non deve uscire dalla propria colonna sopra la barra.
			*/}
			<div className="text-[12.5px] text-muted mb-3 lg:order-last lg:mb-0 lg:min-w-27 lg:shrink-0 lg:text-right lg:whitespace-nowrap lg:text-[13px] lg:font-medium">
				{/* L'inchiostro e non `color`: quello colora la barra, che è un
				    riempimento. Qui è la cifra che il rosso esiste per far notare, e
				    sull'accento in chiaro stava sotto il neutro che le sta accanto. */}
				<span
					className="font-medium lg:font-semibold"
					style={{ color: sforato ? budgetInk(budget.status) : "var(--text-primary)" }}
				>
					{money(budget.spent)}
				</span>{" "}
				/ <span className="lg:hidden">{money(budget.amount)}</span>
				<span className="hidden lg:inline">{bare(budget.amount)}</span>
			</div>

			<div
				className="h-1.5 rounded-full overflow-hidden bg-(--budget-track) lg:w-23 lg:shrink-0 lg:bg-control"
				style={{ "--budget-track": `color-mix(in srgb, ${color} 18%, transparent)` } as CSSProperties}
			>
				<div
					className="h-full rounded-full transition-all"
					style={{ width: `${budget.pct}%`, background: color, opacity: sforato ? 1 : 0.8 }}
				/>
			</div>
			</div>
		</div>
	);
}

export default function BudgetCards({
	overview,
	accountFiltered = false,
}: {
	overview: BudgetOverview;
	/**
	 * Se la lista sotto è filtrata per conto. I budget NON lo sono, e con un
	 * filtro attivo lo dicono — vedi la nota in fondo.
	 */
	accountFiltered?: boolean;
}) {
	const { locale, t } = useI18n();
	const { global, perCategory, fixedOutflowsThisMonth } = overview;
	const cards = [...(global ? [global] : []), ...perCategory];

	// Nessun budget impostato: niente sezione. Uno stato vuoto qui sarebbe un
	// invito a configurare qualcosa in una pagina che serve a leggere i movimenti.
	if (cards.length === 0) return null;

	/*
	 * ⚠️ La finestra sale nell'intestazione SOLO se tutti i budget mostrati hanno
	 * lo stesso periodo — e solo da `lg:` in su.
	 *
	 * La 17a l'aveva tolta dall'intestazione perché con periodi misti (la spesa
	 * settimanale accanto al globale mensile) "Budget del mese" era una
	 * dichiarazione falsa sulle card accanto. Con un periodo solo la stessa frase
	 * è vera per tutte, e nella card desktop le righe sono tutte a vista insieme:
	 * scriverla una volta sola non nasconde niente a nessuna. Con periodi misti
	 * resta su ogni riga, come sempre.
	 *
	 * Sotto `lg:` non cambia nulla: le tessere scorrono in orizzontale, e
	 * guardandone una a metà nastro l'intestazione è già fuori dal campo visivo.
	 */
	const sharedPeriod = cards.every((b) => b.period === cards[0].period)
		? cards[0].period
		: null;

	// Intestazione neutra: prima seguiva il periodo del globale ("Budget del
	// mese"), che con periodi misti era una dichiarazione falsa sulle card
	// accanto. La finestra ora la porta ogni card, che è dove serve — salvo il
	// caso del periodo unico su desktop, qui sopra.
	return (
		<>
			{/*
				Da `lg:` in su tutta la sezione è UNA card di vetro (mockup desktop).
				⚠️ TRE livelli — issue #81: guscio (raggio, anello, ritaglio) →
				vetro (`absolute`, senza raggio proprio) → contenuto. Sotto `lg:` il
				guscio è il semplice contenitore di prima e il vetro non esiste.
			*/}
			<div className="mb-5 lg:relative lg:rounded-[20px] lg:overflow-hidden lg:card-shadow-ring">
				<div className="hidden lg:block absolute inset-0 bg-surface backdrop-blur-lg" />
				<div className="lg:relative lg:px-5 lg:py-4.5">
					<div className="flex items-baseline justify-between mb-3 lg:justify-start lg:gap-2 lg:mb-3.5">
						<h2 className="text-[13px] font-semibold text-muted tracking-wide lg:text-[13.5px] lg:text-foreground lg:tracking-normal">
							{t.budget.sectionTitle}
						</h2>
						{sharedPeriod && (
							<span className="hidden lg:inline text-xs text-disabled">
								{lookup(t.budgetPeriods, sharedPeriod, (p) => p.window, "")}
							</span>
						)}
						{/* "del mese" va detto qui: senza più quella parola nell'intestazione,
						    questa cifra resterebbe senza arco temporale. */}
						{global && fixedOutflowsThisMonth > 0 && (
							<span className="text-[11px] text-muted/80 lg:ml-auto lg:text-xs lg:text-disabled">
								{fill(t.budget.fixedThisMonth, {
									amount: formatMoney(fixedOutflowsThisMonth, {
										locale,
										currency: DISPLAY_CURRENCY,
									}),
								})}
							</span>
						)}
					</div>

					{/*
						Sotto `lg:` un nastro che scorre; da `lg:` in su una griglia di
						righe, tante colonne quante ne entrano (`auto-fit`).
						⚠️ Il minimo è 300px e non i 240 del mockup. Barra (92) + importo
						(108) + spazi (24) prendono 224px fissi, e il nome riceve il
						resto: con 240 una finestra da 1280 stringeva TRE colonne da ~283px
						e lasciava al nome ~58px — "Spese v…". Con 300 a 1440 le colonne
						restano tre, come nel mockup, e a 1280 diventano due larghe.
						⚠️ Il nastro può scorrere perché qui dentro non c'è nessun menu
						`absolute` da ritagliare — la trappola di `overflow-x-auto` che la
						barra filtri evita (#9) non si pone.
					*/}
					<div className="flex gap-3 overflow-x-auto overscroll-x-contain -mx-5 px-5 pb-1 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(300px,1fr))] lg:gap-x-7 lg:gap-y-3.5 lg:overflow-visible lg:mx-0 lg:px-0 lg:pb-0">
						{cards.map((b) => (
							<BudgetCard
								key={b.budgetId}
								budget={b}
								windowInHeader={sharedPeriod !== null}
							/>
						))}
					</div>
				</div>
			</div>

			{/*
				⚠️ I budget NON si filtrano per conto, e con un filtro attivo lo
				dicono. Sono limiti su una CATEGORIA: "€ 400 per la spesa" non si
				divide fra contanti e carta, quindi filtrarli inventerebbe budget
				per-conto che nessuno ha impostato. Nasconderli toglierebbe di vista
				i budget proprio a chi sta guardando le sue uscite. Resta la terza
				via, già usata due volte in questa fase: quando due numeri hanno
				ambiti diversi, si DICE.

				⚠️ Sta QUI e non nella pagina, che la rendeva prima: là dipendeva da
				`budgets` non nullo, cioè da una risposta arrivata — anche vuota — e
				con zero budget la frase compariva da sola, a spiegare card che non
				c'erano. Qui vive solo se le card esistono, per costruzione. Stesso
				markup e stessi margini di prima.
			*/}
			{accountFiltered && (
				<p className="-mt-1 mb-4 ml-1 text-[11px] text-disabled leading-relaxed">
					{t.budget.acrossAllAccounts}
				</p>
			)}
		</>
	);
}
