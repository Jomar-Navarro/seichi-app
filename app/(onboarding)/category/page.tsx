"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCategories } from "@/app/(onboarding)/actions";
import { Sprout, Download, Share, TrendingUp, JapaneseYen, RefreshCw } from "lucide-react";
import Button from "@/components/UI/Button";
import Card from "@/components/UI/card";
import OnboardingProgress from "@/components/UI/OnboardingProgress";

const cardOptions = [
	{
		value: "entrate",
		title: "Entrate",
		subTitle: "Stipendi, rimborsi",
		icon: <Download size={20} />,
		color: {
			border: "border-midori",
			bg: "bg-midori/10",
			icon: "bg-midori/20",
			iconText: "text-midori",
			badge: "bg-midori",
			shadow: "0px 8px 28px rgba(103, 184, 154, 0.35), rgba(255,255,255,0.07) 0px 1px 0px inset",
		},
	},
	{
		value: "spese",
		title: "Spese",
		subTitle: "Acquisti quotidiani",
		icon: <Share size={20} />,
		color: {
			border: "border-aka",
			bg: "bg-aka/10",
			icon: "bg-aka/20",
			iconText: "text-aka",
			badge: "bg-aka",
			shadow: "0px 8px 28px rgba(204, 140, 116, 0.35), rgba(255,255,255,0.07) 0px 1px 0px inset",
		},
	},
	{
		value: "investimenti",
		title: "Investimenti",
		subTitle: "ETF, Azioni",
		icon: <TrendingUp size={20} />,
		color: {
			border: "border-ao",
			bg: "bg-ao/10",
			icon: "bg-ao/20",
			iconText: "text-ao",
			badge: "bg-ao",
			shadow: "0px 8px 28px rgba(123, 159, 224, 0.35), rgba(255,255,255,0.07) 0px 1px 0px inset",
		},
	},
	{
		value: "risparmi",
		title: "Risparmi",
		subTitle: "Obiettivi, fondo",
		icon: <JapaneseYen size={20} />,
		color: {
			border: "border-kin",
			bg: "bg-kin/10",
			icon: "bg-kin/20",
			iconText: "text-kin",
			badge: "bg-kin",
			shadow: "0px 8px 28px rgba(212, 178, 106, 0.35), rgba(255,255,255,0.07) 0px 1px 0px inset",
		},
	},
	{
		value: "abbonamenti",
		title: "Abbonamenti",
		subTitle: "Servizi ricorrenti",
		icon: <RefreshCw size={20} />,
		color: {
			border: "border-muted",
			bg: "bg-foreground/8",
			icon: "bg-foreground/10",
			iconText: "text-muted",
			badge: "bg-muted",
			shadow: "0px 8px 28px rgba(136, 146, 166, 0.25), rgba(255,255,255,0.07) 0px 1px 0px inset",
		},
	},
];

export default function CategoryPage() {
	const [selected, setSelected] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

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

				{/* Progress bar — true-centered at top */}
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
					<Card
						options={cardOptions}
						selected={selected}
						onChange={(value) =>
							setSelected((prev) =>
								prev.includes(value)
									? prev.filter((v) => v !== value)
									: [...prev, value],
							)
						}
					/>
					<div className="grow" />
					{error && <p className="text-aka text-sm text-center mb-3">{error}</p>}
					<div className="pb-10">
						<Button onClick={handleComplete} disabled={isLoading} title={isLoading ? "Salvataggio…" : "Completa la configurazione"} variant="welcome" />
					</div>
				</div>

				{/* ── DESKTOP ── */}
				<div className="hidden lg:flex flex-col grow px-14">
					<div className="grow flex items-center justify-center py-8">
						<div className="w-full max-w-lg xl:bg-surface xl:border xl:border-subtle xl:rounded-2xl xl:px-10 xl:py-10 xl:backdrop-blur-sm">
							<Card
								options={cardOptions}
								selected={selected}
								onChange={(value) =>
									setSelected((prev) =>
										prev.includes(value)
											? prev.filter((v) => v !== value)
											: [...prev, value],
									)
								}
							/>
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
