"use client";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Button from "@/components/UI/Button";
import BrandHeader from "@/components/UI/BrandHeader";
import OnboardingProgress from "@/components/UI/OnboardingProgress";

export default function StartPage() {
	const router = useRouter();

	return (
		<div className="shrink grow basis-0 flex flex-col lg:flex-row overflow-hidden">
			{/* ── LEFT PANEL · desktop only ── */}
			<div className="hidden lg:flex flex-col items-center justify-center text-center w-2/5 border-r border-glass-border onboarding-blur relative overflow-hidden">
				<div className="circle-1 z-0" />
				<div className="circle-3 z-0" />
				<div className="relative z-10 flex flex-col items-center">
					<BrandHeader />
					<p className="text-xl leading-[1.75] max-w-xs mt-4">
						Prepara il terreno prima di costruire.{" "}
						<span className="text-muted">
							Metti in ordine le tue finanze — con calma e intenzione.
						</span>
					</p>
				</div>
			</div>

			{/* ── RIGHT PANEL ── */}
			<div className="relative grow flex flex-col overflow-hidden lg:w-3/5">
				{/* Decorative circles — mobile only */}
				<div className="circle-1 z-0 lg:hidden" />
				<div className="circle-3 z-0 lg:hidden" />

				{/* Progress bar — always at top, true-centered */}
				<div className="relative z-10 pt-8 lg:pt-10">
					<OnboardingProgress currentStep={1} />
				</div>

				{/* ── MOBILE: brand + description (centered) ── */}
				<div className="lg:hidden relative z-10 grow flex flex-col items-center justify-center text-center px-7">
					<BrandHeader />
					<p className="text-base leading-[1.75] text-muted mt-5 max-w-70">
						Prepara il terreno prima di costruire. Metti in ordine le tue
						finanze — con calma e intenzione.
					</p>
				</div>

				{/* ── DESKTOP: heading + description + button (vertically centered) ── */}
				<div className="hidden lg:flex flex-col justify-center grow px-20 2xl:px-72 pb-14">
					<h4 className="uppercase tracking-[2.4px] text-xs text-muted mb-4">
						Benvenuto
					</h4>
					<h1 className="text-6xl xl:text-7xl font-semibold leading-[1.1] mb-6">
						Iniziamo con calma.
					</h1>
					<p className="text-xl text-muted leading-[1.75] max-w-sm mb-10">
						Tre passi brevi per preparare il tuo spazio finanziario. Nessuna
						fretta — puoi cambiare tutto più tardi.
					</p>
					<div className="max-w-sm">
						<Button
							onClick={() => router.push("/preference")}
							title="Inizia"
							icon={<ArrowRight size={18} />}
							variant="welcome"
						/>
					</div>
				</div>

				{/* ── MOBILE: button + Accedi (pinned bottom) ── */}
				<div className="lg:hidden relative z-10 w-full px-7 pb-10">
					<Button
						onClick={() => router.push("/preference")}
						title="Inizia"
						icon={<ArrowRight size={18} />}
						variant="welcome"
					/>
				</div>
			</div>
		</div>
	);
}
