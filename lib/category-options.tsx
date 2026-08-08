import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import type { Category } from "@/types";
import type { Option } from "@/components/UI/Select";

/**
 * Mappa le categorie in opzioni per il Select (icona colorata o pallino di fallback).
 *
 * Con `noneLabel` prepende un'opzione vuota (value "") per permettere di
 * deselezionare — usata dove la categoria è opzionale (es. modifica ricorrenza).
 *
 * ⚠️ L'etichetta arriva dal chiamante (Fase 19), che era un booleano
 * `includeNone` con la stringa "Nessuna categoria" scritta qui dentro. Questo
 * modulo non ha modo di leggere il dizionario — non è un componente e gira anche
 * dal server — e passargliela è più semplice che dargli accesso alla lingua.
 */
export function buildCategoryOptions(
	categories: Category[],
	noneLabel?: string,
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

	if (!noneLabel) return options;

	return [
		{
			value: "",
			label: noneLabel,
			icon: <span className="w-2.5 h-2.5 rounded-full inline-block bg-muted/50" />,
		},
		...options,
	];
}
