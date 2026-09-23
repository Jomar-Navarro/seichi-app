import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
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
 *
 * Dall'issue #108 la query vive in `loadProfileHeader()`, condivisa col footer
 * della sidebar: qui resta solo il `redirect`, che è la parte che la home vuole
 * e il layout no.
 */
export async function getProfileHeader(): Promise<ProfileHeader> {
	const header = await loadProfileHeader();
	if (!header) redirect("/sign");
	return header;
}

/**
 * La lettura di `profiles` per l'intestazione — UNA per richiesta, chiunque la
 * chieda (issue #108).
 *
 * La chiedono in due: la home (`getProfileHeader`) e il footer della sidebar
 * (`getSidebarProfile`, dal layout di `(main)`). Al caricamento di `/` layout e
 * pagina girano nello stesso render, e `cache()` fa sì che la seconda chiamata
 * riceva la promise della prima invece di rifare la query — è il meccanismo
 * che i doc indicano proprio per il layout che deve leggere un dato già letto
 * dalla pagina (node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/layout.md, "Fetching Data").
 *
 * ⚠️ NIENTE `redirect()` qui dentro, ed è il motivo per cui la funzione
 * esiste: senza utente torna `null` e decide il chiamante. La home rimanda al
 * login; il footer semplicemente non si disegna. Un `redirect()` dentro la
 * promise del layout sarebbe un'eccezione lanciata da un pezzo decorativo.
 *
 * ⚠️ Può invece SOLLEVARE: `getSessionUser()` solleva su un guasto di rete, di
 * proposito ("non lo so" non è "non sei autenticato" — vedi lib/auth.ts). La
 * home lo lascia salire, come ha sempre fatto; `getSidebarProfile()` lo
 * assorbe.
 */
const loadProfileHeader = cache(async (): Promise<ProfileHeader | null> => {
	const supabase = await createClient();
	const user = await getSessionUser();

	if (!user) return null;

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
});

/**
 * Quanti conti ATTIVI ha l'utente — la query, UNA per l'intera app.
 *
 * La usano in tre: `canDeleteAccount()` e `deleteAccount()` (conti/actions.ts,
 * "non si resta a zero conti attivi") e il footer della sidebar (qui sotto).
 * Sta qui e non in quel file perché un file `"use server"` può esportare solo
 * server action: esportata da là, sarebbe diventata invocabile dal client.
 * Due copie della stessa query sono due definizioni di «conto attivo» pronte a
 * divergere (review del #108) — la classe per cui l'issue #62 nasce nel primo
 * finding: due punti che decidono la stessa cosa devono decidere la STESSA cosa.
 *
 * ⚠️ Una HEAD count su `accounts`, MAI la vista `account_balances`: quella
 * aggrega l'intero archivio dei movimenti per calcolare i saldi, mentre qui
 * serve solo quante righe ha un utente in una tabella dove ne ha una manciata.
 * `head: true` non trasferisce nemmeno quelle.
 *
 * L'errore lo decide il chiamante, perché i bisogni sono OPPOSTI: là un guasto
 * deve rifiutare un'eliminazione, nel footer deve solo tacere.
 */
export async function countActiveAccounts(
	supabase: SupabaseServerClient,
	userId: string,
): Promise<{ data: number } | { error: string }> {
	const { count, error } = await supabase
		.from("accounts")
		.select("id", { count: "exact", head: true })
		.eq("user_id", userId)
		.eq("archived", false);

	if (error) return { error: error.message };
	return { data: count ?? 0 };
}

/**
 * Il sottotitolo del footer della sidebar (issue #108): `countActiveAccounts`
 * con la politica d'errore del footer.
 *
 * ⚠️ `null` su errore, mai `0`. Uno zero sarebbe un'affermazione ("non hai
 * conti attivi") prodotta da un guasto — la classe già corretta due volte
 * nella 23a, *una lettura fallita travestita da fatto*. Con `null` il
 * sottotitolo semplicemente non compare.
 */
export const getActiveAccountCount = cache(async (): Promise<number | null> => {
	const user = await getSessionUser();
	if (!user) return null;

	const supabase = await createClient();
	const result = await countActiveAccounts(supabase, user.id);
	if ("error" in result) {
		console.error("[account] conteggio dei conti attivi:", result.error);
		return null;
	}
	return result.data;
});

/** Ciò che il footer della sidebar disegna: l'intestazione più il conteggio. */
export type SidebarProfile = ProfileHeader & {
	/** `null` = conteggio non disponibile, e il sottotitolo non si mostra. */
	activeAccounts: number | null;
};

/**
 * I dati del footer della sidebar (issue #108), pensati per viaggiare come
 * PROMISE dal layout di `(main)` al client — vedi il commento là per il costo.
 *
 * ⚠️ Questa promise NON RIFIUTA MAI, e non fa mai `redirect()`. La legge
 * `use()` nel client, e un rifiuto salirebbe fino a un error boundary che nel
 * layout non c'è: `error.js` non avvolge il `layout.js` del proprio segmento
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * error.md) e questo progetto non ha `global-error` — l'intera app sparirebbe
 * per un pezzo decorativo. Qualunque guasto degrada quindi a `null`, cioè a un
 * footer che non si disegna: la voce "Impostazioni" resta nella nav, e con
 * essa tema e uscita.
 */
export async function getSidebarProfile(): Promise<SidebarProfile | null> {
	try {
		const [header, activeAccounts] = await Promise.all([
			loadProfileHeader(),
			getActiveAccountCount(),
		]);
		return header ? { ...header, activeAccounts } : null;
	} catch (error) {
		console.error("[account] footer della sidebar:", error);
		return null;
	}
}
