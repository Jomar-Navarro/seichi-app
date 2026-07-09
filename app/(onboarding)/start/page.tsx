"use client";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Button from "@/components/UI/Button";
import BrandHeader from "@/components/UI/BrandHeader";

export default function StartPage() {
	const router = useRouter();

	return (
		<div className="shrink grow basis-0 relative flex flex-col items-center px-7 pt-12 pb-10 overflow-hidden">
			<div className="circle-1 z-0" />
			<div className="circle-3 z-0" />

			{/* Content — centered in upper area */}
			<div className="relative z-10 grow flex flex-col items-center justify-center text-center w-full max-w-xs">
				<BrandHeader />
				<p className="text-lg leading-[1.75] text-primary">
					<span>Prepara il terreno prima di costruire.</span>{" "}
					<span>Metti in ordine le tue finanze — con calma e intenzione.</span>
				</p>
			</div>

			{/* Actions — pinned to bottom */}
			<div className="relative z-10 w-full max-w-xs">
				<Button
					onClick={() => router.push("/preference")}
					title="Inizia"
					icon={<ArrowRight size={18} />}
					variant="welcome"
				/>
			</div>
		</div>
	);
}
