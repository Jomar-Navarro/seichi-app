"use server";

import { redirect } from "next/navigation";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/errors";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/password";
import { clearRecoverySession, hasRecoverySession } from "@/lib/recovery";
import { getDictionary } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/format";
import { SITE_URL } from "@/lib/site-url";

type ActionResult = { error: string } | { success: true };

/**
 * Invia il link di recupero.
 *
 * `redirectTo` punta a /callback perché il template email di default usa
 * `{{ .ConfirmationURL }}`, che produce un link con `?code=` da scambiare con
 * `exchangeCodeForSession`. Sul piano free di Supabase i template NON sono
 * modificabili senza SMTP personalizzato, quindi la variante `token_hash` —
 * preferibile perché dichiara `type=recovery` — non è utilizzabile.
 *
 * /auth/confirm resta pronta a gestirla: il giorno in cui si configura l'SMTP
 * basta cambiare questo URL e il template. Vedi CLAUDE.md, sezione Auth Flow.
 */
export async function requestPasswordReset(email: string): Promise<ActionResult> {
	const supabase = await createClient();
	const address = email.trim().toLowerCase();

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
		const t = await getDictionary();
		return { error: t.errors.invalidEmail };
	}

	const { error } = await supabase.auth.resetPasswordForEmail(address, {
		redirectTo: `${SITE_URL}/callback?next=/reimposta-password`,
	});

	/*
	 * ⚠️ Si dice SOLO un guasto di rete (#124), e la ragione è la stessa del
	 * "ok" qui sotto. Una richiesta che non è partita non ha mandato nessuna
	 * email a nessuno, e "controlla la posta" sarebbe falso per chiunque: dirlo
	 * non rivela niente. Un limite di frequenza invece SÌ — GoTrue lo applica
	 * solo dopo aver trovato l'utente (non più di un'email al minuto per
	 * account), quindi "troppi tentativi" risponderebbe "questo indirizzo esiste".
	 * Quello resta nei log.
	 *
	 * ⚠️ E "non partita" vuol dire `status === 0`, non ogni errore "ritentabile"
	 * (review della #124). `isAuthRetryableFetchError` copre anche le risposte
	 * 5xx, e GoTrue risponde 500 quando non riesce a SPEDIRE l'email — cosa che
	 * tenta solo per un indirizzo registrato. Dirlo farebbe di nuovo del form un
	 * oracolo, attraverso un guasto del mailer invece che del limite.
	 */
	if (error) {
		if (isAuthRetryableFetchError(error) && error.status === 0) {
			return { error: authErrorMessage("recupero password", error, await getDictionary()) };
		}
		console.error("[recupero password]", error.code ?? "", error.message);
	}

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
		error: userError,
	} = await supabase.auth.getUser();

	const t = await getDictionary();

	// ⚠️ Un servizio che non risponde non è un link scaduto (#124): con la frase
	// di prima, chi aveva un link valido ne chiedeva un altro che avrebbe
	// incontrato lo stesso guasto.
	if (!user && userError && isAuthRetryableFetchError(userError)) {
		return { error: authErrorMessage("reimposta password", userError, t) };
	}

	if (!user || !(await hasRecoverySession())) {
		return { error: t.auth.recovery.linkExpired };
	}

	const invalid = validateNewPassword(newPassword, confirmPassword);
	if (invalid) {
		return {
			error:
				invalid === "tooShort"
					? fill(t.account.passwordCommon.tooShort, { min: PASSWORD_MIN_LENGTH })
					: t.account.passwordCommon.mismatch,
		};
	}

	const { error } = await supabase.auth.updateUser({ password: newPassword });
	if (error) return { error: authErrorMessage("reimposta password", error, t) };

	// Marcatore monouso: bruciato appena la password è stata cambiata.
	await clearRecoverySession();
	await supabase.auth.signOut();

	redirect("/sign?reset=1");
}
