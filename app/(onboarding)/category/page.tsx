"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/UI/Button";
import Card from "@/components/UI/card";

const cardOptions = [
	{
		value: "entrate",
		title: "Entrate",
		subTitle: "Stipendi, rimborsi",
		color: {
			border: "border-midori",
			bg: "bg-midori/10",
			icon: "bg-midori/20",
			badge: "bg-midori",
			shadow:
				"0px 8px 28px rgba(103, 184, 154, 0.35), rgba(255,255,255,0.07) 0px 1px 0px inset",
		},
	},
	{
		value: "spese",
		title: "Spese",
		subTitle: "Acquisti quotidiani",
		color: {
			border: "border-aka",
			bg: "bg-aka/10",
			icon: "bg-aka/20",
			badge: "bg-aka",
			shadow:
				"0px 8px 28px rgba(204, 140, 116, 0.35), rgba(255,255,255,0.07) 0px 1px 0px inset",
		},
	},
	{
		value: "investimenti",
		title: "Investimenti",
		subTitle: "ETF, Azioni",
		color: {
			border: "border-ao",
			bg: "bg-ao/10",
			icon: "bg-ao/20",
			badge: "bg-ao",
			shadow:
				"0px 8px 28px rgba(123, 159, 224, 0.35), rgba(255,255,255,0.07) 0px 1px 0px inset",
		},
	},
	{
		value: "risparmi",
		title: "Risparmi",
		subTitle: "Obiettivi, fondo",
		color: {
			border: "border-kin",
			bg: "bg-kin/10",
			icon: "bg-kin/20",
			badge: "bg-kin",
			shadow:
				"0px 8px 28px rgba(212, 178, 106, 0.35), rgba(255,255,255,0.07) 0px 1px 0px inset",
		},
	},
	{
		value: "abbonamenti",
		title: "Abbonamenti",
		subTitle: "Servizi ricorrenti",
		color: {
			border: "border-muted",
			bg: "bg-foreground/8",
			icon: "bg-foreground/10",
			badge: "bg-muted",
			shadow:
				"0px 8px 28px rgba(136, 146, 166, 0.25), rgba(255,255,255,0.07) 0px 1px 0px inset",
		},
	},
];

export default function CategoryPage() {
	const [selected, setSelected] = useState<string[]>([]);
	const router = useRouter();

	return (
		<div className="shrink grow basis-0 relative flex flex-col px-7 pt-11 pb-8.5 overflow-hidden">
			<div className="mb-7.5 text-left">
				<h4 className="uppercase tracking-[2.4px] text-xs text-muted mb-3">
					Categorie
				</h4>
				<h2 className="text-2xl font-semibold mb-2.5 tracking-wide">
					Scegli le categorie
				</h2>
				<p className="text-muted leading-[1.65] m-0 max-w-70">
					Seleziona ciò che vuoi tenere in ordine. Puoi aggiungerne altre più
					tardi.
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

			<div className="relative z-10 w-full max-w-xs">
				<Button
					onClick={() => router.push("/")}
					title="Completa la configurazione"
					variant="welcome"
				/>
			</div>
		</div>
	);
}
