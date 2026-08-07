import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { getInitials, getDisplayName } from "@/lib/profile";
import { DEFAULT_LOCALE, normalizeLocale } from "@/lib/i18n/config";
import type { AccountContext } from "@/types";

/**
 * Dati di account condivisi da /impostazioni e dalle sue sottopagine.
 * Se non c'è sessione rimanda al login: le pagine che la usano non devono
 * gestire il caso "user null".
 */
export async function getAccountContext(): Promise<AccountContext> {
	const supabase = await createClient();
	const user = await getSessionUser();

	if (!user) redirect("/sign");

	const { data: profile } = await supabase
		.from("profiles")
		.select("full_name, avatar_url, currency, language")
		.eq("id", user.id)
		.single();

	const email = user.email;
	const fullName = profile?.full_name ?? null;

	return {
		userId: user.id,
		email,
		fullName,
		avatarUrl: profile?.avatar_url ?? null,
		currency: profile?.currency ?? "EUR",
		// Normalizzato in lettura, non solo in scrittura: le righe scritte prima
		// della Fase 19 contengono "IT"/"EN" maiuscoli, e la migration che le
		// ripulisce non copre chi non l'ha ancora eseguita in locale.
		language: normalizeLocale(profile?.language) ?? DEFAULT_LOCALE,
		displayName: getDisplayName(fullName, email),
		initials: getInitials(fullName, email),
		// Chi si è registrato solo con Google/Facebook non ha una password da
		// cambiare, né da usare per riautenticarsi.
		//
		// Il dato arriva da `app_metadata.providers` del JWT e non più da
		// `user.identities`: è la stessa lista di provider collegati, ma già
		// dentro il token, quindi non costa una chiamata a `/auth/v1/user`.
		hasPasswordIdentity: user.providers.includes("email"),
	};
}
