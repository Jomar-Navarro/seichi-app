import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import type { Category } from "@/types";
import type { Option } from "@/components/UI/Select";

/**
 * Mappa le categorie in opzioni per il Select (icona colorata o pallino di fallback).
 * Con `includeNone` prepende un'opzione "Nessuna categoria" (value "") per permettere
 * di deselezionare — usata dove la categoria è opzionale (es. modifica ricorrenza).
 */
export function buildCategoryOptions(
	categories: Category[],
	includeNone = false,
): Option[] {
	const options: Option[] = categories.map((c) => {
		const Icon = ICON_MAP[c.icon] ?? GOAL_ICON_MAP[c.icon];
		return {
			value: c.id,
			label: c.name,
			icon: Icon ? (
				<Icon size={14} style={{ color: `var(--color-${c.color})` }} />
			) : (
				<span
					className="w-2.5 h-2.5 rounded-full inline-block"
					style={{ background: `var(--color-${c.color})` }}
				/>
			),
		};
	});

	if (!includeNone) return options;

	return [
		{
			value: "",
			label: "Nessuna categoria",
			icon: <span className="w-2.5 h-2.5 rounded-full inline-block bg-muted/50" />,
		},
		...options,
	];
}
