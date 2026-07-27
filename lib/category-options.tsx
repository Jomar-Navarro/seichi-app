import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import type { Category } from "@/types";
import type { Option } from "@/components/UI/Select";

/** Mappa le categorie in opzioni per il Select (icona colorata o pallino di fallback). */
export function buildCategoryOptions(categories: Category[]): Option[] {
	return categories.map((c) => {
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
}
