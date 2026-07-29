"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateNewPassword } from "@/lib/password";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // deve restare allineato al file_size_limit del bucket
const AVATAR_MIME: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

export type ActionResult = { error: string } | { success: true };

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

/**
 * Ogni server action è raggiungibile con una POST diretta, non solo dalla UI:
 * l'autenticazione va verificata qui dentro, sempre.
 */
async function requireUser() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return { supabase, user };
}

/**
 * Riautenticazione: Supabase permette di cambiare password ed email senza
 * riconfermare le credenziali. Su un dispositivo lasciato sbloccato basterebbe
 * quindi aprire l'app per prendere possesso dell'account. Prima di ogni
 * operazione sensibile richiediamo la password attuale.
 *
 * signInWithPassword rinnova la sessione dello stesso utente: i cookie vengono
 * riscritti, l'utente non se ne accorge.
 */
async function reauthenticate(email: string, password: string): Promise<string | null> {
	const supabase = await createClient();
	const { error } = await supabase.auth.signInWithPassword({ email, password });
	return error ? "Password non corretta" : null;
}

/* ------------------------------------------------------------------ */
/* Profilo — nome                                                      */
/* ------------------------------------------------------------------ */

export async function updateFullName(fullName: string): Promise<ActionResult> {
	const { supabase, user } = await requireUser();
	if (!user) return { error: "Non autenticato" };

	const name = fullName.trim().replace(/\s+/g, " ");
	if (name.length > 80) return { error: "Il nome è troppo lungo" };

	// upsert e non update: chi si è registrato prima del trigger e ha
	// abbandonato l'onboarding non ha una riga in profiles. Un UPDATE su zero
	// righe non è un errore per Postgres, quindi l'app direbbe "salvato" senza
	// aver salvato niente.
	const { error } = await supabase
		.from("profiles")
		.upsert({ id: user.id, full_name: name || null });

	if (error) return { error: error.message };

	revalidatePath("/", "layout");
	return { success: true };
}

/* ------------------------------------------------------------------ */
/* Profilo — avatar                                                    */
/* ------------------------------------------------------------------ */

/**
 * Rimuove i file avatar dell'utente, saltando `keep` (il file appena caricato).
 * La cartella ne contiene normalmente uno solo.
 */
async function purgeAvatarFiles(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string,
	keep?: string,
) {
	const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
	const stale = (files ?? [])
		.map((f) => `${userId}/${f.name}`)
		.filter((path) => path !== keep);

	if (stale.length) {
		await supabase.storage.from(AVATAR_BUCKET).remove(stale);
	}
}

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
	const { supabase, user } = await requireUser();
	if (!user) return { error: "Non autenticato" };

	const file = formData.get("avatar");
	if (!(file instanceof File) || file.size === 0) return { error: "Nessun file selezionato" };

	// I limiti sono anche sul bucket, ma controllarli qui dà un errore leggibile
	// invece di un 413 opaco dallo storage.
	if (file.size > AVATAR_MAX_BYTES) return { error: "L'immagine non può superare 2 MB" };

	const ext = AVATAR_MIME[file.type];
	if (!ext) return { error: "Formato non supportato — usa JPG, PNG o WebP" };

	// Nome casuale: il bucket è pubblico in lettura, quindi il path non deve
	// essere ricostruibile conoscendo solo lo user_id.
	const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

	// Ordine deliberato: carica → aggiorna il puntatore → solo allora cancella il
	// vecchio file. Cancellare per primo significherebbe che un upload fallito
	// lascia `avatar_url` puntato a un oggetto che non esiste più, cioè un avatar
	// rotto senza possibilità di tornare indietro.
	const { error: uploadError } = await supabase.storage
		.from(AVATAR_BUCKET)
		.upload(path, file, { contentType: file.type, upsert: false });

	if (uploadError) return { error: uploadError.message };

	const {
		data: { publicUrl },
	} = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

	const { error } = await supabase
		.from("profiles")
		.upsert({ id: user.id, avatar_url: publicUrl });

	if (error) {
		// Il puntatore non è stato salvato: rimuoviamo il file appena caricato e
		// lasciamo intatto quello vecchio, che è ancora quello referenziato.
		await supabase.storage.from(AVATAR_BUCKET).remove([path]);
		return { error: error.message };
	}

	await purgeAvatarFiles(supabase, user.id, path);

	revalidatePath("/", "layout");
	return { success: true };
}

