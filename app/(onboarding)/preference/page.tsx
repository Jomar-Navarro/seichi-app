"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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

const currencies = [
	{ value: "EUR", label: "Euro", icon: <Euro size={18} /> },
	{ value: "USD", label: "Dollaro", icon: <DollarSign size={18} /> },
	{ value: "GBP", label: "Sterlina", icon: <PoundSterling size={18} /> },
	{ value: "JPY", label: "Yen", icon: <JapaneseYen size={18} /> },
];

const languages = [
	{
		value: "IT",
		label: "Italiano",
		icon: <span className="text-base">🇮🇹</span>,
	},
	{
		value: "EN",
		label: "English",
		icon: <span className="text-base">🇬🇧</span>,
	},
];

export default function PreferencePage() {
	const router = useRouter();
	const [currency, setCurrency] = useState("EUR");
	const [language, setLanguage] = useState("IT");

	return (
		<div className="shrink grow basis-0 flex flex-col lg:flex-row overflow-hidden">
			{/* ── LEFT PANEL · desktop only ── */}
			<div className="hidden lg:flex flex-col w-2/5 lg:p-10 xl:p-14 border-r border-glass-border onboarding-blur">
				<div className="flex items-center gap-2.5">
					<div className="w-9 h-9 flex items-center justify-center border border-glass-border rounded-xl bg-surface-elevated backdrop-blur-md shrink-0">
						<Sprout size={18} className="text-midori" />
					</div>
					<span className="font-semibold text-sm">Seichi</span>
				</div>

				<div className="grow" />

				<div>
					<h4 className="uppercase tracking-[2.4px] text-xs text-muted mb-3">
						Preferenze
					</h4>
					<h2 className="lg:text-5xl xl:text-6xl 2xl:text-7xl font-semibold mb-4 leading-[1.1]">
						Lingua
						<br />e valuta
					</h2>
					<p className="lg:text-sm xl:text-base text-muted leading-[1.65] max-w-xs">
						Imposta le tue preferenze di base. Potrai cambiarle in qualsiasi
						momento.
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
							Preferenze
						</h4>
						<h2 className="text-4xl font-semibold mb-3 leading-[1.1]">
							Lingua e valuta
						</h2>
						<p className="text-muted leading-[1.65]">
							Imposta le tue preferenze di base. Potrai cambiarle in qualsiasi
							momento.
						</p>
					</div>
					<Select
						title="Valuta"
						options={currencies}
						selected={currency}
						onChange={setCurrency}
					/>
					<Select
						title="Lingua"
						options={languages}
						selected={language}
						onChange={setLanguage}
					/>
					<div className="grow" />
					<div className="pb-10">
						<Button
							onClick={() => router.push("/category")}
							title="Continua"
							variant="welcome"
						/>
					</div>
				</div>

				{/* ── DESKTOP ── */}
				<div className="hidden lg:flex flex-col grow px-14">
					<div className="grow flex items-center justify-center py-8">
						<div className="w-full max-w-lg xl:bg-surface xl:border xl:border-glass-border xl:rounded-2xl xl:px-10 xl:py-10 xl:backdrop-blur-sm">
							<Select title="Valuta" options={currencies} selected={currency} onChange={setCurrency} />
							<Select title="Lingua" options={languages} selected={language} onChange={setLanguage} />
						</div>
					</div>
					<div className="w-full max-w-lg mx-auto pb-14">
						<Button onClick={() => router.push("/category")} title="Continua" variant="welcome" />
					</div>
				</div>
			</div>
		</div>
	);
}
