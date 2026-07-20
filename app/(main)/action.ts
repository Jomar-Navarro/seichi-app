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
		importo,
		tipo,
		categoria_id,
		note: nota,
		data,
	});

	return error ? { error: error.message } : { success: true };
}
