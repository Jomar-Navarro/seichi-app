"use client";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface PasswordFieldProps {
	id: string;
	name: string;
	placeholder: string;
	onChange?: (value: string) => void;
}

export default function PasswordField({ id, name, placeholder, onChange }: PasswordFieldProps) {
	const [isView, setIsView] = useState(false);

	return (
		<div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
			<Lock size={18} className="shrink-0 text-gray-500" />
			<input
				id={id}
				name={name}
				type={isView ? "text" : "password"}
				placeholder={placeholder}
				onChange={(e) => onChange?.(e.target.value)}
				required
				className="bg-transparent outline-none text-gray-400 px-4 w-full"
			/>
			<button
				type="button"
				onClick={() => setIsView(!isView)}
				className="bg-transparent cursor-pointer p-1 flex items-center"
			>
				{isView ? (
					<Eye size={18} className="shrink-0 text-gray-500" />
				) : (
					<EyeOff size={18} className="shrink-0 text-gray-500" />
				)}
			</button>
		</div>
	);
}
