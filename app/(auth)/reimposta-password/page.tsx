import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import AuthShell from "@/components/UI/AuthShell";
import LoadError from "@/components/UI/LoadError";
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
		error,
	} = await supabase.auth.getUser();

	/*
	 * ⚠️ Un guasto di rete NON rimanda a chiedere un link nuovo (#124). Il
	 * redirect qui sotto dice "questo link non vale più", e su un servizio che
	 * semplicemente non ha risposto era falso: il link era buono, e quello
	 * nuovo avrebbe incontrato lo stesso guasto. Si dice cosa è successo, e
	 * "riprova" rifà questa stessa pagina — col marcatore ancora valido.
	 */
	if (!user && error && isAuthRetryableFetchError(error)) {
		console.error("[reimposta password] servizio non raggiungibile:", error.message);
		const t = await getDictionary();
		return (
			<AuthShell>
				<LoadError message={t.errors.authUnavailable} />
			</AuthShell>
		);
	}

	if (!user || !(await hasRecoverySession())) redirect("/recupera-password");

	return (
		<AuthShell>
			<ResetPasswordForm />
		</AuthShell>
	);
}
