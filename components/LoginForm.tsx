"use client";
import { login } from "@/app/(auth)/login/action";
import { LoaderCircle, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import PasswordField from "@/components/PasswordField";
import { GoogleIcon, AppleIcon } from "@/components/icons";
import Input from "@/components/UI/Input";
import Button from "@/components/UI/Button";

export default function LoginForm() {
	const router = useRouter();
	return (
		<>
			<div className="grow shrink basis-0 flex flex-col h-full">
				{/* Logo and description */}
				<div className="flex flex-col justify-center items-center text-center mb-5">
					<div className="flex justify-center">
						<div className="w-18 h-18 flex items-center justify-center border border-white/15 rounded-3xl bg-white/10 backdrop-blur-md mb-5">
							<LoaderCircle size={36} />
						</div>
					</div>
					<h1 className="text-3xl font-bold mb-2">Seichi</h1>
					<h3 className="text-sm text-gray-400 uppercase mb-5 tracking-widest">
						整地 · ordine finanziario
					</h3>
					<p className="text-md max-w-2xs text-gray-200 opacity-[0.86] leading-[1.6]">
						Come si prepara il terreno prima di costruire, Seichi ti aiuta a
						mettere ordine nelle tue finanze — con calma, chiarezza e controllo.
					</p>
				</div>

				{/* Input form */}
				<form
					action={login}
					className="flex flex-col justify-center my-4 gap-3"
				>
					<div className="flex flex-col justify-center my-3 gap-3">
						<Input
							id="email"
							name="email"
							placeholder="Email"
							type="email"
							icon={<Mail size={18} className="shrink-0 text-gray-500" />}
						/>

						<PasswordField
							id="password"
							name="password"
							placeholder="Password"
						/>
					</div>

					<div className="text-right mb-4 text-seichi-ao">
						<span className="text-xs cursor-pointer text-seichi-ao tracking-widest">
							Password dimenticata?
						</span>
					</div>

					<Button title="Accedi" />
				</form>

				<div className="flex items-center gap-3 mb-5">
					<span className="grow shrink basis-0 h-px bg-background-tsuki/10"></span>
					<span className="text-[#727e95] text-xs">oppure</span>
					<span className="grow shrink basis-0 h-px bg-background-tsuki/10"></span>
				</div>

				<div className="flex gap-3">
					<Button title="Google" icon={<GoogleIcon />} variant="oauth" />
					<Button title="Apple" icon={<AppleIcon />} variant="oauth" />
				</div>

				<div className="mt-7 text-center text-sm text-[#8a97b0]">
					<span className="me-1">Non hai un account?</span>
					<button
						onClick={() => router.push("/signup")}
						className="text-seichi-ao cursor-pointer font-medium"
					>
						Registrati
					</button>
				</div>
			</div>
		</>
	);
}
