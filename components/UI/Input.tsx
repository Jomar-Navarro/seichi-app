interface InputProps {
	id: string;
	name: string;
	type: string;
	placeholder: string;
	icon?: React.ReactNode;
	value?: string;
	onChange?: (value: string) => void;
}

export default function Input({
	id,
	name,
	type,
	placeholder,
	icon,
	value,
	onChange,
}: InputProps) {
	return (
		<div className="flex items-center gap-3 px-4 rounded-2xl bg-input segment-tab mb-1 text-muted">
			{icon}
			<input
				id={id}
				name={name}
				type={type}
				required
				value={value}
				placeholder={placeholder}
				onChange={(e) => onChange?.(e.target.value)}
				// issue #69 — text-base: sotto i 16px iOS zooma da solo al focus.
				className="grow shrink basis-0 bg-transparent outline-none text-foreground text-base py-4"
			/>
		</div>
	);
}
