import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInitials, getDisplayName } from "@/lib/profile";
import type { AccountContext } from "@/types";

/**
 * Dati di account condivisi da /impostazioni e dalle sue sottopagine.
 * Se non c'è sessione rimanda al login: le pagine che la usano non devono
 * gestire il caso "user null".
 */
export async function getAccountContext(): Promise<AccountContext> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/sign");

	const { data: profile } = await supabase
		.from("profiles")
		.select("full_name, avatar_url, currency, language")
		.eq("id", user.id)
		.single();

	const email = user.email ?? "";
	const fullName = profile?.full_name ?? null;

	return {
		userId: user.id,
		email,
		fullName,
		avatarUrl: profile?.avatar_url ?? null,
		currency: profile?.currency ?? "EUR",
		language: profile?.language ?? "it",
		displayName: getDisplayName(fullName, email),
		initials: getInitials(fullName, email),
		// Chi si è registrato solo con Google/Facebook non ha una password da
		// cambiare, né da usare per riautenticarsi.
		hasPasswordIdentity: user.identities?.some((i) => i.provider === "email") ?? false,
	};
}
