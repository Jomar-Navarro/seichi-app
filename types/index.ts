import type { ElementType } from "react";
import {
	WalletIcon,
	ShoppingBagIcon,
	PiggyBankIcon,
	RepeatIcon,
	TrendingUpIcon,
} from "@/lib/seichi-icons";

export type TransactionTypeId = "spesa" | "entrata" | "risparmio" | "investimento" | "abbonamento";

export interface TransactionType {
	id: TransactionTypeId;
	label: string;
	description: string;
	color: string;
	icon: ElementType;
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
	is_ricurrent: boolean;
	frequency: string | null;
	categories: {
		name: string;
		icon: string;
		color: string;
	} | null;
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
		label: "Uscita",
		description: "Spese e acquisti quotidiani",
		color: "var(--color-aka)",
		icon: ShoppingBagIcon,
	},
	{
		id: "entrata",
		label: "Entrata",
		description: "Stipendio, rimborsi, regali",
		color: "var(--color-midori)",
		icon: WalletIcon,
	},
	{
		id: "risparmio",
		label: "Risparmio",
		description: "Accantonamenti e obiettivi",
		color: "var(--color-kin)",
		icon: PiggyBankIcon,
	},
	{
		id: "investimento",
		label: "Investimento",
		description: "Mercati, fondi, portafoglio",
		color: "var(--color-ao)",
		icon: TrendingUpIcon,
	},
	{
		id: "abbonamento",
		label: "Ricorrente",
		description: "Abbonamenti e pagamenti fissi",
		color: "var(--color-murasaki)",
		icon: RepeatIcon,
	},
];
