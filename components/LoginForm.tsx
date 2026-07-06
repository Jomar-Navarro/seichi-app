"use client";
import { useActionState } from "react";
import { login } from "@/app/(auth)/sign/action";
import { Sprout, Mail } from "lucide-react";
import PasswordField from "@/components/PasswordField";
import { GoogleIcon, AppleIcon, FacebookIcon } from "@/components/icons";
import Input from "@/components/UI/Input";
import Button from "@/components/UI/Button";
import SignTab from "@/components/UI/SignTab";
import BrandHeader from "./UI/BrandHeader";
import { signInWithGoogle } from "@/app/(auth)/sign/action";

interface LoginFormProps {
	onTabChange?: (value: "signin" | "signup") => void;
}

export default function LoginForm({ onTabChange }: LoginFormProps) {
	const [state, formAction] = useActionState(login, { error: "" });

	return (
		<div className="grow shrink basis-0 flex flex-col h-full pt-12 px-7">
			<BrandHeader />

			<SignTab
				onSignIn={() => {}}
				activeTab="signin"
				onSignUp={() => onTabChange?.("signup")}
			/>

			<div className="grow">
				{/* Form */}
				<form action={formAction} className="flex flex-col gap-3 mb-2">
					<Input
						id="email"
						name="email"
						placeholder="Email"
						type="email"
						icon={<Mail size={18} className="shrink-0" />}
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
					<button
						onClick={() => onTabChange?.("signup")}
						type="button"
						className="text-midori cursor-pointer font-medium"
					>
						Registrati
					</button>
				</p>

				<div className="pt-40"></div>

				<div className="flex items-center gap-3 mb-4">
					<span className="grow shrink basis-0 h-px bg-glass-border" />
					<span className="text-muted text-xs">oppure</span>
					<span className="grow shrink basis-0 h-px bg-glass-border" />
				</div>

				<div className="flex gap-3">
					<Button
						onClick={() => signInWithGoogle()}
						title="Google"
						icon={<GoogleIcon />}
						variant="oauth"
					/>
					<Button title="Facebook" icon={<FacebookIcon />} variant="oauth" />
				</div>
			</div>
		</div>
	);
}
