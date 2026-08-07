"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeLocale } from "@/lib/i18n/config";
import { setLocaleCookie } from "@/lib/i18n/server";

export async function savePreferences(currency: string, language: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	// ⚠️ Il tag si normalizza QUI, al confine. Questa action ha sempre scritto in
	// `profiles.language` il valore grezzo della select — cioè "IT"/"EN"
	// maiuscoli — mentre le impostazioni leggevano "it"/"en": chi sceglieva
	// English alla registrazione si ritrovava la pagina impostazioni su
	// "Italiano", in silenzio. Finché nessuno consumava quel campo il difetto era
	// invisibile; da ora in poi sarebbe l'intera app nella lingua sbagliata.
	const locale = normalizeLocale(language);
	if (!locale) return { error: "Lingua non supportata" };

	const { error } = await supabase
		.from("profiles")
		.upsert({ id: user.id, currency, language: locale });

	if (error) return { error: error.message };

	// Il cookie è ciò che il rendering legge: senza questa riga la scelta finirebbe
	// nel database e la pagina successiva dell'onboarding resterebbe in italiano.
	await setLocaleCookie(locale);
	return { success: true };
}

const CATEGORY_MAP: Record<string, { name: string; icon: string; color: string; type: string }> = {
	// Entrate
	stipendio:       { name: "Stipendio",        icon: "Banknote",        color: "midori",   type: "entrata" },
	freelance:       { name: "Freelance",         icon: "Briefcase",       color: "midori",   type: "entrata" },
	bonus:           { name: "Bonus",             icon: "Award",           color: "midori",   type: "entrata" },
	regalo:          { name: "Regalo",            icon: "Gift",            color: "midori",   type: "entrata" },
	rimborso:        { name: "Rimborso",          icon: "ArrowDownLeft",   color: "midori",   type: "entrata" },
	// Spese
	alimentari:      { name: "Alimentari",        icon: "ShoppingCart",    color: "aka",      type: "spesa" },
	ristoranti:      { name: "Ristoranti",        icon: "UtensilsCrossed", color: "aka",      type: "spesa" },
	trasporti:       { name: "Trasporti",         icon: "Car",             color: "aka",      type: "spesa" },
	salute:          { name: "Salute",            icon: "HeartPulse",      color: "aka",      type: "spesa" },
	abbigliamento:   { name: "Abbigliamento",     icon: "Shirt",           color: "aka",      type: "spesa" },
	svago:           { name: "Svago",             icon: "Smile",           color: "aka",      type: "spesa" },
	casa_spesa:      { name: "Casa",              icon: "Home",            color: "aka",      type: "spesa" },
	// Risparmi
	fondo_emergenza: { name: "Fondo emergenza",   icon: "Shield",          color: "kin",      type: "risparmio" },
	vacanze:         { name: "Vacanze",           icon: "Plane",           color: "kin",      type: "risparmio" },
	obiettivo_casa:  { name: "Obiettivo casa",    icon: "Building2",       color: "kin",      type: "risparmio" },
	elettronica:     { name: "Elettronica",       icon: "Laptop",          color: "kin",      type: "risparmio" },
	// Investimenti
	etf:             { name: "ETF",               icon: "BarChart2",       color: "ao",       type: "investimento" },
	azioni:          { name: "Azioni",            icon: "TrendingUp",      color: "ao",       type: "investimento" },
	crypto:          { name: "Crypto",            icon: "Bitcoin",         color: "ao",       type: "investimento" },
	fondi:           { name: "Fondi",             icon: "PiggyBank",       color: "ao",       type: "investimento" },
	// Abbonamenti
	streaming:       { name: "Streaming",         icon: "Play",            color: "murasaki", type: "abbonamento" },
	musica:          { name: "Musica",            icon: "Music",           color: "murasaki", type: "abbonamento" },
	palestra:        { name: "Palestra",          icon: "Dumbbell",        color: "murasaki", type: "abbonamento" },
	utenze:          { name: "Utenze",            icon: "Zap",             color: "murasaki", type: "abbonamento" },
	affitto:         { name: "Affitto",           icon: "KeyRound",        color: "murasaki", type: "abbonamento" },
};

const ONBOARDING_TYPES = ["entrata", "spesa", "risparmio", "investimento", "abbonamento"];

export async function saveCategories(selected: string[]) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	if (!user) return { error: "Non autenticato" };

	const rows = selected
		.filter((v) => CATEGORY_MAP[v])
		.map((v) => ({ user_id: user.id, ...CATEGORY_MAP[v] }));

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
