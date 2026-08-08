"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, ChevronDown } from "lucide-react";
import { updatePreferences } from "@/app/(main)/impostazioni/actions";
import { useI18n } from "@/components/features/I18nProvider";
import { currencySymbol } from "@/lib/i18n/format";
import {
	CURRENCIES,
	DEFAULT_LOCALE,
	LOCALE_LABELS,
	LOCALES,
	isCurrency,
	normalizeLocale,
	type Currency,
} from "@/lib/i18n/config";

/**
 * I codici ISO sono dati, i nomi sono testo: la riga si compone "EUR — Euro".
 *
 * L'elenco e la guardia vivono in `lib/i18n/config.ts` accanto a `LOCALES`,
 * perché servono anche alle server action che validano la scrittura.
 *
 * Che ogni codice ammesso sia anche NOMINABILE non ha bisogno di un'asserzione
 * a parte: `currencies[code]` più sotto è già il controllo: aggiungere una
 * valuta a `CURRENCIES` senza tradurla non compila, perché l'indice uscirebbe
 * dalle chiavi del dizionario.
 */
interface PreferencesSectionProps {
	currency: string;
	language: string;
}

export default function PreferencesSection({ currency, language }: PreferencesSectionProps) {
	const router = useRouter();
	const { locale, t } = useI18n();
	const currencies = t.settings.currencies;
	const [cur, setCur] = useState<Currency>(isCurrency(currency) ? currency : "EUR");
	// ⚠️ `normalizeLocale` e non `language in LANGUAGES`: il confronto secco
	// falliva su "IT"/"EN", i valori che l'onboarding ha scritto per mesi, e
	// ripiegava su "it" mostrando "Italiano" a chi aveva scelto English.
	const [lang, setLang] = useState<string>(normalizeLocale(language) ?? DEFAULT_LOCALE);
	const [saving, setSaving] = useState(false);

	async function save(nextCur: string, nextLang: string) {
		setSaving(true);
		try {
			await updatePreferences(nextCur, nextLang);
			router.refresh();
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="rounded-[22px] bg-card border border-subtle card-shadow overflow-hidden" aria-busy={saving}>
			{/* Valuta */}
			<label className="relative flex items-center gap-3 h-15.5 px-4 border-b border-subtle cursor-pointer">
				<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
					<span className="text-[15px] font-semibold text-secondary">{currencySymbol(cur, locale)}</span>
				</span>
				<span className="flex-1 text-sm font-medium">{t.settings.preferences.currency}</span>
				<span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
					{cur} — {currencies[cur]}
					<ChevronDown size={12} />
				</span>
				<select
					value={cur}
					onChange={(e) => {
						// La guardia stringe il `string` del DOM al codice tipizzato.
						// Le opzioni le generiamo noi, quindi non può fallire — ma è
						// il compilatore a saperlo, non un commento.
						const next = e.target.value;
						if (!isCurrency(next)) return;
						setCur(next);
						save(next, lang);
					}}
					className="absolute inset-0 opacity-0 cursor-pointer"
					aria-label={t.settings.preferences.currency}
				>
					{CURRENCIES.map((code) => (
						<option key={code} value={code}>
							{code} — {currencies[code]}
						</option>
					))}
				</select>
			</label>

			{/* Lingua */}
			<label className="relative flex items-center gap-3 h-15.5 px-4 cursor-pointer">
				<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
					<Globe size={17} className="text-secondary" />
				</span>
				<span className="flex-1 text-sm font-medium">{t.settings.preferences.language}</span>
				<span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
					{LOCALE_LABELS[lang as keyof typeof LOCALE_LABELS] ?? LOCALE_LABELS[DEFAULT_LOCALE]}
					<ChevronDown size={12} />
				</span>
				<select
					value={lang}
					onChange={(e) => {
						setLang(e.target.value);
						save(cur, e.target.value);
					}}
					className="absolute inset-0 opacity-0 cursor-pointer"
					aria-label={t.settings.preferences.language}
				>
					{/* Gli endonimi non passano dal dizionario: restano "Italiano" e
					    "English" in entrambe le lingue, altrimenti chi cerca la propria
					    non la riconoscerebbe. */}
					{LOCALES.map((code) => (
						<option key={code} value={code}>
							{LOCALE_LABELS[code]}
						</option>
					))}
				</select>
			</label>
		</div>
	);
}
