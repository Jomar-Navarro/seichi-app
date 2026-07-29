"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
import PasswordInput from "@/components/UI/PasswordInput";
import PasswordStrength from "@/components/UI/PasswordStrength";
import StatusScreen from "@/components/UI/StatusScreen";
import SubmitButton from "@/components/UI/SubmitButton";
import { resetPassword } from "@/app/(auth)/recupera-password/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";

export default function ResetPasswordForm() {
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);
	const [pending, startTransition] = useTransition();

	const ready = password.length >= PASSWORD_MIN_LENGTH && confirm.length > 0;

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		startTransition(async () => {
			const result = await resetPassword(password, confirm);
			if ("error" in result) setError(result.error);
			else setDone(true);
		});
	}

	if (done) {
		return (
			<StatusScreen
				icon={<Check size={30} style={{ color: "var(--color-midori)" }} strokeWidth={2.2} />}
				title="Password aggiornata"
				shape="circle"
			>
				<SubmitButton label="Vai alla dashboard" onClick={() => router.push("/")} />
			</StatusScreen>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col">
			<div className="flex flex-col items-center text-center mb-7">
				<span className="w-18 h-18 rounded-[26px] flex items-center justify-center mb-5 bg-control border border-subtle box-shadow">
					<Lock size={34} className="text-foreground" strokeWidth={1.5} />
				</span>
				<h1 className="text-[21px] font-semibold">Reimposta password</h1>
			</div>

			<PasswordInput
				name="new-password"
				label="Nuova password"
				value={password}
				onChange={setPassword}
				autoComplete="new-password"
				autoFocus
			/>
			<PasswordInput
				name="confirm-password"
				label="Conferma password"
				value={confirm}
				onChange={setConfirm}
				autoComplete="new-password"
				invalid={confirm.length > 0 && confirm !== password}
			/>

			<PasswordStrength password={password} />

			{error && (
				<p className="text-xs text-center mb-3" style={{ color: "var(--color-aka)" }}>
					{error}
				</p>
			)}

			<SubmitButton
				label="Reimposta password"
				pendingLabel="Aggiornamento…"
				pending={pending}
				disabled={!ready}
				type="submit"
			/>
		</form>
	);
}
