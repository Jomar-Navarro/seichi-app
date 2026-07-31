import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthShell from "@/components/UI/AuthShell";
import ResetPasswordForm from "@/components/features/ResetPasswordForm";
import { createClient } from "@/lib/supabase/server";
import { hasRecoverySession } from "@/lib/recovery";

export const metadata: Metadata = {
	title: "Reimposta password — Seichi",
};

export default async function ReimpostaPasswordPage() {
	// Servono sessione E marcatore di recupero. Una sessione qualsiasi non basta:
	// un utente già loggato non deve poter cambiare password da qui saltando la
	// verifica di quella attuale (per quello c'è /impostazioni/password).
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user || !(await hasRecoverySession())) redirect("/recupera-password");

	return (
		<AuthShell>
			<ResetPasswordForm />
		</AuthShell>
	);
}
