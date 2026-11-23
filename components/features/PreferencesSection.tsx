"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { updatePreferences } from "@/app/(main)/impostazioni/actions";
import { useI18n } from "@/components/features/I18nProvider";
import RowMenu from "@/components/UI/RowMenu";
import { currencyDecimals, currencySymbol } from "@/lib/i18n/format";
import {
	CURRENCIES,
	DEFAULT_LOCALE,
	LOCALE_LABELS,
	LOCALES,
	isCurrency,
	normalizeLocale,
	type Currency,
} from "@/lib/i18n/config";
import { logClientError } from "@/lib/client-errors";

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
	const [error, setError] = useState<string | null>(null);
	const currencyHintId = useId();

	/*
	 * ⚠️ La riga mostra la scelta PRIMA che il server la confermi, quindi un
	 * salvataggio fallito deve rimetterla com'era (#124). Prima l'esito veniva
	 * ignorato: la riga diceva "USD" o "English" mentre il database conteneva
	 * ancora la scelta di prima, e nessun messaggio lo spiegava — fino al
	 * ricaricamento, quando la scelta "salvata" spariva da sola.
	 *
	 * `previous` si passa da fuori e non si legge dallo stato: dentro `onChange`
	 * lo stato è già stato aggiornato al valore nuovo.
	 */
	async function save(nextCur: Currency, nextLang: string, previous: { cur: Currency; lang: string }) {
		setSaving(true);
		setError(null);
		let failed: string | null = null;
		try {
			const res = await updatePreferences(nextCur, nextLang);
			if ("error" in res) failed = res.error ?? t.common.genericError;
			else router.refresh();
		} catch (e) {
			logClientError("[preferenze] salvataggio:", e);
			failed = t.common.genericError;
		} finally {
			setSaving(false);
		}
		if (failed) {
			setCur(previous.cur);
			setLang(previous.lang);
			setError(failed);
		}
	}

	// Il simbolo nella pastiglia da 36px: «$» a 15px, «CHF» più piccolo, o
	// esce dai bordi.
	const symbol = currencySymbol(cur, locale);

	return (
		<div className="rounded-[22px] bg-card card-shadow-ring overflow-hidden" aria-busy={saving}>
			{/* Valuta — con l'avviso sotto (#171): Seichi non converte, e chi
			    cambia valuta deve saperlo PRIMA di vedere il saldo col simbolo
			    nuovo. Il filo sta sotto l'avviso, che appartiene alla riga.
			    ⚠️ Menu disegnato (`RowMenu`), non una `<select>` nativa: il menu
			    del sistema operativo non è il design. Le righe si spengono durante
			    il salvataggio (review della #124): con due salvataggi sovrapposti
			    il ripristino del primo cancellava la scelta del secondo. */}
			<div className="border-b border-subtle">
				<RowMenu
					label={t.settings.preferences.currency}
					icon={
						<span className={`${symbol.length > 1 ? "text-[11px]" : "text-[15px]"} font-semibold text-secondary`}>
							{symbol}
						</span>
					}
					valueText={`${cur} — ${currencies[cur]}`}
					options={CURRENCIES.map((code) => ({ value: code, label: `${code} — ${currencies[code]}` }))}
					selected={cur}
					disabled={saving}
					describedBy={currencyHintId}
					onSelect={(next) => {
						// La guardia stringe lo `string` al codice tipizzato. Le opzioni
						// le generiamo noi, quindi non può fallire — ma è il compilatore
						// a saperlo, non un commento.
						if (!isCurrency(next)) return;
						setCur(next);
						save(next, lang, { cur, lang });
					}}
				/>
				<p id={currencyHintId} className="px-4 pb-3.5 -mt-1.5 text-[11.5px] leading-snug text-muted">
					{t.settings.preferences.currencyHint}
					{currencyDecimals(cur) === 0 && <> {t.settings.preferences.currencyHintNoDecimals}</>}
				</p>
			</div>

			{/* Lingua. Gli endonimi non passano dal dizionario: restano «Italiano» e
			    «English» in entrambe le lingue, altrimenti chi cerca la propria non
			    la riconoscerebbe. */}
			<RowMenu
				label={t.settings.preferences.language}
				icon={<Globe size={17} className="text-secondary" />}
				valueText={LOCALE_LABELS[lang as keyof typeof LOCALE_LABELS] ?? LOCALE_LABELS[DEFAULT_LOCALE]}
				options={LOCALES.map((code) => ({ value: code, label: LOCALE_LABELS[code] }))}
				selected={lang}
				disabled={saving}
				onSelect={(next) => {
					setLang(next);
					save(cur, next, { cur, lang });
				}}
			/>

			{error && (
				<p role="alert" className="px-4 pb-3.5 -mt-1 text-[11.5px] leading-snug text-aka-ink">
					{error}
				</p>
			)}
		</div>
	);
}
