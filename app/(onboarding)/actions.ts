"use server";

import { createClient } from "@/lib/supabase/server";

export async function savePreferences(currency: string, language: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	const { error } = await supabase
		.from("profiles")
		.update({ currency, language })
		.eq("id", user.id);

	return error ? { error: error.message } : { success: true };
}

const CATEGORY_MAP: Record<string, { name: string; icon: string; color: string; type: string }> = {
	entrate:      { name: "Entrate",      icon: "Download",    color: "midori", type: "entrata" },
	spese:        { name: "Spese",        icon: "Share",       color: "aka",    type: "spesa" },
	investimenti: { name: "Investimenti", icon: "TrendingUp",  color: "ao",     type: "investimento" },
	risparmi:     { name: "Risparmi",     icon: "JapaneseYen", color: "kin",    type: "risparmio" },
	abbonamenti:  { name: "Abbonamenti",  icon: "RefreshCw",   color: "muted",  type: "abbonamento" },
};

export async function saveCategories(selected: string[]) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	const rows = selected
		.filter((v) => CATEGORY_MAP[v])
		.map((v) => ({ user_id: user.id, ...CATEGORY_MAP[v] }));

	if (rows.length === 0) return { success: true };

	await supabase.from("categories").delete().eq("user_id", user.id);

	const { error } = await supabase.from("categories").insert(rows);

	return error ? { error: error.message } : { success: true };
}
