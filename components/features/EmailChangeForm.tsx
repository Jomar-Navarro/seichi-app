"use client";

import { useState, useTransition } from "react";
import { Lock, Mail } from "lucide-react";
import PasswordInput from "@/components/UI/PasswordInput";
import StatusScreen from "@/components/UI/StatusScreen";
import SubmitButton from "@/components/UI/SubmitButton";
import {
	requestEmailChange,
	verifyCurrentPassword,
} from "@/app/(main)/impostazioni/account/actions";
import { useI18n } from "@/components/features/I18nProvider";

type Step = "identity" | "newEmail" | "sent";

export default function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
	const { t } = useI18n();
	const [step, setStep] = useState<Step>("identity");
	const [password, setPassword] = useState("");
	const [newEmail, setNewEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	function handleIdentity() {
		setError(null);
		startTransition(async () => {
			const result = await verifyCurrentPassword(password);
			if ("error" in result) setError(result.error);
			else setStep("newEmail");
		});
	}

	function handleSubmit() {
		setError(null);
		startTransition(async () => {
			// La password viene rimandata al server: il passo 1 non lascia uno
			// stato di cui il server possa fidarsi.
			const result = await requestEmailChange(newEmail, password);
			if ("error" in result) setError(result.error);
			else {
				setPassword("");
				setStep("sent");
			}
		});
	}

	if (step === "sent") {
		return (
			<StatusScreen
				icon={<Mail size={30} style={{ color: "var(--color-midori)" }} strokeWidth={1.5} />}
				title={t.account.email.sentTitle}
				description={t.account.email.sentDescription}
			/>
		);
	}

	if (step === "identity") {
		return (
			<>
				<p className="text-[13px] text-muted mb-5.5">{t.account.email.confirmIdentity}</p>

				<div className="flex flex-col gap-1.5 mb-3.5">
					<span className="text-[11.5px] text-disabled ml-0.5">{t.account.email.currentEmail}</span>
					<p className="px-4 py-4 rounded-2xl bg-input ring-border text-sm text-muted truncate">
						{currentEmail}
					</p>
				</div>

				<PasswordInput
					name="current-password"
					value={password}
					onChange={setPassword}
					placeholder={t.account.email.password}
					icon={<Lock size={18} className="shrink-0" />}
					autoComplete="current-password"
					invalid={Boolean(error)}
				/>

				{error && (
					<p className="text-xs text-center mb-3" style={{ color: "var(--ink-aka)" }}>
						{error}
					</p>
				)}

				<SubmitButton
					label={t.common.continue}
					pendingLabel={t.account.email.verifying}
					pending={pending}
					disabled={!password}
					onClick={handleIdentity}
					className="mt-3"
				/>
			</>
		);
	}

	return (
		<>
			<p className="text-[13px] text-muted mb-5.5">{t.account.email.newEmailIntro}</p>

			<div className="flex items-center gap-3 px-4 rounded-[18px] bg-input ring-border text-muted mb-6">
				<Mail size={18} className="shrink-0" />
				<input
					type="email"
					value={newEmail}
					autoFocus
					placeholder={t.account.email.newEmailPlaceholder}
					autoComplete="email"
					onChange={(e) => setNewEmail(e.target.value)}
					className="grow shrink basis-0 min-w-0 bg-transparent outline-none text-foreground text-base py-3.5 placeholder:text-muted/60"
				/>
			</div>

			{error && (
				<p className="text-xs text-center mb-3" style={{ color: "var(--ink-aka)" }}>
					{error}
				</p>
			)}

			<SubmitButton
				label={t.account.email.sendRequest}
				pendingLabel={t.account.email.sending}
				pending={pending}
				disabled={!newEmail}
				onClick={handleSubmit}
			/>
		</>
	);
}
