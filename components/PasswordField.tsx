"use client";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface PasswordFieldProps {
	id: string;
	name: string;
	placeholder: string;
	onChange?: (value: string) => void;
	value?: string;
}

export default function PasswordField({
	id,
	name,
	placeholder,
	onChange,
	value,
}: PasswordFieldProps) {
	const [isView, setIsView] = useState(false);

	return (
		<div className="flex items-center gap-3 px-4 rounded-2xl bg-input border border-subtle segment-tab mb-1 text-muted">
			<Lock size={18} className="shrink-0 text-shadow-foreground" />
			<input
				id={id}
				name={name}
				type={isView ? "text" : "password"}
				placeholder={placeholder}
				onChange={(e) => onChange?.(e.target.value)}
				value={value}
				required
				className="grow shrink basis-0 bg-transparent outline-none text-foreground text-sm py-4"
			/>
			<button
				type="button"
				onClick={() => setIsView(!isView)}
				className="bg-transparent cursor-pointer p-1 flex items-center"
			>
				{isView ? (
					<Eye size={18} className="shrink-0 text-shadow-foreground" />
				) : (
					<EyeOff size={18} className="shrink-0 text-shadow-foreground" />
				)}
			</button>
		</div>
	);
}
