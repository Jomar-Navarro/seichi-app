"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { genericError } from "@/lib/errors";

/**
 * Chiude la card «Primi passi» (#163): «Ho capito» prima di finire, o «Chiudi»
 * a voci tutte fatte. La chiusura sta in `profiles` e non nel browser, perché
 * chiusa su un dispositivo deve restare chiusa sugli altri.
 *
 * ⚠️ `upsert` e non `update`: un update su zero righe non è un errore per
 * Postgres, e l'app direbbe «chiusa» senza aver scritto niente (CLAUDE.md,
 * «profiles si scrive con upsert»). L'istante viene dal server: è un fatto
 * («quando»), non un «oggi» dell'utente, quindi il fuso non c'entra.
 *
 * `revalidatePath("/")` e non `("/", "layout")`: cambia solo la home, e il
 * layout di `(main)` rifarebbe a vuoto le sue letture (sidebar, conteggi).
 */
export async function dismissFirstSteps(): Promise<{ success: true } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { error } = await supabase
		.from("profiles")
		.upsert({ id: user.id, first_steps_dismissed_at: new Date().toISOString() });

	if (error) return { error: genericError("primi passi: chiusura", error, t) };

	revalidatePath("/");
	return { success: true };
}
