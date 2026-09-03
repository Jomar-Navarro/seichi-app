"use client";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/components/features/I18nProvider";

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
	const { t } = useI18n();
	const [isView, setIsView] = useState(false);

	return (
		<div className="flex items-center gap-3 px-4 rounded-2xl bg-input segment-tab mb-1 text-muted">
			<Lock size={18} className="shrink-0" />
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
				aria-label={isView ? t.account.passwordCommon.hide : t.account.passwordCommon.show}
			>
				{/* L'icona mostra l'azione disponibile, non lo stato corrente */}
				{isView ? (
					<EyeOff size={18} className="shrink-0" />
				) : (
					<Eye size={18} className="shrink-0" />
				)}
			</button>
		</div>
	);
}
