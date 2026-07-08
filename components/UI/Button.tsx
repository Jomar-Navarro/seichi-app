interface ButtonProps {
	title: string;
	icon?: React.ReactNode;
	variant?: "primary" | "oauth" | "welcome";
	onClick?: () => void;
}

export default function Button({ title, icon, variant, onClick }: ButtonProps) {
	if (variant === "oauth") {
		return (
			<button
				onClick={onClick}
				className="grow shrink basis-0 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl cursor-pointer text-xs segment-tab font-medium text-foreground"
			>
				{icon}
				<span>{title}</span>
			</button>
		);
	} else if (variant === "welcome") {
		return (
			<button
				onClick={onClick}
				className="w-full flex items-center justify-center gap-2.5 py-5 rounded-3xl text-base font-semibold cursor-pointer bg-surface-elevated deep-shadow mb-4 hover:-translate-y-0.5"
			>
				<span>{title}</span>
				{icon}
			</button>
		);
	} else {
		return (
			<button onClick={onClick} className="w-full flex items-center justify-center gap-2.5 py-5 rounded-3xl text-base font-semibold cursor-pointer bg-surface-elevated deep-shadow mb-4 hover:-translate-y-0.5">
				{title}
			</button>
		);
	}
}
