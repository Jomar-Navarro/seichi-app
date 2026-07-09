"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Euro, DollarSign, PoundSterling, JapaneseYen } from "lucide-react";
import Button from "@/components/UI/Button";
import Select from "@/components/UI/Select";

const currencies = [
	{ value: "EUR", label: "Euro", icon: <Euro size={18} /> },
	{ value: "USD", label: "Dollaro", icon: <DollarSign size={18} /> },
	{ value: "GBP", label: "Sterlina", icon: <PoundSterling size={18} /> },
	{ value: "JPY", label: "Yen", icon: <JapaneseYen size={18} /> },
];

const languages = [
	{ value: "IT", label: "Italiano", icon: <span className="text-base">🇮🇹</span> },
	{ value: "EN", label: "English", icon: <span className="text-base">🇬🇧</span> },
];

export default function PreferencePage() {
	const router = useRouter();
	const [currency, setCurrency] = useState("EUR");
	const [language, setLanguage] = useState("IT");

	return (
		<div className="shrink grow basis-0 relative flex flex-col px-7 pt-11 pb-8.5 overflow-hidden">
			<div className="mb-7.5 text-left">
				<h4 className="uppercase tracking-[2.4px] text-xs text-muted mb-3">
					Preferenze
				</h4>
				<h2 className="text-2xl font-semibold mb-2.5 tracking-wide">
					Lingua e valuta
				</h2>
				<p className="text-muted leading-[1.65] m-0 max-w-70">
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

			<div className="relative z-10 w-full max-w-xs">
				<Button
					onClick={() => router.push("/categories")}
					title="Continua"
					variant="welcome"
				/>
			</div>
		</div>
	);
}
