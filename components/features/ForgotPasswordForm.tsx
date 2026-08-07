"use client";

import { useState, useTransition } from "react";
import { Mail, Lock } from "lucide-react";
import StatusScreen from "@/components/UI/StatusScreen";
import SubmitButton from "@/components/UI/SubmitButton";
import { requestPasswordReset } from "@/app/(auth)/recupera-password/actions";
import { useI18n } from "@/components/features/I18nProvider";

export default function ForgotPasswordForm() {
	const { t } = useI18n();
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [sent, setSent] = useState(false);
	const [pending, startTransition] = useTransition();

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		startTransition(async () => {
			const result = await requestPasswordReset(email);
			if ("error" in result) setError(result.error);
			else setSent(true);
		});
	}

	if (sent) {
		return (
			<StatusScreen
				icon={
					<Mail
						size={32}
						style={{ color: "var(--color-midori)" }}
						strokeWidth={1.5}
					/>
				}
				title={t.auth.recovery.sentTitle}
				description={t.auth.recovery.sentDescription}
			>
				<SubmitButton label={t.auth.recovery.backToLogin} href="/sign" />
			</StatusScreen>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col">
			<div className="flex flex-col items-center text-center mb-7">
				<span className="w-18 h-18 rounded-[26px] flex items-center justify-center mb-5 bg-control border border-subtle box-shadow">
					<Lock size={34} className="text-foreground" strokeWidth={1.5} />
				</span>
				<h1 className="text-[21px] font-semibold mb-2">Recupera la password</h1>
				<p className="text-[13px] text-muted leading-relaxed max-w-70">
					Inserisci la tua email e ti invieremo un link per reimpostarla
				</p>
			</div>

			<div className="flex items-center gap-3 px-4 rounded-[18px] bg-input border border-subtle text-muted mb-5.5">
				<Mail size={18} className="shrink-0" />
				<input
					type="email"
					value={email}
					required
					autoFocus
					placeholder={t.auth.signIn.email}
					autoComplete="email"
					onChange={(e) => setEmail(e.target.value)}
					className="grow shrink basis-0 min-w-0 bg-transparent outline-none text-foreground text-base py-4 placeholder:text-muted/60"
				/>
			</div>

			{error && (
				<p
					className="text-xs text-center mb-3"
					style={{ color: "var(--ink-aka)" }}
				>
					{error}
				</p>
			)}

			<SubmitButton
				label={t.auth.recovery.submit}
				pendingLabel={t.auth.recovery.sending}
				pending={pending}
				type="submit"
			/>

			<SubmitButton
				label={t.auth.recovery.backToLogin}
				href="/sign"
				variant="ghost"
				className="mt-3"
			/>
		</form>
	);
}
