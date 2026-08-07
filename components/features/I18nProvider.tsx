"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/config";
// Import di SOLO TIPO: viene cancellato in compilazione, quindi `it.ts` non entra
// nel bundle del browser. Le parole arrivano come prop, non come modulo.
import type { Dictionary } from "@/lib/i18n/dictionaries/it";

interface I18nContextValue {
	locale: Locale;
	/** Il dizionario stesso: si scrive `t.nav.home`. */
	t: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Lingua e parole per i client component.
 *
 * Speculare a `getI18n()` dei server component, così lo stesso pezzo di UI si
 * scrive allo stesso modo da entrambi i lati: `t.nav.home`.
 */
export function useI18n() {
	const ctx = useContext(I18nContext);
	if (!ctx) throw new Error("useI18n va usato dentro <I18nProvider>");
	return ctx;
}

interface I18nProviderProps {
	locale: Locale;
	/**
	 * Il dizionario già risolto dal root layout.
	 *
	 * ⚠️ Passarlo come prop è la ragione per cui i dizionari contengono solo
	 * stringhe e oggetti semplici: questo valore attraversa il confine
	 * server→client e viene serializzato nell'RSC payload. Una funzione lì dentro
	 * — anche una sola, anche per un plurale — farebbe fallire il render con
	 * "Functions cannot be passed directly to Client Components".
	 *
	 * In cambio, nel bundle JS viaggia UNA lingua sola: quella in uso.
	 */
	dictionary: Dictionary;
	children: React.ReactNode;
}

/**
 * ⚠️ Nessun `setLocale`, a differenza di `ThemeProvider.setChoice`.
 *
 * Il tema cambia nel fotogramma corrente perché tutto ciò che serve è una classe
 * su `<html>`, e il client ce l'ha già. Le parole no: cambiare lingua richiede il
 * dizionario dell'altra, che sta sul server. Le due vie erano impacchettare
 * entrambe le lingue nel browser — raddoppiando il peso delle traduzioni per
 * risparmiare un round-trip su un'azione che si compie forse due volte nella vita
 * di un account — oppure passare dal server. Passa dal server: il cambio lingua
 * avviene sempre dentro una server action (`savePreferences`, `updatePreferences`)
 * che scrive `profiles.language` E il cookie, e il `router.refresh()` che segue
 * riporta giù le parole nuove.
 */
export default function I18nProvider({ locale, dictionary, children }: I18nProviderProps) {
	const value = useMemo(() => ({ locale, t: dictionary }), [locale, dictionary]);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
