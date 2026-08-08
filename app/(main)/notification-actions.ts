"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { renderNotification } from "@/lib/notifications";
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
	// `locale` oltre al dizionario: `renderNotification` formatta importi e date,
	// non solo parole. Arriva da `requireUser()`, che lo risolve comunque.
	const { supabase, user, t, locale } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	// ⚠️ La query del conteggio sta QUI, non dietro una chiamata a
	// `getUnreadCount()`. Quella è una server action a sé: apriva un secondo
	// client e rifaceva il proprio controllo di autenticazione per una query che
	// da qui parte comunque nello stesso `Promise.all`. Il conteggio continua a
	// non dedursi dalle righe caricate — con più di `PANEL_LIMIT` notifiche
	// sarebbe più basso di quello vero — ma la ragione era quella, non il
	// riuso della funzione.
	const [{ data, error }, { data: profile }, { count, error: countError }] =
		await Promise.all([
			supabase
				.from("notifications")
				.select("id, type, payload, destination, read, created_at")
				.eq("user_id", user.id)
				.order("created_at", { ascending: false })
				.limit(PANEL_LIMIT),
			supabase.from("profiles").select("currency").eq("id", user.id).single(),
			unreadCountQuery(supabase, user.id),
		]);

	if (error) return { error: error.message };
	if (countError) return { error: countError.message };

	// La valuta arriva dal profilo, non è cablata: è la stessa scelta
	// nell'onboarding che governa ogni altro importo dell'app.
	const currency = profile?.currency || "EUR";
	// La lingua arriva dal cookie: le frasi si compongono ADESSO, quindi anche
	// una notifica di due mesi fa esce nella lingua attuale dell'utente.
	const rendered = (data ?? []).map((row) => {
		const n = row as AppNotification;
		return { ...n, ...renderNotification(n, { currency, locale, t }) };
	});

	return { data: rendered, unread: count ?? 0 };
}

/**
 * La query del badge, senza il contorno da server action.
 *
 * `head: true` → nessuna riga trasferita, solo il conteggio. L'indice parziale
 * su (user_id) where not read serve esattamente a questa query.
 */
function unreadCountQuery(supabase: SupabaseServerClient, userId: string) {
	return supabase
		.from("notifications")
		.select("id", { count: "exact", head: true })
		.eq("user_id", userId)
		.eq("read", false);
}

/** Il numero per il badge sulla campanella. */
export async function getUnreadCount(): Promise<{ data: number } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { count, error } = await unreadCountQuery(supabase, user.id);

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
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

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
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

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
