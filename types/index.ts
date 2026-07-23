import {
	ArrowDownLeft,
	ArrowUpRight,
	PiggyBank,
	RefreshCw,
	TrendingUp,
} from "lucide-react";
import type { ElementType } from "react";

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

export const TRANSACTION_TYPES: TransactionType[] = [
	{
		id: "spesa",
		label: "Uscita",
		description: "Spese e acquisti quotidiani",
		color: "var(--color-aka)",
		icon: ArrowUpRight,
	},
	{
		id: "entrata",
		label: "Entrata",
		description: "Stipendio, rimborsi, regali",
		color: "var(--color-midori)",
		icon: ArrowDownLeft,
	},
	{
		id: "risparmio",
		label: "Risparmio",
		description: "Accantonamenti e obiettivi",
		color: "var(--color-kin)",
		icon: PiggyBank,
	},
	{
		id: "investimento",
		label: "Investimento",
		description: "Mercati, fondi, portafoglio",
		color: "var(--color-ao)",
		icon: TrendingUp,
	},
	{
		id: "abbonamento",
		label: "Ricorrente",
		description: "Abbonamenti e pagamenti fissi",
		color: "var(--color-murasaki)",
		icon: RefreshCw,
	},
];
