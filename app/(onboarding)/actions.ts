"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isCurrency, normalizeLocale } from "@/lib/i18n/config";
import { getDictionary, setLocaleCookie } from "@/lib/i18n/server";

export async function savePreferences(currency: string, language: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	// La valuta si valida come la lingua: `profiles.currency` è il flag
	// dell'onboarding, e un valore vuoto rimbalzerebbe l'utente su /start a ogni
	// accesso. La action è raggiungibile con una POST diretta, non solo dalla UI.
	if (!isCurrency(currency)) return { error: t.errors.unsupportedCurrency };

	// ⚠️ Il tag si normalizza QUI, al confine. Questa action ha sempre scritto in
	// `profiles.language` il valore grezzo della select — cioè "IT"/"EN"
	// maiuscoli — mentre le impostazioni leggevano "it"/"en": chi sceglieva
	// English alla registrazione si ritrovava la pagina impostazioni su
	// "Italiano", in silenzio. Finché nessuno consumava quel campo il difetto era
	// invisibile; da ora in poi sarebbe l'intera app nella lingua sbagliata.
	const locale = normalizeLocale(language);
	if (!locale) return { error: t.errors.unsupportedLanguage };

	const { error } = await supabase
		.from("profiles")
		.upsert({ id: user.id, currency, language: locale });

	if (error) return { error: error.message };

	// Il cookie è ciò che il rendering legge: senza questa riga la scelta finirebbe
	// nel database e la pagina successiva dell'onboarding resterebbe in italiano.
	await setLocaleCookie(locale);

	// ⚠️ Scrivere il cookie NON basta: la pagina successiva si raggiunge con un
	// `router.push`, cioè una navigazione soft, che riusa il root layout dalla
	// cache del router e quindi il dizionario VECCHIO. Il risultato era il peggiore
	// possibile: `/category` mostrava le card in italiano mentre `saveCategories()`
	// — che il cookie lo legge sul server — scriveva i nomi in inglese nel
	// database. Esattamente il disallineamento che il catalogo unico esiste per
	// impedire. `revalidatePath` sul layout invalida quella cache.
	revalidatePath("/", "layout");
	return { success: true };
}

/**
 * Le categorie proposte dall'onboarding: icona, colore e tipo.
 *
 * ⚠️ Niente `name` (Fase 19). Il nome arriva da `t.presetCategories[chiave].title`
 * e viene tradotto AL MOMENTO DELL'INSERT, non al render: una volta scritto in
 * `categories.name` non è più una stringa dell'app ma un dato dell'utente — che
 * può rinominarlo — ed è già stato copiato nel payload delle notifiche
 * (`'category', c.name` nella migration della 17b). Tradurlo alla lettura
 * significherebbe che la lista categorie e una notifica di due mesi fa mostrano
 * due nomi diversi per la stessa cosa, nella stessa schermata.
 *
 * Le chiavi (`stipendio`, `alimentari`) restano italiane: sono identificatori,
 * come i valori di `categories.type`.
 */
const CATEGORY_MAP: Record<string, { icon: string; color: string; type: string }> = {
	// Entrate
	stipendio:       { icon: "Banknote",        color: "midori",   type: "entrata" },
	freelance:       { icon: "Briefcase",       color: "midori",   type: "entrata" },
	bonus:           { icon: "Award",           color: "midori",   type: "entrata" },
	regalo:          { icon: "Gift",            color: "midori",   type: "entrata" },
	rimborso:        { icon: "ArrowDownLeft",   color: "midori",   type: "entrata" },
	// Spese
	alimentari:      { icon: "ShoppingCart",    color: "aka",      type: "spesa" },
	ristoranti:      { icon: "UtensilsCrossed", color: "aka",      type: "spesa" },
	trasporti:       { icon: "Car",             color: "aka",      type: "spesa" },
	salute:          { icon: "HeartPulse",      color: "aka",      type: "spesa" },
	abbigliamento:   { icon: "Shirt",           color: "aka",      type: "spesa" },
	svago:           { icon: "Smile",           color: "aka",      type: "spesa" },
	casa_spesa:      { icon: "Home",            color: "aka",      type: "spesa" },
	// Risparmi
	fondo_emergenza: { icon: "Shield",          color: "kin",      type: "risparmio" },
	vacanze:         { icon: "Plane",           color: "kin",      type: "risparmio" },
	obiettivo_casa:  { icon: "Building2",       color: "kin",      type: "risparmio" },
	elettronica:     { icon: "Laptop",          color: "kin",      type: "risparmio" },
	// Investimenti
	etf:             { icon: "BarChart2",       color: "ao",       type: "investimento" },
	azioni:          { icon: "TrendingUp",      color: "ao",       type: "investimento" },
	crypto:          { icon: "Bitcoin",         color: "ao",       type: "investimento" },
	fondi:           { icon: "PiggyBank",       color: "ao",       type: "investimento" },
	// Abbonamenti
	streaming:       { icon: "Play",            color: "murasaki", type: "abbonamento" },
	musica:          { icon: "Music",           color: "murasaki", type: "abbonamento" },
	palestra:        { icon: "Dumbbell",        color: "murasaki", type: "abbonamento" },
	utenze:          { icon: "Zap",             color: "murasaki", type: "abbonamento" },
	affitto:         { icon: "KeyRound",        color: "murasaki", type: "abbonamento" },
};

const ONBOARDING_TYPES = ["entrata", "spesa", "risparmio", "investimento", "abbonamento"];

export async function saveCategories(selected: string[]) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	const t = await getDictionary();

	if (!user) return { error: t.errors.notAuthenticated };

	// Il nome si fissa QUI, nella lingua scelta all'onboarding — che il passo
	// precedente ha appena scritto nel cookie, quindi `getDictionary()` la vede
	// già. Da questo insert in poi è un dato dell'utente come qualsiasi altro.
	const rows = selected
		.filter((v) => CATEGORY_MAP[v])
		.map((v) => ({
			user_id: user.id,
			...CATEGORY_MAP[v],
			name: t.presetCategories[v as keyof typeof t.presetCategories].title,
		}));

	const { error: deleteError } = await supabase
		.from("categories")
		.delete()
		.eq("user_id", user.id)
		.in("type", ONBOARDING_TYPES);

	if (deleteError) return { error: deleteError.message };

	if (rows.length === 0) return { success: true };

	const { error } = await supabase.from("categories").insert(rows);

	return error ? { error: error.message } : { success: true };
}
