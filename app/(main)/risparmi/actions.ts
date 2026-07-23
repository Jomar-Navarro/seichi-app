"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { GoalWithProgress, InvestmentData } from "@/types";
import { INVESTMENT_TYPE_META } from "@/lib/investment-types";

export async function getGoals(): Promise<{ data: GoalWithProgress[] } | { error: string }> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const [{ data: cats, error: catsError }, { data: txns, error: txnsError }] = await Promise.all([
		supabase
			.from("categories")
			.select("*")
			.eq("user_id", user.id)
			.eq("type", "risparmio")
			.order("created_at", { ascending: false }),
		supabase
			.from("transactions")
			.select("category_id, amount")
			.eq("user_id", user.id)
			.eq("type", "risparmio"),
	]);

	if (catsError) return { error: catsError.message };
	if (txnsError) return { error: txnsError.message };

	// Aggrega i risparmi per categoria
	const sums = (txns ?? []).reduce(
		(acc, t) => {
			if (t.category_id) acc[t.category_id] = (acc[t.category_id] ?? 0) + t.amount;
			return acc;
		},
		{} as Record<string, number>,
	);

	const goals: GoalWithProgress[] = (cats ?? []).map((c) => ({
		...c,
		saved_amount: sums[c.id] ?? 0,
	}));

	return { data: goals };
}

export async function getInvestments(): Promise<{ data: InvestmentData } | { error: string }> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const { data: txns, error } = await supabase
		.from("transactions")
		.select("category_id, amount, investment_type, date, categories(name, icon, color)")
		.eq("user_id", user.id)
		.eq("type", "investimento");

	if (error) return { error: error.message };

	const now = new Date();
	const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	let total = 0;
	let prevMonthTotal = 0;
	const catMap = new Map<string, {
		name: string; icon: string; color: string;
		investment_type: string | null; total: number;
	}>();
	const typeMap = new Map<string, number>();

	for (const t of txns ?? []) {
		if (!t.category_id || !t.categories) continue;

		const cat = t.categories as unknown as { name: string; icon: string; color: string };

		total += t.amount;
		if (new Date(t.date) < firstOfThisMonth) prevMonthTotal += t.amount;

		const existing = catMap.get(t.category_id);
		if (existing) {
			existing.total += t.amount;
		} else {
			catMap.set(t.category_id, {
				name: cat.name,
				icon: cat.icon,
				color: cat.color,
				investment_type: t.investment_type ?? null,
				total: t.amount,
			});
		}

		const typeKey = t.investment_type ?? "altro";
		typeMap.set(typeKey, (typeMap.get(typeKey) ?? 0) + t.amount);
	}

	const variazionePct =
		prevMonthTotal > 0
			? Math.round(((total - prevMonthTotal) / prevMonthTotal) * 1000) / 10
			: null;

	const byType = Array.from(typeMap.entries())
		.map(([type, typeTotal]) => ({
			type,
			label: INVESTMENT_TYPE_META[type]?.label ?? type,
			color: INVESTMENT_TYPE_META[type]?.color ?? "kiri",
			total: typeTotal,
			pct: total > 0 ? Math.round((typeTotal / total) * 100) : 0,
		}))
		.sort((a, b) => b.total - a.total);

	const positions = Array.from(catMap.entries())
		.map(([category_id, cat]) => ({
			category_id,
			name: cat.name,
			icon: cat.icon,
			color: cat.color,
			investment_type: cat.investment_type,
			total: cat.total,
			pct: total > 0 ? Math.round((cat.total / total) * 100) : 0,
		}))
		.sort((a, b) => b.total - a.total);

	return { data: { total, variazionePct, byType, positions } };
}

export async function createGoal(payload: {
	name: string;
	target_amount: number | null;
	target_date: string | null;
	icon: string;
}): Promise<{ error?: string }> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const { error } = await supabase.from("categories").insert({
		user_id: user.id,
		name: payload.name,
		icon: payload.icon,
		color: "kin",
		type: "risparmio",
		target_amount: payload.target_amount,
		target_date: payload.target_date,
	});

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return {};
}

export async function updateGoal(
	id: string,
	payload: {
		name: string;
		target_amount: number | null;
		target_date: string | null;
		icon: string;
	},
): Promise<{ error?: string }> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const { error } = await supabase
		.from("categories")
		.update({
			name: payload.name,
			icon: payload.icon,
			target_amount: payload.target_amount,
			target_date: payload.target_date,
		})
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return {};
}

export async function deleteGoal(id: string): Promise<{ error?: string }> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	// Delete associated transactions first — otherwise they remain as
	// orphaned outflows that permanently reduce the balance with no visible goal.
	const { error: txnError } = await supabase
		.from("transactions")
		.delete()
		.eq("category_id", id)
		.eq("user_id", user.id)
		.eq("type", "risparmio");

	if (txnError) return { error: txnError.message };

	const { error } = await supabase
		.from("categories")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return {};
}
