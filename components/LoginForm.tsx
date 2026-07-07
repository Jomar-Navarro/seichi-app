"use client";
import { useActionState } from "react";
import { login, signInWithFacebook } from "@/app/(auth)/sign/action";
import { Mail } from "lucide-react";
import PasswordField from "@/components/PasswordField";
import { GoogleIcon, FacebookIcon } from "@/components/icons";
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
		<div className="grow shrink basis-0 flex flex-col h-full overflow-y-auto pt-12 px-7 pb-7 md:py-18 md:px-20 lg:p-8">
			<div className="w-full max-w-md xl:max-w-lg 2xl:max-w-xl mx-auto grow lg:grow-0 my-auto flex flex-col lg:bg-surface lg:border lg:border-glass-border lg:rounded-2xl lg:px-8 lg:py-8 xl:px-10 xl:py-10 lg:backdrop-blur-sm">
				<div className="lg:hidden">
					<BrandHeader />
				</div>

				{/* Desktop heading */}
				<div className="hidden lg:block mb-6">
					<span className="text-xs text-muted uppercase tracking-widest mb-2 block">
						Bentornato
					</span>
					<h2 className="text-3xl font-bold leading-tight">
						Accedi al tuo spazio.
					</h2>
				</div>

				<SignTab
					onSignIn={() => {}}
					activeTab="signin"
					onSignUp={() => onTabChange?.("signup")}
				/>

				<div className="grow flex flex-col">
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

					{/* Spacer — pushes OAuth to bottom on mobile */}
					<div className="grow" />

					<div className="flex items-center gap-3 mb-4">
						<span className="grow shrink basis-0 h-px bg-glass-border" />
						<span className="text-muted text-xs">oppure</span>
						<span className="grow shrink basis-0 h-px bg-glass-border" />
					</div>

					<div className="flex gap-3 pb-8 lg:pb-0">
						<Button
							onClick={() => signInWithGoogle()}
							title="Google"
							icon={<GoogleIcon />}
							variant="oauth"
						/>
						<Button
							onClick={() => signInWithFacebook()}
							title="Facebook"
							icon={<FacebookIcon />}
							variant="oauth"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
