"use client";
import { useState } from "react";
import LoginForm from "@/components/LoginForm";
import SignUpForm from "@/components/SignUpForm";
import BrandHeader from "@/components/UI/BrandHeader";

const tabDescriptions = {
	signin: "Bentornato. Riprendi da dove avevi lasciato — con calma.",
	signup: "Prepara il terreno prima di costruire. Bastano pochi passi.",
};

export default function Sign() {
	const [tab, setTab] = useState<"signin" | "signup">("signin");
	return (
		<div className="h-lvh relative z-1 grow shrink basis-0 flex flex-col lg:flex-row overflow-hidden">
			<div className="circle-1"></div>
			<div className="circle-3"></div>

			{/* Brand panel — desktop only */}
			<div className="hidden lg:flex flex-col items-center justify-center text-center w-2/5 border-r border-glass-border onboarding-blur">
				<BrandHeader />
				<p className="text-base text-secondary leading-[1.7] max-w-52 mt-1">
					{tabDescriptions[tab]}
				</p>
			</div>

			{/* Form panel */}
			<div className="grow lg:grow-0 lg:w-3/5 flex flex-col overflow-hidden">
				{tab === "signup" ? (
					<SignUpForm onTabChange={setTab} />
				) : (
					<LoginForm onTabChange={setTab} />
				)}
			</div>
		</div>
	);
}
