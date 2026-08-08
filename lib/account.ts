import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { getInitials, getDisplayName } from "@/lib/profile";
import { DEFAULT_LOCALE, normalizeLocale } from "@/lib/i18n/config";
import type { AccountContext, ProfileHeader } from "@/types";

/**
 * Dati di account per /impostazioni e le sue sottopagine.
 * Se non c'è sessione rimanda al login: le pagine che la usano non devono
 * gestire il caso "user null".
 *
 * ⚠️ **Qui l'identità si legge VIVA, con `auth.getUser()`, e non dalle claims.**
 * È l'unico punto di lettura che paga una chiamata di rete, ed è il prezzo
 * giusto: queste pagine mostrano l'indirizzo email come *fatto* e lo usano come
 * *conferma*, quindi un valore stantio non è un dettaglio estetico.
 *
 * Il difetto che questa scelta ripara: con l'email presa dalle claims, dopo un
 * cambio confermato la pagina di eliminazione mostrava l'indirizzo VECCHIO,
 * mentre `deleteAccount()` confrontava con quello NUOVO. Digitare il nuovo non
 * abilitava il pulsante, digitare il vecchio veniva rifiutato dal server:
 * l'account restava impossibile da eliminare fino alla scadenza del token.
 *
 * Stesso motivo per `hasPasswordIdentity`: `deleteAccount()` lo ricava da
 * `user.identities`, e questa funzione decide se mostrare o meno il campo
 * password di quel medesimo modulo. Devono venire dalla **stessa fonte**, o la
 * UI nasconde un campo che il server poi pretende.
 *
 * Il costo è contenuto perché sono pagine di impostazioni: una chiamata per
 * vista, non cinque. La home NON passa di qui — usa `getProfileHeader()`.
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
		// Normalizzato in lettura, non solo in scrittura: le righe scritte prima
		// della Fase 19 contengono "IT"/"EN" maiuscoli, e la migration che le
		// ripulisce non copre chi non l'ha ancora eseguita in locale.
		language: normalizeLocale(profile?.language) ?? DEFAULT_LOCALE,
		displayName: getDisplayName(fullName, email),
		initials: getInitials(fullName, email),
		// Chi si è registrato solo con Google/Facebook non ha una password da
		// cambiare, né da usare per riautenticarsi. Da `user.identities`, cioè
		// la stessa fonte che usa `deleteAccount()`.
		hasPasswordIdentity: user.identities?.some((i) => i.provider === "email") ?? false,
	};
}

/**
 * Il solo necessario per l'intestazione della home: avatar, iniziali, nome.
 *
 * Esiste per non far pagare alla home ciò che serve alle impostazioni. Era tutto
 * `getAccountContext()`, e la home ne usava tre campi su nove — ma si portava
 * dietro il vincolo di freschezza dei restanti sei.
 *
 * ⚠️ **Il tipo di ritorno è la garanzia, non il commento.** `ProfileHeader` non
 * espone né `email` né `hasPasswordIdentity`, quindi nessuna pagina che parta da
 * qui può usare per una conferma d'identità un dato che è una fotografia. La
 * classe di difetto non è mitigata: è irrappresentabile.
 *
 * L'email delle claims entra solo in `getDisplayName`/`getInitials`, come
 * ripiego quando manca `full_name`. Là uno scatto vecchio è innocuo — al più
 * un'iniziale diversa per un'ora — e le due funzioni degradano da sole
 * ("Account", "··") se manca del tutto.
 */
export async function getProfileHeader(): Promise<ProfileHeader> {
	const supabase = await createClient();
	const user = await getSessionUser();

	if (!user) redirect("/sign");

	const { data: profile } = await supabase
		.from("profiles")
		.select("full_name, avatar_url")
		.eq("id", user.id)
		.single();

	const fullName = profile?.full_name ?? null;

	return {
		avatarUrl: profile?.avatar_url ?? null,
		displayName: getDisplayName(fullName, user.email),
		initials: getInitials(fullName, user.email),
	};
}
