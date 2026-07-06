"use client";
import { useState, useActionState } from "react";
import { signInWithFacebook, signup } from "@/app/(auth)/sign/action";
import PasswordField from "@/components/PasswordField";
import { Mail, User } from "lucide-react";
import Button from "@/components/UI/Button";
import { GoogleIcon, FacebookIcon } from "@/components/icons";
import Input from "@/components/UI/Input";
import SignTab from "./UI/SignTab";
import BrandHeader from "./UI/BrandHeader";
import { signInWithGoogle } from "@/app/(auth)/sign/action";

interface SignUpFormProps {
	onTabChange?: (value: "signin" | "signup") => void;
}

const checkStrength = (password: string) => {
	const requirements = [
		{ regex: /.{5,}/, text: "Minimo 5 caratteri" },
		{ regex: /[0-9]/, text: "Minimo un numero" },
		{ regex: /[a-z]/, text: "Minimo una lettera minuscola" },
		{ regex: /[A-Z]/, text: "Minimo una lettera maiuscola" },
		{ regex: /[^A-Za-z0-9]/, text: "Minimo un carattere speciale" },
	];
	return requirements.map((req) => ({
		met: req.regex.test(password),
		text: req.text,
	}));
};

export default function SignUpForm({ onTabChange }: SignUpFormProps) {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordMismatch, setPasswordMismatch] = useState(false);
	const [state, formAction, pending] = useActionState(signup, {
		error: "",
	});
	const [name, setName] = useState("");
	const [surname, setSurname] = useState("");
	const [email, setEmail] = useState("");

	return (
		<div className="grow shrink basis-0 flex flex-col h-full overflow-y-auto pt-12 px-7 pb-7 md:py-18 md:px-20 lg:py-14 lg:px-22">
			{/* BrandHeader — mobile only */}
			<div className="lg:hidden">
				<BrandHeader />
			</div>

			<SignTab
				onSignUp={() => {}}
				activeTab="signup"
				onSignIn={() => onTabChange?.("signin")}
			/>

			{/* Input form */}
			<form
				onSubmit={(e) => {
					password !== confirmPassword ? e.preventDefault() : null;
					setPasswordMismatch(password !== confirmPassword);
				}}
				action={formAction}
				className="flex flex-col justify-center gap-3"
			>
				<div className="flex flex-col justify-center gap-3">
					<Input
						id="name"
						name="name"
						placeholder="Nome"
						type="text"
						value={name}
						onChange={setName}
						icon={<User size={18} className="shrink-0" />}
					/>

					<Input
						id="surname"
						name="surname"
						placeholder="Cognome"
						type="text"
						value={surname}
						onChange={setSurname}
						icon={<User size={18} className="shrink-0" />}
					/>

					<Input
						id="email"
						name="email"
						placeholder="Email"
						type="email"
						value={email}
						onChange={setEmail}
						icon={
							<Mail size={18} className="shrink-0 text-shadow-foreground" />
						}
					/>

					<PasswordField
						id="password"
						name="password"
						placeholder="Password"
						onChange={setPassword}
					/>
					<PasswordField
						id="confirm-password"
						name="confirm-password"
						placeholder="Conferma password"
						onChange={setConfirmPassword}
					/>
					{confirmPassword !== password && passwordMismatch ? (
						<div className="text-xs text-aka">
							Le password non corrispondono
						</div>
					) : null}

					<div className="flex items-center gap-1.5 w-full my-1">
						{checkStrength(password).map((req, index) => (
							<span
								key={index}
								className={`grow shrink basis-0 h-1.5 rounded-sm transition-all ${
									req.met ? "bg-midori" : "bg-glass-border"
								}`}
							/>
						))}
					</div>

					{state.error && (
						<div className="text-xs text-aka mt-1 text-center">
							{state.error}
						</div>
					)}
				</div>

				<div className="flex items-start gap-3 mb-4 cursor-pointer">
					<input
						id="privacy"
						name="privacy"
						type="checkbox"
						className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-px"
					/>
					<div className="text-xs text-muted tracking-wider">
						Accetto i <span className="text-midori">Termini di servizio</span> e
						l'
						<span className="text-midori">informativa sulla privacy</span> di
						Seichi.
					</div>
				</div>

				<Button title="Crea account" />
			</form>

			<div className="flex items-center gap-3 my-5">
				<span className="grow shrink basis-0 h-px bg-glass-border"></span>
				<span className="text-muted text-xs">oppure</span>
				<span className="grow shrink basis-0 h-px bg-glass-border"></span>
			</div>

			<div className="flex gap-3 mb-7">
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

			<div className="text-center text-sm">
				<span className="me-1 text-muted">Hai già un account?</span>
				<button
					onClick={() => onTabChange?.("signin")}
					className="text-midori cursor-pointer font-medium"
				>
					Accedi
				</button>
			</div>
		</div>
	);
}
