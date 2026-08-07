"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePreferences } from "@/app/(onboarding)/actions";
import {
	Euro,
	DollarSign,
	PoundSterling,
	JapaneseYen,
	Sprout,
} from "lucide-react";
import Button from "@/components/UI/Button";
import Select from "@/components/UI/Select";
import OnboardingProgress from "@/components/UI/OnboardingProgress";
import { DEFAULT_LOCALE, LOCALE_LABELS } from "@/lib/i18n/config";
import { useI18n } from "@/components/features/I18nProvider";

/** Solo codice e icona: il nome viene da `t.settings.currencies`. */
const CURRENCY_OPTIONS = [
	{ value: "EUR", icon: <Euro size={18} /> },
	{ value: "USD", icon: <DollarSign size={18} /> },
	{ value: "GBP", icon: <PoundSterling size={18} /> },
	{ value: "JPY", icon: <JapaneseYen size={18} /> },
] as const;

// I `value` sono i tag canonici minuscoli, gli stessi che finiscono in
// `profiles.language` e nel cookie. Erano "IT"/"EN" e le impostazioni leggevano
// minuscolo: la scelta dell'inglese si perdeva per strada senza dirlo.
// L'etichetta è l'endonimo e non si traduce — chi cerca l'inglese non riconosce
// la parola "Inglese".
const languages = [
	{
		value: "it",
		label: LOCALE_LABELS.it,
		icon: <span className="text-base">🇮🇹</span>,
	},
	{
		value: "en",
		label: LOCALE_LABELS.en,
		icon: <span className="text-base">🇬🇧</span>,
	},
];

export default function PreferencePage() {
	const router = useRouter();
	const { t } = useI18n();
	const currencies = CURRENCY_OPTIONS.map((c) => ({
		...c,
		label: t.settings.currencies[c.value],
	}));
	const [currency, setCurrency] = useState("EUR");
	const [language, setLanguage] = useState<string>(DEFAULT_LOCALE);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleContinue = async () => {
		setIsLoading(true);
		setError(null);
		const result = await savePreferences(currency, language);
		if ("error" in result) {
			setError(result.error ?? t.common.unknownError);
			setIsLoading(false);
			return;
		}
		router.push("/category");
	};

	return (
		<div className="shrink grow basis-0 flex flex-col lg:flex-row overflow-hidden">
			{/* ── LEFT PANEL · desktop only ── */}
			<div className="hidden lg:flex flex-col w-2/5 lg:p-10 xl:p-14 border-r border-subtle onboarding-blur">
				<div className="flex items-center gap-2.5">
					<div className="w-9 h-9 flex items-center justify-center border border-subtle rounded-xl bg-surface-elevated backdrop-blur-md shrink-0">
						<Sprout size={18} className="text-midori" />
					</div>
					<span className="font-semibold text-sm">Seichi</span>
				</div>

				<div className="grow" />

				<div>
					<h4 className="uppercase tracking-[2.4px] text-xs text-muted mb-3">
						{t.onboarding.preference.eyebrow}
					</h4>
					<h2 className="lg:text-5xl xl:text-6xl 2xl:text-7xl font-semibold mb-4 leading-[1.1]">
						{t.onboarding.preference.headingLine1}
						<br />{t.onboarding.preference.headingLine2}
					</h2>
					<p className="lg:text-sm xl:text-base text-muted leading-[1.65] max-w-xs">
						{t.onboarding.preference.description}
					</p>
				</div>
			</div>

			{/* ── RIGHT PANEL ── */}
			<div className="grow lg:grow-0 lg:w-3/5 flex flex-col overflow-auto">
				{/* Progress bar — true-centered at top */}
				<div className="relative z-10 pt-8 lg:pt-10">
					<OnboardingProgress currentStep={2} />
				</div>

				{/* ── MOBILE ── */}
				<div className="lg:hidden flex flex-col grow w-full max-w-md mx-auto px-6">
					<div className="mt-8 mb-6">
						<h4 className="uppercase tracking-[2.4px] text-xs text-muted mb-3">
							{t.onboarding.preference.eyebrow}
						</h4>
						<h2 className="text-4xl font-semibold mb-3 leading-[1.1]">
							{t.onboarding.preference.heading}
						</h2>
						<p className="text-muted leading-[1.65]">
							{t.onboarding.preference.description}
						</p>
					</div>
					<Select title={t.settings.preferences.currency} options={currencies} selected={currency} onChange={setCurrency} />
					<Select title={t.settings.preferences.language} options={languages} selected={language} onChange={setLanguage} />
					<div className="grow" />
					{error && <p className="text-aka-ink text-sm text-center mb-3">{error}</p>}
					<div className="pb-10">
						<Button onClick={handleContinue} disabled={isLoading} title={isLoading ? t.common.saving : t.common.continue} variant="welcome" />
					</div>
				</div>

				{/* ── DESKTOP ── */}
				<div className="hidden lg:flex flex-col grow px-14">
					<div className="grow flex items-center justify-center py-8">
						<div className="w-full max-w-lg xl:bg-surface xl:border xl:border-subtle xl:rounded-2xl xl:px-10 xl:py-10 xl:backdrop-blur-sm">
							<Select title={t.settings.preferences.currency} options={currencies} selected={currency} onChange={setCurrency} />
							<Select title={t.settings.preferences.language} options={languages} selected={language} onChange={setLanguage} />
						</div>
					</div>
					{error && <p className="text-aka-ink text-sm text-center w-full max-w-lg mx-auto mb-3">{error}</p>}
					<div className="w-full max-w-lg mx-auto pb-14">
						<Button onClick={handleContinue} disabled={isLoading} title={isLoading ? t.common.saving : t.common.continue} variant="welcome" />
					</div>
				</div>
			</div>
		</div>
	);
}
