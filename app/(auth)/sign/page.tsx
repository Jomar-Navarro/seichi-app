"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import SignUpForm from "@/components/SignUpForm";
import BrandHeader from "@/components/UI/BrandHeader";
import { useI18n } from "@/components/features/I18nProvider";

export default function Sign() {
	const router = useRouter();
	const { t } = useI18n();
	const [tab, setTab] = useState<"signin" | "signup">("signin");
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const wantsSignup = params.get("tab") === "signup";
		// Impostato da resetPassword() dopo un recupero andato a buon fine
		const passwordReset = params.get("reset") === "1";

		// Le setState in effect sono volute: i query param esistono solo a runtime
		// sul client e vengono subito ripuliti dall'URL. Basta un disable: la regola
		// segnala una volta per effetto, non per singola chiamata.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (wantsSignup) setTab("signup");
		if (passwordReset) setNotice(t.auth.signIn.passwordReset);
		if (wantsSignup || passwordReset) router.replace("/sign");
		// `t` fra le dipendenze perché l'effetto ne legge una stringa. È stabile
		// (memoizzato in I18nProvider), quindi non fa rigirare nulla.
	}, [router, t]);

	return (
		<div className="h-lvh relative z-1 grow shrink basis-0 flex flex-col lg:flex-row overflow-hidden">
			<div className="circle-1"></div>
			<div className="circle-3"></div>

			{/* Brand panel — desktop only */}
			<div className="hidden lg:flex flex-col items-center justify-center text-center w-2/5 border-r border-subtle onboarding-blur">
				<BrandHeader />
				<p className="text-xl 2xl:text-2xl leading-[1.75] max-w-xs 2xl:max-w-sm mt-2">
					{t.auth.welcome.lead}{" "}
					<span className="text-muted">{t.auth.welcome.leadMuted}</span>
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
