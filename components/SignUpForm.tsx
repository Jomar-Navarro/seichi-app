"use client";
import { useState, useActionState } from "react";
import { signInWithFacebook, signup } from "@/app/(auth)/sign/action";
import PasswordField from "@/components/PasswordField";
import { Mail, User, MailCheck } from "lucide-react";
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
		{ regex: /.{8,}/, text: "Minimo 8 caratteri" },
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
	const [state, formAction] = useActionState(signup, {
		error: "",
		emailSent: false,
		email: "",
	});
	const [name, setName] = useState("");
	const [surname, setSurname] = useState("");
	const [email, setEmail] = useState("");

	if (state.emailSent) {
		return (
			<div className="grow shrink basis-0 flex flex-col h-full overflow-y-auto pt-12 px-7 pb-7 md:py-18 md:px-20 lg:p-8">
				<div className="w-full max-w-md xl:max-w-lg 2xl:max-w-xl mx-auto my-auto lg:bg-surface lg:border lg:border-subtle lg:rounded-2xl lg:px-8 lg:py-8 xl:px-10 xl:py-10 lg:backdrop-blur-sm">
					<div className="lg:hidden mb-8">
						<BrandHeader />
					</div>
					<div className="flex flex-col items-center text-center py-6">
						<div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-midori/15 mb-6">
							<MailCheck size={26} className="text-midori" />
						</div>
						<h2 className="text-2xl font-bold mb-3">Controlla la tua email</h2>
						<p className="text-muted text-sm leading-relaxed max-w-xs">
							Abbiamo inviato un link di verifica a{" "}
							<span className="text-foreground font-medium">{state.email}</span>.
							Aprilo per attivare il tuo account.
						</p>
						<p className="text-muted text-xs mt-5">
							Già verificato?{" "}
							<button
								onClick={() => onTabChange?.("signin")}
								className="text-midori font-medium cursor-pointer"
							>
								Accedi
							</button>
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="grow shrink basis-0 flex flex-col h-full overflow-y-auto pt-12 px-7 pb-7 md:py-18 md:px-20 lg:p-8">
			<div className="w-full max-w-md xl:max-w-lg 2xl:max-w-xl mx-auto my-auto lg:bg-surface lg:border lg:border-subtle lg:rounded-2xl lg:px-8 lg:py-8 xl:px-10 xl:py-10 lg:backdrop-blur-sm">
				{/* BrandHeader — mobile only */}
				<div className="lg:hidden">
					<BrandHeader />
				</div>

				{/* Desktop heading */}
				<div className="hidden lg:block mb-6">
					<span className="text-xs text-muted uppercase tracking-widest mb-2 block">
						Benvenuto
					</span>
					<h2 className="text-3xl font-bold leading-tight">
						Crea il tuo account.
					</h2>
				</div>

				<SignTab
					onSignUp={() => {}}
					activeTab="signup"
					onSignIn={() => onTabChange?.("signin")}
				/>

				{/* Input form */}
				<form
					onSubmit={(e) => {
						if (password !== confirmPassword) e.preventDefault();
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
							Accetto i <span className="text-midori">Termini di servizio</span> e{" "}
							l&apos;<span className="text-midori">informativa sulla privacy</span> di
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

				<div className="flex gap-3 mb-4">
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

				<div className="text-center text-sm mt-4">
					<span className="me-1 text-muted">Hai già un account?</span>
					<button
						onClick={() => onTabChange?.("signin")}
						className="text-midori cursor-pointer font-medium"
					>
						Accedi
					</button>
				</div>
			</div>
		</div>
	);
}
