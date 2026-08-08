"use client";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Button from "@/components/UI/Button";
import BrandHeader from "@/components/UI/BrandHeader";
import { useI18n } from "@/components/features/I18nProvider";

export default function WelcomePage() {
	const router = useRouter();
	const { t } = useI18n();

	return (
		<div className="shrink grow basis-0 relative flex flex-col items-center px-7 pt-12 pb-10 overflow-hidden">
			<div className="circle-1 z-0" />
			<div className="circle-3 z-0" />

			{/* Content — centered in upper area */}
			<div className="relative z-10 grow flex flex-col items-center justify-center text-center w-full max-w-xs">
				<BrandHeader />
				<p className="text-lg leading-[1.75]">
					<strong>{t.auth.welcome.lead}</strong>{" "}
					<span className="text-muted">{t.auth.welcome.leadMuted}</span>
				</p>
			</div>

			{/* Actions — pinned to bottom */}
			<div className="relative z-10 w-full max-w-xs">
				<Button
					onClick={() => router.push("/sign?tab=signup")}
					title={t.auth.welcome.createAccount}
					icon={<ArrowRight size={18} />}
					variant="welcome"
				/>
				<p className="text-center text-sm text-muted">
					{t.auth.welcome.haveAccount}{" "}
					<button
						onClick={() => router.push("/sign")}
						className="text-midori-ink cursor-pointer font-medium"
					>
						{t.auth.welcome.signIn}
					</button>
				</p>
			</div>
		</div>
	);
}
