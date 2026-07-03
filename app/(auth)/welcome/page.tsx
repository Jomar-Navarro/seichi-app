"use client";
import { useRouter } from "next/navigation";
import { Sprout, ArrowRight } from "lucide-react";
import Button from "@/components/UI/Button";

export default function WelcomePage() {
	const router = useRouter();

	return (
		<div className="shrink grow basis-0 relative z-1 flex flex-col pt-11 px-7 pb-8">
			<div className="circle-1 z-0"></div>
			<div className="circle-3 z-0"></div>

			{/* Progress */}
			{/* <div className="flex gap-1.5 justify-center pt-2">
				<div className="h-1 w-8 rounded-full bg-midori" />
				<div className="h-1 w-8 rounded-full bg-white/15" />
				<div className="h-1 w-8 rounded-full bg-white/15" />
			</div> */}

			{/* Logo e descrizione */}
			<div className="shrink grow basis-0 flex flex-col items-center justify-center text-center">
				<div className="w-20 h-20 flex items-center justify-center border border-glass-border rounded-3xl bg-surface backdrop-blur-md mb-7 shadow-[0_18px_40px_rgba(0,0,0,0.18),rgba(255,255,255,0.12)_0px_1px_0px_inset]">
					<Sprout size={36} className="text-midori" />
				</div>
				<h1 className="text-4xl font-semibold mb-2.5 tracking-wide">Seichi</h1>
				<h3 className="text-xs text-muted uppercase mb-5 tracking-widest">
					整地 · ordine finanziario
				</h3>
				<p className="text-base max-w-67 text-secondary leading-[1.7] m-0">
					Prepara il terreno prima di costruire. Metti in ordine le tue finanze
					— con calma e intenzione.
				</p>
			</div>

			{/* Azioni */}
			<Button
				onClick={() => router.push("/signup")}
				title="Inizia"
				icon={<ArrowRight size={18} />}
				variant="welcome"
			/>
			<p className="text-center text-sm text-muted">
				Ho già un account ·{" "}
				<button
					onClick={() => router.push("/login")}
					className="text-midori cursor-pointer font-medium"
				>
					Accedi
				</button>
			</p>
		</div>
	);
}
