import { fill, formatMoney, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/it";
import type { CoachSnapshot } from "@/types";

/**
 * Le risposte che l'app sa dare **da sola** (Fase 24b).
 *
 * ⚠️ Qui non c'è nessun modello, nessuna chiave e nessuna dipendenza: sono
 * aritmetica e frasi di dizionario. Quasi nulla di ciò che un coach dice ha
 * bisogno di un modello — il disponibile, i budget sforati, gli obiettivi e il
 * peso delle uscite fisse sono conti — e quindi sono **gratuite** *e* incapaci
 * di sbagliare una cifra. Il modello arriva nella 24c, e solo per le domande
 * aperte.
 *
 * ⚠️ **Il coach mette in RELAZIONE i numeri, non li RIDEFINISCE.** Può dire che
 * le uscite fisse sono il tot per cento delle entrate — è un rapporto fra due
 * numeri che l'app già mostra — ma non può inventare una propria idea di
 * «uscita» o di «flusso»: quelle stanno in `lib/totals.ts` e nello snapshot,
 * che le riceve da `getDashboardTotals` e `getBudgetOverview`. È la regola che
 * la review della 20a ha dovuto imporre dopo aver trovato tre `filter` scritti
 * a mano che divergevano già fra loro.
 *
 * ⚠️ Le frasi stanno nei DIZIONARI, non qui: sono cornice, cioè testo
 * dell'interfaccia. Il criterio *«nessuna stringa fuori dai dizionari»* vale
 * per intero in 24b — è solo nella 24c che comparirà del testo *generato*, e
 * quello è un dato, non una stringa.
 */

/** Gli argomenti su cui l'app sa rispondere senza chiamare nessuno. */
export type CoachTopic = "disponibile" | "budget" | "obiettivi" | "fisse";

export interface CoachReply {
	topic: CoachTopic;
	/** La domanda, come compare sulla pastiglia. */
	question: string;
	/** La risposta, già composta e con le cifre dentro. */
	answer: string;
}

/** Contesto di formattazione, per non passare tre argomenti a ogni riga. */
interface Ctx {
	s: CoachSnapshot;
	locale: Locale;
	t: Dictionary;
}

/**
 * Gli importi del coach hanno i CENTESIMI.
 *
 * ⚠️ Non è una scelta estetica: molte frasi enunciano una sottrazione («entrate
 * meno uscite fisse: ti restano…»), e con gli importi arrotondati all'euro il
 * conto non torna sotto gli occhi di chi legge. È la stessa ragione per cui la
 * card del budget globale mostra i centesimi mentre la home resta a euro interi.
 */
function money({ s, locale }: Ctx, value: number): string {
	return formatMoney(value, { locale, currency: s.currency, decimals: 2 });
}

/** Una percentuale intera. `null` quando il denominatore non c'è: una divisione
 *  per zero qui produrrebbe `Infinity`, cioè una frase che dice "∞%". */
function pct(parte: number, totale: number): number | null {
	if (!(totale > 0)) return null;
	return Math.round((parte / totale) * 100);
}

/**
 * Il messaggio con cui si apre il pannello.
 *
 * Tre frasi al massimo: il disponibile, quanto si sta mettendo da parte, e il
 * confronto col mese precedente. Non è un referto — è ciò che si vorrebbe
 * sapere aprendo l'app senza dover chiedere niente.
 */
export function coachOpening(s: CoachSnapshot, locale: Locale, t: Dictionary): string[] {
	const ctx: Ctx = { s, locale, t };
	const righe: string[] = [];

	/*
	 * ⚠️ Con zero entrate registrate il disponibile è negativo, ed è VERO — ma
	 * all'inizio del mese è il caso normale, non un buco nei conti. La frase
	 * cambia invece di lasciare che un numero vero si faccia capire male: è la
	 * stessa correzione già fatta sulla card in impostazioni.
	 */
	righe.push(
		s.month.income === 0
			? fill(t.coach.opening.availableNoIncome, { fixed: money(ctx, s.fixedOutflows) })
			: fill(t.coach.opening.available, {
					income: money(ctx, s.month.income),
					fixed: money(ctx, s.fixedOutflows),
					available: money(ctx, s.available),
				}),
	);

	/*
	 * ⚠️ Con zero messo da parte NON si dice «stai mettendo da parte € 0,00»:
	 * sarebbe un non-fatto travestito da osservazione. Si dice l'altra cosa, che
	 * è vera e utile. E se non ci sono nemmeno entrate si tace: la prima riga
	 * l'ha già detto, ripeterlo sarebbe rumore.
	 */
	const messoDaParte = s.month.saved + s.month.invested;
	const tasso = pct(messoDaParte, s.month.income);
	if (messoDaParte > 0 && tasso !== null) {
		righe.push(
			fill(t.coach.opening.savingsRate, {
				amount: money(ctx, messoDaParte),
				income: money(ctx, s.month.income),
				pct: formatNumber(tasso, locale),
			}),
		);
	} else if (s.month.income > 0) {
		righe.push(t.coach.opening.savingsRateNone);
	}

	/*
	 * ⚠️ Il confronto col mese scorso mette un mese PARZIALE accanto a uno
	 * INTERO, e il primo del mese direbbe "stai andando molto peggio" a chi non
	 * ha ancora fatto niente. Non si nasconde con una soglia arbitraria («solo
	 * dopo il quindici»): lo dice la frase stessa — *finora* contro *tutto il
	 * mese scorso* — che è l'unica forma onesta a qualunque giorno del mese.
	 */
	righe.push(
		fill(t.coach.opening.flowSoFar, {
			flow: money(ctx, s.month.flow),
			previous: money(ctx, s.previousMonthFlow),
		}),
	);

	return righe;
}

/**
 * Le domande proposte, con la loro risposta già pronta.
 *
 * ⚠️ Sono **domande proposte** e non testo libero, ed è la decisione che regge
 * l'intera 24b: il ramo lo sceglie il GESTO. Un instradamento a parole chiave
 * sbaglierebbe in silenzio, e far classificare la domanda al modello costerebbe
 * la chiamata che si sta cercando di evitare. Così il percorso predefinito —
 * apri, leggi, tocca — non consuma niente.
 */
export function coachReplies(s: CoachSnapshot, locale: Locale, t: Dictionary): CoachReply[] {
	const ctx: Ctx = { s, locale, t };
	const q = t.coach.questions;
	const a = t.coach.answers;

	/* ------------------------------------------------------- disponibile */
	const disponibile =
		s.month.income === 0
			? fill(a.availableNoIncome, { fixed: money(ctx, s.fixedOutflows) })
			: fill(a.available, {
					income: money(ctx, s.month.income),
					fixed: money(ctx, s.fixedOutflows),
					available: money(ctx, s.available),
					spent: money(ctx, s.month.variableExpenses),
				});

	/* ------------------------------------------------------------ budget */
	let budget: string;
	const sforati = s.categoryBudgets.filter((b) => b.status === "sforato");
	const soglia = s.categoryBudgets.filter((b) => b.status === "soglia");

	if (!s.globalBudget && s.categoryBudgets.length === 0) {
		budget = a.budgetNone;
	} else {
		const pezzi: string[] = [];
		if (s.globalBudget) {
			pezzi.push(
				fill(a.budgetGlobal, {
					spent: money(ctx, s.globalBudget.spent),
					amount: money(ctx, s.globalBudget.amount),
				}),
			);
		}
		if (sforati.length > 0) {
			pezzi.push(
				fill(a.budgetOver, {
					// ⚠️ Il nome della categoria è testo dell'utente: entra nella frase
					// come valore, mai concatenato a mano attorno a un aggettivo — è la
					// trappola di «Nuova investimento» registrata nella Fase 19.
					names: sforati.map((b) => b.name).join(", "),
				}),
			);
		} else if (soglia.length > 0) {
			pezzi.push(fill(a.budgetNear, { names: soglia.map((b) => b.name).join(", ") }));
		} else if (s.categoryBudgets.length > 0) {
			pezzi.push(a.budgetOk);
		}
		budget = pezzi.join(" ");
	}

	/* -------------------------------------------------------- obiettivi */
	let obiettivi: string;
	const conTarget = s.goals.filter((g) => g.target > 0);
	if (s.goals.length === 0) {
		obiettivi = a.goalsNone;
	} else if (conTarget.length === 0) {
		// Obiettivi senza traguardo: si può dire quanto c'è, non quanto manca.
		obiettivi = fill(a.goalsNoTarget, {
			amount: money(ctx, s.goals.reduce((acc, g) => acc + g.saved, 0)),
		});
	} else {
		/*
		 * Il più vicino al traguardo, che è quello di cui vale la pena parlare:
		 * elencarli tutti trasformerebbe una risposta in un tabulato.
		 */
		const vicino = conTarget.reduce((best, g) =>
			g.saved / g.target > best.saved / best.target ? g : best,
		);
		/*
		 * ⚠️ Niente conteggio nella frase («in tutto hai {n} obiettivi»): con un
		 * obiettivo solo direbbe «hai 1 obiettivi». Si chiuderebbe con `plural()`,
		 * ma la frase non ne ha bisogno — è il difetto di «Nuova investimento»
		 * della Fase 19 evitato togliendo la costruzione, non irrobustendola.
		 */
		obiettivi = fill(a.goalsClosest, {
			name: vicino.name,
			saved: money(ctx, vicino.saved),
			target: money(ctx, vicino.target),
			missing: money(ctx, Math.max(0, vicino.target - vicino.saved)),
		});
	}

	/* ------------------------------------------------------ uscite fisse */
	const peso = pct(s.fixedOutflows, s.month.income);
	const fisse =
		peso === null
			? fill(a.fixedNoIncome, { fixed: money(ctx, s.fixedOutflows) })
			: fill(a.fixed, {
					fixed: money(ctx, s.fixedOutflows),
					income: money(ctx, s.month.income),
					pct: formatNumber(peso, locale),
				});

	return [
		{ topic: "disponibile", question: q.available, answer: disponibile },
		{ topic: "budget", question: q.budget, answer: budget },
		{ topic: "obiettivi", question: q.goals, answer: obiettivi },
		{ topic: "fisse", question: q.fixed, answer: fisse },
	];
}
