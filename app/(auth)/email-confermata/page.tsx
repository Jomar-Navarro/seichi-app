import type { Metadata } from "next";
import AuthShell from "@/components/UI/AuthShell";
import EmailConfirmedStatus from "@/components/features/EmailConfirmedStatus";

export const metadata: Metadata = {
	title: "Email confermata — Seichi",
};

/**
 * Atterraggio del link di conferma cambio email.
 *
 * NON passa da /callback di proposito: il cambio email non è un flusso PKCE —
 * la sessione esiste già, quindi nessun `code_verifier` viene generato e
 * Supabase reindirizza senza `code`. /callback, che il `code` lo pretende,
 * scaricherebbe l'utente su /auth/auth-code-error.
 *
 * L'esito lo determina un componente client: GoTrue mette gli errori nel
 * fragment dell'URL, che al server non arriva mai.
 */
export default function EmailConfermataPage() {
	return (
		<AuthShell>
			<EmailConfirmedStatus />
		</AuthShell>
	);
}
