"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import SignUpForm from "@/components/SignUpForm";
import BrandHeader from "@/components/UI/BrandHeader";

export default function Sign() {
	const router = useRouter();
	const [tab, setTab] = useState<"signin" | "signup">("signin");
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const wantsSignup = params.get("tab") === "signup";
		// Impostato da resetPassword() dopo un recupero andato a buon fine
		const passwordReset = params.get("reset") === "1";

		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (wantsSignup) setTab("signup");
		if (passwordReset) setNotice("Password aggiornata — accedi con quella nuova");
		if (wantsSignup || passwordReset) router.replace("/sign");
	}, [router]);

	return (
		<div className="h-lvh relative z-1 grow shrink basis-0 flex flex-col lg:flex-row overflow-hidden">
			<div className="circle-1"></div>
			<div className="circle-3"></div>

			{/* Brand panel — desktop only */}
			<div className="hidden lg:flex flex-col items-center justify-center text-center w-2/5 border-r border-subtle onboarding-blur">
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
					<LoginForm onTabChange={setTab} notice={notice} />
				)}
			</div>
		</div>
	);
}
