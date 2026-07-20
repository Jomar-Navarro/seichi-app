import {
	ArrowDownLeft,
	ArrowUpRight,
	PiggyBank,
	RefreshCw,
	TrendingUp,
} from "lucide-react";
import type { ElementType } from "react";

export interface TransactionType {
	id: string;
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
