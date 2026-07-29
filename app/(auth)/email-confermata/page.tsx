import type { Metadata } from "next";
import { MailCheck, TriangleAlert } from "lucide-react";
import AuthShell from "@/components/UI/AuthShell";
import StatusScreen from "@/components/UI/StatusScreen";
import SubmitButton from "@/components/UI/SubmitButton";

export const metadata: Metadata = {
	title: "Email confermata — Seichi",
};

/**
 * Atterraggio del link di conferma cambio email.
 *
 * NON passa da /callback di proposito: il cambio email non è un flusso PKCE —
 * la sessione esiste già, quindi nessun `code_verifier` viene generato e
 * Supabase non rimanda un `code`. /callback, che il `code` lo pretende,
 * scaricherebbe l'utente su /auth/auth-code-error.
 *
 * La verifica del token l'ha già fatta Supabase prima di reindirizzare qui:
 * questa pagina deve solo raccontare l'esito.
 */
export default async function EmailConfermataPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
	const params = await searchParams;
	const failed = Boolean(params.error);

	return (
		<AuthShell>
			{failed ? (
				<StatusScreen
					icon={<TriangleAlert size={30} style={{ color: "var(--color-aka)" }} strokeWidth={1.6} />}
					title="Conferma non riuscita"
					description={
						params.error_description ??
						"Il link non è valido o è scaduto. Riprova a cambiare email dalle impostazioni."
					}
					tone="var(--color-aka)"
				>
					<SubmitButton label="Vai alle impostazioni" href="/impostazioni" />
				</StatusScreen>
			) : (
				<StatusScreen
					icon={<MailCheck size={30} style={{ color: "var(--color-midori)" }} strokeWidth={1.6} />}
					title="Email confermata"
					description="Se Supabase ha richiesto la conferma anche dall'indirizzo precedente, il cambio diventa effettivo solo dopo aver aperto entrambi i link."
				>
					<SubmitButton label="Torna alle impostazioni" href="/impostazioni" />
				</StatusScreen>
			)}
		</AuthShell>
	);
}
