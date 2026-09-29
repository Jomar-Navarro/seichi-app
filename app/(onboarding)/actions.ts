"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isCurrency, normalizeLocale } from "@/lib/i18n/config";
import { dictionaryFor, setLocaleCookie } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/dictionaries/it";

export async function savePreferences(currency: string, language: string) {
	const { supabase, user, t } = await requireUser();

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

	/*
	 * ⚠️ Il conto PRIMA del profilo, e non è pignoleria sull'ordine.
	 *
	 * `profiles.currency` è il GATE dell'onboarding (`if (!profile?.currency)
	 * redirect("/start")`): nell'istante in cui viene scritta, l'utente è libero
	 * di entrare nell'app. Ma il primo conto nasceva un passo dopo, in
	 * `saveCategories`, e `transactions.account_id` è NOT NULL — quindi chi
	 * abbandonava fra /preference e /category si ritrovava dentro l'app **senza
	 * un conto**, col bottone di salvataggio spento per sempre e nessun messaggio
	 * che spiegasse perché. Il backfill della `20260814` copre solo chi esisteva
	 * quando è stata eseguita, non chi arriva dopo.
	 *
	 * Creandolo qui l'invariante diventa: *gate soddisfatto ⇒ almeno un conto*.
	 * `saveCategories` continua a chiamarlo, ed è innocuo perché è idempotente:
	 * serve a chi ha superato questo passo prima di questa correzione.
	 *
	 * ⚠️ Il nome arriva da `dictionaryFor(locale)`, NON da `t`.
	 * `t` viene da `requireUser()`, che legge il cookie — cioè la lingua
	 * PRECEDENTE, perché `setLocaleCookie` non è ancora stato chiamato. Chi
	 * sceglie English qui si sarebbe visto creare "Conto principale". È la stessa
	 * trappola della Fase 19 ("scrivere il cookie non basta a cambiare la lingua
	 * resa"), in versione anticipata: qui il cookie non è nemmeno ancora scritto.
	 */
	const account = await ensureFirstAccount(supabase, user.id, dictionaryFor(locale));
	if ("error" in account) return account;

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

/** La chiave con cui due categorie si considerano la stessa: tipo + nome. */
const categoryKey = (type: string, name: string) => `${type}\u0000${name.trim().toLowerCase()}`;

/**
 * Aggiunge le categorie scelte nell'onboarding. **Non ne cancella mai nessuna.**
 *
 * ⚠️⚠️ Fino alla #116 cancellava prima tutte le categorie dell'utente di ogni
 * tipo e poi reinseriva le scelte, per poter "rifare" l'onboarding senza
 * doppioni. Ma `transactions_category_id_fkey` è `on delete cascade`: tornare
 * su `/category` dopo mesi d'uso (cronologia, tasto indietro, segnalibro) e
 * toccare "Completa" cancellava ogni movimento tranne i trasferimenti, e con
 * loro budget, obiettivi e le righe delle ricevute. Senza conferma.
 *
 * Ora l'idempotenza viene dal confronto, non dalla cancellazione: si inseriscono
 * solo le scelte che l'utente non ha già, a parità di tipo e di nome. Un secondo
 * invio non duplica, e rifare l'onboarding può solo aggiungere ciò che l'utente
 * ha appena scelto.
 *
 * ⚠️ La garanzia sta QUI e non nel layout di `(onboarding)`, che rimanda in home
 * chi ha già finito: un layout non si riesegue sulle navigazioni interne né su
 * quelle indietro/avanti restaurate dalla cache del router (guida autenticazione
 * di Next 16, "Layouts and auth checks"), e la action è raggiungibile anche con
 * una POST diretta.
 *
 * Residuo dichiarato: una categoria preset rinominata dall'utente, o creata in
 * un'altra lingua, non combacia col nome di adesso e verrebbe aggiunta di nuovo
 * se riselezionata. È una categoria in più che l'utente ha appena scelto, non un
 * dato perso.
 *
 * ⚠️ Secondo residuo: "un secondo invio non duplica" vale per invii in
 * SEQUENZA. Due richieste concorrenti leggono entrambe prima che l'una o l'altra
 * scriva, e inseriscono entrambe. Il bottone si spegne al primo tocco, quindi
 * servono due schede aperte su `/category` o un nuovo tentativo di una richiesta
 * già arrivata; il risultato sono categorie doppie, che si cancellano, non dati
 * persi. La chiusura vera sarebbe un indice unico su `(user_id, type, nome)`, ma
 * è una regola di prodotto nuova — oggi due categorie con lo stesso nome sono
 * ammesse ovunque — e le righe esistenti potrebbero già violarla: si decide in
 * chiaro, non come effetto collaterale di questa action.
 */
export async function saveCategories(selected: string[]) {
	const { supabase, user, t } = await requireUser();

	if (!user) return { error: t.errors.notAuthenticated };

	// Il tipo dice `string[]`, ma con una POST diretta l'argomento può essere
	// qualunque valore serializzabile: `new Set({})` solleverebbe, e una stringa
	// verrebbe letta carattere per carattere. Il resto lo scarta già `Object.hasOwn`.
	if (!Array.isArray(selected)) return { error: t.common.genericError };

	// Il nome si fissa QUI, nella lingua scelta all'onboarding — che il passo
	// precedente ha appena scritto nel cookie, quindi `getDictionary()` la vede
	// già. Da questo insert in poi è un dato dell'utente come qualsiasi altro.
	//
	// `Object.hasOwn` e non `CATEGORY_MAP[v]`: il valore arriva dal client, e
	// "constructor" o "toString" sono veri su qualunque oggetto. Il `Set` toglie
	// i doppioni di una stessa richiesta.
	const rows = [...new Set(selected)]
		.filter((v) => Object.hasOwn(CATEGORY_MAP, v))
		.map((v) => ({
			user_id: user.id,
			...CATEGORY_MAP[v],
			name: t.presetCategories[v as keyof typeof t.presetCategories].title,
		}));

	if (rows.length > 0) {
		// Solo i tipi delle scelte: una categoria di un altro tipo non può
		// combaciare, e chi torna qui dopo mesi d'uso non deve scaricarle tutte.
		const { data: existing, error: readError } = await supabase
			.from("categories")
			.select("type, name")
			.eq("user_id", user.id)
			.in("type", [...new Set(rows.map((r) => r.type))]);

		// ⚠️ Una lettura fallita non si tratta come "nessuna categoria": si
		// inserirebbero doppioni di tutto ciò che l'utente ha già.
		if (readError) {
			console.error("[onboarding] saveCategories, lettura:", readError.message);
			return { error: t.common.genericError };
		}

		const present = new Set((existing ?? []).map((c) => categoryKey(c.type, c.name)));
		const missing = rows.filter((r) => !present.has(categoryKey(r.type, r.name)));

		if (missing.length > 0) {
			const { error } = await supabase.from("categories").insert(missing);
			if (error) {
				console.error("[onboarding] saveCategories, inserimento:", error.message);
				return { error: t.common.genericError };
			}
		}
	}

	return ensureFirstAccount(supabase, user.id, t);
}

/**
 * Il primo conto, creato insieme alle categorie.
 *
 * ⚠️ Non è un vezzo: `transactions.account_id` è NOT NULL, quindi **senza un
 * conto l'utente non può registrare un solo movimento** e l'onboarding
 * consegnerebbe un'app inutilizzabile. La migration `20260814` fa il backfill
 * per chi c'era già; questa funzione copre chi arriva dopo.
 *
 * ⚠️ Il nome è tradotto alla SCRITTURA, come le categorie qui sopra e per lo
 * stesso motivo: una volta scritto in `accounts.name` non è più una stringa
 * dell'app ma un dato dell'utente, che può rinominarlo. Tradurlo alla lettura
 * richiederebbe una colonna `preset_key` e una regola "se è valorizzata ignora
 * `name`", che si sfalderebbe al primo rename.
 *
 * ⚠️ È idempotente: l'onboarding si può ripercorrere (per esempio tornando
 * indietro), e un conto già esistente non si ricrea né si tocca — come le
 * categorie di `saveCategories`, che dalla #116 si aggiungono e non si
 * cancellano più.
 */
async function ensureFirstAccount(
	supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
	userId: string,
	dict: Dictionary,
) {
	const { count, error: countError } = await supabase
		.from("accounts")
		.select("id", { count: "exact", head: true })
		.eq("user_id", userId);

	if (countError) return { error: countError.message };
	if ((count ?? 0) > 0) return { success: true };

	const { error } = await supabase.from("accounts").insert({
		user_id: userId,
		name: dict.onboarding.firstAccountName,
		type: "corrente",
	});

	return error ? { error: error.message } : { success: true };
}
