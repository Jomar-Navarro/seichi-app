"use client";
import { useState } from "react";
import LoginForm from "@/components/LoginForm";
import SignUpForm from "@/components/SignUpForm";
import BrandHeader from "@/components/UI/BrandHeader";

export default function Sign() {
	const [tab, setTab] = useState<"signin" | "signup">("signin");
	return (
		<div className="h-lvh relative z-1 grow shrink basis-0 flex flex-col lg:flex-row overflow-hidden">
			<div className="circle-1"></div>
			<div className="circle-3"></div>

			{/* Brand panel — desktop only */}
			<div className="hidden lg:flex flex-col items-center justify-center text-center w-2/5 border-r border-glass-border onboarding-blur">
				<BrandHeader />
				<p className="text-xl 2xl:text-2xl leading-[1.75] max-w-xs 2xl:max-w-sm mt-2">
					Prepara il terreno prima di costruire.{" "}
					<span className="text-muted">
						Metti in ordine le tue finanze — con calma e intenzione.
					</span>
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
