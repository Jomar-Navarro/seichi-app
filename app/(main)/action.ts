"use server";
import { revalidatePath } from "next/cache";
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

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
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

	if (limit !== undefined) query = query.limit(limit);

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

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
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

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
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

	const [{ data, error }, { data: dataTotale, error: errorTotale }] =
		await Promise.all([
			query,
			supabase
				.from("transactions")
				.select("amount, type")
				.eq("user_id", user.id),
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

	const abbonaMese =
		data
			?.filter((t) => t.type === "abbonamento")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;

	const saldoMese = entrateMese - speseMese - risparmiMese - investimentiMese - abbonaMese;

	const entrateTotali =
		dataTotale
			?.filter((t) => t.type === "entrata")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;
	const speseTotali =
		dataTotale
			?.filter((t) => t.type === "spesa")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;
	const risparmiTotali =
		dataTotale
			?.filter((t) => t.type === "risparmio")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;
	const investimentiTotali =
		dataTotale
			?.filter((t) => t.type === "investimento")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;
	const abbonaTotali =
		dataTotale
			?.filter((t) => t.type === "abbonamento")
			.reduce((acc, t) => acc + t.amount, 0) ?? 0;
	const saldoTotale = entrateTotali - speseTotali - risparmiTotali - investimentiTotali - abbonaTotali;

	if (error || errorTotale) return { error: (error ?? errorTotale)!.message };

	return {
		entrateMese,
		speseMese,
		investimentiMese,
		risparmiMese,
		abbonaMese,
		saldoMese,
		saldoTotale,
	};
}

const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const GIORNI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

export async function getAnalyticsData(periodo: string = "mese") {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	const now = new Date();
	const oggi = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	// Calcola range corrente, precedente e punti del trend in base al periodo
	let rangeStart: Date;
	let rangeEnd: Date;
	let prevStart: Date;
	let prevEnd: Date;
	let trendPoints: { label: string; start: Date; end: Date }[];
	let fetchStart: Date;

	if (periodo === "settimana") {
		rangeStart = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - 6);
		rangeEnd = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 1);
		prevStart = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - 13);
		prevEnd = rangeStart;
		fetchStart = prevStart;
		trendPoints = Array.from({ length: 7 }, (_, i) => {
			const d = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - 6 + i);
			return {
				label: GIORNI[d.getDay()],
				start: d,
				end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
			};
		});
	} else if (periodo === "anno") {
		rangeStart = new Date(now.getFullYear(), 0, 1);
		rangeEnd = new Date(now.getFullYear() + 1, 0, 1);
		prevStart = new Date(now.getFullYear() - 1, 0, 1);
		prevEnd = rangeStart;
		fetchStart = prevStart;
		trendPoints = Array.from({ length: 12 }, (_, i) => ({
			label: MESI[i],
			start: new Date(now.getFullYear(), i, 1),
			end: new Date(now.getFullYear(), i + 1, 1),
		}));
	} else {
		// mese (default)
		rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
		rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
		prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		prevEnd = rangeStart;
		fetchStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
		trendPoints = Array.from({ length: 6 }, (_, i) => {
			const m = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
			return {
				label: MESI[m.getMonth()],
				start: m,
				end: new Date(now.getFullYear(), now.getMonth() - 5 + i + 1, 1),
			};
		});
	}

	const [
		{ data: trendData, error: trendError },
		{ data: speseData, error: speseError },
	] = await Promise.all([
		supabase
			.from("transactions")
			.select("amount, type, date")
			.eq("user_id", user.id)
			.in("type", ["entrata", "spesa"])
			.gte("date", fetchStart.toISOString())
			.lt("date", rangeEnd.toISOString()),
		supabase
			.from("transactions")
			.select("amount, categories(name, color)")
			.eq("user_id", user.id)
			.eq("type", "spesa")
			.gte("date", rangeStart.toISOString())
			.lt("date", rangeEnd.toISOString()),
	]);

	if (trendError || speseError) return { error: (trendError ?? speseError)!.message };

	// Trend
	const trend = trendPoints.map(({ label, start, end }) => {
		const pts = trendData?.filter((t) => {
			const d = new Date(t.date);
			return d >= start && d < end;
		}) ?? [];
		return {
			mese: label,
			entrate: pts.filter((t) => t.type === "entrata").reduce((acc, t) => acc + t.amount, 0),
			uscite: pts.filter((t) => t.type === "spesa").reduce((acc, t) => acc + t.amount, 0),
		};
	});

	// KPI periodo corrente
	const currentData = trendData?.filter((t) => {
		const d = new Date(t.date);
		return d >= rangeStart && d < rangeEnd;
	}) ?? [];
	const entrateCorrente = currentData.filter((t) => t.type === "entrata").reduce((acc, t) => acc + t.amount, 0);
	const speseCorrente = currentData.filter((t) => t.type === "spesa").reduce((acc, t) => acc + t.amount, 0);
	const saldoMese = entrateCorrente - speseCorrente;

	// Variazione vs periodo precedente
	const prevData = trendData?.filter((t) => {
		const d = new Date(t.date);
		return d >= prevStart && d < prevEnd;
	}) ?? [];
	const entratePrev = prevData.filter((t) => t.type === "entrata").reduce((acc, t) => acc + t.amount, 0);
	const spesePrev = prevData.filter((t) => t.type === "spesa").reduce((acc, t) => acc + t.amount, 0);
	const saldoPrecedente = entratePrev - spesePrev;
	const variazionePct = saldoPrecedente !== 0
		? Math.round(((saldoMese - saldoPrecedente) / Math.abs(saldoPrecedente)) * 100)
		: null;

	// Spese per categoria (donut)
	const spesePerCategoria = speseData?.reduce(
		(acc, t) => {
			const cat = t.categories as unknown as { name: string; color: string } | null;
			const nome = cat?.name;
			const color = cat?.color ?? "";
			if (!nome) return acc;
			if (!acc[nome]) {
				acc[nome] = { name: nome, color, total: t.amount };
			} else {
				acc[nome].total += t.amount;
			}
			return acc;
		},
		{} as Record<string, { name: string; color: string; total: number }>,
	);

	return {
		spese: Object.values(spesePerCategoria ?? {}),
		saldoMese,
		variazionePct,
		trend,
	};
}
