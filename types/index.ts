import type { ElementType } from "react";
import {
	WalletIcon,
	ShoppingBagIcon,
	PiggyBankIcon,
	RepeatIcon,
	TrendingUpIcon,
	ArrowLeftRightIcon,
} from "@/lib/seichi-icons";

export type TransactionTypeId =
	| "spesa"
	| "entrata"
	| "risparmio"
	| "investimento"
	| "abbonamento"
	| "trasferimento";

/**
 * Un tipo di transazione: identità, colore e icona.
 *
 * ⚠️ `label` e `description` non ci sono più (Fase 19). Stavano qui — in un file
 * di TIPI — ed erano le uniche due cose che cambiano con la lingua: ora vivono
 * in `t.transactionTypes[id]`. L'`id` è il valore scritto nel database e resta
 * italiano, come ogni altra chiave.
 */
export interface TransactionType {
	id: TransactionTypeId;
	color: string;
	icon: ElementType;
}

/** Dati di account risolti lato server e passati alle pagine impostazioni. */
export interface AccountContext {
	userId: string;
	email: string;
	fullName: string | null;
	avatarUrl: string | null;
	currency: string;
	language: string;
	displayName: string;
	initials: string;
	/** false per gli account creati solo via OAuth: non hanno una password */
	hasPasswordIdentity: boolean;
}

/**
 * L'intestazione della home: solo ciò che si DISEGNA.
 *
 * ⚠️ Deliberatamente privo di `email` e `hasPasswordIdentity`. Sono i campi che
 * pretendono un valore vivo — un confronto d'identità su un'email stantia ha già
 * bloccato l'eliminazione account — e chi parte da qui legge dalle claims, cioè
 * da una fotografia. Non esponendoli, l'errore non è più esprimibile.
 * Le pagine impostazioni usano `AccountContext`, che li ha e li legge freschi.
 */
export interface ProfileHeader {
	avatarUrl: string | null;
	displayName: string;
	initials: string;
}

/**
 * I tipi di conto (Fase 20a).
 *
 * ⚠️ DECORATIVI: scelgono icona ed etichetta, e NIENT'ALTRO. La natura di un
 * movimento la decide sempre e solo `transactions.type`. Nel momento in cui uno
 * di questi valori facesse qualcosa — "i movimenti su un conto investimento sono
 * investimenti" — la domanda *"questo movimento è un investimento?"* avrebbe due
 * risposte, che è la classe di difetto già pagata tre volte in questo progetto.
 *
 * Come per `TransactionTypeId`, le chiavi restano italiane: sono i valori
 * scritti in `accounts.type` e vincolati da `accounts_type_check`.
 */
export type AccountTypeId = "corrente" | "contanti" | "risparmio" | "investimento";

export const ACCOUNT_TYPES: AccountTypeId[] = [
	"corrente",
	"contanti",
	"risparmio",
	"investimento",
];

export interface Account {
	id: string;
	user_id: string;
	name: string;
	/** null = nessun tipo scelto; l'app ripiega su icona ed etichetta generiche */
	type: AccountTypeId | null;
	icon: string | null;
	color: string | null;
	initial_balance: number;
	archived: boolean;
	created_at: string;
}

/**
 * Un conto col saldo, dalla vista `account_balances`.
 *
 * ⚠️ Il saldo NON è una colonna e non lo si somma lato app: lo calcola Postgres
 * (`initial_balance` + entrate − tutto il resto). Una colonna avrebbe quattro
 * punti di scrittura da tenere allineati, inclusi gli insert di pg_cron; una
 * somma in TypeScript vorrebbe dire scaricare ogni transazione di ogni conto a
 * ogni vista, cioè rifare l'errore che la `20260808` ha corretto per la home.
 */
export interface AccountWithBalance extends Account {
	balance: number;
}

export interface Category {
	id: string;
	user_id: string;
	name: string;
	icon: string;
	color: string;
	type: string;
	target_amount?: number | null;
	target_date?: string | null;
}

export interface GoalWithProgress extends Category {
	saved_amount: number;
}

