"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateNewPassword } from "@/lib/password";
import { clearRecoverySession, hasRecoverySession } from "@/lib/recovery";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type ActionResult = { error: string } | { success: true };

/**
 * Invia il link di recupero.
 *
 * `redirectTo` punta a /callback e NON a /auth/confirm: @supabase/ssr usa il
 * flusso PKCE, quindi il link torna con `?code=` e va scambiato con
 * `exchangeCodeForSession`. /auth/confirm gestisce solo `token_hash`+`type` e
 * scaricherebbe l'utente su /error.
 */
export async function requestPasswordReset(email: string): Promise<ActionResult> {
	const supabase = await createClient();
	const address = email.trim().toLowerCase();

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
		return { error: "Indirizzo email non valido" };
	}

	await supabase.auth.resetPasswordForEmail(address, {
		redirectTo: `${SITE_URL}/callback?next=/reimposta-password`,
	});

	// Rispondiamo "ok" anche quando l'indirizzo non è registrato: distinguere i
	// due casi trasformerebbe questo form in un oracolo per scoprire chi ha un
	// account (user enumeration).
	return { success: true };
}

/**
 * Imposta la nuova password.
 *
 * Richiede DUE cose: una sessione valida e il marcatore di recupero emesso da
 * /callback. La sola sessione non basta — sarebbe soddisfatta anche da un
 * normale login, e permetterebbe a chi trova il dispositivo sbloccato di
 * cambiare la password senza conoscere quella attuale.
 *
 * In caso di successo NON torna al chiamante: chiude la sessione di recupero e
 * manda al login. Oltre a essere la scelta più sicura (la sessione nata dal link
 * muore lì, e l'utente conferma di conoscere la password nuova), evita un
 * problema concreto: cancellare un cookie dentro una server action fa
 * ri-renderizzare la pagina corrente, e la guardia di /reimposta-password —
 * ormai senza marcatore — rimbalzerebbe l'utente su /recupera-password prima
 * ancora di mostrargli l'esito.
 */
export async function resetPassword(
	newPassword: string,
	confirmPassword: string,
): Promise<ActionResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user || !(await hasRecoverySession())) {
		return { error: "Link scaduto o non valido — richiedi un nuovo recupero" };
	}

	const invalid = validateNewPassword(newPassword, confirmPassword);
	if (invalid) return { error: invalid };

	const { error } = await supabase.auth.updateUser({ password: newPassword });
	if (error) return { error: error.message };

	// Marcatore monouso: bruciato appena la password è stata cambiata.
	await clearRecoverySession();
	await supabase.auth.signOut();

	redirect("/sign?reset=1");
}
