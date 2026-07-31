"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
	name: string;
	value: string;
	onChange: (value: string) => void;
	/** Etichetta piccola sopra il campo */
	label?: string;
	placeholder?: string;
	/** Icona a sinistra dentro il campo */
	icon?: ReactNode;
	/** Vedi https://developer.mozilla.org/docs/Web/HTML/Attributes/autocomplete */
	autoComplete?: "current-password" | "new-password";
	autoFocus?: boolean;
	invalid?: boolean;
}

/** Campo password con toggle di visibilità, usato dalle pagine account. */
export default function PasswordInput({
	name,
	value,
	onChange,
	label,
	placeholder,
	icon,
	autoComplete = "current-password",
	autoFocus,
	invalid,
}: PasswordInputProps) {
	const [visible, setVisible] = useState(false);

	return (
		<div className="flex flex-col gap-1.5 mb-3">
			{label && <label htmlFor={name} className="text-[11.5px] text-disabled ml-0.5">{label}</label>}
			<div
				className="flex items-center gap-3 px-4 rounded-[18px] bg-input border border-subtle text-muted"
				style={invalid ? { borderColor: "var(--color-aka)" } : undefined}
			>
				{icon}
				<input
					id={name}
					name={name}
					type={visible ? "text" : "password"}
					value={value}
					placeholder={placeholder}
					autoComplete={autoComplete}
					autoFocus={autoFocus}
					onChange={(e) => onChange(e.target.value)}
					className="grow shrink basis-0 min-w-0 bg-transparent outline-none text-foreground text-base py-3.5 placeholder:text-muted/60"
				/>
				<button
					type="button"
					onClick={() => setVisible((v) => !v)}
					className="p-1 flex items-center shrink-0 cursor-pointer"
					aria-label={visible ? "Nascondi password" : "Mostra password"}
				>
					{/* L'icona mostra l'AZIONE, non lo stato: a password visibile si
					    offre "nascondi". Deve concordare con l'aria-label qui sopra. */}
					{visible ? <EyeOff size={17} /> : <Eye size={17} />}
				</button>
			</div>
		</div>
	);
}