export interface Transaction {
	id: string;
	user_id: string;
	amount: number;
	type: TransactionTypeId;
	category_id: string | null;
	investment_type: string | null;
	date: string;
	notes: string | null;
	recurring_rule_id: string | null;
	/** NOT NULL nel database dalla Fase 20a: ogni movimento appartiene a un conto. */
	account_id: string;
	/**
	 * Il conto di DESTINAZIONE (Fase 20b) — dove il denaro arriva.
	 *
	 * ⚠️ Nullable e valorizzato solo su tre tipi: obbligatorio su
	 * `trasferimento`, facoltativo su `risparmio` e `investimento`, vietato su
	 * tutti gli altri. Non è una convenzione applicativa: sono quattro CHECK in
	 * `20260815_transfers.sql`, quindi lo stato illegale non è rappresentabile
	 * nemmeno da un insert scritto a mano nel SQL Editor.
	 */
	to_account_id: string | null;
	categories: {
		name: string;
		icon: string;
		color: string;
	} | null;
}

export type Frequency = "settimanale" | "mensile" | "annuale";

export interface RecurringRule {
	id: string;
	user_id: string;
	amount: number;
	type: TransactionTypeId;
	category_id: string | null;
	notes: string | null;
	frequency: Frequency;
	start_date: string;
	next_run: string;
	end_date: string | null;
	active: boolean;
	created_at: string;
	/**
	 * Il conto su cui la regola scrive.
	 *
	 * ⚠️ NOT NULL nel database dalla 20a, ma **mancava da questo tipo** — e
	 * l'omissione non era innocua: senza il campo, `RecurringSheet` non poteva
	 * nemmeno leggerlo, quindi il conto di una regola era di fatto a scrittura
	 * unica e una regola nata sul conto sbagliato ci scriveva sopra per sempre.
	 * Un tipo incompleto non produce un errore, produce una funzionalità che non
	 * viene scritta perché il dato sembra non esserci.
	 */
	account_id: string;
	categories?: {
		name: string;
		icon: string;
		color: string;
	} | null;
}

/**
 * Periodo di un budget. Valori identici a `Frequency`, ma è un tipo a sé
 * DELIBERATAMENTE: una frequenza è la cadenza di un evento che si ripete a
 * partire da una data (l'affitto esce il 5), un periodo di budget è una finestra
 * ancorata al calendario (settimana da lunedì, mese dal 1°, anno solare).
 * Stessi valori, significato diverso — tenerli separati impedisce di passare
 * l'uno dove serve l'altro senza accorgersene.
 */
export type BudgetPeriod = "settimanale" | "mensile" | "annuale";

/** Riga della tabella `budgets`. */
export interface Budget {
	id: string;
	user_id: string;
	/** NULL = budget globale (non una categoria specifica) */
	category_id: string | null;
	period: BudgetPeriod;
	/** NULL = "lapide": da questo periodo la categoria non ha budget */
	amount: number | null;
	valid_from: string;
	created_at: string;
}

/** Riga restituita dalla funzione SQL `budgets_at()`. */
export interface BudgetAt {
	budget_id: string;
	category_id: string | null;
	period: BudgetPeriod;
	amount: number | null;
	valid_from: string;
	period_start: string;
	/** Fine ESCLUSIVA: primo giorno del periodo successivo */
	period_end: string;
}

/** ok < soglia < sforato. La soglia è `BUDGET_WARNING_THRESHOLD`. */
export type BudgetStatus = "ok" | "soglia" | "sforato";

/** Budget con lo speso calcolato, pronto per la UI. */
export interface BudgetWithSpending {
	budgetId: string;
	/** null = budget globale */
	categoryId: string | null;
	/** null per il globale, che non ha una categoria da mostrare */
	category: { name: string; icon: string; color: string } | null;
	period: BudgetPeriod;
	amount: number;
	spent: number;
	/** Può essere negativo: è di quanto si è sforato */
	remaining: number;
	/** 0–100, troncato a 100 per la barra; usare `spent`/`amount` per il resto */
	pct: number;
	status: BudgetStatus;
	periodStart: string;
	periodEnd: string;
}

