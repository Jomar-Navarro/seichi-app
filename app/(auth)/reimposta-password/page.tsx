import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthShell from "@/components/UI/AuthShell";
import ResetPasswordForm from "@/components/features/ResetPasswordForm";
import { createClient } from "@/lib/supabase/server";
import { hasRecoverySession } from "@/lib/recovery";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getDictionary();
	return { title: t.auth.meta.reset };
}

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
