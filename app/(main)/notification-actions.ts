"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AppNotification } from "@/types";

/**
 * Quante notifiche carica il pannello. Non c'è paginazione: oltre questo numero
 * l'utente non sta più consultando un registro, sta scorrendo un archivio — e
 * per quello c'è la pulizia a 90 giorni lato job.
 */
const PANEL_LIMIT = 30;

export async function getNotifications(): Promise<
	{ data: AppNotification[] } | { error: string }
> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const { data, error } = await supabase
		.from("notifications")
		.select("id, type, title, body, destinazione, read, created_at")
		.eq("user_id", user.id)
		.order("created_at", { ascending: false })
		.limit(PANEL_LIMIT);

	return error ? { error: error.message } : { data: (data ?? []) as AppNotification[] };
}

/** Il numero per il badge sulla campanella. */
export async function getUnreadCount(): Promise<{ data: number } | { error: string }> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	// head: true → nessuna riga trasferita, solo il conteggio. L'indice parziale
	// su (user_id) where not read serve esattamente a questa query.
	const { count, error } = await supabase
		.from("notifications")
		.select("id", { count: "exact", head: true })
		.eq("user_id", user.id)
		.eq("read", false);

	return error ? { error: error.message } : { data: count ?? 0 };
}

/**
 * Segna una notifica come letta.
 *
 * Il tap fa questo E naviga alla destinazione: è ciò che rende utile la colonna
 * `destinazione`. Scartata l'alternativa "aprire il pannello segna tutto", che
 * azzererebbe il valore del non-letto — l'unica cosa che distingue ciò che hai
 * già guardato da ciò che non hai mai visto.
 */
export async function markNotificationRead(
	id: string,
): Promise<{ success: true } | { error: string }> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	const { error } = await supabase
		.from("notifications")
		.update({ read: true })
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}

export async function markAllNotificationsRead(): Promise<
	{ success: true } | { error: string }
> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Non autenticato" };

	// Il filtro su `read` non è cosmetico: senza, l'UPDATE riscriverebbe ogni
	// riga dell'utente a ogni tocco, comprese quelle già lette.
	const { error } = await supabase
		.from("notifications")
		.update({ read: true })
		.eq("user_id", user.id)
		.eq("read", false);

	if (error) return { error: error.message };
	revalidatePath("/", "layout");
	return { success: true };
}
