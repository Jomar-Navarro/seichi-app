"use server";

import { createClient } from "@/lib/supabase/server";

export async function savePreferences(currency: string, language: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	// upsert instead of update — handles missing profile row silently created by trigger
	const { error } = await supabase
		.from("profiles")
		.upsert({ id: user.id, currency, language });

	return error ? { error: error.message } : { success: true };
}

const CATEGORY_MAP: Record<string, { name: string; icon: string; color: string; type: string }> = {
	entrate:      { name: "Entrate",      icon: "Download",    color: "midori", type: "entrata" },
	spese:        { name: "Spese",        icon: "Share",       color: "aka",    type: "spesa" },
	investimenti: { name: "Investimenti", icon: "TrendingUp",  color: "ao",     type: "investimento" },
	risparmi:     { name: "Risparmi",     icon: "JapaneseYen", color: "kin",    type: "risparmio" },
	abbonamenti:  { name: "Abbonamenti",  icon: "RefreshCw",   color: "muted",  type: "abbonamento" },
};

// Scoped to onboarding types so future custom categories are never touched
const ONBOARDING_TYPES = Object.values(CATEGORY_MAP).map((v) => v.type);

export async function saveCategories(selected: string[]) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	const rows = selected
		.filter((v) => CATEGORY_MAP[v])
		.map((v) => ({ user_id: user.id, ...CATEGORY_MAP[v] }));

	// Delete before the early return so deselecting all correctly clears DB
	const { error: deleteError } = await supabase
		.from("categories")
		.delete()
		.eq("user_id", user.id)
		.in("type", ONBOARDING_TYPES);

	if (deleteError) return { error: deleteError.message };

	if (rows.length === 0) return { success: true };

	const { error } = await supabase.from("categories").insert(rows);

	return error ? { error: error.message } : { success: true };
}
