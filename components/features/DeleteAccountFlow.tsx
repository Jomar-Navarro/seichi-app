"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import PasswordInput from "@/components/UI/PasswordInput";
import SubmitButton from "@/components/UI/SubmitButton";
import { deleteAccount } from "@/app/(main)/impostazioni/account/actions";
import { useI18n } from "@/components/features/I18nProvider";

const AKA = "var(--color-aka)";

interface DeleteAccountFlowProps {
	email: string;
	/** Gli account OAuth non hanno password: si conferma solo digitando l'email */
	hasPasswordIdentity: boolean;
}

export default function DeleteAccountFlow({ email, hasPasswordIdentity }: DeleteAccountFlowProps) {
	const router = useRouter();
	const { t } = useI18n();
	const [confirmed, setConfirmed] = useState(false);
	const [typedEmail, setTypedEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	const emailMatches = typedEmail.trim().toLowerCase() === email.toLowerCase();
	const ready = emailMatches && (!hasPasswordIdentity || password.length > 0);

	function handleDelete() {
		setError(null);
		startTransition(async () => {
			// In caso di successo la action fa redirect: qui torna solo l'errore.
			const result = await deleteAccount(typedEmail, password);
			if (result?.error) setError(result.error);
		});
	}

	/* Passo 1 — avviso */
	if (!confirmed) {
		return (
			<>
				<p className="text-[13.5px] text-muted leading-relaxed mb-7">
					{t.account.delete.warning}
				</p>

				<SubmitButton label={t.common.cancel} onClick={() => router.push("/impostazioni")} />

				<button
					type="button"
					onClick={() => setConfirmed(true)}
					className="w-full text-center text-sm font-medium mt-4.5 py-2 cursor-pointer"
					style={{ color: AKA }}
				>
					{t.common.continue}
				</button>
			</>
		);
	}

	/* Passo 2 — conferma esplicita */
	return (
		<>
			<p className="text-[13px] text-muted mb-5.5">{t.account.delete.typeEmail}</p>

			<input
				type="text"
				value={typedEmail}
				autoFocus
				// Il placeholder NON contiene l'email: scriverci dentro la risposta
				// ridurrebbe la conferma a un copia-e-incolla di ciò che è a schermo.
				placeholder={t.account.delete.emailPlaceholder}
				autoComplete="off"
				autoCapitalize="none"
				spellCheck={false}
				onChange={(e) => setTypedEmail(e.target.value)}
				className="w-full px-4 py-4 rounded-2xl bg-input outline-none text-base mb-4 placeholder:text-muted/60"
				// issue #81 — anello (box-shadow), non bordo: il colore è traslucido (30%).
				style={{ boxShadow: `color-mix(in srgb, ${AKA} 30%, transparent) 0px 0px 0px 1px inset` }}
			/>

			{hasPasswordIdentity && (
				<PasswordInput
					name="current-password"
					value={password}
					onChange={setPassword}
					placeholder={t.account.email.password}
					icon={<Lock size={18} className="shrink-0" />}
					autoComplete="current-password"
				/>
			)}

			{error && (
				<p className="text-xs text-center mb-3 mt-1" style={{ color: AKA }}>
					{error}
				</p>
			)}

			<SubmitButton
				label={t.account.delete.deleteForever}
				pendingLabel={t.account.delete.deleting}
				pending={pending}
				disabled={!ready}
				onClick={handleDelete}
				danger
				className="mt-3"
			/>
		</>
	);
}
