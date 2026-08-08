import type { Metadata } from "next";
import AuthShell from "@/components/UI/AuthShell";
import { getDictionary } from "@/lib/i18n/server";
import ForgotPasswordForm from "@/components/features/ForgotPasswordForm";

// Funzione e non costante: il locale si conosce solo a richiesta in corso.
export async function generateMetadata(): Promise<Metadata> {
	const t = await getDictionary();
	return { title: t.auth.meta.recover };
}

export default function RecuperaPasswordPage() {
	return (
		<AuthShell>
			<ForgotPasswordForm />
		</AuthShell>
	);
}
