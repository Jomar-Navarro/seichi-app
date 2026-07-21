"use server";
import { createClient } from "@/lib/supabase/server";

export async function saveTransaction(
	importo: number,
	tipo: string,
	categoria_id: string | null,
	nota: string | null,
	data: string,
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	const { error } = await supabase.from("transactions").insert({
		user_id: user.id,
		amount: importo,
		type: tipo,
		category_id: categoria_id,
		notes: nota,
		date: data,
	});

	return error ? { error: error.message } : { success: true };
}

export async function getTransactions(
	tipo?: string,
	periodo?: string,
	limit?: number,
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	let query = supabase
		.from("transactions")
		.select("*, categories(name, icon, color)")
		.eq("user_id", user.id)
		.order("date", { ascending: false });

	if (tipo) query = query.eq("type", tipo);

	if (periodo && periodo !== "tutto") {
		const from = new Date();
		if (periodo === "7d") from.setDate(from.getDate() - 7);
		else if (periodo === "30d") from.setDate(from.getDate() - 30);
		else if (periodo === "3m") from.setMonth(from.getMonth() - 3);
		from.setHours(0, 0, 0, 0);
		query = query.gte("date", from.toISOString());
	}

	if (limit) query = query.limit(limit);

	const { data, error } = await query;
	return error ? { error: error.message } : { data };
}

export async function updateTransaction(
	id: string,
	importo: number,
	tipo: string,
	categoria_id: string | null,
	nota: string | null,
	data: string,
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	const { error } = await supabase
		.from("transactions")
		.update({
			amount: importo,
			type: tipo,
			category_id: categoria_id,
			notes: nota,
			date: data,
		})
		.eq("id", id)
		.eq("user_id", user.id);

	return error ? { error: error.message } : { success: true };
}

export async function deleteTransaction(id: string) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	const { error } = await supabase
		.from("transactions")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	return error ? { error: error.message } : { success: true };
}

export async function getDashboardTotals() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	let query = supabase
		.from("transactions")
		.select("amount, type")
		.eq("user_id", user.id);

	const now = new Date();
	const inizioMese = new Date(now.getFullYear(), now.getMonth(), 1);
	const inizioMeseProssimo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	query = query
		.gte("date", inizioMese.toISOString())
		.lt("date", inizioMeseProssimo.toISOString());

	const [
		{ data, error },
		{ data: dataTotale },
	] = await Promise.all([
		query,
		supabase.from("transactions").select("amount, type").eq("user_id", user.id),
	]);

	const entrateMese =
		data
			?.filter((t) => t.type === "entrata")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;

	const speseMese =
		data
			?.filter((t) => t.type === "spesa")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;

	const investimentiMese =
		data
			?.filter((t) => t.type === "investimento")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;

	const risparmiMese =
		data
			?.filter((t) => t.type === "risparmio")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;

	const saldoMese = entrateMese - speseMese;

	const entrateTotali =
		dataTotale
			?.filter((t) => t.type === "entrata")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;
	const speseTotali =
		dataTotale
			?.filter((t) => t.type === "spesa")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;
	const saldoTotale = entrateTotali - speseTotali;

	return error
		? { error: error.message }
		: {
				entrateMese,
				speseMese,
				investimentiMese,
				risparmiMese,
				saldoMese,
				saldoTotale,
			};
}
