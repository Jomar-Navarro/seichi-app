import { cookies } from "next/headers";

/**
 * Marcatore della sessione di recupero password.
 *
 * Il problema che risolve: /reimposta-password è pubblica e la sessione creata
 * dal link di recupero è una normale sessione Supabase, indistinguibile da
 * quella di un login. Senza questo marcatore, chiunque trovi un dispositivo
 * già loggato può aprire quella pagina e reimpostare la password senza
 * conoscere quella attuale — aggirando la riautenticazione che protegge
 * `changePassword`.
 *
 * Il cookie viene emesso solo da /callback dopo aver scambiato con successo il
 * `code` del link ricevuto via email, quindi non è ottenibile senza accedere
 * alla casella. È httpOnly (non leggibile da JS), di durata breve, e viene
 * bruciato appena la password è stata cambiata.
 */
export const RECOVERY_COOKIE = "seichi_pw_recovery";

const MAX_AGE_SECONDS = 15 * 60;

export async function markRecoverySession() {
	const store = await cookies();
	store.set(RECOVERY_COOKIE, "1", {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: MAX_AGE_SECONDS,
	});
}

export async function hasRecoverySession(): Promise<boolean> {
	const store = await cookies();
	return store.get(RECOVERY_COOKIE)?.value === "1";
}

export async function clearRecoverySession() {
	const store = await cookies();
	store.delete(RECOVERY_COOKIE);
}
