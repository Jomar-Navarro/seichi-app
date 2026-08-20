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
import { useI18n } from "@/components/features/I18nProvider";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { fill } from "@/lib/i18n/format";

interface SignUpFormProps {
	onTabChange?: (value: "signin" | "signup") => void;
}

/**
 * I cinque requisiti, come regole pure.
 *
 * ⚠️ Il testo non sta più qui (Fase 19): la barra lo mostra solo come colore, ma
 * l'etichetta serve comunque all'accessibilità e viene da
 * `t.auth.signUp.requirements`. La soglia di lunghezza usa `PASSWORD_MIN_LENGTH`
 * invece dell'"8" cablato che c'era sia nella regex sia nella frase — due punti
 * che potevano divergere in silenzio.
 */
const REQUIREMENTS = [
	{ key: "length", regex: new RegExp(`.{${PASSWORD_MIN_LENGTH},}`) },
	{ key: "number", regex: /[0-9]/ },
	{ key: "lowercase", regex: /[a-z]/ },
	{ key: "uppercase", regex: /[A-Z]/ },
	{ key: "special", regex: /[^A-Za-z0-9]/ },
] as const;

const checkStrength = (password: string) =>
	REQUIREMENTS.map((req) => ({ key: req.key, met: req.regex.test(password) }));

export default function SignUpForm({ onTabChange }: SignUpFormProps) {
	const { t } = useI18n();
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
						<h2 className="text-2xl font-bold mb-3">{t.auth.signUp.sentTitle}</h2>
						<p className="text-muted text-sm leading-relaxed max-w-xs">
							{t.auth.signUp.sentBefore}
							<span className="text-foreground font-medium">{state.email}</span>
							{t.auth.signUp.sentAfter}
						</p>
						<p className="text-muted text-xs mt-5">
							{t.auth.signUp.alreadyVerified}{" "}
							<button
								onClick={() => onTabChange?.("signin")}
								className="text-midori-ink font-medium cursor-pointer"
							>
								{t.auth.welcome.signIn}
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
						{t.auth.signUp.eyebrow}
					</span>
					<h2 className="text-3xl font-bold leading-tight">
						{t.auth.signUp.heading}
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
							placeholder={t.auth.signUp.firstName}
							type="text"
							value={name}
							onChange={setName}
							icon={<User size={18} className="shrink-0" />}
						/>

						<Input
							id="surname"
							name="surname"
							placeholder={t.auth.signUp.lastName}
							type="text"
							value={surname}
							onChange={setSurname}
							icon={<User size={18} className="shrink-0" />}
						/>

						<Input
							id="email"
							name="email"
							placeholder={t.auth.signIn.email}
							type="email"
							value={email}
							onChange={setEmail}
							icon={
								<Mail size={18} className="shrink-0" />
							}
						/>

						<PasswordField
							id="password"
							name="password"
							placeholder={t.auth.signIn.password}
							onChange={setPassword}
						/>
						<PasswordField
							id="confirm-password"
							name="confirm-password"
							placeholder={t.auth.signUp.confirmPassword}
							onChange={setConfirmPassword}
						/>
						{confirmPassword !== password && passwordMismatch ? (
							<div className="text-xs text-aka-ink">
								{t.auth.errors.passwordMismatch}
							</div>
						) : null}

						<div className="flex items-center gap-1.5 w-full my-1">
							{checkStrength(password).map((req) => (
								<span
									key={req.key}
									// L'etichetta non è visibile — le barre sono solo colore —
									// ma senza, uno screen reader legge cinque riquadri muti.
									title={
										req.key === "length"
											? fill(t.auth.signUp.requirements.length, { n: PASSWORD_MIN_LENGTH })
											: t.auth.signUp.requirements[req.key]
									}
									className={`grow shrink basis-0 h-1.5 rounded-sm transition-all ${
										req.met ? "bg-midori" : "bg-input"
									}`}
								/>
							))}
						</div>

						{state.error && (
							<div className="text-xs text-aka-ink mt-1 text-center">
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
						{/* Spezzata in cinque perché due frammenti sono link: una frase
						    unica con segnaposto non potrebbe portare il markup. */}
						<div className="text-xs text-muted tracking-wider">
							{t.auth.signUp.consentBefore}
							<span className="text-midori-ink">{t.auth.signUp.consentTerms}</span>
							{t.auth.signUp.consentMiddle}
							<span className="text-midori-ink">{t.auth.signUp.consentPrivacy}</span>
							{t.auth.signUp.consentAfter}
						</div>
					</div>

					<Button title={t.auth.signUp.submit} />
				</form>

				<div className="flex items-center gap-3 my-5">
					<span className="grow shrink basis-0 h-px bg-subtle"></span>
					<span className="text-muted text-xs">{t.auth.signIn.or}</span>
					<span className="grow shrink basis-0 h-px bg-subtle"></span>
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
					<span className="me-1 text-muted">{t.auth.welcome.haveAccount}</span>
					<button
						onClick={() => onTabChange?.("signin")}
						className="text-midori-ink cursor-pointer font-medium"
					>
						{t.auth.welcome.signIn}
					</button>
				</div>
			</div>
		</div>
	);
}
