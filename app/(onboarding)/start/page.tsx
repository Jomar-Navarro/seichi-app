"use client";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Button from "@/components/UI/Button";
import BrandHeader from "@/components/UI/BrandHeader";
import OnboardingProgress from "@/components/UI/OnboardingProgress";
import { useI18n } from "@/components/features/I18nProvider";

export default function StartPage() {
	const router = useRouter();
	const { t } = useI18n();

	return (
		<div className="shrink grow basis-0 flex flex-col lg:flex-row overflow-hidden">
			{/* ── LEFT PANEL · desktop only ── */}
			<div className="hidden lg:flex flex-col items-center justify-center text-center w-2/5 border-r border-subtle onboarding-blur relative overflow-hidden">
				<div className="circle-1 z-0" />
				<div className="circle-3 z-0" />
				<div className="relative z-10 flex flex-col items-center">
					<BrandHeader />
					<p className="text-xl leading-[1.75] max-w-xs mt-4">
						{t.onboarding.start.lead}{" "}
						<span className="text-muted">{t.onboarding.start.leadMuted}</span>
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
						{t.onboarding.start.lead} {t.onboarding.start.leadMuted}
					</p>
				</div>

				{/* ── DESKTOP: heading + description + button (vertically centered) ── */}
				<div className="hidden lg:flex flex-col justify-center grow px-20 2xl:px-72 pb-14">
					<h4 className="uppercase tracking-[2.4px] text-xs text-muted mb-4">
						{t.onboarding.start.eyebrow}
					</h4>
					<h1 className="text-6xl xl:text-7xl font-semibold leading-[1.1] mb-6">
						{t.onboarding.start.heading}
					</h1>
					<p className="text-xl text-muted leading-[1.75] max-w-sm mb-10">
						{t.onboarding.start.description}
					</p>
					<div className="max-w-sm">
						<Button
							onClick={() => router.push("/preference")}
							title={t.onboarding.start.cta}
							icon={<ArrowRight size={18} />}
							variant="welcome"
						/>
					</div>
				</div>

				{/* ── MOBILE: button + Accedi (pinned bottom) ── */}
				<div className="lg:hidden relative z-10 w-full px-7 pb-10">
					<Button
						onClick={() => router.push("/preference")}
						title={t.onboarding.start.cta}
						icon={<ArrowRight size={18} />}
						variant="welcome"
					/>
				</div>
			</div>
		</div>
	);
}
