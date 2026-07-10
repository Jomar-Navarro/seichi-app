interface ButtonProps {
	title: string;
	icon?: React.ReactNode;
	variant?: "primary" | "oauth" | "welcome";
	onClick?: () => void;
	disabled?: boolean;
}

export default function Button({ title, icon, variant, onClick, disabled }: ButtonProps) {
	if (variant === "oauth") {
		return (
			<button
				onClick={onClick}
				disabled={disabled}
				className="grow shrink basis-0 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl cursor-pointer text-xs segment-tab font-medium text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{icon}
				<span>{title}</span>
			</button>
		);
	} else if (variant === "welcome") {
		return (
			<button
				onClick={onClick}
				disabled={disabled}
				className="w-full flex items-center justify-center gap-2.5 py-5 rounded-3xl text-base font-semibold bg-surface-elevated deep-shadow mb-4 disabled:opacity-50 disabled:cursor-not-allowed enabled:cursor-pointer enabled:hover:-translate-y-0.5"
			>
				<span>{title}</span>
				{icon}
			</button>
		);
	} else {
		return (
			<button
				onClick={onClick}
				disabled={disabled}
				className="w-full flex items-center justify-center gap-2.5 py-5 rounded-3xl text-base font-semibold bg-surface-elevated deep-shadow mb-4 disabled:opacity-50 disabled:cursor-not-allowed enabled:cursor-pointer enabled:hover:-translate-y-0.5"
			>
				{title}
			</button>
		);
	}
}
