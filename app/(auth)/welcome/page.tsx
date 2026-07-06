"use client";
import { useRouter } from "next/navigation";
import { Sprout, ArrowRight } from "lucide-react";
import Button from "@/components/UI/Button";

export default function WelcomePage() {
	const router = useRouter();

	return (
		<div className="shrink grow basis-0 relative z-1 flex flex-col lg:flex-row pt-11 px-7 pb-8 lg:p-0 overflow-hidden">
			<div className="circle-1 z-0"></div>
			<div className="circle-3 z-0"></div>

			{/* Brand panel — left column on desktop */}
			<div className="grow lg:grow-0 flex flex-col items-center justify-center text-center lg:w-2/5 lg:border-r lg:border-glass-border lg:onboarding-blur">
				<div className="w-20 h-20 flex items-center justify-center border border-glass-border rounded-3xl bg-surface backdrop-blur-md mb-7 shadow-[0_18px_40px_rgba(0,0,0,0.18),rgba(255,255,255,0.12)_0px_1px_0px_inset]">
					<Sprout size={36} className="text-midori" />
				</div>
				<h1 className="text-5xl font-semibold mb-3.5 tracking-wide">Seichi</h1>
				<h3 className="text-xs text-muted uppercase mb-5 tracking-widest">
					整地 · ordine finanziario
				</h3>
				{/* Description — mobile/portrait only */}
				<p className="lg:hidden text-base max-w-67 text-secondary leading-[1.7]">
					Prepara il terreno prima di costruire. Metti in ordine le tue finanze
					— con calma e intenzione.
				</p>
			</div>

			{/* Right panel — actions on mobile, full content on desktop */}
			<div className="mt-8 lg:mt-0 lg:grow lg:flex lg:flex-col lg:px-22 lg:py-16">
				{/* Progress dots + heading — desktop only */}
				<div className="hidden lg:flex flex-col grow">
					<div className="grow flex flex-col justify-center">
						<h2 className="text-4xl font-semibold mb-5 leading-tight max-w-lg">
							Prepara il terreno prima di costruire.
						</h2>
						<p className="text-base text-secondary leading-[1.75] max-w-sm">
							Metti in ordine le tue finanze — con calma e intenzione.
						</p>
					</div>
				</div>

				{/* Actions */}
				<Button
					onClick={() => router.push("/sign")}
					title="Inizia"
					icon={<ArrowRight size={18} />}
					variant="welcome"
				/>
				<p className="text-center text-sm text-muted">
					Ho già un account ·{" "}
					<button
						onClick={() => router.push("/sign")}
						className="text-midori cursor-pointer font-medium"
					>
						Accedi
					</button>
				</p>
			</div>
		</div>
	);
}
