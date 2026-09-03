"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCategories } from "@/app/(onboarding)/actions";
import {
	Sprout,
	Banknote, Briefcase, Award, Gift, ArrowDownLeft,
	ShoppingCart, UtensilsCrossed, Car, HeartPulse, Shirt, Smile, Home,
	Shield, Plane, Building2, Laptop,
	BarChart2, TrendingUp, Bitcoin, PiggyBank,
	Play, Music, Dumbbell, Zap, KeyRound,
} from "lucide-react";
import Button from "@/components/UI/Button";
import Card from "@/components/UI/card";
import OnboardingProgress from "@/components/UI/OnboardingProgress";
import { useI18n } from "@/components/features/I18nProvider";
import type { Option } from "@/components/UI/card";
import type { Dictionary } from "@/lib/i18n/dictionaries/it";

type ColorScheme = Option["color"];

/** Le chiavi del catalogo dei preset — le stesse di CATEGORY_MAP nella action. */
type PresetKey = keyof Dictionary["presetCategories"];
/** I cinque gruppi del picker. */
type GroupType = keyof Dictionary["onboarding"]["category"]["groups"];

/**
 * L'alone della card selezionata era cablato sui valori SCURI degli accenti
 * (es. 103,165,154 = midori del tema scuro): in chiaro il bagliore aveva una
 * tinta diversa dal bordo e dal testo della stessa card. Derivandolo dal token
 * segue il tema da sé.
 */
const glow = (accent: string) =>
	`0px 8px 28px color-mix(in srgb, var(--color-${accent}) 35%, transparent), var(--shadow-inset) 0px 1px 0px inset`;

const COLORS: Record<string, ColorScheme> = {
	midori:   { border: "border-midori",   bg: "bg-midori/10",   icon: "bg-midori/20",   iconText: "text-midori",   badge: "bg-midori",   shadow: glow("midori") },
	aka:      { border: "border-aka",      bg: "bg-aka/10",      icon: "bg-aka/20",      iconText: "text-aka",      badge: "bg-aka",      shadow: glow("aka") },
	kin:      { border: "border-kin",      bg: "bg-kin/10",      icon: "bg-kin/20",      iconText: "text-kin",      badge: "bg-kin",      shadow: glow("kin") },
	ao:       { border: "border-ao",       bg: "bg-ao/10",       icon: "bg-ao/20",       iconText: "text-ao",       badge: "bg-ao",       shadow: glow("ao") },
	murasaki: { border: "border-murasaki", bg: "bg-murasaki/10", icon: "bg-murasaki/20", iconText: "text-murasaki", badge: "bg-murasaki", shadow: glow("murasaki") },
};

/**
 * Struttura del picker: gruppo, colore, chiavi e icone.
 *
 * ⚠️ Nessun testo (Fase 19). Titolo e sottotitolo di ogni voce vengono da
 * `t.presetCategories[chiave]`, che è lo STESSO catalogo da cui `saveCategories()`
 * prende il nome da scrivere nel database: se stessero in due posti, la card
 * potrebbe dire "Groceries" e la categoria creata chiamarsi "Alimentari".
 */
type Group = {
	type: GroupType;
	colorKey: string;
	items: { value: PresetKey; icon: React.ReactNode }[];
};

const TYPE_GROUPS: Group[] = [
	{
		type: "entrata", colorKey: "midori",
		items: [
			{ value: "stipendio", icon: <Banknote size={18} /> },
			{ value: "freelance", icon: <Briefcase size={18} /> },
			{ value: "bonus",     icon: <Award size={18} /> },
			{ value: "regalo",    icon: <Gift size={18} /> },
			{ value: "rimborso",  icon: <ArrowDownLeft size={18} /> },
		],
	},
	{
		type: "spesa", colorKey: "aka",
		items: [
			{ value: "alimentari",    icon: <ShoppingCart size={18} /> },
			{ value: "ristoranti",    icon: <UtensilsCrossed size={18} /> },
			{ value: "trasporti",     icon: <Car size={18} /> },
			{ value: "salute",        icon: <HeartPulse size={18} /> },
			{ value: "abbigliamento", icon: <Shirt size={18} /> },
			{ value: "svago",         icon: <Smile size={18} /> },
			{ value: "casa_spesa",    icon: <Home size={18} /> },
		],
	},
	{
		type: "risparmio", colorKey: "kin",
		items: [
			{ value: "fondo_emergenza", icon: <Shield size={18} /> },
			{ value: "vacanze",         icon: <Plane size={18} /> },
			{ value: "obiettivo_casa",  icon: <Building2 size={18} /> },
			{ value: "elettronica",     icon: <Laptop size={18} /> },
		],
	},
	{
		type: "investimento", colorKey: "ao",
		items: [
			{ value: "etf",    icon: <BarChart2 size={18} /> },
			{ value: "azioni", icon: <TrendingUp size={18} /> },
			{ value: "crypto", icon: <Bitcoin size={18} /> },
			{ value: "fondi",  icon: <PiggyBank size={18} /> },
		],
	},
	{
		type: "abbonamento", colorKey: "murasaki",
		items: [
			{ value: "streaming", icon: <Play size={18} /> },
			{ value: "musica",    icon: <Music size={18} /> },
			{ value: "palestra",  icon: <Dumbbell size={18} /> },
			{ value: "utenze",    icon: <Zap size={18} /> },
			{ value: "affitto",   icon: <KeyRound size={18} /> },
		],
	},
];

