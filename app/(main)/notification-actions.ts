"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { renderNotification } from "@/lib/notifications";
import { getDictionary, getI18n } from "@/lib/i18n/server";
import type { AppNotification, RenderedNotification } from "@/types";

/**
 * Quante notifiche carica il pannello. Non c'è paginazione: oltre questo numero
 * non si sta più consultando un registro, si sta scorrendo un archivio.
 */
const PANEL_LIMIT = 30;

/**
 * La lista, con il testo già composto, **più il conteggio totale dei non letti**.
 *
 * Il conteggio viaggia insieme alla pagina e non si deduce da essa: con più di
 * `PANEL_LIMIT` notifiche, contare i non letti fra quelle caricate darebbe un
 * numero più basso di quello vero, e le più vecchie sparirebbero dal badge
 * senza che nessuno se ne accorga.
 */
export async function getNotifications(): Promise<
	{ data: RenderedNotification[]; unread: number } | { error: string }
> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: (await getDictionary()).errors.notAuthenticated };

	const [{ data, error }, { data: profile }, unreadResult] = await Promise.all([
		supabase
			.from("notifications")
			.select("id, type, payload, destination, read, created_at")
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.limit(PANEL_LIMIT),
		supabase.from("profiles").select("currency").eq("id", user.id).single(),
		getUnreadCount(),
	]);

	if (error) return { error: error.message };
	if ("error" in unreadResult) return unreadResult;

	// La valuta arriva dal profilo, non è cablata: è la stessa scelta
	// nell'onboarding che governa ogni altro importo dell'app.
	const currency = profile?.currency || "EUR";
	// La lingua arriva dal cookie: le frasi si compongono ADESSO, quindi anche
	// una notifica di due mesi fa esce nella lingua attuale dell'utente.
	const { locale, t } = await getI18n();

	const rendered = (data ?? []).map((row) => {
		const n = row as AppNotification;
		return { ...n, ...renderNotification(n, { currency, locale, t }) };
	});

	return { data: rendered, unread: unreadResult.data };
}

/** Il numero per il badge sulla campanella. */
export async function getUnreadCount(): Promise<{ data: number } | { error: string }> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: (await getDictionary()).errors.notAuthenticated };

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
 * Il tap fa questo E naviga: è ciò che rende utile la colonna `destination`.
 * `revalidatePath("/")` e non `"layout"`: l'unica cosa cambiata è il badge in
 * home, mentre invalidare il layout rigenererebbe l'intero albero di `(main)`
 * — dashboard, totali, obiettivi — per un numero.
 */
export async function markNotificationRead(
	id: string,
): Promise<{ success: true } | { error: string }> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: (await getDictionary()).errors.notAuthenticated };

	const { error } = await supabase
		.from("notifications")
		.update({ read: true })
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) return { error: error.message };
	revalidatePath("/");
	return { success: true };
}

export async function markAllNotificationsRead(): Promise<
	{ success: true } | { error: string }
> {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: (await getDictionary()).errors.notAuthenticated };

	// Il filtro su `read` non è cosmetico: senza, l'UPDATE riscriverebbe ogni
	// riga dell'utente a ogni tocco, comprese quelle già lette.
	const { error } = await supabase
		.from("notifications")
		.update({ read: true })
		.eq("user_id", user.id)
		.eq("read", false);

	if (error) return { error: error.message };
	revalidatePath("/");
	return { success: true };
}
