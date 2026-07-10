interface Props {
	currentStep: 1 | 2 | 3;
	className?: string;
}

export default function OnboardingProgress({
	currentStep,
	className = "",
}: Props) {
	return (
		<div className={`flex gap-1.5 max-w-30 mx-auto ${className}`}>
			{[1, 2, 3].map((step) => (
				<div
					key={step}
					className={`h-1.5 rounded-full flex-1 transition-all ${step === currentStep ? "bg-midori" : "bg-foreground/20"}`}
				/>
			))}
		</div>
	);
}
