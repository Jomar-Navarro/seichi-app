"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isCurrency, normalizeLocale } from "@/lib/i18n/config";
import { setLocaleCookie } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/format";
import type { Category } from "@/types";

// Il colore di una categoria deriva dal suo tipo (design Zen Glass)
const TYPE_COLOR: Record<string, string> = {
	entrata: "midori",
	spesa: "aka",
	investimento: "ao",
	risparmio: "kin",
	abbonamento: "murasaki",
};

const VALID_TYPES = Object.keys(TYPE_COLOR);

export async function getCategories(): Promise<{ data: Category[] } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { data, error } = await supabase
		.from("categories")
		.select("*")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true });

	return error ? { error: error.message } : { data: data as Category[] };
}

export async function createCategory(input: { name: string; icon: string; type: string }) {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const name = input.name.trim();
	if (!name) return { error: t.errors.nameRequired };
	if (!VALID_TYPES.includes(input.type)) return { error: t.errors.invalidType };

	// L'id torna al chiamante perché il budget si imposta subito dopo, sulla
	// categoria appena creata (vedi CategorySheet): senza, servirebbe una
	// seconda query per ritrovarla per nome, che non è nemmeno univoco.
	const { data, error } = await supabase
		.from("categories")
		.insert({
			user_id: user.id,
			name,
			icon: input.icon,
			color: TYPE_COLOR[input.type],
			type: input.type,
		})
		.select("id")
		.single();

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true as const, id: data.id as string };
}

export async function updateCategory(
	id: string,
	input: { name: string; icon: string; type: string },
) {
	// `locale` serve al plurale del rifiuto sul cambio di tipo, qui sotto.
	const { supabase, user, t, locale } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const name = input.name.trim();
	if (!name) return { error: t.errors.nameRequired };
	if (!VALID_TYPES.includes(input.type)) return { error: t.errors.invalidType };

	/*
	 * ⚠️ Il TIPO di una categoria usata non si cambia (#122).
	 *
	 * Il tipo di un movimento è fissato alla creazione — il form in modifica non
	 * lo cambia — e il form filtra le categorie per tipo. Cambiando quello della
	 * categoria, i suoi movimenti restavano con una categoria di un altro tipo:
	 * aprendoli comparivano "senza categoria", e un obiettivo convertito spariva
	 * da `/risparmi` con tutti i suoi versamenti. Le regole ricorrenti hanno lo
	 * stesso problema un mese per volta: il job scrive il tipo della REGOLA.
	 *
	 * Si rifiuta, come `deleteCategory` rifiuta l'eliminazione: avvisare e
	 * lasciar fare scriverebbe proprio l'incoerenza che il rifiuto evita. Una
	 * categoria nuova del tipo giusto è la via d'uscita, e la frase la dice.
	 */
	const { data: current, error: readError } = await supabase
		.from("categories")
		.select("type")
		.eq("id", id)
		.eq("user_id", user.id)
		.maybeSingle();
	if (readError || !current) {
		if (readError) console.error("[categorie] modifica, lettura:", readError.message);
		return { error: t.common.genericError };
	}

	if (current.type !== input.type) {
		const [movements, rules] = await Promise.all([
			supabase
				.from("transactions")
				.select("id", { count: "exact", head: true })
				.eq("user_id", user.id)
				.eq("category_id", id),
			supabase
				.from("recurring_rules")
				.select("id", { count: "exact", head: true })
				.eq("user_id", user.id)
				.eq("category_id", id),
		]);
		if (movements.error || rules.error) {
			console.error(
				"[categorie] modifica, conteggi:",
				movements.error?.message ?? rules.error?.message,
			);
			return { error: t.common.genericError };
		}
		if ((movements.count ?? 0) > 0) {
			return { error: plural(t.errors.categoryTypeLockedTransactions, movements.count ?? 0, locale) };
		}
		if ((rules.count ?? 0) > 0) {
			return { error: plural(t.errors.categoryTypeLockedRecurring, rules.count ?? 0, locale) };
		}
	}

	const { error } = await supabase
		.from("categories")
		.update({
			name,
			icon: input.icon,
			color: TYPE_COLOR[input.type],
			type: input.type,
		})
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function deleteCategory(id: string) {
	// `locale` serve al plurale del messaggio di blocco qui sotto.
	const { supabase, user, t, locale } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	// Blocca l'eliminazione se ci sono movimenti collegati (nessuna perdita accidentale)
	const { count, error: countError } = await supabase
		.from("transactions")
		.select("id", { count: "exact", head: true })
		.eq("user_id", user.id)
		.eq("category_id", id);

	if (countError) return { error: countError.message };
	if ((count ?? 0) > 0) {
		return {
			error: plural(t.errors.categoryHasTransactions, count ?? 0, locale),
			blocked: true as const,
		};
	}

	/*
	 * ⚠️ E se ci sono regole ricorrenti (#117). Una regola non è un movimento,
	 * quindi il conteggio sopra non la vede — tipicamente un abbonamento appena
	 * creato con la prima occorrenza nel futuro. `recurring_rules_category_id_fkey`
	 * è `on delete set null`: la regola restava ATTIVA senza categoria, e il job
	 * scriveva ogni mese un movimento senza categoria che abbassa il saldo del
	 * conto. Tutte le regole, non solo le attive: una in pausa, ripresa dopo,
	 * farebbe lo stesso. La via d'uscita c'è — `RecurringSheet` cambia la
	 * categoria di una regola — quindi rifiutare non è un vicolo cieco.
	 */
	const { count: rules, error: rulesError } = await supabase
		.from("recurring_rules")
		.select("id", { count: "exact", head: true })
		.eq("user_id", user.id)
		.eq("category_id", id);

	if (rulesError) {
		console.error("[categorie] eliminazione, conteggio regole:", rulesError.message);
		return { error: t.common.genericError };
	}
	if ((rules ?? 0) > 0) {
		return {
			error: plural(t.errors.categoryHasRecurring, rules ?? 0, locale),
			blocked: true as const,
		};
	}

	const { error } = await supabase
		.from("categories")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function updatePreferences(currency: string, language: string) {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	// Stessa validazione di `savePreferences`, su ENTRAMBI i parametri: la
	// valuta passava grezza in un upsert dove la lingua era già controllata.
	if (!isCurrency(currency)) return { error: t.errors.unsupportedCurrency };

	// Il tag canonico è minuscolo.
	const locale = normalizeLocale(language);
	if (!locale) return { error: t.errors.unsupportedLanguage };

	const { error } = await supabase
		.from("profiles")
		.upsert({ id: user.id, currency, language: locale });

	if (error) return { error: error.message };

	// Prima del `revalidatePath`: il layout riletto deve già vedere il cookie
	// nuovo, altrimenti la pagina si ridisegna nella lingua vecchia e il cambio
	// sembrerebbe non aver funzionato fino al caricamento successivo.
	await setLocaleCookie(locale);
	revalidatePath("/", "layout");
	return { success: true };
}

export async function signOut() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	redirect("/welcome");
}
