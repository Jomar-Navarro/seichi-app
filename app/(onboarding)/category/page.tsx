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
import type { Option } from "@/components/UI/card";

type ColorScheme = Option["color"];

const COLORS: Record<string, ColorScheme> = {
	midori:   { border: "border-midori",   bg: "bg-midori/10",   icon: "bg-midori/20",   iconText: "text-midori",   badge: "bg-midori",   shadow: "0px 8px 28px rgba(103,184,154,0.35), rgba(255,255,255,0.07) 0px 1px 0px inset" },
	aka:      { border: "border-aka",      bg: "bg-aka/10",      icon: "bg-aka/20",      iconText: "text-aka",      badge: "bg-aka",      shadow: "0px 8px 28px rgba(204,140,116,0.35), rgba(255,255,255,0.07) 0px 1px 0px inset" },
	kin:      { border: "border-kin",      bg: "bg-kin/10",      icon: "bg-kin/20",      iconText: "text-kin",      badge: "bg-kin",      shadow: "0px 8px 28px rgba(212,178,106,0.35), rgba(255,255,255,0.07) 0px 1px 0px inset" },
	ao:       { border: "border-ao",       bg: "bg-ao/10",       icon: "bg-ao/20",       iconText: "text-ao",       badge: "bg-ao",       shadow: "0px 8px 28px rgba(123,159,224,0.35), rgba(255,255,255,0.07) 0px 1px 0px inset" },
	murasaki: { border: "border-murasaki", bg: "bg-murasaki/10", icon: "bg-murasaki/20", iconText: "text-murasaki", badge: "bg-murasaki", shadow: "0px 8px 28px rgba(155,127,212,0.35), rgba(255,255,255,0.07) 0px 1px 0px inset" },
};

type Group = { label: string; colorKey: string; items: Omit<Option, "color">[] };

const TYPE_GROUPS: Group[] = [
	{
		label: "Entrate", colorKey: "midori",
		items: [
			{ value: "stipendio",  title: "Stipendio",  subTitle: "Reddito mensile",     icon: <Banknote size={18} /> },
			{ value: "freelance",  title: "Freelance",  subTitle: "Lavoro autonomo",      icon: <Briefcase size={18} /> },
			{ value: "bonus",      title: "Bonus",      subTitle: "Premi e incentivi",    icon: <Award size={18} /> },
			{ value: "regalo",     title: "Regalo",     subTitle: "Entrate inaspettate",  icon: <Gift size={18} /> },
			{ value: "rimborso",   title: "Rimborso",   subTitle: "Spese rimborsate",     icon: <ArrowDownLeft size={18} /> },
		],
	},
	{
		label: "Spese", colorKey: "aka",
		items: [
			{ value: "alimentari",    title: "Alimentari",    subTitle: "Spesa e supermercato",   icon: <ShoppingCart size={18} /> },
			{ value: "ristoranti",    title: "Ristoranti",    subTitle: "Bar e locali",           icon: <UtensilsCrossed size={18} /> },
			{ value: "trasporti",     title: "Trasporti",     subTitle: "Auto, treni, bus",       icon: <Car size={18} /> },
			{ value: "salute",        title: "Salute",        subTitle: "Visite e farmaci",       icon: <HeartPulse size={18} /> },
			{ value: "abbigliamento", title: "Abbigliamento", subTitle: "Vestiti e accessori",    icon: <Shirt size={18} /> },
			{ value: "svago",         title: "Svago",         subTitle: "Tempo libero",           icon: <Smile size={18} /> },
			{ value: "casa_spesa",    title: "Casa",          subTitle: "Arredi e manutenzione",  icon: <Home size={18} /> },
		],
	},
	{
		label: "Risparmi", colorKey: "kin",
		items: [
			{ value: "fondo_emergenza", title: "Fondo emergenza", subTitle: "Cuscinetto di sicurezza", icon: <Shield size={18} /> },
			{ value: "vacanze",         title: "Vacanze",         subTitle: "Viaggi e soggiorni",      icon: <Plane size={18} /> },
			{ value: "obiettivo_casa",  title: "Obiettivo casa",  subTitle: "Acquisto o affitto",      icon: <Building2 size={18} /> },
			{ value: "elettronica",     title: "Elettronica",     subTitle: "Gadget e dispositivi",    icon: <Laptop size={18} /> },
		],
	},
	{
		label: "Investimenti", colorKey: "ao",
		items: [
			{ value: "etf",    title: "ETF",    subTitle: "Fondi indicizzati",  icon: <BarChart2 size={18} /> },
			{ value: "azioni", title: "Azioni", subTitle: "Mercati azionari",   icon: <TrendingUp size={18} /> },
			{ value: "crypto", title: "Crypto", subTitle: "Asset digitali",     icon: <Bitcoin size={18} /> },
			{ value: "fondi",  title: "Fondi",  subTitle: "Gestione attiva",    icon: <PiggyBank size={18} /> },
		],
	},
	{
		label: "Abbonamenti", colorKey: "murasaki",
		items: [
			{ value: "streaming", title: "Streaming", subTitle: "Video on demand",  icon: <Play size={18} /> },
			{ value: "musica",    title: "Musica",    subTitle: "Piattaforme audio", icon: <Music size={18} /> },
			{ value: "palestra",  title: "Palestra",  subTitle: "Fitness e sport",  icon: <Dumbbell size={18} /> },
			{ value: "utenze",    title: "Utenze",    subTitle: "Luce, gas, internet", icon: <Zap size={18} /> },
			{ value: "affitto",   title: "Affitto",   subTitle: "Casa e spazi",     icon: <KeyRound size={18} /> },
		],
	},
];