/** Quadro budget del periodo corrente, come lo consuma la UI. */
export interface BudgetOverview {
	/** null se l'utente non ha impostato un budget globale */
	global: BudgetWithSpending | null;
	perCategory: BudgetWithSpending[];
	/**
	 * Uscite fisse previste nel mese corrente, da `recurring_rules`.
	 * NON entra in nessun budget: affitto e utenze sono categorie `abbonamento`,
	 * e il globale limita solo le spese VARIABILI. Si mostra accanto al globale
	 * perché un limite di spesa che ignora in silenzio l'affitto è un numero
	 * sbagliato che sembra giusto.
	 */
	fixedOutflowsThisMonth: number;
}

export type NotificationType =
	| "budget_soglia"
	| "budget_sforato"
	| "obiettivo_soglia"
	| "abbonamento_rinnovo"
	| "ricorrenti_generate";

/**
 * I fatti di una notifica, senza presentazione.
 *
 * Il database registra COSA è successo; la frase la compone `lib/notifications.ts`
 * alla lettura. Salvare il testo già fatto avrebbe cablato la valuta ignorando
 * `profiles.currency`, e reso intraducibili alla Fase 19 le notifiche già scritte.
 */
export type NotificationPayload =
	| { category: string | null; spent: number; amount: number }
	| { goal: string; saved: number; target: number; pct: number }
	| { name: string | null; amount: number; days: number }
	| { count: number };

/**
 * Riga della tabella `notifications`.
 *
 * Si chiama `AppNotification` e non `Notification` perché quest'ultimo è un tipo
 * GLOBALE del DOM (le notifiche del browser): ridichiararlo non darebbe errore,
 * si limiterebbe a metterlo in ombra, e un import dimenticato passerebbe il
 * type-check riferendosi alla cosa sbagliata.
 */
export interface AppNotification {
	id: string;
	type: NotificationType;
	payload: NotificationPayload;
	/** rotta dell'app: una notifica che non porta da nessuna parte è un vicolo cieco */
	destination: string;
	read: boolean;
	created_at: string;
}

/** Notifica con il testo già composto, pronta per la UI. */
export interface RenderedNotification extends AppNotification {
	title: string;
	body: string | null;
}

export interface InvestmentByType {
	type: string;
	label: string;
	color: string;
	total: number;
	pct: number;
}

export interface InvestmentPosition {
	category_id: string;
	name: string;
	icon: string;
	color: string;
	investment_type: string | null;
	total: number;
	pct: number;
}

export interface InvestmentData {
	total: number;
	variazionePct: number | null;
	byType: InvestmentByType[];
	positions: InvestmentPosition[];
}

export const TRANSACTION_TYPES: TransactionType[] = [
	{
		id: "spesa",
		color: "var(--color-aka)",
		icon: ShoppingBagIcon,
	},
	{
		id: "entrata",
		color: "var(--color-midori)",
		icon: WalletIcon,
	},
	{
		id: "risparmio",
		color: "var(--color-kin)",
		icon: PiggyBankIcon,
	},
	{
		id: "investimento",
		color: "var(--color-ao)",
		icon: TrendingUpIcon,
	},
	{
		id: "abbonamento",
		color: "var(--color-murasaki)",
		icon: RepeatIcon,
	},
	/**
	 * ⚠️ Ultimo, e NEUTRO — le due cose sono deliberate.
	 *
	 * Ultimo perché è il tipo che si sceglie meno spesso, e la griglia del
	 * `TransactionModal` si legge dall'alto.
	 *
	 * Neutro perché gli altri cinque accenti dicono ciascuno una cosa sul denaro
	 * — verde entra, rosso esce, oro da parte, blu investito, viola ricorre — e
	 * un trasferimento non ne dice nessuna: il denaro non è cresciuto né
	 * diminuito, si è spostato. Prestargli uno di quei colori sarebbe
	 * un'affermazione che il tipo non ha titolo per fare, come colorare di verde
	 * la giacenza di un conto.
	 */
	{
		id: "trasferimento",
		color: "var(--color-kiri)",
		icon: ArrowLeftRightIcon,
	},
];