export async function removeAvatar(): Promise<ActionResult> {
	const { supabase, user } = await requireUser();
	if (!user) return { error: "Non autenticato" };

	// Stesso principio di uploadAvatar, al contrario: prima si toglie il
	// puntatore, poi si cancellano i file. Invertendo l'ordine, un update fallito
	// lascerebbe `avatar_url` a puntare a un oggetto ormai inesistente.
	const { error } = await supabase
		.from("profiles")
		.upsert({ id: user.id, avatar_url: null });

	if (error) return { error: error.message };

	await purgeAvatarFiles(supabase, user.id);

	revalidatePath("/", "layout");
	return { success: true };
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

/** Passo 1: conferma dell'identità prima di mostrare il campo nuova email. */
export async function verifyCurrentPassword(password: string): Promise<ActionResult> {
	const { user } = await requireUser();
	if (!user?.email) return { error: "Non autenticato" };
	if (!password) return { error: "Inserisci la password" };

	const error = await reauthenticate(user.email, password);
	return error ? { error } : { success: true };
}

/** Passo 2: richiede il cambio email. Supabase invia il link di conferma. */
export async function requestEmailChange(
	newEmail: string,
	password: string,
): Promise<ActionResult> {
	const { supabase, user } = await requireUser();
	if (!user?.email) return { error: "Non autenticato" };

	const email = newEmail.trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Indirizzo email non valido" };
	if (email === user.email.toLowerCase()) return { error: "È già la tua email attuale" };

	// La riautenticazione va ripetuta: il passo 1 e il passo 2 sono due richieste
	// distinte, e fidarsi di uno stato tenuto sul client renderebbe il controllo
	// aggirabile chiamando direttamente questa action.
	const authError = await reauthenticate(user.email, password);
	if (authError) return { error: authError };

	// NON /callback: il cambio email non è un flusso PKCE (la sessione esiste
	// già, quindi nessun code_verifier viene generato) e Supabase reindirizza
	// senza `code`. /callback lo pretende e finirebbe su /auth/auth-code-error,
	// dicendo "accesso non riuscito" a fronte di un cambio andato a buon fine.
	const { error } = await supabase.auth.updateUser(
		{ email },
		{ emailRedirectTo: `${SITE_URL}/email-confermata` },
	);

	if (error) return { error: error.message };
	return { success: true };
}

/* ------------------------------------------------------------------ */
/* Password                                                            */
/* ------------------------------------------------------------------ */

export async function changePassword(
	currentPassword: string,
	newPassword: string,
	confirmPassword: string,
): Promise<ActionResult> {
	const { supabase, user } = await requireUser();
	if (!user?.email) return { error: "Non autenticato" };

	const invalid = validateNewPassword(newPassword, confirmPassword);
	if (invalid) return { error: invalid };

	if (newPassword === currentPassword) {
		return { error: "La nuova password deve essere diversa da quella attuale" };
	}

	const authError = await reauthenticate(user.email, currentPassword);
	if (authError) return { error: "La password attuale non è corretta" };

	const { error } = await supabase.auth.updateUser({ password: newPassword });
	if (error) return { error: error.message };

	return { success: true };
}

/* ------------------------------------------------------------------ */
/* Eliminazione account                                                */
/* ------------------------------------------------------------------ */

export async function deleteAccount(confirmEmail: string, password: string) {
	const { supabase, user } = await requireUser();
	if (!user?.email) return { error: "Non autenticato" };

	if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
		return { error: "L'email digitata non corrisponde al tuo account" };
	}

	// Gli account creati solo via OAuth non hanno password: per loro la conferma
	// è la sola digitazione dell'indirizzo.
	const hasPasswordIdentity = user.identities?.some((i) => i.provider === "email") ?? false;
	if (hasPasswordIdentity) {
		const authError = await reauthenticate(user.email, password);
		if (authError) return { error: "Password non corretta" };
	}

	// I file dell'avatar vanno rimossi QUI, con l'API storage. La funzione SQL
	// cancella le righe di storage.objects, che sono solo i metadati: i byte
	// resterebbero nel bucket per sempre, che è esattamente ciò che
	// l'eliminazione account deve evitare.
	await purgeAvatarFiles(supabase, user.id);

	// delete_current_user() è SECURITY DEFINER e cancella solo auth.uid():
	// evita di dover tenere la service_role key nel backend.
	// Vedi supabase/migrations/20260729_account_security.sql
	const { error } = await supabase.rpc("delete_current_user");
	if (error) return { error: error.message };

	await supabase.auth.signOut();
	revalidatePath("/", "layout");
	redirect("/welcome");
}