function CategoryGroups({ selected, onChange }: { selected: string[]; onChange: (v: string) => void }) {
	return (
		<div className="space-y-6">
			{TYPE_GROUPS.map((group) => {
				const color = COLORS[group.colorKey];
				const options: Option[] = group.items.map((item) => ({ ...item, color }));
				return (
					<div key={group.label}>
						<p className="text-xs uppercase tracking-[1.8px] text-muted mb-2.5 ms-1">
							{group.label}
						</p>
						<Card options={options} selected={selected} onChange={onChange} />
					</div>
				);
			})}
		</div>
	);
}

export default function CategoryPage() {
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
			setError(result.error ?? "Errore sconosciuto");
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
					<div className="w-9 h-9 flex items-center justify-center border border-subtle rounded-xl bg-surface-elevated backdrop-blur-md shrink-0">
						<Sprout size={18} className="text-midori" />
					</div>
					<span className="font-semibold text-sm">Seichi</span>
				</div>

				<div className="grow" />

				<div>
					<h4 className="uppercase tracking-[2.4px] text-xs text-muted mb-3">
						Categorie
					</h4>
					<h2 className="lg:text-5xl xl:text-6xl 2xl:text-7xl font-semibold mb-4 leading-[1.1]">
						Scegli le
						<br />categorie
					</h2>
					<p className="lg:text-sm xl:text-base text-muted leading-[1.65] max-w-xs">
						Seleziona ciò che vuoi tenere in ordine. Puoi aggiungerne altre più
						tardi.
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
							Categorie
						</h4>
						<h2 className="text-4xl font-semibold mb-3 leading-[1.1]">
							Scegli le categorie
						</h2>
						<p className="text-muted leading-[1.65]">
							Seleziona ciò che vuoi tenere in ordine. Puoi aggiungerne altre
							più tardi.
						</p>
					</div>
					<CategoryGroups selected={selected} onChange={toggle} />
					<div className="grow" />
					{error && <p className="text-aka text-sm text-center mb-3">{error}</p>}
					<div className="pb-10 pt-6">
						<Button onClick={handleComplete} disabled={isLoading} title={isLoading ? "Salvataggio…" : "Completa la configurazione"} variant="welcome" />
					</div>
				</div>

				{/* ── DESKTOP ── */}
				<div className="hidden lg:flex flex-col grow px-14">
					<div className="grow flex items-center justify-center py-8">
						<div className="w-full max-w-lg xl:bg-surface xl:border xl:border-subtle xl:rounded-2xl xl:px-10 xl:py-10 xl:backdrop-blur-sm">
							<CategoryGroups selected={selected} onChange={toggle} />
						</div>
					</div>
					{error && <p className="text-aka text-sm text-center w-full max-w-lg mx-auto mb-3">{error}</p>}
					<div className="w-full max-w-lg mx-auto pb-14">
						<Button onClick={handleComplete} disabled={isLoading} title={isLoading ? "Salvataggio…" : "Completa la configurazione"} variant="welcome" />
					</div>
				</div>
			</div>
		</div>
	);
}
