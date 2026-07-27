"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, ChevronDown } from "lucide-react";
import { updatePreferences } from "@/app/(main)/impostazioni/actions";

const CURRENCIES: Record<string, string> = {
	EUR: "EUR — Euro",
	USD: "USD — Dollaro",
	GBP: "GBP — Sterlina",
	CHF: "CHF — Franco",
	JPY: "JPY — Yen",
};

const LANGUAGES: Record<string, string> = {
	it: "Italiano",
	en: "English",
};

interface PreferencesSectionProps {
	currency: string;
	language: string;
}

export default function PreferencesSection({ currency, language }: PreferencesSectionProps) {
	const router = useRouter();
	const [cur, setCur] = useState(currency in CURRENCIES ? currency : "EUR");
	const [lang, setLang] = useState(language in LANGUAGES ? language : "it");
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
					<span className="text-[15px] font-semibold text-secondary">€</span>
				</span>
				<span className="flex-1 text-sm font-medium">Valuta</span>
				<span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
					{CURRENCIES[cur]}
					<ChevronDown size={12} />
				</span>
				<select
					value={cur}
					onChange={(e) => {
						setCur(e.target.value);
						save(e.target.value, lang);
					}}
					className="absolute inset-0 opacity-0 cursor-pointer"
					aria-label="Valuta"
				>
					{Object.entries(CURRENCIES).map(([code, label]) => (
						<option key={code} value={code}>
							{label}
						</option>
					))}
				</select>
			</label>

			{/* Lingua */}
			<label className="relative flex items-center gap-3 h-15.5 px-4 cursor-pointer">
				<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
					<Globe size={17} className="text-secondary" />
				</span>
				<span className="flex-1 text-sm font-medium">Lingua</span>
				<span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
					{LANGUAGES[lang]}
					<ChevronDown size={12} />
				</span>
				<select
					value={lang}
					onChange={(e) => {
						setLang(e.target.value);
						save(cur, e.target.value);
					}}
					className="absolute inset-0 opacity-0 cursor-pointer"
					aria-label="Lingua"
				>
					{Object.entries(LANGUAGES).map(([code, label]) => (
						<option key={code} value={code}>
							{label}
						</option>
					))}
				</select>
			</label>
		</div>
	);
}
