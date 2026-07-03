"use client";
import { useActionState } from "react";
import { login } from "@/app/(auth)/sign/action";
import { Sprout, Mail } from "lucide-react";
import PasswordField from "@/components/PasswordField";
import { GoogleIcon, AppleIcon } from "@/components/icons";
import Input from "@/components/UI/Input";
import Button from "@/components/UI/Button";
import SignTab from "@/components/UI/SignTab";

interface LoginFormProps {
	onTabChange?: (value: "signin" | "signup") => void;
}

export default function LoginForm({ onTabChange }: LoginFormProps) {
	const [state, formAction] = useActionState(login, { error: "" });

	return (
		<div className="grow shrink basis-0 flex flex-col h-full">
			{/* Logo */}
			<div className="flex flex-col items-center text-center mb-6">
				<div className="w-16 h-16 flex items-center justify-center border border-glass-border rounded-3xl bg-surface-elevated backdrop-blur-md mb-4">
					<Sprout size={30} className="text-midori" />
				</div>
				<h1 className="text-2xl font-semibold mb-1">Seichi</h1>
				<h3 className="text-xs text-muted uppercase tracking-widest">
					整地 · ordine finanziario
				</h3>
			</div>

			<SignTab
				onSignIn={() => {}}
				activeTab="signin"
				onSignUp={() => onTabChange?.("signup")}
			/>

			{/* Form */}
			<form action={formAction} className="flex flex-col gap-3 mb-4">
				<Input
					id="email"
					name="email"
					placeholder="Email"
					type="email"
					icon={<Mail size={18} className="shrink-0 text-shadow-foreground" />}
				/>
				<PasswordField id="password" name="password" placeholder="Password" />
				{state.error && (
					<div className="text-xs text-aka text-center">{state.error}</div>
				)}
				<div className="text-right mb-2">
					<span className="text-xs cursor-pointer text-ao tracking-widest">
						Password dimenticata?
					</span>
				</div>
				<Button title="Accedi" />
			</form>

			<p className="text-center text-sm text-muted mb-5">
				Non hai un account?{" "}
				<button type="button" className="text-ao cursor-pointer font-medium">
					Registrati
				</button>
			</p>

			{/* Divider */}
			<div className="flex items-center gap-3 mb-4">
				<span className="grow shrink basis-0 h-px bg-glass-border" />
				<span className="text-muted text-xs">oppure</span>
				<span className="grow shrink basis-0 h-px bg-glass-border" />
			</div>

			{/* OAuth */}
			<div className="flex gap-3">
				<Button title="Google" icon={<GoogleIcon />} variant="oauth" />
				<Button title="Apple" icon={<AppleIcon />} variant="oauth" />
			</div>
		</div>
	);
}
