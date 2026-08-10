"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getDictionary, syncLocaleFromProfile } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/format";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { SITE_URL } from "@/lib/site-url";

export async function login(_prevState: { error: string }, formData: FormData) {
	const supabase = await createClient();

	const data = {
		email: formData.get("email") as string,
		password: formData.get("password") as string,
	};

	const { data: { user }, error } = await supabase.auth.signInWithPassword(data);

	if (error) {
		const t = await getDictionary();
		return { error: t.auth.errors.wrongCredentials };
	}

	if (user) {
		const { data: profile } = await supabase
			.from("profiles")
			.select("currency, language")
			.eq("id", user.id)
			.single();
		// `language` viaggia con la query che c'era già per il gate dell'onboarding:
		// è il momento in cui la preferenza salvata sul profilo diventa la lingua di
		// questa sessione, ed è ciò che la rende valida su un dispositivo nuovo.
		await syncLocaleFromProfile(profile?.language);
		if (!profile?.currency) {
			redirect("/start");
		}
	}

	redirect("/");
}

export async function signup(
	_prevState: { error: string; emailSent: boolean; email: string },
	formData: FormData,
) {
	const supabase = await createClient();

	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	const confirmPassword = formData.get("confirm-password") as string;
	const privacy = formData.get("privacy");
	const t = await getDictionary();

	if (!privacy) {
		return { error: t.auth.errors.acceptTerms, emailSent: false, email: "" };
	}

	// La soglia arriva da PASSWORD_MIN_LENGTH: era scritta a mano sia nel
	// confronto sia nel messaggio, e le due potevano divergere in silenzio.
	if (password.length < PASSWORD_MIN_LENGTH) {
		return {
			error: fill(t.auth.errors.passwordTooShort, { n: PASSWORD_MIN_LENGTH }),
			emailSent: false,
			email: "",
		};
	}

	if (password !== confirmPassword) {
		return { error: t.auth.errors.passwordMismatch, emailSent: false, email: "" };
	}

	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			// Senza questo il link di conferma atterra sul Site URL, cioè "/", che
			// non scambia il `code`: l'utente finisce su /welcome senza sessione,
			// come se la conferma non fosse servita a niente. /callback lo scambia
			// e poi instrada a /start perché profiles.currency è ancora NULL.
			//
			// ⚠️ Quel "è ancora NULL" ha smesso di essere vero per cinque
			// settimane: dalla Fase 16 il trigger on_auth_user_created crea la
			// riga, e `currency` aveva `default 'EUR'` — quindi il gate di
			// /callback non scattava e chi confermava l'email (o entrava con
			// OAuth) saltava l'onboarding. Il default è stato rimosso dalla
			// migration 20260813; il commento torna a descrivere la realtà.
			emailRedirectTo: `${SITE_URL}/callback`,
			data: {
				name: formData.get("name") as string,
				surname: formData.get("surname") as string,
			},
		},
	});

	if (error) {
		return { error: error.message, emailSent: false, email: "" };
	}

	// Con la conferma email DISATTIVATA su Supabase, signUp restituisce già una
	// sessione: l'utente è loggato. Mostrargli "controlla la tua email" lo
	// lascerebbe fermo davanti a un messaggio per una mail che non arriverà mai.
	// Con la conferma attiva `session` è null e si passa al ramo successivo.
	if (data.session) {
		redirect("/start");
	}

	return { error: "", emailSent: true, email };
}

export async function signInWithGoogle() {
	const supabase = await createClient();

	const { data } = await supabase.auth.signInWithOAuth({
		provider: "google",
		options: {
			queryParams: {
				access_type: "offline",
				prompt: "consent",
			},
			redirectTo: `${SITE_URL}/callback`,
		},
	});
	if (data.url) {
		redirect(data.url);
	}
}

export async function signInWithFacebook() {
	const supabase = await createClient();

	const { data } = await supabase.auth.signInWithOAuth({
		provider: "facebook",
		options: {
			redirectTo: `${SITE_URL}/callback`,
		},
	});
	if (data.url) {
		redirect(data.url);
	}
}
