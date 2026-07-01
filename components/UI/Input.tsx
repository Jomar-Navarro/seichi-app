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
		<div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
			{icon}
			<input
				id={id}
				name={name}
				type={type}
				required
				value={value}
				placeholder={placeholder}
				onChange={(e) => onChange?.(e.target.value)}
				className="bg-transparent outline-none text-gray-400 px-4 w-full"
			/>
		</div>
	);
}
