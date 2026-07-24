"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const { data, error } = await supabase
		.from("categories")
		.select("*")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true });

	return error ? { error: error.message } : { data: data as Category[] };
}

export async function createCategory(input: { name: string; icon: string; type: string }) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const name = input.name.trim();
	if (!name) return { error: "Il nome è obbligatorio" };
	if (!VALID_TYPES.includes(input.type)) return { error: "Tipo non valido" };

	const { error } = await supabase.from("categories").insert({
		user_id: user.id,
		name,
		icon: input.icon,
		color: TYPE_COLOR[input.type],
		type: input.type,
	});

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function updateCategory(
	id: string,
	input: { name: string; icon: string; type: string },
) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const name = input.name.trim();
	if (!name) return { error: "Il nome è obbligatorio" };
	if (!VALID_TYPES.includes(input.type)) return { error: "Tipo non valido" };

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
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	// Blocca l'eliminazione se ci sono movimenti collegati (nessuna perdita accidentale)
	const { count, error: countError } = await supabase
		.from("transactions")
		.select("id", { count: "exact", head: true })
		.eq("user_id", user.id)
		.eq("category_id", id);

	if (countError) return { error: countError.message };
	if ((count ?? 0) > 0) {
		return {
			error: `Questa categoria ha ${count} ${count === 1 ? "movimento collegato" : "movimenti collegati"}. Spostali o eliminali prima di rimuoverla.`,
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
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const { error } = await supabase
		.from("profiles")
		.upsert({ id: user.id, currency, language });

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function signOut() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	redirect("/welcome");
}