function CategoryGroups({ selected, onChange }: { selected: string[]; onChange: (v: string) => void }) {
	const { t } = useI18n();

	return (
		<div className="space-y-6">
			{TYPE_GROUPS.map((group) => {
				const color = COLORS[group.colorKey];
				const options: Option[] = group.items.map((item) => ({
					value: item.value,
					title: t.presetCategories[item.value].title,
					subTitle: t.presetCategories[item.value].subtitle,
					icon: item.icon,
					color,
				}));
				return (
					<div key={group.type}>
						<p className="text-xs uppercase tracking-[1.8px] text-muted mb-2.5 ms-1">
							{t.onboarding.category.groups[group.type]}
						</p>
						<Card options={options} selected={selected} onChange={onChange} />
					</div>
				);
			})}
		</div>
	);
}

export default function CategoryPage() {
	const { t } = useI18n();
	const [selected, setSelected] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

	const toggle = (value: string) =>
		setSelected((prev) =>
			prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
		);

	const handleComplete = async () => {
		setIsLoading(true);
		setError(null);
		const result = await saveCategories(selected);
		if ("error" in result) {
			setError(result.error ?? t.common.unknownError);
			setIsLoading(false);
			return;
		}
		router.push("/");
	};

	return (
		<div className="shrink grow basis-0 flex flex-col lg:flex-row overflow-hidden">

			{/* ── LEFT PANEL · desktop only ── */}
			<div className="hidden lg:flex flex-col w-2/5 lg:p-10 xl:p-14 border-r border-subtle onboarding-blur">
				<div className="flex items-center gap-2.5">
					{/* ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto. */}
					<div className="relative w-9 h-9 rounded-xl ring-border overflow-hidden shrink-0">
						<div className="absolute inset-0 bg-surface-elevated backdrop-blur-md" />
						<div className="relative w-full h-full flex items-center justify-center">
							<Sprout size={18} className="text-midori" />
						</div>
					</div>
					<span className="font-semibold text-sm">Seichi</span>
				</div>

				<div className="grow" />

				<div>
					<h4 className="uppercase tracking-[2.4px] text-xs text-muted mb-3">
						{t.onboarding.category.eyebrow}
					</h4>
					<h2 className="lg:text-5xl xl:text-6xl 2xl:text-7xl font-semibold mb-4 leading-[1.1]">
						{t.onboarding.category.headingLine1}
						<br />{t.onboarding.category.headingLine2}
					</h2>
					<p className="lg:text-sm xl:text-base text-muted leading-[1.65] max-w-xs">
						{t.onboarding.category.description}
					</p>
				</div>
			</div>

			{/* ── RIGHT PANEL ── */}
			<div className="grow lg:grow-0 lg:w-3/5 flex flex-col overflow-auto">

				<div className="relative z-10 pt-8 lg:pt-10">
					<OnboardingProgress currentStep={3} />
				</div>

				{/* ── MOBILE ── */}
				<div className="lg:hidden flex flex-col grow w-full max-w-md mx-auto px-6">
					<div className="mt-8 mb-6">
						<h4 className="uppercase tracking-[2.4px] text-xs text-muted mb-3">
							{t.onboarding.category.eyebrow}
						</h4>
						<h2 className="text-4xl font-semibold mb-3 leading-[1.1]">
							{t.onboarding.category.heading}
						</h2>
						<p className="text-muted leading-[1.65]">
							{t.onboarding.category.description}
						</p>
					</div>
					<CategoryGroups selected={selected} onChange={toggle} />
					<div className="grow" />
					{error && <p className="text-aka-ink text-sm text-center mb-3">{error}</p>}
					<div className="pb-10 pt-6">
						<Button onClick={handleComplete} disabled={isLoading} title={isLoading ? t.common.saving : t.onboarding.category.cta} variant="welcome" />
					</div>
				</div>

				{/* ── DESKTOP ── */}
				<div className="hidden lg:flex flex-col grow px-14">
					<div className="grow flex items-center justify-center py-8">
						{/* ⚠️ TRE livelli, solo `xl:` conta — issue #81. Vedi la nota in LoginForm. */}
						<div className="relative w-full max-w-lg xl:rounded-2xl xl:overflow-hidden xl:ring-border">
							<div className="absolute inset-0 xl:bg-surface xl:backdrop-blur-sm" />
							<div className="relative xl:px-10 xl:py-10">
								<CategoryGroups selected={selected} onChange={toggle} />
							</div>
						</div>
					</div>
					{error && <p className="text-aka-ink text-sm text-center w-full max-w-lg mx-auto mb-3">{error}</p>}
					<div className="w-full max-w-lg mx-auto pb-14">
						<Button onClick={handleComplete} disabled={isLoading} title={isLoading ? t.common.saving : t.onboarding.category.cta} variant="welcome" />
					</div>
				</div>
			</div>
		</div>
	);
}
