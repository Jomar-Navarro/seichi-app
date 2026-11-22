/**
 * Lettura della lingua lato server (Fase 19).
 *
 * Sta in un modulo separato da `config.ts` perché importa `next/headers`: questo
 * file non può essere toccato da un client component, e il tentativo fallisce in
 * compilazione. È anche la ragione per cui non serve il pacchetto `server-only` —
 * la guardia esiste già, per costruzione.
 *
 * Qui vivono anche gli import dei due dizionari. Non devono MAI finire in un
 * modulo che un client component importa, o entrambe le lingue verrebbero
 * impacchettate nel bundle del browser: il dizionario raggiunge il client come
 * PROP di `<I18nProvider>`, cioè come dato serializzato, e viaggia una lingua sola.
 */

import { cookies, headers } from "next/headers";
import {
	CURRENCY_COOKIE,
	CURRENCY_COOKIE_OPTIONS,
	DEFAULT_LOCALE,
	FALLBACK_CURRENCY,
	isCurrency,
	LOCALE_COOKIE,
	LOCALE_COOKIE_OPTIONS,
	negotiateLocale,
	normalizeLocale,
	type Currency,
	type Locale,
} from "./config";
import { it, type Dictionary } from "./dictionaries/it";
import { en } from "./dictionaries/en";

const DICTIONARIES: Record<Locale, Dictionary> = { it, en };

export function dictionaryFor(locale: Locale): Dictionary {
	return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * La lingua di questa richiesta.
 *
 * Ordine: cookie → `Accept-Language` → italiano.
 *
 * ⚠️ `profiles.language` NON viene letto qui, ed è deliberato: sarebbe una query
 * a Supabase su OGNI render di OGNI pagina, root layout compreso, per un valore
 * che cambia forse due volte nella vita di un account. La riga del database resta
 * la persistenza fra dispositivi e viene riversata nel cookie al login, dove il
 * profilo è già stato interrogato per il gate dell'onboarding (`profiles.currency`)
 * — quindi a costo zero. Il cookie è la fonte per il rendering, esattamente come
 * per il tema della Fase 18.
 */
export async function getLocale(): Promise<Locale> {
	const store = await cookies();
	const fromCookie = normalizeLocale(store.get(LOCALE_COOKIE)?.value);
	if (fromCookie) return fromCookie;

	// Nessun cookie: è la primissima visita, quasi sempre pre-login. A differenza
	// del tema, qui il browser ce lo dice negli header e non serve tirare a indovinare.
	const headerStore = await headers();
	return negotiateLocale(headerStore.get("accept-language"));
}

/**
 * Locale e dizionario insieme — la chiamata che serve nei server component.
 *
 * `t` è il dizionario stesso, quindi si scrive `t.nav.home`: accesso diretto a un
 * oggetto tipizzato, con autocompletamento e senza parsing di stringhe a runtime.
 * Una chiave inesistente è un errore del compilatore, non una `undefined` che
 * finisce nella pagina.
 */
export async function getI18n(): Promise<{ locale: Locale; t: Dictionary; currency: Currency }> {
	const [locale, currency] = await Promise.all([getLocale(), getCurrency()]);
	return { locale, t: dictionaryFor(locale), currency };
}

/**
 * La valuta di questa richiesta (#171): il cookie, o il ripiego.
 *
 * Il ripiego vale solo dove nessun importo dell'utente è a schermo: a un
 * utente autenticato senza cookie lo scrive il proxy, prima del render. Vedi
 * `CURRENCY_COOKIE` in `config.ts`.
 */
export async function getCurrency(): Promise<Currency> {
	const value = (await cookies()).get(CURRENCY_COOKIE)?.value;
	return isCurrency(value) ? value : FALLBACK_CURRENCY;
}

/** Scorciatoia per chi non ha bisogno del locale, ma solo delle parole. */
export async function getDictionary(): Promise<Dictionary> {
	return dictionaryFor(await getLocale());
}

/* -------------------------------------------------------------- scrittura --- */

/**
 * Scrive il cookie della lingua.
 *
 * ⚠️ Chiamabile SOLO da una server action o da un route handler: durante il render
 * di un server component `cookies()` è di sola lettura e questa solleva. Non è un
 * limite fastidioso, è la regola giusta — una risposta già in streaming non può
 * tornare indietro a mettere un header.
 */
export async function setLocaleCookie(locale: Locale) {
	const store = await cookies();
	store.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);
}

/**
 * Riversa `profiles.language` e `profiles.currency` nei cookie, se dicono
 * qualcosa di sensato.
 *
 * È il punto in cui la persistenza fra dispositivi diventa la lingua di questa
 * sessione: si chiama al login, dove il profilo è già stato interrogato per il
 * gate dell'onboarding. Chi accede da un computer nuovo ritrova la propria lingua
 * senza che il server debba interrogare il database a ogni pagina.
 *
 * Un valore illeggibile non fa niente di rumoroso: si tiene ciò che il cookie o
 * `Accept-Language` già dicevano. Riscrivere l'italiano d'ufficio sopra una scelta
 * valida sarebbe peggio del non fare nulla.
 */
export async function syncPreferencesFromProfile(profile: { language?: unknown; currency?: unknown } | null) {
	const locale = normalizeLocale(profile?.language);
	if (locale) await setLocaleCookie(locale);
	// La valuta segue la stessa strada (#171). NULL vuol dire onboarding da
	// fare: il cookie si toglie, perché sullo stesso dispositivo può esserci
	// quello di chi è uscito prima. La scelta dell'onboarding lo riscriverà.
	const currency = profile?.currency;
	if (isCurrency(currency)) await setCurrencyCookie(currency);
	else (await cookies()).delete(CURRENCY_COOKIE);
}

/** Scrive il cookie della valuta. Stesse condizioni di `setLocaleCookie`. */
export async function setCurrencyCookie(currency: Currency) {
	const store = await cookies();
	store.set(CURRENCY_COOKIE, currency, CURRENCY_COOKIE_OPTIONS);
}

/**
 * Toglie il cookie della valuta all'uscita (#171, review). Si chiama accanto a
 * ogni `auth.signOut()`.
 *
 * ⚠️ La lingua può restare: è una preferenza di chi legge, e chi entra dopo la
 * ritrova uguale o la cambia. La valuta no: è un fatto dei DATI dell'utente.
 * Rimasta sul dispositivo, chi entra dopo per una strada che non la riallinea
 * (una registrazione, un OAuth con `next` diverso da "/") vedrebbe i propri
 * importi col simbolo e i decimali di un altro, e il proxy non interverrebbe:
 * ripara un cookie che MANCA, non uno che appartiene a un altro.
 */
export async function clearCurrencyCookie() {
	(await cookies()).delete(CURRENCY_COOKIE);
}
