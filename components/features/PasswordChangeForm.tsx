"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import PasswordInput from "@/components/UI/PasswordInput";
import PasswordStrength from "@/components/UI/PasswordStrength";
import StatusScreen from "@/components/UI/StatusScreen";
import SubmitButton from "@/components/UI/SubmitButton";
import { changePassword } from "@/app/(main)/impostazioni/account/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";

export default function PasswordChangeForm() {
	const router = useRouter();
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);
	const [pending, startTransition] = useTransition();

	const ready = current.length > 0 && next.length >= PASSWORD_MIN_LENGTH && confirm.length > 0;

	function handleSubmit() {
		setError(null);
		startTransition(async () => {
			const result = await changePassword(current, next, confirm);
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
				<SubmitButton label="Fatto" onClick={() => router.push("/impostazioni")} />
			</StatusScreen>
		);
	}

	return (
		<>
			<PasswordInput
				name="current-password"
				label="Password attuale"
				value={current}
				onChange={setCurrent}
				autoComplete="current-password"
			/>
			<PasswordInput
				name="new-password"
				label="Nuova password"
				value={next}
				onChange={setNext}
				autoComplete="new-password"
			/>
			<PasswordInput
				name="confirm-password"
				label="Conferma nuova password"
				value={confirm}
				onChange={setConfirm}
				autoComplete="new-password"
				invalid={confirm.length > 0 && confirm !== next}
			/>

			<PasswordStrength password={next} />

			{error && (
				<p className="text-xs text-center mb-3" style={{ color: "var(--ink-aka)" }}>
					{error}
				</p>
			)}

			<SubmitButton
				label="Aggiorna password"
				pendingLabel="Aggiornamento…"
				pending={pending}
				disabled={!ready}
				onClick={handleSubmit}
			/>
		</>
	);
}
