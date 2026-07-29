import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthShell from "@/components/UI/AuthShell";
import ResetPasswordForm from "@/components/features/ResetPasswordForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	title: "Reimposta password — Seichi",
};

export default async function ReimpostaPasswordPage() {
	// Ci si arriva solo dal link di recupero, che ha già creato la sessione in
	// /auth/confirm. Senza sessione il link è scaduto o l'URL è stato aperto a mano.
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/recupera-password");

	return (
		<AuthShell>
			<ResetPasswordForm />
		</AuthShell>
	);
}
