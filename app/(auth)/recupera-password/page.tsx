import type { Metadata } from "next";
import AuthShell from "@/components/UI/AuthShell";
import ForgotPasswordForm from "@/components/features/ForgotPasswordForm";

export const metadata: Metadata = {
	title: "Recupera la password — Seichi",
};

export default function RecuperaPasswordPage() {
	return (
		<AuthShell>
			<ForgotPasswordForm />
		</AuthShell>
	);
}
