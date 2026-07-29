"use server";

import { createClient } from "@/lib/supabase/server";
import { validateNewPassword } from "@/lib/password";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type ActionResult = { error: string } | { success: true };

/**
 * Invia il link di recupero. Il link atterra su /auth/confirm, che scambia il
 * token per una sessione e poi inoltra a /reimposta-password.
 */
export async function requestPasswordReset(email: string): Promise<ActionResult> {
	const supabase = await createClient();
	const address = email.trim().toLowerCase();

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
		return { error: "Indirizzo email non valido" };
	}

	await supabase.auth.resetPasswordForEmail(address, {
		redirectTo: `${SITE_URL}/auth/confirm?next=/reimposta-password`,
	});

	// Rispondiamo "ok" anche quando l'indirizzo non è registrato: distinguere i
	// due casi trasformerebbe questo form in un oracolo per scoprire chi ha un
	// account (user enumeration).
	return { success: true };
}

/**
 * Imposta la nuova password. Richiede la sessione creata dal link di recupero:
 * senza quella, getUser() è null e l'operazione viene rifiutata.
 */
export async function resetPassword(
	newPassword: string,
	confirmPassword: string,
): Promise<ActionResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) return { error: "Link scaduto o non valido — richiedi un nuovo recupero" };

	const invalid = validateNewPassword(newPassword, confirmPassword);
	if (invalid) return { error: invalid };

	const { error } = await supabase.auth.updateUser({ password: newPassword });
	if (error) return { error: error.message };

	return { success: true };
}
