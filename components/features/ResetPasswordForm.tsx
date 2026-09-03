"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import PasswordInput from "@/components/UI/PasswordInput";
import PasswordStrength from "@/components/UI/PasswordStrength";
import SubmitButton from "@/components/UI/SubmitButton";
import { resetPassword } from "@/app/(auth)/recupera-password/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { useI18n } from "@/components/features/I18nProvider";

export default function ResetPasswordForm() {
	const { t } = useI18n();
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	const ready = password.length >= PASSWORD_MIN_LENGTH && confirm.length > 0;

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		startTransition(async () => {
			// In caso di successo l'action fa redirect su /sign?reset=1 e non
			// torna qui: la conferma viene mostrata dalla pagina di login.
			const result = await resetPassword(password, confirm);
			if (result && "error" in result) setError(result.error);
		});
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col">
			<div className="flex flex-col items-center text-center mb-7">
				<span className="w-18 h-18 rounded-[26px] flex items-center justify-center mb-5 bg-control box-shadow-ring">
					<Lock size={34} className="text-foreground" strokeWidth={1.5} />
				</span>
				<h1 className="text-[21px] font-semibold">{t.auth.recovery.resetTitle}</h1>
			</div>

			<PasswordInput
				name="new-password"
				label={t.auth.recovery.newPassword}
				value={password}
				onChange={setPassword}
				autoComplete="new-password"
				autoFocus
			/>
			<PasswordInput
				name="confirm-password"
				label={t.auth.recovery.confirmPassword}
				value={confirm}
				onChange={setConfirm}
				autoComplete="new-password"
				invalid={confirm.length > 0 && confirm !== password}
			/>

			<PasswordStrength password={password} />

			{error && (
				<p className="text-xs text-center mb-3" style={{ color: "var(--ink-aka)" }}>
					{error}
				</p>
			)}

			<SubmitButton
				label={t.auth.recovery.reset}
				pendingLabel={t.auth.recovery.resetting}
				pending={pending}
				disabled={!ready}
				type="submit"
			/>
		</form>
	);
}
